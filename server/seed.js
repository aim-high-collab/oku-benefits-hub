import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { insertBenefit, insertPlace, insertOffers } from './store.js';

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
  {
    // A network-wide concession: kept here rather than as a place, because a place needs one map pin.
    title: 'KTM Komuter 50% concession fare for OKU passengers',
    agency: 'Keretapi Tanah Melayu Berhad (KTMB)',
    category: 'transport',
    summary: 'Malaysian citizens registered with JKM who hold a valid OKU card can qualify for a 50% concession fare on KTM Komuter services across the network. Registration and eligible ticketing methods apply.',
    eligibility: 'Malaysian citizens registered with JKM and holding a valid OKU card. Check KTMB’s current terms for how to register and which ticketing methods qualify.',
    how_to_apply: 'Read KTMB’s Komuter terms and conditions (linked below), register as they describe, then buy a concession ticket. Ask at a Komuter station counter if unsure.',
    url: 'https://ktmb.com.my/assets/pdf/2026/APPENDIX%202_TERMA%20DAN%20SYARAT_PERKHIDMATAN%20KOMUTER%20Jan%202026.pdf',
  },
];

const CHECKED = '30 Sep 2026';
const NOTE = `Compiled from web sources on ${CHECKED}, not yet confirmed with the venue, and the map pin may be a few hundred metres off. Please check before you go, and use “Suggest an edit” to correct anything.`;
// Sample listings added on 21 Oct 2026 from each venue's own published page (kept as source_url). They are not
// checked by OKU Benefits Hub, so they carry the community label. Coordinates come from the cited place pages
// (Wikipedia, or the venue's own Google Maps link), not from guesswork.
const SAMPLE_NOTE = 'Sample listing compiled from the official source on 21 Oct 2026. OKU Benefits Hub has not checked it independently, so please confirm before you go.';
const VOLUNTEER_NOTE = 'The organisation publishes volunteer opportunities, but OKU-specific access and accommodations have not been verified. Ask them about suitable roles and access before you go.';
const FREE_OKU = (conditions) => ({ title: 'Free admission for OKU cardholders', kind: 'free', value_text: 'Free', conditions });

