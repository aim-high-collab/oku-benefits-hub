import { Router } from 'express';
import { HttpError, wrap, hashPassword, verifyPassword, createSession, destroySession } from '../http.js';
import { verifyGoogleToken } from '../google.js';
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
    if (row && !row.password_hash) throw new HttpError(401, 'This account uses Google. Choose “Continue with Google”.');
    const ok = await verifyPassword(password, row?.password_hash);
    if (!row || !ok) throw new HttpError(401, 'Email or password is incorrect.');
    createSession(db, res, row.id, config);
    res.json({ user: { id: row.id, name: row.name, email: row.email, role: row.role } });
  }));

  // "Continue with Google": the browser sends Google's signed ID token; we check it with Google, then log in
  // the account with that email, creating one the first time. Google-only accounts have no password.
  r.post('/google', authLimiter, wrap(async (req, res) => {
    if (!config.googleClientId) throw new HttpError(404, 'Google sign-in is not set up.');
    const credential = req.body?.credential;
    if (typeof credential !== 'string' || !credential) throw new HttpError(422, 'Missing Google credential.');
    const verify = config.verifyGoogleToken ?? verifyGoogleToken;
    const g = await verify(credential, config.googleClientId);
    if (!g) throw new HttpError(401, 'Google sign-in failed. Please try again.');
    const email = g.email.toLowerCase();
    let row = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    let status = 200;
    if (!row) {
      const name = (g.name || email.split('@')[0]).slice(0, 50);
      const info = db.prepare("INSERT INTO users (name, email, password_hash) VALUES (?, ?, '')").run(name, email);
      row = { id: Number(info.lastInsertRowid), name, email, role: 'user' };
      status = 201;
    }
    createSession(db, res, row.id, config);
    res.status(status).json({ user: { id: row.id, name: row.name, email: row.email, role: row.role } });
  }));

  r.post('/logout', (req, res) => {
    destroySession(db, req, res);
    res.json({ ok: true });
  });

  r.get('/me', (req, res) => res.json({ user: req.user }));

  return r;
}
