import { Router } from 'express';
import { HttpError, wrap, hashPassword, verifyPassword, createSession, destroySession } from '../http.js';
import { cleanCredentials } from '../validate.js';

export function authRoutes({ db, config, authLimiter }) {
  const r = Router();

  r.post('/register', authLimiter, wrap(async (req, res) => {
    const { email, password, name } = cleanCredentials(req.body, { withName: true });
    if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) {
      throw new HttpError(409, 'An account with that email already exists.', { email: 'Already registered — try logging in.' });
    }
    const hash = await hashPassword(password);
    const info = db.prepare('INSERT INTO users (name, email, password_hash) VALUES (?,?,?)').run(name, email, hash);
    const id = Number(info.lastInsertRowid);
    createSession(db, res, id, config);
    res.status(201).json({ user: { id, name, email, role: 'user' } });
  }));

  r.post('/login', authLimiter, wrap(async (req, res) => {
    const { email, password } = cleanCredentials(req.body, { withName: false });
    const row = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    const ok = await verifyPassword(password, row?.password_hash);
    if (!row || !ok) throw new HttpError(401, 'Email or password is incorrect.');
    createSession(db, res, row.id, config);
    res.json({ user: { id: row.id, name: row.name, email: row.email, role: row.role } });
  }));

  r.post('/logout', (req, res) => {
    destroySession(db, req, res);
    res.json({ ok: true });
  });

  r.get('/me', (req, res) => res.json({ user: req.user }));

  return r;
}