// Entries without source_url (first seed, 30 Sep 2026) have approximate pins placed from knowledge of the area, not
// geocoded. Moderators can nudge a pin through the normal edit-request flow.
// Photos: drop `<slug>.jpg|png|webp` into public/img/places/ and restart; see applySeedPhotos().
const PLACES = [
  {
    slug: 'zoo-negara', name: 'Zoo Negara Malaysia', category: 'attraction', website: 'https://www.zoonegara.my/', phone: '+603-4108 3422',
    address: 'Hulu Kelang, 68000', city: 'Ampang', state: 'Selangor', lat: 3.20972, lng: 101.75778,
    source_url: 'https://www.zoonegara.my/visitor-guide/tickets', replaces: 'Zoo Negara',
    description: `Malaysia’s national zoo. Its ticket page lists free entry for persons with disabilities who show a valid OKU card. ${SAMPLE_NOTE}`,
    accessibility: [],
    offers: [
      { title: 'Free admission for persons with disabilities', kind: 'free', value_text: 'Free', conditions: 'Show a valid OKU card at the entrance.' },
      { title: 'Discount on tram rides for OKU visitors', kind: 'discount', value_text: '', conditions: 'Reported as 10% off with a valid OKU card, but the zoo’s ticket and rides pages did not show it on 21 Oct 2026. Ask at the tram counter.' },
    ],
  },
  {
    slug: 'kl-bird-park', name: 'Kuala Lumpur Bird Park', category: 'attraction', website: 'https://www.klbirdpark.com/', phone: '',
    address: '920 Jalan Cenderawasih, Taman Tasik Perdana', city: 'Kuala Lumpur', state: 'W.P. Kuala Lumpur', lat: 3.1430, lng: 101.6883,
    description: `Walk-in aviary in the Lake Gardens. Free entry for OKU cardholders is listed by a secondary source and was not found on the park’s own pages. ${NOTE}`,
    accessibility: [], offers: [FREE_OKU('Reported by a third-party list; confirm with the park. Bring your OKU card.')],
  },
  {
    slug: 'petrosains', name: 'Petrosains, The Discovery Centre', category: 'attraction', website: 'https://petrosains.com.my/visit/admission-and-ticketing/', phone: '+603-2331 8181',
    address: 'Level 4, Suria KLCC, PETRONAS Twin Towers, Kuala Lumpur City Centre, 50088', city: 'Kuala Lumpur', state: 'W.P. Kuala Lumpur', lat: 3.1578987, lng: 101.7097923,
    source_url: 'https://petrosains.com.my/visit/admission-and-ticketing/', replaces: 'Petrosains, The Discovery Centre',
    description: `Interactive science centre in Suria KLCC. Its admission page asks OKU visitors to show their registered OKU card at the counter but gives no OKU price, so no amount is shown here. For concession rates, call or email infopetrosains@petronas.com. ${SAMPLE_NOTE}`,
    accessibility: [],
    offers: [{ title: 'Special admission rates for visitors with disabilities', kind: 'discount', value_text: '', conditions: 'Not confirmed yet: show your registered OKU card at the counter and ask whether a concession rate applies and what it costs.' }],
  },
  {
    slug: 'planetarium-negara', name: 'Planetarium Negara', category: 'attraction', website: '', phone: '',
    address: '53 Jalan Perdana, Tasik Perdana', city: 'Kuala Lumpur', state: 'W.P. Kuala Lumpur', lat: 3.1420, lng: 101.6871,
    description: `National planetarium and space exhibition in the Lake Gardens. Admission is reported to be free, including for OKU visitors (only social-media sources found); separate fees may apply for some shows. Reported hours: 9am–4:30pm, closed Mondays and Tuesdays. ${NOTE}`,
    accessibility: [], offers: [FREE_OKU('Reported as free for everyone including OKU; check whether any shows are ticketed.')],
  },
  {
    slug: 'muzium-negara', name: 'National Museum (Muzium Negara)', category: 'attraction', website: 'https://www.muziumnegara.gov.my/en', phone: '+603-2267 1111',
    address: 'Jalan Damansara, 50566', city: 'Kuala Lumpur', state: 'W.P. Kuala Lumpur', lat: 3.13758, lng: 101.68739,
    source_url: 'https://www.muziumnegara.gov.my/index.php/en/visiting-info', replaces: 'Muzium Negara (National Museum)',
    description: `Malaysia’s national museum on Jalan Damansara. Concession admission for OKU visitors has been published, but the current rate needs confirming, so no amount is shown here. ${SAMPLE_NOTE}`,
    accessibility: [],
    offers: [{ title: 'Concession admission for OKU visitors', kind: 'discount', value_text: '', conditions: 'Not confirmed yet: ask for the current OKU rate at the counter before you rely on it.' }],
  },
  {
    slug: 'sunway-lagoon', name: 'Sunway Lagoon', category: 'entertainment', website: 'https://sunwaylagoon.com/', phone: '',
    address: '3 Jalan PJS 11/11, Bandar Sunway', city: 'Subang Jaya', state: 'Selangor', lat: 3.0709, lng: 101.6072,
    description: `Theme and water park. Its FAQ is reported to give OKU cardholders a discount on the published ticket price. ${NOTE}`,
    accessibility: [],
    offers: [{ title: 'Discount on admission for OKU cardholders', kind: 'discount', value_text: '50% off', conditions: 'OKU tickets are reported to be sold only at the ticketing counters, with your OKU card shown for verification.' }],
  },
  {
    slug: 'aquaria-klcc', name: 'Aquaria KLCC', category: 'attraction', website: 'https://aquariaklcc.com/', phone: '',
    address: 'Kuala Lumpur Convention Centre, Jalan Pinang', city: 'Kuala Lumpur', state: 'W.P. Kuala Lumpur', lat: 3.1529, lng: 101.7135,
    description: `Oceanarium beneath the Kuala Lumpur Convention Centre. A concession rate for OKU visitors is reported, but sources disagree on the price. ${NOTE}`,
    accessibility: [],
    offers: [{ title: 'Concession ticket for OKU cardholders', kind: 'discount', value_text: '', conditions: 'Verification with your OKU card is required. One source lists RM16; confirm the current price at the counter.' }],
  },
  {
    slug: 'sunway-putra-mall', name: 'Sunway Putra Mall', category: 'retail', website: '', phone: '',
    address: '100 Jalan Putra', city: 'Kuala Lumpur', state: 'W.P. Kuala Lumpur', lat: 3.1667, lng: 101.6878,
    description: `Reported as Malaysia’s first autism-friendly mall. Tuesdays are “Autsome Day” with dimmed lights, lower music and dedicated quiet zones, plus sensory walls and calm rooms for anyone who needs a break. ${NOTE}`,
    accessibility: ['quiet_space'],
    offers: [{ title: 'Autsome Day: dimmed lights, quieter music, quiet zones', kind: 'other', value_text: 'Every Tuesday', conditions: 'Reported by a news article; confirm the current schedule with the mall.' }],
  },
  {
    slug: 'autism-cafe-project', name: 'Autism Café Project', category: 'social', website: '', phone: '',
    address: '5 Jalan Adang U8/16, Bukit Jelutong', city: 'Shah Alam', state: 'Selangor', lat: 3.1052, lng: 101.5268,
    description: `A social enterprise café where autistic young adults train and work in the kitchen and front of house. Eating here supports their training. The café has moved a few times (Puchong, Shah Alam, USJ), so check its Facebook or Instagram page (@autismcafeproject) for the current address and hours. ${NOTE}`,
    accessibility: [], offers: [],
  },
  {
    slug: 'bake-with-dignity', name: 'Bake with Dignity', category: 'social', website: 'https://www.dignityandservices.org/bwd-online-store-and-cafe/bwd-cafe', phone: '',
    address: 'Tropicana Gardens Mall, 2A Persiaran Surian, Tropicana Indah', city: 'Petaling Jaya', state: 'Selangor', lat: 3.1706, lng: 101.6082,
    description: `Café and bakery run by Dignity & Services, giving adults with learning disabilities sheltered employment and training. Proceeds go back into the training programme. The team has also baked in Taman Tun Dr Ismail and Bandar Sunway; check for the current spot. ${NOTE}`,
    accessibility: [],
    offers: [{ title: 'Volunteer in the kitchen', kind: 'volunteer', value_text: '', conditions: 'Occasional or regular morning and afternoon slots, no experience needed; trainers show you the ropes. Sign up through Dignity & Services.' }],
  },
  {
    slug: 'tender-hearts', name: 'Tender Hearts Café', category: 'social', website: 'https://tenderheartswebsit.wixsite.com/tender-hearts', phone: '016-216 2188',
    address: 'L2.05, Level 2, KL Gateway Mall, Kerinchi', city: 'Kuala Lumpur', state: 'W.P. Kuala Lumpur', lat: 3.1122, lng: 101.6671,
    description: `Café staffed by young people with special needs, part of Tender Hearts, which also runs a baking and training centre at Summit USJ, Subang Jaya. ${NOTE}`,
    accessibility: [],
    offers: [{ title: 'Volunteer with Tender Hearts', kind: 'volunteer', value_text: '', conditions: 'Contact them by email (tenderheartsent@gmail.com) or sign up on their website.' }],
  },
  {
    slug: 'national-science-centre', name: 'National Science Centre (Pusat Sains Negara)', category: 'attraction', website: 'https://psn.gov.my/', phone: '+603-2089 3400',
    address: 'Persiaran Bukit Kiara, 50662 Bukit Kiara', city: 'Kuala Lumpur', state: 'W.P. Kuala Lumpur', lat: 3.14939, lng: 101.64256,
    source_url: 'https://psn.gov.my/',
    description: `National science centre with hands-on exhibitions. Its official website lists free admission for OKU visitors. ${SAMPLE_NOTE}`,
    accessibility: [], offers: [FREE_OKU('Malaysian visitors with a valid OKU card enter free of charge. Show your OKU card at the counter.')],
  },
  {
    slug: 'skyline-luge-kl', name: 'Skyline Luge Kuala Lumpur', category: 'entertainment', website: 'https://kualalumpur.skylineluge.com/visiting-us/', phone: '',
    address: 'Gamuda Luge Gardens, Gamuda Gardens', city: 'Rawang', state: 'Selangor', lat: 3.2731875, lng: 101.5515625,
    source_url: 'https://kualalumpur.skylineluge.com/visiting-us/',
    description: `Gravity-powered luge rides at Gamuda Gardens. Its visiting page lists 50% off normal admission for holders of a valid Malaysian government-issued OKU card from 1 October 2026. The full street address and postcode are not confirmed yet. ${SAMPLE_NOTE}`,
    accessibility: [],
    offers: [{ title: '50% off standard admission for OKU cardholders', kind: 'discount', value_text: '50% off', conditions: 'Buy at the ticket counter with your OKU card; not available online. Skyride-only tickets are excluded, and it cannot be combined with other promotions.' }],
  },
  {
    slug: 'kechara-soup-kitchen', name: 'Kechara Soup Kitchen', category: 'services', website: 'https://kecharasoupkitchen.com/my/contact-us/', phone: '+603-2141 6046',
    address: '17 Jalan Barat, Off Jalan Imbi, 55100', city: 'Kuala Lumpur', state: 'W.P. Kuala Lumpur', lat: 3.1451089, lng: 101.7153101,
    source_url: 'https://www.kecharasoupkitchen.com/volunteer/',
    description: `Soup kitchen serving the homeless and urban poor in Kuala Lumpur. ${VOLUNTEER_NOTE} ${SAMPLE_NOTE}`,
    accessibility: [],
    offers: [{ title: 'Community food distribution and support', kind: 'volunteer', value_text: '', conditions: 'Help with food preparation, food distribution, community outreach and other activities. Contact them to discuss suitable roles and access arrangements.' }],
  },
  {
    slug: 'spca-selangor', name: 'SPCA Selangor', category: 'services', website: 'https://www.spca.org.my/what-you-can-do-to-help/volunteer/', phone: '+603-4256 5312',
    address: 'Jalan Kerja Ayer Lama, Ampang Jaya, 68000', city: 'Ampang', state: 'Selangor', lat: 3.16098, lng: 101.7593,
    source_url: 'https://www.spca.org.my/contact-us/',
    description: `Animal welfare society with a shelter in Ampang Jaya. ${VOLUNTEER_NOTE} ${SAMPLE_NOTE}`,
    accessibility: [],
    offers: [{ title: 'Animal care and shelter volunteering', kind: 'volunteer', value_text: '', conditions: 'Animal socialisation, dog-walking, shelter housekeeping, event support, marketing and fundraising. First-time volunteers must complete the Pet Care Programme.' }],
  },
  {
    slug: 'klpac', name: 'The Kuala Lumpur Performing Arts Centre (klpac)', category: 'entertainment', website: 'https://www.klpac.org/join-support/internship-volunteer/', phone: '+60 18-227 7212',
    address: 'Sentul Park, Jalan Strachan, off Jalan Sultan Azlan Shah, 51100', city: 'Kuala Lumpur', state: 'W.P. Kuala Lumpur', lat: 3.1852, lng: 101.6864,
    source_url: 'https://www.klpac.org/join-support/internship-volunteer/',
    description: `Performing arts centre in Sentul Park. ${VOLUNTEER_NOTE} ${SAMPLE_NOTE}`,
    accessibility: [],
    offers: [{ title: 'Arts and cultural volunteering', kind: 'volunteer', value_text: '', conditions: 'Gain experience in the local arts scene and help with arts-centre activities. Confirm current openings, role requirements and access arrangements with klpac.' }],
  },
];

