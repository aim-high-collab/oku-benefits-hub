import { randomBytes, createHash, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);

export class HttpError extends Error {
  constructor(status, message, fields) {
    super(message);
    this.status = status;
    this.fields = fields;
  }
}

export const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// ---------- passwords & sessions ----------

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt, 64);
  return `scrypt$${salt.toString('hex')}$${key.toString('hex')}`;
}

const DUMMY_HASH = await hashPassword('dummy-password-for-timing');

export async function verifyPassword(password, stored) {
  const [scheme, saltHex, keyHex] = (stored || DUMMY_HASH).split('$');
  if (scheme !== 'scrypt') return false;
  const expected = Buffer.from(keyHex, 'hex');
  const actual = await scryptAsync(password, Buffer.from(saltHex, 'hex'), expected.length);
  return timingSafeEqual(actual, expected) && Boolean(stored);
}

const sha256 = (s) => createHash('sha256').update(s).digest('hex');
const SESSION_DAYS = 30;
const COOKIE = 'sid';

export function createSession(db, res, userId, config) {
  const token = randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + SESSION_DAYS * 864e5);
  db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)')
    .run(sha256(token), userId, expires.toISOString());
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.secureCookies,
    expires,
    path: '/',
  });
}

export function destroySession(db, req, res) {
  const token = readCookie(req, COOKIE);
  if (token) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha256(token));
  res.clearCookie(COOKIE, { path: '/' });
}

function readCookie(req, name) {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return null;
}

export function sessionMiddleware(db) {
  const find = db.prepare(`
    SELECT u.id, u.name, u.email, u.role FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ? AND s.expires_at > ?`);
  return (req, _res, next) => {
    req.user = null;
    const token = readCookie(req, COOKIE);
    if (token) {
      const row = find.get(sha256(token), new Date().toISOString());
      if (row) req.user = { ...row };
    }
    next();
  };
}

export const requireUser = (req, _res, next) =>
  req.user ? next() : next(new HttpError(401, 'Please log in to do that.'));

export const requireAdmin = (req, _res, next) => {
  if (!req.user) return next(new HttpError(401, 'Please log in to do that.'));
  if (req.user.role !== 'admin') return next(new HttpError(403, 'Moderator access only.'));
  next();
};

// ---------- request hygiene ----------

// Cookies are SameSite=Lax; additionally require JSON bodies (forces a CORS preflight
// cross-origin) and reject mismatched Origin headers on state-changing requests.
export function sameOriginWrites(req, _res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (!req.is('application/json')) return next(new HttpError(415, 'Expected a JSON request.'));
  const origin = req.headers.origin;
  if (origin) {
    let host;
    try { host = new URL(origin).host; } catch { host = null; }
    if (host !== req.headers.host) return next(new HttpError(403, 'Cross-origin request blocked.'));
  }
  next();
}

export function rateLimit({ windowMs, max }) {
  const hits = new Map();
  const timer = setInterval(() => {
    const cutoff = Date.now() - windowMs;
    for (const [k, arr] of hits) {
      const kept = arr.filter((t) => t > cutoff);
      if (kept.length) hits.set(k, kept); else hits.delete(k);
    }
  }, windowMs);
  timer.unref();
  return (req, _res, next) => {
    const now = Date.now();
    const arr = (hits.get(req.ip) || []).filter((t) => t > now - windowMs);
    if (arr.length >= max) return next(new HttpError(429, 'Too many requests. Please slow down and try again shortly.'));
    arr.push(now);
    hits.set(req.ip, arr);
    next();
  };
}

export function securityHeaders(req, res, next) {
  res.set({
    'Content-Security-Policy': [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self'",
      "img-src 'self' data: https://tile.openstreetmap.org https://*.tile.openstreetmap.org",
      "connect-src 'self' https://nominatim.openstreetmap.org",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'geolocation=(self), camera=(), microphone=()',
  });
  next();
}

export function errorHandler(err, _req, res, _next) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, fields: err.fields });
  }
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON.' });
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Request too large.' });
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on our side.' });
}
