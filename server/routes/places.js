import { Router } from 'express';
import { HttpError, requireUser } from '../http.js';
import { clean, cleanReason, PLACE_SPEC, CONTRIBUTOR_SPEC, CONTRIBUTOR_TYPES } from '../validate.js';
import { FEATURES, CATEGORIES, OFFER_KINDS, SOURCES, ACCESS_QUESTIONS } from '../meta.js';
import { listPlaces, getPlace, insertPlace, createEditRequest } from '../store.js';
import { tx } from '../db.js';
import { uploadExists } from '../uploads.js';

const int = (v) => (/^\d+$/.test(String(v)) ? Number(v) : null);

export function placeRoutes({ db, config, writeLimiter }) {
  const r = Router();

  r.get('/', (req, res) => {
    const q = String(req.query.q ?? '').trim().slice(0, 100);
    const category = Object.hasOwn(CATEGORIES, req.query.category) ? req.query.category : '';
    const kind = Object.hasOwn(OFFER_KINDS, req.query.kind) ? req.query.kind : '';
    const features = String(req.query.features ?? '').split(',').filter((f) => Object.hasOwn(FEATURES, f));
    res.json({ places: listPlaces(db, { q, category, kind, features }) });
  });

  // Loads a place the current user is allowed to see (approved, or their own/any for admins).
  const loadVisible = (req) => {
    const id = int(req.params.id);
    const place = id && getPlace(db, id);
    const canSee = place && (place.status === 'approved' || req.user?.role === 'admin' || place.submitted_by === req.user?.id);
    if (!canSee) throw new HttpError(404, 'Place not found.');
    return place;
  };

  r.get('/:id', (req, res) => res.json({ place: loadVisible(req) }));

  // Adding a place needs an account (email or Google). Every submission still waits for a moderator.
  r.post('/', requireUser, writeLimiter, (req, res) => {
    const data = clean(req.body, PLACE_SPEC);
    // contributor_type is who they say they are; it never marks the listing as confirmed by the business.
    const type = req.body?.contributor_type ?? '';
    if (type !== '' && !CONTRIBUTOR_TYPES.includes(type)) throw new HttpError(422, 'Please fix the highlighted fields.', { contributor_type: 'Choose who you are submitting as.' });
    const who = clean(req.body?.contributor, CONTRIBUTOR_SPEC);
    const source = type === 'business' ? 'owner' : req.body?.source ?? '';
    if (source !== '' && !Object.hasOwn(SOURCES, source)) throw new HttpError(422, 'Please fix the highlighted fields.', { source: 'Choose how you know about this place.' });
    if (type === 'community' && source === 'owner') throw new HttpError(422, 'Please fix the highlighted fields.', { source: 'Choose how you know about this place.' });
    if (type === 'business') {
      const missing = {};
      if (who.rep_name.length < 2) missing.rep_name = 'Enter your name.';
      if (who.rep_contact.length < 5) missing.rep_contact = 'Enter an email or phone number we can reach you on.';
      if (Object.keys(missing).length) throw new HttpError(422, 'Please fix the highlighted fields.', missing);
    }
    if (!uploadExists(config.uploadDir, data.image)) throw new HttpError(422, 'Upload the photo again.', { image: 'Upload the photo again.' });
    if (!data.offers.length && !data.accessibility.length) {
      throw new HttpError(422, 'Add at least one OKU offer or one accessibility feature.', {
        offers: 'Add at least one offer, or tick an accessibility feature.',
      });
    }
    const isAdmin = req.user?.role === 'admin';
    const id = insertPlace(db, data, {
      userId: req.user.id,
      status: isAdmin ? 'approved' : 'pending',
      isOwner: type === 'business' || (type === '' && (req.body?.is_owner === true || source === 'owner')),
      source,
    });
    const { source_url: sourceUrl, ...details } = who;
    // keep only the fields that belong to the chosen type (community: their experience; business: name, role, contact)
    const fits = (k) => (type === 'business' ? k.startsWith('rep_') : k === 'note');
    const kept = Object.fromEntries(Object.entries(details).filter(([k, v]) => v && fits(k)));
    db.prepare('UPDATE places SET source_url = ?, contributor = ? WHERE id = ?')
      .run(sourceUrl, JSON.stringify(type ? { type, ...kept } : kept), id);
    res.status(201).json({ id, status: isAdmin ? 'approved' : 'pending' });
  });

  r.post('/:id/edits', requireUser, writeLimiter, (req, res) => {
    const place = loadVisible(req);
    if (place.status !== 'approved') throw new HttpError(409, 'This listing is still awaiting review.');
    const changes = clean(req.body?.changes, PLACE_SPEC, { partial: true });
    if (!uploadExists(config.uploadDir, changes.image)) throw new HttpError(422, 'Upload the photo again.', { image: 'Upload the photo again.' });
    if (!Object.keys(changes).length) throw new HttpError(422, 'You have not changed anything.');
    const reason = cleanReason(req.body?.reason);
    const id = createEditRequest(db, { type: 'place', id: place.id, user: req.user, changes, reason });
    res.status(201).json({ id, status: 'pending' });
  });

  // ---------- "Did it work?" (no account needed) ----------

  r.post('/:id/visits', writeLimiter, (req, res) => {
    const place = loadVisible(req);
    if (place.status !== 'approved') throw new HttpError(409, 'This listing is still awaiting review.');
    const worked = req.body?.worked;
    if (!['yes', 'no', 'partly'].includes(worked)) throw new HttpError(422, 'Choose yes, no or partly.', { worked: 'Choose yes, no or partly.' });
    db.prepare('INSERT INTO visits (place_id, worked) VALUES (?, ?)').run(place.id, worked);
    const p = getPlace(db, place.id);
    res.status(201).json({ visits_yes: p.visits_yes, visits_no: p.visits_no, visits_partly: p.visits_partly, last_visit_at: p.last_visit_at, last_used_at: p.last_used_at });
  });

  // Quick accessibility questions after a visit: { answers: { step_free_entry: 'yes', ... } }. No account needed.
  r.post('/:id/access', writeLimiter, (req, res) => {
    const place = loadVisible(req);
    if (place.status !== 'approved') throw new HttpError(409, 'This listing is still awaiting review.');
    const answers = req.body?.answers;
    const entries = answers && typeof answers === 'object' && !Array.isArray(answers) ? Object.entries(answers) : [];
    if (!entries.length || entries.length > Object.keys(ACCESS_QUESTIONS).length
      || entries.some(([f, a]) => !Object.hasOwn(ACCESS_QUESTIONS, f) || !['yes', 'no'].includes(a))) {
      throw new HttpError(422, 'Answer yes or no to at least one question.');
    }
    const ins = db.prepare('INSERT INTO access_reports (place_id, feature, answer) VALUES (?, ?, ?)');
    tx(db, () => { for (const [f, a] of entries) ins.run(place.id, f, a); });
    res.status(201).json({ access_reports: getPlace(db, place.id).access_reports });
  });

  // ---------- reviews ----------

  r.get('/:id/reviews', (req, res) => {
    const place = loadVisible(req);
    const reviews = db.prepare(`SELECT r.id, r.rating, r.access_rating, r.discount_honoured, r.body, r.created_at,
        u.name AS author FROM reviews r JOIN users u ON u.id = r.user_id
        WHERE r.place_id = ? ORDER BY r.created_at DESC, r.id DESC LIMIT 200`).all(place.id);
    res.json({ reviews: reviews.map((x) => ({ ...x })) });
  });

  r.post('/:id/reviews', requireUser, writeLimiter, (req, res) => {
    const place = loadVisible(req);
    if (place.status !== 'approved') throw new HttpError(409, 'This listing is still awaiting review.');
    const b = req.body ?? {};
    const errors = {};
    const rating = Number.isInteger(b.rating) && b.rating >= 1 && b.rating <= 5 ? b.rating : null;
    if (!rating) errors.rating = 'Choose a rating from 1 to 5.';
    let access = null;
    if (b.access_rating != null && b.access_rating !== '') {
      access = Number.isInteger(b.access_rating) && b.access_rating >= 1 && b.access_rating <= 5 ? b.access_rating : null;
      if (!access) errors.access_rating = 'Choose an accessibility rating from 1 to 5.';
    }
    const honoured = ['yes', 'no', 'not_tried'].includes(b.discount_honoured) ? b.discount_honoured : 'not_tried';
    const body = typeof b.body === 'string' ? b.body.trim() : '';
    if (body.length > 1000) errors.body = 'Review must be at most 1000 characters.';
    if (Object.keys(errors).length) throw new HttpError(422, 'Please fix the highlighted fields.', errors);

    db.prepare(`INSERT INTO reviews (place_id, user_id, rating, access_rating, discount_honoured, body)
      VALUES (?,?,?,?,?,?)
      ON CONFLICT (place_id, user_id) DO UPDATE SET rating = excluded.rating, access_rating = excluded.access_rating,
        discount_honoured = excluded.discount_honoured, body = excluded.body, created_at = datetime('now')`)
      .run(place.id, req.user.id, rating, access, honoured, body);
    res.status(201).json({ ok: true });
  });

  return r;
}