// The first seed of these three (30 Sep 2026) was replaced by the official-source versions above. A database that
// still holds the untouched first version is brought up to date; anything a moderator has edited is left alone.
export const SUPERSEDED = {
  'Zoo Negara': `Malaysia’s national zoo. OKU cardholders are reported to enter free of charge. ${NOTE}`,
  'Petrosains, The Discovery Centre': `Interactive science centre. Its admission page states that OKU cardholders enter free. ${NOTE}`,
  'Muzium Negara (National Museum)': `Malaysia’s national museum. We could not confirm an OKU admission concession (children and senior citizens are reported to enter free), so no offer is listed yet. Reported facilities: lifts, step-free routes, free wheelchair loan (subject to availability) and accessible toilets. ${NOTE}`,
};

export function seedBenefits(db) {
  const exists = db.prepare('SELECT 1 FROM benefits WHERE title = ?');
  let added = 0;
  for (const b of BENEFITS) {
    if (exists.get(b.title)) continue;
    insertBenefit(db, b, { userId: null, status: 'approved' });
    added++;
  }
  return added;
}

export function seedPlaces(db) {
  const exists = db.prepare('SELECT 1 FROM places WHERE name = ?');
  const setSource = db.prepare('UPDATE places SET source_url = ? WHERE id = ?');
  let added = 0;
  for (const { slug, source_url: sourceUrl = '', replaces, ...p } of PLACES) {
    if (replaces && refreshSuperseded(db, replaces, p, sourceUrl)) continue;
    if (exists.get(p.name)) continue;
    const id = insertPlace(db, { image: '', ...p }, { userId: null, status: 'approved', source: sourceUrl ? 'heard' : '' });
    setSource.run(sourceUrl, id);
    added++;
  }
  return added;
}

