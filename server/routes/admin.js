import { Router } from 'express';
import { HttpError, requireAdmin } from '../http.js';
import { editableSnapshot, applyEdit, getPlace } from '../store.js';

const id = (req) => {
  if (!/^\d+$/.test(req.params.id)) throw new HttpError(404, 'Not found.');
  return Number(req.params.id);
};
const note = (req) => (typeof req.body?.note === 'string' ? req.body.note.trim().slice(0, 500) : '');

export function adminRoutes({ db }) {
  const r = Router();
  r.use(requireAdmin);

  r.get('/queue', (_req, res) => {
    const rows = (sql) => db.prepare(sql).all().map((x) => ({ ...x }));
    const places = rows(`SELECT p.id FROM places p WHERE p.status = 'pending' ORDER BY p.id`)
      .map((p) => getPlace(db, p.id));
    const benefits = rows(`SELECT b.*, u.name AS submitter FROM benefits b LEFT JOIN users u ON u.id = b.submitted_by
      WHERE b.status = 'pending' ORDER BY b.id`);
    const edits = rows(`SELECT e.*, u.name AS submitter FROM edit_requests e LEFT JOIN users u ON u.id = e.user_id
      WHERE e.status = 'pending' ORDER BY e.id`).map((e) => {
      const current = editableSnapshot(db, e.target_type, e.target_id);
      return { ...e, changes: JSON.parse(e.changes), current, missing: !current };
    });
    const names = new Map(db.prepare('SELECT id, name FROM users').all().map((u) => [u.id, u.name]));
    const contributorOf = db.prepare('SELECT contributor FROM places WHERE id = ?');
    for (const p of places) {
      p.submitter = names.get(p.submitted_by) ?? null;
      p.contributor = JSON.parse(contributorOf.get(p.id)?.contributor || '{}'); // moderators only
    }
    res.json({ places, benefits, edits });
  });

  const decide = (table, verb) => (req, res) => {
    const rowId = id(req);
    const status = verb === 'approve' ? 'approved' : 'rejected';
    const extra = table === 'benefits' && status === 'approved' ? ", last_verified = date('now')" : '';
    const info = db.prepare(`UPDATE ${table} SET status = ?, updated_at = datetime('now')${extra}
      WHERE id = ? AND status = 'pending'`).run(status, rowId);
    if (!info.changes) throw new HttpError(404, 'No pending item with that id.');
    res.json({ ok: true, status });
  };
  for (const verb of ['approve', 'reject']) {
    r.post(`/places/:id/${verb}`, decide('places', verb));
    r.post(`/benefits/:id/${verb}`, decide('benefits', verb));
  }

  r.post('/edits/:id/approve', (req, res) => {
    const edit = db.prepare("SELECT * FROM edit_requests WHERE id = ? AND status = 'pending'").get(id(req));
    if (!edit) throw new HttpError(404, 'No pending edit with that id.');
    applyEdit(db, edit, req.user.id, note(req));
    res.json({ ok: true });
  });

  r.post('/edits/:id/reject', (req, res) => {
    const info = db.prepare(`UPDATE edit_requests SET status='rejected', reviewed_by=?, review_note=?, reviewed_at=datetime('now')
      WHERE id = ? AND status = 'pending'`).run(req.user.id, note(req), id(req));
    if (!info.changes) throw new HttpError(404, 'No pending edit with that id.');
    res.json({ ok: true });
  });

  // Mark / unmark a place as business confirmed (partner_verified) or checked by our own team (hub_verified).
  r.patch('/places/:id', (req, res) => {
    const flags = [['partner_verified', 'verified_at'], ['hub_verified', 'hub_verified_at']].filter(([k]) => k in (req.body ?? {}));
    if (!flags.length) throw new HttpError(422, 'Send partner_verified or hub_verified.');
    for (const [k] of flags) if (typeof req.body[k] !== 'boolean') throw new HttpError(422, `${k} must be true or false.`);
    const checked = req.body.hub_checked ?? '';
    if (typeof checked !== 'string' || checked.length > 200) throw new HttpError(422, 'hub_checked must be text of 200 characters or fewer.');
    const sets = flags.map(([k, at]) => `${k} = ${req.body[k] ? 1 : 0}, ${at} = ${req.body[k] ? "date('now')" : 'NULL'}`);
    if ('hub_verified' in req.body) sets.push('hub_checked = ?');
    const args = 'hub_verified' in req.body ? [req.body.hub_verified ? checked.trim() : ''] : [];
    const info = db.prepare(`UPDATE places SET ${sets.join(', ')} WHERE id = ?`).run(...args, id(req));
    if (!info.changes) throw new HttpError(404, 'Place not found.');
    res.json({ ok: true });
  });

  r.delete('/reviews/:id', (req, res) => {
    const info = db.prepare('DELETE FROM reviews WHERE id = ?').run(id(req));
    if (!info.changes) throw new HttpError(404, 'Review not found.');
    res.json({ ok: true });
  });

  return r;
}
