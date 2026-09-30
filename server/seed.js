import { fileURLToPath } from 'node:url';
import { insertBenefit, insertPlace } from './store.js';

// Starting points only: descriptions are deliberately general and rates/thresholds are left to the
// agency. `last_verified` stays NULL until a moderator confirms an entry, and the UI says so.
const BENEFITS = [
  {
    title: 'OKU card (Kad OKU) registration',
    agency: 'Jabatan Kebajikan Masyarakat (JKM)',
    category: 'other',
    summary: 'The OKU card is the proof of registration that unlocks most government and merchant benefits.',
    eligibility: 'Malaysians with a physical, sensory, intellectual, mental, learning or speech disability certified by a registered medical practitioner.',
    how_to_apply: 'Get the medical practitioner’s certification form, then register at your nearest JKM district office. Bring your MyKad and supporting medical documents. Registration can also be started online via JKM’s OKU registration portal.',
    url: 'https://www.jkm.gov.my',
  },
  {
    title: 'Employment allowance for OKU workers (Elaun Pekerja Cacat)',
    agency: 'Jabatan Kebajikan Masyarakat (JKM)',
    category: 'financial',
    summary: 'A monthly allowance to support registered OKU who are employed or self-employed on a low income.',
    eligibility: 'Registered OKU in employment or self-employment, subject to an income ceiling and other criteria set by JKM. Confirm the current rate and ceiling with JKM.',
    how_to_apply: 'Apply at your JKM district office with your OKU card, MyKad and proof of income.',
    url: 'https://www.jkm.gov.my',
  },
  {
    title: 'Monthly assistance for children with disabilities (Bantuan Kanak-Kanak Cacat)',
    agency: 'Jabatan Kebajikan Masyarakat (JKM)',
    category: 'financial',
    summary: 'Monthly financial help for families caring for a child with a disability.',
    eligibility: 'Registered OKU children from households that meet JKM’s income criteria. Confirm current criteria and rates with JKM.',
    how_to_apply: 'A parent or guardian applies at the JKM district office with the child’s OKU card, birth certificate and household income documents.',
    url: 'https://www.jkm.gov.my',
  },
  {
    title: 'Assistive device assistance (Bantuan Alat Bantu)',
    agency: 'Jabatan Kebajikan Masyarakat (JKM)',
    category: 'assistive',
    summary: 'Help with the cost of assistive devices such as wheelchairs, hearing aids, walking aids or prostheses.',
    eligibility: 'Registered OKU who need the device, usually with a supporting recommendation from a medical professional or therapist.',
    how_to_apply: 'Ask your JKM district office about the current application process and required documents.',
    url: 'https://www.jkm.gov.my',
  },
  {
    title: 'Income tax relief for disabled persons',
    agency: 'Lembaga Hasil Dalam Negeri (LHDN)',
    category: 'tax',
    summary: 'Extra personal income-tax relief for a taxpayer who is an OKU, plus relief for a disabled spouse or child. Amounts change between assessment years, so check the current figures on the LHDN site.',
    eligibility: 'Taxpayers who are registered OKU, or who support a disabled spouse or child.',
    how_to_apply: 'Claim in your annual income tax return (e-Filing) and keep a copy of the OKU card as supporting evidence.',
    url: 'https://www.hasil.gov.my',
  },
  {
    title: 'Public transport concession fares',
    agency: 'Prasarana Malaysia and other operators',
    category: 'transport',
    summary: 'Several rail and bus operators offer concession fares or passes for OKU cardholders. Terms differ by operator and change over time.',
    eligibility: 'Registered OKU cardholders. Some operators require a dedicated concession pass.',
    how_to_apply: 'Ask at the operator’s customer service counter or website with your OKU card and MyKad.',
    url: '',
  },
  {
    title: 'Vehicle duty and road-tax concessions for OKU',
    agency: 'Jabatan Kastam Diraja Malaysia / Jabatan Pengangkutan Jalan (JPJ)',
    category: 'vehicle',
    summary: 'Concessions may apply to vehicles owned or used by OKU, including vehicles adapted for a driver with a disability. Conditions apply.',
    eligibility: 'Registered OKU, with conditions on the vehicle and its modification. Confirm the current rules with Customs and JPJ.',
    how_to_apply: 'Contact the Royal Malaysian Customs Department and your nearest JPJ office before purchasing or registering the vehicle.',
    url: '',
  },
  {
    title: 'OKU parking bays and local council concessions',
    agency: 'Local councils (PBT)',
    category: 'vehicle',
    summary: 'Many local councils offer OKU parking permits or parking concessions. Availability varies by council.',
    eligibility: 'Registered OKU cardholders, and sometimes their registered caregivers.',
    how_to_apply: 'Ask your local council (e.g. DBKL, MBPP, MBJB) about its OKU parking permit process.',
    url: '',
  },
  {
    title: 'Healthcare fee concessions at government facilities',
    agency: 'Kementerian Kesihatan Malaysia (KKM)',
    category: 'healthcare',
    summary: 'OKU cardholders may receive fee concessions or waivers at government hospitals and clinics.',
    eligibility: 'Registered OKU cardholders. Scope varies by facility and service.',
    how_to_apply: 'Present your OKU card at registration and ask the counter which concessions apply.',
    url: 'https://www.moh.gov.my',
  },
];

