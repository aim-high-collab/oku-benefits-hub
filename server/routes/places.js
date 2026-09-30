import { Router } from 'express';
import { HttpError, requireUser } from '../http.js';
import { clean, cleanReason, PLACE_SPEC } from '../validate.js';
import { FEATURES, CATEGORIES, OFFER_KINDS } from '../meta.js';
import { listPlaces, getPlace, insertPlace, createEditRequest } from '../store.js';
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

  r.post('/', requireUser, writeLimiter, (req, res) => {
    const data = clean(req.body, PLACE_SPEC);
    if (!uploadExists(config.uploadDir, data.image)) throw new HttpError(422, 'Upload the photo again.', { image: 'Upload the photo again.' });
    if (!data.offers.length && !data.accessibility.length) {
      throw new HttpError(422, 'Add at least one OKU offer or one accessibility feature.', {
        offers: 'Add at least one offer, or tick an accessibility feature.',
      });
    }
    const isAdmin = req.user.role === 'admin';
    const id = insertPlace(db, data, {
      userId: req.user.id,
      status: isAdmin ? 'approved' : 'pending',
      isOwner: req.body?.is_owner === true,
    });
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
