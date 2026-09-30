// Data access helpers shared by routes.
import { tx } from './db.js';
import { HttpError } from './http.js';

const PLACE_COLS = ['name', 'category', 'description', 'address', 'city', 'state', 'lat', 'lng', 'phone', 'website'];
const BENEFIT_COLS = ['title', 'agency', 'category', 'summary', 'eligibility', 'how_to_apply', 'url'];

export const parsePlace = (row) => row && {
  ...row,
  accessibility: JSON.parse(row.accessibility),
  submitter_is_owner: Boolean(row.submitter_is_owner),
  partner_verified: Boolean(row.partner_verified),
  is_demo: Boolean(row.is_demo),
};

const placeholders = (n) => Array(n).fill('?').join(',');

const STATS_SQL = `
  (SELECT ROUND(AVG(rating), 1) FROM reviews r WHERE r.place_id = places.id) AS avg_rating,
  (SELECT COUNT(*) FROM reviews r WHERE r.place_id = places.id) AS review_count,
  (SELECT COUNT(*) FROM reviews r WHERE r.place_id = places.id AND discount_honoured = 'yes') AS honoured_yes,
  (SELECT COUNT(*) FROM reviews r WHERE r.place_id = places.id AND discount_honoured = 'no') AS honoured_no`;

export function attachOffers(db, places) {
  if (!places.length) return places;
  const rows = db.prepare(`SELECT * FROM offers WHERE place_id IN (${placeholders(places.length)}) ORDER BY id`)
    .all(...places.map((p) => p.id));
  const byPlace = new Map();
  for (const o of rows) {
    if (!byPlace.has(o.place_id)) byPlace.set(o.place_id, []);
    byPlace.get(o.place_id).push({ ...o });
  }
  for (const p of places) p.offers = byPlace.get(p.id) || [];
  return places;
}

export function listPlaces(db, { q, category, kind, features = [], status = 'approved', limit = 500 }) {
  const where = ['places.status = ?'];
  const args = [status];
  if (q) {
    const like = `%${q.replace(/[\\%_]/g, '\\$&')}%`;
    where.push(`(places.name LIKE ? ESCAPE '\\' OR places.address LIKE ? ESCAPE '\\' OR places.city LIKE ? ESCAPE '\\'
      OR places.description LIKE ? ESCAPE '\\'
      OR EXISTS (SELECT 1 FROM offers o WHERE o.place_id = places.id AND (o.title LIKE ? ESCAPE '\\' OR o.value_text LIKE ? ESCAPE '\\')))`);
    args.push(like, like, like, like, like, like);
  }
  if (category) { where.push('places.category = ?'); args.push(category); }
  if (kind) { where.push('EXISTS (SELECT 1 FROM offers o WHERE o.place_id = places.id AND o.kind = ?)'); args.push(kind); }
  for (const f of features) {
    where.push('EXISTS (SELECT 1 FROM json_each(places.accessibility) j WHERE j.value = ?)');
    args.push(f);
  }
  const rows = db.prepare(`SELECT places.*, ${STATS_SQL} FROM places WHERE ${where.join(' AND ')}
    ORDER BY partner_verified DESC, places.name COLLATE NOCASE LIMIT ?`).all(...args, limit);
  return attachOffers(db, rows.map((r) => parsePlace(r)));
}

export function getPlace(db, id) {
  const row = db.prepare(`SELECT places.*, ${STATS_SQL} FROM places WHERE id = ?`).get(id);
  if (!row) return null;
  return attachOffers(db, [parsePlace(row)])[0];
}

export function insertOffers(db, placeId, offers) {
  const ins = db.prepare('INSERT INTO offers (place_id, title, kind, value_text, conditions) VALUES (?,?,?,?,?)');
  for (const o of offers) ins.run(placeId, o.title, o.kind, o.value_text, o.conditions);
}