const DEMO = [
  { name: 'Kopi Contoh (Demo)', category: 'cafe', address: 'Jalan Contoh 1, Bukit Bintang', city: 'Kuala Lumpur', state: 'W.P. Kuala Lumpur', lat: 3.1466, lng: 101.7115, accessibility: ['step_free_entry', 'accessible_toilet', 'wide_aisles'], partner: true,
    offers: [{ title: 'Discount on all drinks', kind: 'discount', value_text: '10% off', conditions: 'Show OKU card at the counter.' }] },
  { name: 'Pasar Mini Sample (Demo)', category: 'grocery', address: 'Jalan Sample 5, Taman Tun', city: 'Petaling Jaya', state: 'Selangor', lat: 3.1073, lng: 101.6067, accessibility: ['oku_parking', 'ramp', 'trained_staff'], partner: false,
    offers: [{ title: 'Priority checkout lane', kind: 'priority', value_text: '', conditions: 'Ask any cashier.' }] },
  { name: 'Muzium Ujian (Demo)', category: 'attraction', address: 'Lebuh Ujian, George Town', city: 'George Town', state: 'Pulau Pinang', lat: 5.4141, lng: 100.3288, accessibility: ['step_free_entry', 'lift', 'accessible_toilet', 'tactile_paving'], partner: true,
    offers: [{ title: 'Free admission for OKU', kind: 'free', value_text: 'Free', conditions: 'Caregiver enters at 50% off.' }] },
  { name: 'Klinik Demo Sihat (Demo)', category: 'healthcare', address: 'Jalan Demo 2, Taman Molek', city: 'Johor Bahru', state: 'Johor', lat: 1.5535, lng: 103.7715, accessibility: ['step_free_entry', 'accessible_toilet', 'hearing_loop'], partner: false,
    offers: [{ title: 'Consultation fee discount', kind: 'discount', value_text: '15% off', conditions: 'Weekdays only.' }] },
  { name: 'Kedai Buku Rekaan (Demo)', category: 'retail', address: 'Jalan Rekaan 8, Kuching Waterfront', city: 'Kuching', state: 'Sarawak', lat: 1.5597, lng: 110.3446, accessibility: ['ramp', 'wide_aisles', 'braille_signage'], partner: true,
    offers: [{ title: 'Discount on all books', kind: 'discount', value_text: '5% off', conditions: 'Not combinable with other promotions.' }, { title: 'Free bookmark', kind: 'freebie', value_text: '', conditions: '' }] },
  { name: 'Restoran Model (Demo)', category: 'restaurant', address: 'Jalan Model 3, Gaya Street', city: 'Kota Kinabalu', state: 'Sabah', lat: 5.9804, lng: 116.0735, accessibility: ['step_free_entry', 'assistance_animals', 'quiet_space'], partner: false,
    offers: [{ title: 'Free dessert with main course', kind: 'freebie', value_text: '', conditions: 'One per OKU cardholder.' }] },
  { name: 'Taman Contoh Waterfront (Demo)', category: 'entertainment', address: 'Persiaran Contoh, Presint 2', city: 'Putrajaya', state: 'W.P. Putrajaya', lat: 2.9264, lng: 101.6964, accessibility: ['step_free_entry', 'accessible_toilet', 'oku_parking', 'tactile_paving'], partner: false, offers: [] },
  { name: 'Hotel Sampel (Demo)', category: 'hotel', address: 'Jalan Sampel 10, Ipoh Garden', city: 'Ipoh', state: 'Perak', lat: 4.6, lng: 101.0901, accessibility: ['lift', 'accessible_toilet', 'wide_aisles', 'trained_staff'], partner: true,
    offers: [{ title: 'Room upgrade subject to availability', kind: 'other', value_text: '', conditions: 'Mention OKU card at booking.' }] },
];

export function seedBenefits(db) {
  if (db.prepare('SELECT COUNT(*) AS n FROM benefits').get().n) return 0;
  for (const b of BENEFITS) insertBenefit(db, b, { userId: null, status: 'approved' });
  return BENEFITS.length;
}

export function seedDemoPlaces(db) {
  if (db.prepare('SELECT COUNT(*) AS n FROM places WHERE is_demo = 1').get().n) return 0;
  for (const { partner, ...p } of DEMO) {
    insertPlace(db, { phone: '', website: '', description: 'Fictional demo listing used to preview the app. Not a real business.', ...p },
      { userId: null, status: 'approved', isDemo: true, partnerVerified: partner, isOwner: partner });
  }
  return DEMO.length;
}

export const purgeDemoPlaces = (db) => db.prepare('DELETE FROM places WHERE is_demo = 1').run().changes;

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { openDb } = await import('./db.js');
  const { loadConfig } = await import('./config.js');
  const db = openDb(loadConfig().dbPath);
  const cmd = process.argv[2];
  if (cmd === 'demo') console.log(`Seeded ${seedDemoPlaces(db)} demo places.`);
  else if (cmd === 'purge-demo') console.log(`Removed ${purgeDemoPlaces(db)} demo places.`);
  else { console.error('Usage: node server/seed.js demo|purge-demo'); process.exit(1); }
}
