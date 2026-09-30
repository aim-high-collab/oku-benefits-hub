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

const CHECKED = '30 Sep 2026';
const NOTE = `Compiled from web sources on ${CHECKED} and not yet confirmed with the venue. Please confirm before you go, and use “Suggest an edit” to correct anything.`;
const FREE_OKU = (conditions) => ({ title: 'Free admission for OKU cardholders', kind: 'free', value_text: 'Free', conditions });

// Coordinates are approximate (placed from memory of the location, not geocoded): moderators should
// nudge the pin via an edit request if it is off.
const PLACES = [
  {
    name: 'Zoo Negara', category: 'attraction', website: 'https://www.zoonegara.my/', phone: '',
    address: 'Jalan Taman Zoo, Ulu Klang', city: 'Ampang', state: 'Selangor', lat: 3.2101, lng: 101.7590,
    description: `Malaysia’s national zoo. OKU cardholders are reported to enter free of charge. ${NOTE}`,
    accessibility: [],
    offers: [FREE_OKU('Show a valid OKU card at the ticket counter.')],
  },
  {
    name: 'Kuala Lumpur Bird Park', category: 'attraction', website: 'https://www.klbirdpark.com/', phone: '',
    address: '920 Jalan Cenderawasih, Taman Tasik Perdana', city: 'Kuala Lumpur', state: 'W.P. Kuala Lumpur', lat: 3.1430, lng: 101.6883,
    description: `Walk-in aviary in the Lake Gardens. Free entry for OKU cardholders is listed by a secondary source and was not found on the park’s own pages. ${NOTE}`,
    accessibility: [],
    offers: [FREE_OKU('Reported by a third-party list; confirm with the park. Bring your OKU card.')],
  },
  {
    name: 'Petrosains, The Discovery Centre', category: 'attraction', website: 'https://petrosains.com.my/', phone: '03-2331 8181',
    address: 'Level 4, Suria KLCC, Kuala Lumpur City Centre', city: 'Kuala Lumpur', state: 'W.P. Kuala Lumpur', lat: 3.1584, lng: 101.7119,
    description: `Interactive science centre. Its admission page states that OKU cardholders enter free. ${NOTE}`,
    accessibility: [],
    offers: [FREE_OKU('Present your registered OKU card at the counter.')],
  },
  {
    name: 'Planetarium Negara', category: 'attraction', website: '', phone: '',
    address: '53 Jalan Perdana, Tasik Perdana', city: 'Kuala Lumpur', state: 'W.P. Kuala Lumpur', lat: 3.1420, lng: 101.6871,
    description: `National planetarium and space exhibition in the Lake Gardens. Admission is reported to be free, including for OKU visitors (only social-media sources found); separate fees may apply for some shows. Reported hours: 9am–4:30pm, closed Mondays and Tuesdays. ${NOTE}`,
    accessibility: [],
    offers: [FREE_OKU('Reported as free for everyone including OKU; check whether any shows are ticketed.')],
  },
  {
    name: 'Muzium Negara (National Museum)', category: 'attraction', website: 'https://www.muziumnegara.gov.my/', phone: '',
    address: 'Jalan Damansara', city: 'Kuala Lumpur', state: 'W.P. Kuala Lumpur', lat: 3.1379, lng: 101.6875,
    description: `Malaysia’s national museum. We could not confirm an OKU admission concession (children and senior citizens are reported to enter free), so no offer is listed yet. Reported facilities: lifts, step-free routes, free wheelchair loan (subject to availability) and accessible toilets. ${NOTE}`,
    accessibility: ['lift', 'step_free_entry', 'accessible_toilet'],
    offers: [],
  },
];

export function seedBenefits(db) {
  if (db.prepare('SELECT COUNT(*) AS n FROM benefits').get().n) return 0;
  for (const b of BENEFITS) insertBenefit(db, b, { userId: null, status: 'approved' });
  return BENEFITS.length;
}

export function seedPlaces(db) {
  const exists = db.prepare('SELECT 1 FROM places WHERE name = ?');
  let added = 0;
  for (const p of PLACES) {
    if (exists.get(p.name)) continue;
    insertPlace(db, p, { userId: null, status: 'approved' });
    added++;
  }
  return added;
}

// Earlier versions shipped fictional placeholder listings; remove any left in an existing database.
export const purgeLegacyDemoPlaces = (db) => db.prepare('DELETE FROM places WHERE is_demo = 1').run().changes;
