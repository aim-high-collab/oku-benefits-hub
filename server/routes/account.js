import { Router } from 'express';
import { HttpError, requireUser } from '../http.js';
import { getPlace } from '../store.js';

export function accountRoutes({ db }) {
  const r = Router();
  r.use(requireUser);

  r.get('/submissions', (req, res) => {
    const all = (sql) => db.prepare(sql).all(req.user.id).map((x) => ({ ...x }));
    res.json({
      places: all(`SELECT id, name, status, created_at FROM places WHERE submitted_by = ? ORDER BY id DESC`),
      benefits: all(`SELECT id, title, status, created_at FROM benefits WHERE submitted_by = ? ORDER BY id DESC`),
      edits: all(`SELECT e.id, e.target_type, e.target_id, e.status, e.review_note, e.created_at,
          COALESCE(p.name, b.title) AS target_name
        FROM edit_requests e
        LEFT JOIN places p ON e.target_type = 'place' AND p.id = e.target_id
        LEFT JOIN benefits b ON e.target_type = 'benefit' AND b.id = e.target_id
        WHERE e.user_id = ? ORDER BY e.id DESC`),
    });
  });

  // Saved places, newest first. Only approved places show; a place that is later hidden simply drops out.
  r.get('/saved', (req, res) => {
    const ids = db.prepare('SELECT place_id FROM saved_places WHERE user_id = ? ORDER BY created_at DESC, rowid DESC').all(req.user.id);
    res.json({ places: ids.map(({ place_id }) => getPlace(db, place_id)).filter((p) => p?.status === 'approved') });
  });

  r.put('/saved/:id', (req, res) => {
    const place = getPlace(db, Number(req.params.id));
    if (!place || place.status !== 'approved') throw new HttpError(404, 'Place not found.');
    db.prepare('INSERT OR IGNORE INTO saved_places (user_id, place_id) VALUES (?, ?)').run(req.user.id, place.id);
    res.json({ saved: true });
  });

  r.delete('/saved/:id', (req, res) => {
    db.prepare('DELETE FROM saved_places WHERE user_id = ? AND place_id = ?').run(req.user.id, Number(req.params.id));
    res.json({ saved: false });
  });

  return r;
}
