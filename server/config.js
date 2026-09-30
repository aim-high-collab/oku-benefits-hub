import { randomBytes } from 'node:crypto';

export function loadConfig(env = process.env) {
  const production = env.NODE_ENV === 'production';
  return {
    port: Number(env.PORT) || 3000,
    dbPath: env.DB_PATH || 'data/oku.db',
    production,
    secureCookies: production && env.INSECURE_COOKIES !== '1',
    trustProxy: env.TRUST_PROXY || false,
    seedDemo: env.SEED_DEMO === '1',
    adminEmail: env.ADMIN_EMAIL || '',
    adminPassword: env.ADMIN_PASSWORD || '',
    generatePassword: () => randomBytes(9).toString('base64url'),
  };
}
