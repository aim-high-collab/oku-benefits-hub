// Browser-only stand-in for the server API, used by the static preview. Data comes from data.json;
// anything visitors add is kept in localStorage and never leaves their browser. No real accounts or security.
const KEY = 'oku-demo-v1';
let base;
let store;

const fresh = () => ({ user: null, users: [], places: [], benefits: [], edits: [], reviews: [], next: 1000 });
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch { /* storage full or blocked */ } };
const fail = (status, message, fields = {}) => Object.assign(new Error(message), { status, fields });

async function boot() {
  if (base) return;
  base = await (await fetch('data.json')).json();
  try { store = { ...fresh(), ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { store = fresh(); }
}

const allPlaces = () => [...base.places, ...store.places];
const allBenefits = () => [...base.benefits, ...store.benefits];
const need = () => { if (!store.user) throw fail(401, 'Please log in to do that.'); return store.user; };
const like = (hay, q) => hay.toLowerCase().includes(q.toLowerCase());

function withStats(p) {
  const rs = store.reviews.filter((r) => r.place_id === p.id);
  const n = rs.length;
  return {
    ...p,
    review_count: n,
    avg_rating: n ? Math.round((rs.reduce((s, r) => s + r.rating, 0) / n) * 10) / 10 : null,
    honoured_yes: rs.filter((r) => r.discount_honoured === 'yes').length,
    honoured_no: rs.filter((r) => r.discount_honoured === 'no').length,
  };
}

function listPlaces(q) {
  const term = q.get('q')?.trim();
  const category = q.get('category');
  const kind = q.get('kind');
  const feats = (q.get('features') || '').split(',').filter(Boolean);
  return allPlaces()
    .filter((p) => !term || [p.name, p.address, p.city, p.description, ...p.offers.flatMap((o) => [o.title, o.value_text])].some((s) => like(s || '', term)))
    .filter((p) => !category || p.category === category)
    .filter((p) => !kind || p.offers.some((o) => o.kind === kind))
    .filter((p) => feats.every((f) => p.accessibility.includes(f)))
    .sort((a, b) => Number(b.partner_verified) - Number(a.partner_verified) || a.name.localeCompare(b.name))
    .map(withStats);
}

function requireFields(body, rules) {
  const fields = {};
  for (const [k, [min, label]] of Object.entries(rules)) {
    if (typeof body[k] !== 'string' || body[k].trim().length < min) fields[k] = `${label} is required.`;
  }
  if (Object.keys(fields).length) throw fail(422, 'Please fix the highlighted fields.', fields);
}

function newEdit(type, id, body) {
  const user = need();
  const target = (type === 'place' ? allPlaces() : allBenefits()).find((x) => x.id === id);
  if (!target) throw fail(404, 'That listing was not found.');
  const changed = Object.entries(body.changes || {}).filter(([k, v]) => {
    const cur = target[k];
    return Array.isArray(v) && k !== 'offers' ? JSON.stringify([...v].sort()) !== JSON.stringify([...cur].sort()) : JSON.stringify(v) !== JSON.stringify(cur);
  });
  if (!changed.length) throw fail(422, 'You have not changed anything.');
  const edit = { id: store.next++, target_type: type, target_id: id, target_name: target.name ?? target.title, status: 'pending', review_note: '', created_at: new Date().toISOString(), by: user.email };
  store.edits.push(edit);
  save();
  return { id: edit.id, status: 'pending' };
}

export async function handle(method, path, body = {}) {
  await boot();
  const url = new URL(path, 'http://demo');
  const p = url.pathname;
  const q = url.searchParams;
  let m;

  if (p === '/meta') return base.meta;

  // ----- accounts (a local profile, no password) -----
  if (p === '/auth/me') return { user: store.user };
  if (p === '/auth/register' && method === 'POST') {
    const email = String(body.email || '').trim().toLowerCase();
    const fields = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fields.email = 'Enter a valid email address.';
    if (String(body.name || '').trim().length < 2) fields.name = 'Name must be at least 2 characters.';
    if (String(body.password || '').length < 8) fields.password = 'Password must be 8–200 characters.';
    if (Object.keys(fields).length) throw fail(422, 'Please fix the highlighted fields.', fields);
    if (store.users.some((u) => u.email === email)) throw fail(409, 'An account with that email already exists.', { email: 'Already registered, try logging in.' });
    const user = { id: store.next++, name: body.name.trim(), email, role: 'user' };
    store.users.push(user);
    store.user = user;
    save();
    return { user };
  }
  if (p === '/auth/login' && method === 'POST') {
    const user = store.users.find((u) => u.email === String(body.email || '').trim().toLowerCase());
    if (!user) throw fail(401, 'In this preview, log in with an email you signed up with in this browser, or sign up first.');
    store.user = user;
    save();
    return { user };
  }
  if (p === '/auth/logout') { store.user = null; save(); return { ok: true }; }
  if (p.startsWith('/admin')) throw fail(403, 'Moderation is not available in the preview.');
  if (p === '/uploads' && method === 'POST') { need(); return { path: body.image }; }

  // ----- places -----
  if (p === '/places' && method === 'GET') return { places: listPlaces(q) };
  if (p === '/places' && method === 'POST') {
    const user = need();
    requireFields(body, { name: [2, 'Name'], address: [3, 'Address'] });
    if (!Number.isFinite(body.lat) || !Number.isFinite(body.lng)) throw fail(422, 'Please fix the highlighted fields.', { lat: 'Pick the location on the map.', lng: 'Pick the location on the map.' });
    if (!(body.offers?.length || body.accessibility?.length)) throw fail(422, 'Add at least one offer or one accessibility feature.', { offers: 'Add at least one offer, or tick an accessibility feature.' });
    const place = { ...body, id: store.next++, status: 'approved', partner_verified: false, submitter_is_owner: body.is_owner === true, submitted_by: user.id,
      offers: (body.offers || []).map((o, i) => ({ ...o, id: i })), accessibility: body.accessibility || [], created_at: new Date().toISOString() };
    store.places.push(place);
    save();
    return { id: place.id, status: 'approved' };
  }
  if ((m = /^\/places\/(\d+)$/.exec(p))) {
    const place = allPlaces().find((x) => x.id === Number(m[1]));
    if (!place) throw fail(404, 'Place not found.');
    return { place: withStats(place) };
  }
  if ((m = /^\/places\/(\d+)\/reviews$/.exec(p))) {
    const id = Number(m[1]);
    if (method === 'GET') return { reviews: store.reviews.filter((r) => r.place_id === id).map(({ email, ...r }) => r).reverse() };
    const user = need();
    if (!Number.isInteger(body.rating) || body.rating < 1 || body.rating > 5) throw fail(422, 'Please fix the highlighted fields.', { rating: 'Choose a rating from 1 to 5.' });
    store.reviews = store.reviews.filter((r) => !(r.place_id === id && r.email === user.email));
    store.reviews.push({ id: store.next++, place_id: id, email: user.email, author: user.name, rating: body.rating, access_rating: body.access_rating ?? null,
      discount_honoured: body.discount_honoured || 'not_tried', body: (body.body || '').trim(), created_at: new Date().toISOString() });
    save();
    return { ok: true };
  }
  if ((m = /^\/places\/(\d+)\/edits$/.exec(p))) return newEdit('place', Number(m[1]), body);

  // ----- benefits -----
  if (p === '/benefits' && method === 'GET') {
    const term = q.get('q')?.trim();
    const cat = q.get('category');
    return { benefits: allBenefits().filter((b) => (!term || [b.title, b.agency, b.summary].some((s) => like(s, term))) && (!cat || b.category === cat))
      .sort((a, b) => a.title.localeCompare(b.title)) };
  }
  if (p === '/benefits' && method === 'POST') {
    need();
    requireFields(body, { title: [3, 'Title'], agency: [2, 'Agency'], summary: [10, 'Summary'] });
    const b = { ...body, id: store.next++, status: 'approved', last_verified: null, created_at: new Date().toISOString() };
    store.benefits.push(b);
    save();
    return { id: b.id, status: 'approved' };
  }
  if ((m = /^\/benefits\/(\d+)$/.exec(p))) {
    const b = allBenefits().find((x) => x.id === Number(m[1]));
    if (!b) throw fail(404, 'Benefit not found.');
    return { benefit: b };
  }
  if ((m = /^\/benefits\/(\d+)\/edits$/.exec(p))) return newEdit('benefit', Number(m[1]), body);

  if (p === '/me/submissions') {
    need();
    return {
      places: store.places.map((x) => ({ id: x.id, name: x.name, status: x.status, created_at: x.created_at })).reverse(),
      benefits: store.benefits.map((x) => ({ id: x.id, title: x.title, status: x.status, created_at: x.created_at })).reverse(),
      edits: [...store.edits].reverse(),
    };
  }
  throw fail(404, 'Not found.');
}