/** Updates a seeded place still in its first, untouched form to the newer seed. Returns true if it did. */
function refreshSuperseded(db, oldName, p, sourceUrl) {
  const row = db.prepare('SELECT id FROM places WHERE name = ? AND description = ? AND submitted_by IS NULL').get(oldName, SUPERSEDED[oldName]);
  if (!row) return false;
  db.prepare(`UPDATE places SET name = ?, category = ?, description = ?, address = ?, city = ?, state = ?, lat = ?, lng = ?,
      phone = ?, website = ?, accessibility = ?, source = 'heard', source_url = ?, updated_at = datetime('now') WHERE id = ?`)
    .run(p.name, p.category, p.description, p.address, p.city, p.state, p.lat, p.lng, p.phone, p.website,
      JSON.stringify(p.accessibility), sourceUrl, row.id);
  db.prepare('DELETE FROM offers WHERE place_id = ?').run(row.id);
  insertOffers(db, row.id, p.offers);
  return true;
}

/**
 * Photos we are allowed to use (your own, or properly licensed) can be dropped into public/img/places/ as
 * `<slug>.jpg|png|webp` (slugs are listed in PLACES above). They are attached to seeded places that have no photo yet.
 */
export function applySeedPhotos(db, dir) {
  const set = db.prepare("UPDATE places SET image = ? WHERE name = ? AND image = ''");
  let n = 0;
  for (const p of PLACES) {
    const file = ['jpg', 'jpeg', 'png', 'webp'].map((e) => `${p.slug}.${e}`).find((f) => existsSync(join(dir, f)));
    if (file) n += Number(set.run(`/img/places/${file}`, p.name).changes);
  }
  return n;
}

// Earlier versions shipped fictional placeholder listings; remove any left in an existing database.
export const purgeLegacyDemoPlaces = (db) => db.prepare('DELETE FROM places WHERE is_demo = 1').run().changes;
