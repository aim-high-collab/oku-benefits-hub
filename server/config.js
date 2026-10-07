import { randomBytes } from 'node:crypto';
import { dirname, join } from 'node:path';

export function loadConfig(env = process.env) {
  const production = env.NODE_ENV === 'production';
  return {
    port: Number(env.PORT) || 3000,
    dbPath: env.DB_PATH || 'data/oku.db',
    uploadDir: env.UPLOAD_DIR || join(dirname(env.DB_PATH || 'data/oku.db'), 'uploads'),
    production,
    secureCookies: production && env.INSECURE_COOKIES !== '1',
    trustProxy: env.TRUST_PROXY || false,
    adminEmail: env.ADMIN_EMAIL || '',
    adminPassword: env.ADMIN_PASSWORD || '',
    // Browser key for the Maps JavaScript API (+ Places API (New) for address search). Unset: OpenStreetMap.
    googleMapsKey: env.GOOGLE_MAPS_API_KEY || '',
    // Advanced markers need a map ID; DEMO_MAP_ID works for testing, create your own for production.
    googleMapId: env.GOOGLE_MAPS_MAP_ID || 'DEMO_MAP_ID',
    generatePassword: () => randomBytes(9).toString('base64url'),
  };
}
