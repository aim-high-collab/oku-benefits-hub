// Made-up members, businesses and places so a fresh prototype shows every part of the app: all three trust labels,
// business-owned listings, reviews, "N visitors got the OKU offer" counts and saved places.
// None of these places exist. Every sample account uses an @sample.okuhub.test address, which is how they are
// found again and removed (SAMPLE_DATA=0, and by default in production).
import { hashPassword } from './http.js';
import { insertPlace } from './store.js';

export const SAMPLE_DOMAIN = 'sample.okuhub.test';
export const SAMPLE_PASSWORD = 'sample-pass-123';
const NOTE = 'Sample listing for trying out the prototype. This business is made up, so please don’t visit it.';

const USERS = [
  { key: 'aisyah', name: 'Aisyah (sample member)' },
  { key: 'ravi', name: 'Ravi (sample member)' },
  { key: 'siewling', name: 'Siew Ling (sample member)' },
  { key: 'farid', name: 'Farid, Kopi Kawan (sample business)' },
  { key: 'meiling', name: 'Mei Ling, Pelangi Books (sample business)' },
];

// trust: hub = checked by our team, business = confirmed by the business, community = shared by a member.
const PLACES = [
  {
    by: 'farid', owner: true, trust: 'business', verifiedAt: '2026-10-10',
    name: 'Kopi Kawan Café', category: 'cafe', address: 'Sample address, Bangsar', city: 'Kuala Lumpur', state: 'W.P. Kuala Lumpur',
    lat: 3.1295, lng: 101.6788, description: `Neighbourhood café with roomy seating and staff who are happy to read out the menu. ${NOTE}`,
    accessibility: ['step_free_entry', 'trained_staff'],
    offers: [{ title: '10% off food and drinks for OKU cardholders', kind: 'discount', value_text: '10% off', conditions: 'Show your OKU card when you order.' }],
    visits: ['yes', 'yes', 'yes', 'partly'], reviews: { aisyah: [5, 'Friendly staff, and the discount was given without any fuss.'] },
  },
  {
    by: 'aisyah', trust: 'hub', hubAt: '2026-10-14', hubChecked: 'Priority queue, ramp and accessible toilet, by visit',
    name: 'Senyum Dental Clinic', category: 'healthcare', address: 'Sample address, SS2', city: 'Petaling Jaya', state: 'Selangor',
    lat: 3.1188, lng: 101.6229, description: `Family dental clinic on the ground floor, with a ramp from the car park. ${NOTE}`,
    accessibility: ['ramp', 'accessible_toilet', 'oku_parking'],
    offers: [{ title: 'Priority appointment slots for OKU patients', kind: 'priority', value_text: '', conditions: 'Mention your OKU card when you book by phone.' }],
    visits: ['yes', 'yes'], reviews: { ravi: [4, 'Booked a priority slot and was seen on time.'] },
  },
  {
    by: 'meiling', owner: true, trust: 'business', verifiedAt: '2026-10-08',
    name: 'Pelangi Books', category: 'retail', address: 'Sample address, Seksyen 14', city: 'Shah Alam', state: 'Selangor',
    lat: 3.0733, lng: 101.5185, description: `Independent bookshop with wide aisles and a quiet reading corner. ${NOTE}`,
    accessibility: ['wide_aisles', 'quiet_space'],
    offers: [{ title: 'Free tote bag with any purchase for OKU cardholders', kind: 'freebie', value_text: '', conditions: 'While stocks last. Show your OKU card at the counter.' }],
    visits: ['yes'], reviews: {},
  },
  {
    by: 'ravi', trust: 'hub', hubAt: '2026-10-16', hubChecked: 'Free carer entry and quiet room, by phone with the manager',
    name: 'Taman Ceria Play Centre', category: 'entertainment', address: 'Sample address, Taman Connaught', city: 'Kuala Lumpur', state: 'W.P. Kuala Lumpur',
    lat: 3.0846, lng: 101.7386, description: `Indoor play centre for children, with a calm room for breaks from the noise. ${NOTE}`,
    accessibility: ['step_free_entry', 'quiet_space', 'trained_staff'],
    offers: [{ title: 'Free entry for one carer with each OKU child', kind: 'free', value_text: 'Free', conditions: 'Show the child’s OKU card at the entrance.' }],
    visits: ['yes', 'yes', 'yes'], reviews: { siewling: [5, 'My son loved it, and the calm room really helped.'] },
  },
  {
    by: 'siewling', trust: 'community', source: 'used_it',
    name: 'Warung Mak Nah', category: 'restaurant', address: 'Sample address, Sungai Chua', city: 'Kajang', state: 'Selangor',
    lat: 2.9995, lng: 101.7905, description: `Malay rice stall with tables at street level. ${NOTE}`,
    accessibility: [],
    offers: [{ title: 'Free teh tarik with any meal for OKU cardholders', kind: 'freebie', value_text: '', conditions: 'Ask at the counter when you pay.' }],
    visits: ['yes', 'no'], reviews: {},
  },
];

