import { Router, json } from 'express';
import { randomBytes } from 'node:crypto';
import { mkdirSync, existsSync, writeFileSync } from 'node:fs';
import { join, basename } from 'node:path';
import { HttpError, requireUser, sameOriginWrites, sessionMiddleware } from './http.js';

const MAX_BYTES = 2 * 1024 * 1024;

function sniff(buf) {
  if (buf.length > 12 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (buf.length > 12 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buf.length > 12 && buf.subarray(0, 4).toString() === 'RIFF' && buf.subarray(8, 12).toString() === 'WEBP') return 'webp';
  return null;
}

/** True if `path` ("/uploads/<name>") points at a file we stored. */
export const uploadExists = (uploadDir, path) => !path || existsSync(join(uploadDir, basename(path)));

export function uploadRoutes({ db, config, writeLimiter }) {
  mkdirSync(config.uploadDir, { recursive: true });
  const r = Router();
  // Own (larger) body limit; mounted before the app-wide 100kb JSON parser.
  r.use(json({ limit: '3mb' }), sameOriginWrites, sessionMiddleware(db));

  r.post('/', requireUser, writeLimiter, (req, res) => {
    const m = /^data:image\/(?:jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(req.body?.image ?? '');
    if (!m) throw new HttpError(422, 'Choose a JPEG, PNG or WebP photo.');
    const buf = Buffer.from(m[1], 'base64');
    if (buf.length > MAX_BYTES) throw new HttpError(413, 'That photo is too large (2 MB maximum).');
    const ext = sniff(buf);
    if (!ext) throw new HttpError(422, 'That file is not a valid JPEG, PNG or WebP image.');
    const name = `${randomBytes(16).toString('hex')}.${ext}`;
    writeFileSync(join(config.uploadDir, name), buf);
    res.status(201).json({ path: `/uploads/${name}` });
  });
  return r;
}