export function insertPlace(db, data, { userId, status, isOwner = false, isDemo = false, partnerVerified = false }) {
  return tx(db, () => {
    const res = db.prepare(`INSERT INTO places (${PLACE_COLS.join(',')}, accessibility, status, submitter_is_owner,
        partner_verified, is_demo, submitted_by) VALUES (${placeholders(PLACE_COLS.length + 6)})`)
      .run(...PLACE_COLS.map((c) => data[c]), JSON.stringify(data.accessibility), status,
        isOwner ? 1 : 0, partnerVerified ? 1 : 0, isDemo ? 1 : 0, userId ?? null);
    const id = Number(res.lastInsertRowid);
    insertOffers(db, id, data.offers);
    return id;
  });
}

export function insertBenefit(db, data, { userId, status, lastVerified = null }) {
  const res = db.prepare(`INSERT INTO benefits (${BENEFIT_COLS.join(',')}, status, submitted_by, last_verified)
    VALUES (${placeholders(BENEFIT_COLS.length + 3)})`)
    .run(...BENEFIT_COLS.map((c) => data[c]), status, userId ?? null, lastVerified);
  return Number(res.lastInsertRowid);
}

export const getBenefit = (db, id) => db.prepare('SELECT * FROM benefits WHERE id = ?').get(id) || null;

// ---------- edit requests ----------

const offersKey = (list) => JSON.stringify(list.map((o) => [o.title, o.kind, o.value_text, o.conditions]));

/** Current values of the editable fields, in the same shape as an edit-request `changes` object. */
export function editableSnapshot(db, type, id) {
  if (type === 'place') {
    const p = getPlace(db, id);
    if (!p) return null;
    const snap = Object.fromEntries([...PLACE_COLS, 'accessibility', 'offers'].map((c) => [c, p[c]]));
    snap.offers = p.offers.map(({ title, kind, value_text, conditions }) => ({ title, kind, value_text, conditions }));
    return snap;
  }
  const b = getBenefit(db, id);
  return b && Object.fromEntries(BENEFIT_COLS.map((c) => [c, b[c]]));
}

// Feature lists are sets: order must not turn an untouched form into an "edit".
const same = (key, a, b) => {
  if (key === 'offers') return offersKey(a) === offersKey(b);
  if (key === 'accessibility') return JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
  return JSON.stringify(a) === JSON.stringify(b);
};

export function createEditRequest(db, { type, id, user, changes, reason }) {
  const current = editableSnapshot(db, type, id);
  if (!current) throw new HttpError(404, 'That listing was not found.');
  const effective = {};
  for (const [k, v] of Object.entries(changes)) if (!same(k, v, current[k])) effective[k] = v;
  if (!Object.keys(effective).length) throw new HttpError(422, 'You have not changed anything.');
  const res = db.prepare('INSERT INTO edit_requests (target_type, target_id, user_id, changes, reason) VALUES (?,?,?,?,?)')
    .run(type, id, user.id, JSON.stringify(effective), reason);
  return Number(res.lastInsertRowid);
}

export function applyEdit(db, edit, adminId, note) {
  const changes = JSON.parse(edit.changes);
  tx(db, () => {
    const cols = edit.target_type === 'place' ? PLACE_COLS : BENEFIT_COLS;
    const table = edit.target_type === 'place' ? 'places' : 'benefits';
    const sets = [];
    const args = [];
    for (const c of cols) if (c in changes) { sets.push(`${c} = ?`); args.push(changes[c]); }
    if (edit.target_type === 'place' && 'accessibility' in changes) {
      sets.push('accessibility = ?');
      args.push(JSON.stringify(changes.accessibility));
    }
    if (edit.target_type === 'benefit') { sets.push("last_verified = date('now')"); }
    sets.push("updated_at = datetime('now')");
    const res = db.prepare(`UPDATE ${table} SET ${sets.join(', ')} WHERE id = ?`).run(...args, edit.target_id);
    if (!res.changes) throw new HttpError(404, 'The listing no longer exists.');
    if (edit.target_type === 'place' && 'offers' in changes) {
      db.prepare('DELETE FROM offers WHERE place_id = ?').run(edit.target_id);
      insertOffers(db, edit.target_id, changes.offers);
    }
    db.prepare(`UPDATE edit_requests SET status='approved', reviewed_by=?, review_note=?, reviewed_at=datetime('now')
      WHERE id = ?`).run(adminId, note, edit.id);
  });
}