// Which places each sample member has bookmarked with "Save".
const SAVED = { aisyah: ['Taman Ceria Play Centre', 'Kopi Kawan Café'], ravi: ['Senyum Dental Clinic'] };

const emailOf = (key) => `${key}@${SAMPLE_DOMAIN}`;

/** Adds the sample members, businesses and places once. Returns how many places it added. */
export async function seedSampleData(db) {
  if (db.prepare('SELECT 1 FROM users WHERE email LIKE ?').get(`%@${SAMPLE_DOMAIN}`)) return 0;
  const hash = await hashPassword(SAMPLE_PASSWORD);
  const userId = {};
  for (const u of USERS) {
    userId[u.key] = Number(db.prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)').run(u.name, emailOf(u.key), hash).lastInsertRowid);
  }
  const placeId = {};
  for (const { by, owner = false, trust, verifiedAt, hubAt, hubChecked, source, visits, reviews, ...p } of PLACES) {
    const id = insertPlace(db, { phone: '', website: '', image: '', ...p },
      { userId: userId[by], status: 'approved', isOwner: owner, partnerVerified: trust === 'business', source: owner ? 'owner' : source || 'used_it' });
    placeId[p.name] = id;
    if (trust === 'business') db.prepare('UPDATE places SET verified_at = ? WHERE id = ?').run(verifiedAt, id);
    if (trust === 'hub') db.prepare('UPDATE places SET hub_verified = 1, hub_verified_at = ?, hub_checked = ? WHERE id = ?').run(hubAt, hubChecked, id);
    visits.forEach((worked, i) => db.prepare("INSERT INTO visits (place_id, worked, created_at) VALUES (?, ?, datetime('now', ?))").run(id, worked, `-${i + 1} days`));
    for (const [who, [rating, body]] of Object.entries(reviews)) {
      db.prepare("INSERT INTO reviews (place_id, user_id, rating, discount_honoured, body) VALUES (?, ?, ?, 'yes', ?)").run(id, userId[who], rating, body);
    }
  }
  for (const [who, names] of Object.entries(SAVED)) {
    for (const name of names) db.prepare('INSERT INTO saved_places (user_id, place_id) VALUES (?, ?)').run(userId[who], placeId[name]);
  }
  return PLACES.length;
}

/** Removes every sample account and the places they added (reviews, visits and saves go with them). */
export function removeSampleData(db) {
  const users = db.prepare('SELECT id FROM users WHERE email LIKE ?').all(`%@${SAMPLE_DOMAIN}`).map((u) => u.id);
  if (!users.length) return 0;
  const list = users.join(',');
  const places = db.prepare(`DELETE FROM places WHERE submitted_by IN (${list})`).run().changes;
  db.prepare(`DELETE FROM users WHERE id IN (${list})`).run();
  return places;
}
