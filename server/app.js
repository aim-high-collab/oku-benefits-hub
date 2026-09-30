import express from 'express';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  sessionMiddleware, sameOriginWrites, securityHeaders, errorHandler, rateLimit, HttpError,
} from './http.js';
import { meta } from './meta.js';
import { authRoutes } from './routes/auth.js';
import { placeRoutes } from './routes/places.js';
import { benefitRoutes } from './routes/benefits.js';
import { accountRoutes } from './routes/account.js';
import { adminRoutes } from './routes/admin.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const fontDir = (pkg) => join(dirname(createRequire(import.meta.url).resolve(`${pkg}/package.json`)), 'files');
const leafletDist = join(dirname(createRequire(import.meta.url).resolve('leaflet/package.json')), 'dist');

export function createApp({ db, config }) {
  const app = express();
  app.disable('x-powered-by');
  if (config.trustProxy) app.set('trust proxy', config.trustProxy);
  app.use(securityHeaders);

  const scale = config.rateLimitScale ?? 1;
  const authLimiter = rateLimit({ windowMs: 60_000, max: 10 * scale });
  const writeLimiter = rateLimit({ windowMs: 60_000, max: 30 * scale });
  const deps = { db, config, authLimiter, writeLimiter };

  app.use('/api', express.json({ limit: '100kb' }), sameOriginWrites, sessionMiddleware(db));
  app.get('/api/meta', (_req, res) => res.json(meta()));
  app.use('/api/auth', authRoutes(deps));
  app.use('/api/places', placeRoutes(deps));
  app.use('/api/benefits', benefitRoutes(deps));
  app.use('/api/me', accountRoutes(deps));
  app.use('/api/admin', adminRoutes(deps));
  app.use('/api', (_req, _res, next) => next(new HttpError(404, 'Not found.')));

  app.use('/vendor/leaflet', express.static(leafletDist, { maxAge: '7d' }));
  app.use('/vendor/inter', express.static(fontDir('@fontsource-variable/inter'), { maxAge: '30d', immutable: true }));
  app.use(express.static(join(root, 'public')));
  // SPA uses hash routing, so unknown non-API paths are simply 404.
  app.use(errorHandler);
  return app;
}
