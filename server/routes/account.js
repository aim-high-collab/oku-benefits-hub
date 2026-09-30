import { Router } from 'express';
import { requireUser } from '../http.js';

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

  return r;
}
