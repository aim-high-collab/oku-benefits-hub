import { openDb } from './db.js';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { hashPassword } from './http.js';
import { seedBenefits, seedPlaces, purgeLegacyDemoPlaces } from './seed.js';

const config = loadConfig();
const db = openDb(config.dbPath);

async function ensureAdmin() {
  if (db.prepare("SELECT 1 FROM users WHERE role = 'admin'").get()) return;
  if (config.production && !(config.adminEmail && config.adminPassword)) {
    console.warn('No moderator account exists. Set ADMIN_EMAIL and ADMIN_PASSWORD to create one.');
    return;
  }
  const email = (config.adminEmail || 'admin@example.com').toLowerCase();
  const password = config.adminPassword || config.generatePassword();
  db.prepare("INSERT INTO users (name, email, password_hash, role) VALUES ('Moderator', ?, ?, 'admin')")
    .run(email, await hashPassword(password));
  console.log(`Created moderator account: ${email}${config.adminPassword ? '' : `  password: ${password}`}`);
}

await ensureAdmin();
const nBenefits = seedBenefits(db);
if (nBenefits) console.log(`Seeded ${nBenefits} government benefit entries (unverified starting points).`);
const nPurged = purgeLegacyDemoPlaces(db);
if (nPurged) console.log(`Removed ${nPurged} legacy placeholder places.`);
const nPlaces = seedPlaces(db);
if (nPlaces) console.log(`Added ${nPlaces} researched attractions (details not yet confirmed with the venues).`);

createApp({ db, config }).listen(config.port, () => {
  console.log(`OKU Benefits Hub running at http://localhost:${config.port}`);
});
