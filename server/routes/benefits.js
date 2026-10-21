import { Router } from 'express';
import { HttpError, requireUser } from '../http.js';
import { clean, cleanReason, BENEFIT_SPEC } from '../validate.js';
import { BENEFIT_CATEGORIES } from '../meta.js';
import { getBenefit, insertBenefit, createEditRequest } from '../store.js';

export function benefitRoutes({ db, writeLimiter }) {
  const r = Router();

  r.get('/', (req, res) => {
    const where = ["status = 'approved'"];
    const args = [];
    const q = String(req.query.q ?? '').trim().slice(0, 100);
    if (q) {
      const like = `%${q.replace(/[\\%_]/g, '\\$&')}%`;
      where.push(`(title LIKE ? ESCAPE '\\' OR agency LIKE ? ESCAPE '\\' OR summary LIKE ? ESCAPE '\\')`);
      args.push(like, like, like);
    }
    if (Object.hasOwn(BENEFIT_CATEGORIES, req.query.category)) {
      where.push('category = ?');
      args.push(req.query.category);
    }
    const rows = db.prepare(`SELECT * FROM benefits WHERE ${where.join(' AND ')} ORDER BY title COLLATE NOCASE`).all(...args);
    res.json({ benefits: rows.map((x) => ({ ...x })) });
  });

  const load = (req) => {
    const b = /^\d+$/.test(req.params.id) && getBenefit(db, Number(req.params.id));
    if (!b || (b.status !== 'approved' && b.submitted_by !== req.user?.id && req.user?.role !== 'admin')) {
      throw new HttpError(404, 'Benefit not found.');
    }
    return b;
  };

  r.get('/:id', (req, res) => res.json({ benefit: { ...load(req) } }));

  r.post('/', requireUser, writeLimiter, (req, res) => {
    const data = clean(req.body, BENEFIT_SPEC);
    const isAdmin = req.user.role === 'admin';
    const id = insertBenefit(db, data, {
      userId: req.user.id,
      status: isAdmin ? 'approved' : 'pending',
      lastVerified: isAdmin ? new Date().toISOString().slice(0, 10) : null,
    });
    res.status(201).json({ id, status: isAdmin ? 'approved' : 'pending' });
  });

  r.post('/:id/edits', requireUser, writeLimiter, (req, res) => {
    const benefit = load(req);
    if (benefit.status !== 'approved') throw new HttpError(409, 'This entry is still awaiting review.');
    const changes = clean(req.body?.changes, BENEFIT_SPEC, { partial: true });
    if (!Object.keys(changes).length) throw new HttpError(422, 'You have not changed anything.');
    const reason = cleanReason(req.body?.reason);
    const id = createEditRequest(db, { type: 'benefit', id: benefit.id, user: req.user, changes, reason });
    res.status(201).json({ id, status: 'pending' });
  });

  return r;
}
