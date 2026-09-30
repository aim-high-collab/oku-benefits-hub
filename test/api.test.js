import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../server/db.js';
import { createApp } from '../server/app.js';
import { hashPassword } from '../server/http.js';
import { seedBenefits, seedDemoPlaces } from '../server/seed.js';

let server, base, db;

before(async () => {
  db = openDb(':memory:');
  seedBenefits(db);
  seedDemoPlaces(db);
  db.prepare("INSERT INTO users (name, email, password_hash, role) VALUES ('Mod', 'mod@x.my', ?, 'admin')")
    .run(await hashPassword('moderator-pass'));
  const app = createApp({ db, config: { secureCookies: false, rateLimitScale: 1000 } });
  await new Promise((resolve) => { server = app.listen(0, resolve); });
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

// Minimal client with a cookie jar.
function client() {
  let cookie = '';
  const call = async (method, path, body) => {
    const res = await fetch(base + path, {
      method,
      headers: { 'content-type': 'application/json', ...(cookie && { cookie }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0].startsWith('sid=') && set.split(';')[0] !== 'sid=' ? set.split(';')[0] : '';
    return { status: res.status, body: await res.json().catch(() => null), res };
  };
  return { get: (p) => call('GET', p), post: (p, b = {}) => call('POST', p, b), patch: (p, b) => call('PATCH', p, b), del: (p) => call('DELETE', p, {}) };
}

const validPlace = (over = {}) => ({
  name: 'Kedai Ujian', category: 'cafe', address: '1 Jalan Ujian', city: 'Shah Alam', state: 'Selangor',
  lat: 3.07, lng: 101.5, phone: '03-1234 5678', website: 'https://example.com', accessibility: ['ramp'],
  offers: [{ title: '10% off', kind: 'discount', value_text: '10%', conditions: 'Show card' }],
  ...over,
});

const register = async (name) => {
  const c = client();
  const r = await c.post('/api/auth/register', { name, email: `${name}@test.my`, password: 'password123' });
  assert.equal(r.status, 201);
  return c;
};

const admin = async () => {
  const c = client();
  assert.equal((await c.post('/api/auth/login', { email: 'mod@x.my', password: 'moderator-pass' })).status, 200);
  return c;
};

test('meta and public listings work without login', async () => {
  const c = client();
  assert.ok((await c.get('/api/meta')).body.categories.cafe);
  const places = (await c.get('/api/places')).body.places;
  assert.ok(places.length >= 8 && places.every((p) => p.status === 'approved'));
  assert.ok(places[0].offers);
  assert.ok((await c.get('/api/benefits')).body.benefits.length >= 8);
});

test('filters: text, category, offer kind, accessibility features', async () => {
  const c = client();
  const ids = async (qs) => (await c.get(`/api/places?${qs}`)).body.places.map((p) => p.name);
  assert.deepEqual(await ids('q=kopi'), ['Kopi Contoh (Demo)']);
  assert.ok((await ids('category=cafe')).every((n) => n.startsWith('Kopi')));
  assert.deepEqual(await ids('kind=free'), ['Muzium Ujian (Demo)']);
  const both = await ids('features=lift,tactile_paving');
  assert.deepEqual(both, ['Muzium Ujian (Demo)']);
  assert.deepEqual(await ids('q=_'), []); // LIKE wildcards are escaped, not treated as 'match anything'
});

test('auth: register, duplicate, wrong password, me, logout', async () => {
  const c = await register('alice');
  assert.equal((await c.get('/api/auth/me')).body.user.email, 'alice@test.my');
  assert.equal((await client().post('/api/auth/register', { name: 'alice', email: 'ALICE@test.my', password: 'password123' })).status, 409);
  assert.equal((await client().post('/api/auth/login', { email: 'alice@test.my', password: 'nope-nope' })).status, 401);
  assert.equal((await client().post('/api/auth/register', { name: 'x', email: 'bad', password: 'short' })).status, 422);
  await c.post('/api/auth/logout');
  assert.equal((await c.get('/api/auth/me')).body.user, null);
});

test('writes require login, JSON content type and same origin', async () => {
  assert.equal((await client().post('/api/places', validPlace())).status, 401);
  const res = await fetch(`${base}/api/auth/logout`, { method: 'POST', headers: { 'content-type': 'text/plain' }, body: '{}' });
  assert.equal(res.status, 415);
  const cross = await fetch(`${base}/api/auth/logout`, { method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://evil.example' }, body: '{}' });
  assert.equal(cross.status, 403);
});

test('submission → pending → hidden → moderator approves → public', async () => {
  const bob = await register('bob');
  const sub = await bob.post('/api/places', validPlace({ name: 'Bob Bistro', is_owner: true }));
  assert.equal(sub.status, 201);
  assert.equal(sub.body.status, 'pending');
  const id = sub.body.id;

  const anon = client();
  assert.equal((await anon.get(`/api/places/${id}`)).status, 404);
  assert.ok(!(await anon.get('/api/places')).body.places.some((p) => p.id === id));
  assert.equal((await bob.get(`/api/places/${id}`)).status, 200); // submitter can see their own
  assert.equal((await bob.get('/api/me/submissions')).body.places[0].status, 'pending');

  assert.equal((await bob.get('/api/admin/queue')).status, 403);
  const mod = await admin();
  const queue = (await mod.get('/api/admin/queue')).body;
  const queued = queue.places.find((p) => p.id === id);
  assert.equal(queued.submitter, 'bob');
  assert.equal(queued.submitter_is_owner, true);
  assert.equal(queued.partner_verified, false);

  assert.equal((await mod.post(`/api/admin/places/${id}/approve`)).status, 200);
  assert.equal((await mod.post(`/api/admin/places/${id}/approve`)).status, 404); // already decided
  assert.equal((await anon.get(`/api/places/${id}`)).status, 200);

  assert.equal((await mod.patch(`/api/admin/places/${id}`, { partner_verified: true })).status, 200);
  assert.equal((await anon.get(`/api/places/${id}`)).body.place.partner_verified, true);
});

test('place validation reports field errors', async () => {
  const c = await register('carol');
  const bad = await c.post('/api/places', validPlace({ name: '', lat: 51.5, lng: -0.1, website: 'javascript:alert(1)', category: 'nope' }));
  assert.equal(bad.status, 422);
  for (const f of ['name', 'lat', 'lng', 'website', 'category']) assert.ok(bad.body.fields[f], f);
  const empty = await c.post('/api/places', validPlace({ offers: [], accessibility: [] }));
  assert.equal(empty.status, 422);
  const badOffer = await c.post('/api/places', validPlace({ offers: [{ title: 'x', kind: 'zzz' }] }));
  assert.ok(badOffer.body.fields['offers.0.title'] && badOffer.body.fields['offers.0.kind']);
});

test('edit request: only real changes, moderator approval applies them, rejection does not', async () => {
  const dan = await register('dan');
  const mod = await admin();
  const target = (await client().get('/api/places?q=Kopi')).body.places[0];

  assert.equal((await dan.post(`/api/places/${target.id}/edits`, { changes: { name: target.name }, reason: 'same' })).status, 422);
  assert.equal((await dan.post(`/api/places/${target.id}/edits`, { changes: { website: 'ftp://x' }, reason: '' })).status, 422);

  const changes = { phone: '03-9999 0000', offers: [{ title: '15% off all drinks', kind: 'discount', value_text: '15%', conditions: '' }], name: target.name };
  const r1 = await dan.post(`/api/places/${target.id}/edits`, { changes, reason: 'Called the shop, promo changed.' });
  assert.equal(r1.status, 201);

  const queue = (await mod.get('/api/admin/queue')).body;
  const edit = queue.edits.find((e) => e.id === r1.body.id);
  assert.deepEqual(Object.keys(edit.changes).sort(), ['offers', 'phone']); // unchanged `name` dropped
  assert.equal(edit.current.phone, '');

  // Nothing changes until approval
  assert.equal((await client().get(`/api/places/${target.id}`)).body.place.phone, '');
  assert.equal((await mod.post(`/api/admin/edits/${edit.id}/approve`, { note: 'thanks' })).status, 200);
  const after = (await client().get(`/api/places/${target.id}`)).body.place;
  assert.equal(after.phone, '03-9999 0000');
  assert.deepEqual(after.offers.map((o) => o.title), ['15% off all drinks']);

  const r2 = await dan.post(`/api/places/${target.id}/edits`, { changes: { phone: '03-1111 1111' }, reason: 'test' });
  assert.equal((await mod.post(`/api/admin/edits/${r2.body.id}/reject`, { note: 'unverified' })).status, 200);
  assert.equal((await client().get(`/api/places/${target.id}`)).body.place.phone, '03-9999 0000');
  const mine = (await dan.get('/api/me/submissions')).body.edits;
  assert.deepEqual(mine.map((e) => e.status), ['rejected', 'approved']);
  assert.equal(mine[0].review_note, 'unverified');
});

test('edit request: resubmitting unchanged data (features in a different order) is not a change', async () => {
  const ivy = await register('ivy');
  const p = (await client().get('/api/places?q=Pasar')).body.places[0];
  const reordered = [...p.accessibility].reverse();
  const r = await ivy.post(`/api/places/${p.id}/edits`, { changes: { accessibility: reordered, offers: p.offers, lat: p.lat }, reason: '' });
  assert.equal(r.status, 422);
  assert.match(r.body.error, /not changed/);
});

test('benefits: submit, moderate, edit request marks verified', async () => {
  const eve = await register('eve');
  const mod = await admin();
  const sub = await eve.post('/api/benefits', {
    title: 'Free bus pass', agency: 'Majlis Contoh', category: 'transport',
    summary: 'A free bus pass for OKU cardholders in the district.', eligibility: '', how_to_apply: '', url: '',
  });
  assert.equal(sub.status, 201);
  assert.ok(!(await client().get('/api/benefits')).body.benefits.some((b) => b.id === sub.body.id));
  assert.equal((await mod.post(`/api/admin/benefits/${sub.body.id}/approve`)).status, 200);
  const listed = (await client().get('/api/benefits?q=bus+pass')).body.benefits;
  assert.equal(listed.length, 1);
  assert.ok(listed[0].last_verified);

  const e = await eve.post(`/api/benefits/${sub.body.id}/edits`, { changes: { eligibility: 'Residents only' }, reason: 'Read the council notice' });
  assert.equal(e.status, 201);
  await mod.post(`/api/admin/edits/${e.body.id}/approve`);
  assert.equal((await client().get(`/api/benefits/${sub.body.id}`)).body.benefit.eligibility, 'Residents only');
});

test('reviews: validation, upsert per user, stats, moderator removal', async () => {
  const frank = await register('frank');
  const gina = await register('gina');
  const mod = await admin();
  const p = (await client().get('/api/places?q=Pasar')).body.places[0];

  assert.equal((await client().post(`/api/places/${p.id}/reviews`, { rating: 5 })).status, 401);
  assert.equal((await frank.post(`/api/places/${p.id}/reviews`, { rating: 9 })).status, 422);
  assert.equal((await frank.post(`/api/places/${p.id}/reviews`, { rating: 4, discount_honoured: 'yes', body: 'Nice ramp' })).status, 201);
  assert.equal((await frank.post(`/api/places/${p.id}/reviews`, { rating: 2, discount_honoured: 'no', body: 'Changed my mind' })).status, 201);
  await gina.post(`/api/places/${p.id}/reviews`, { rating: 4, access_rating: 5, discount_honoured: 'yes' });

  const reviews = (await client().get(`/api/places/${p.id}/reviews`)).body.reviews;
  assert.equal(reviews.length, 2);
  assert.ok(!('email' in reviews[0]));
  const stats = (await client().get(`/api/places/${p.id}`)).body.place;
  assert.equal(stats.review_count, 2);
  assert.equal(stats.avg_rating, 3);
  assert.equal(stats.honoured_yes, 1);
  assert.equal(stats.honoured_no, 1);

  assert.equal((await frank.del(`/api/admin/reviews/${reviews[0].id}`)).status, 403);
  assert.equal((await mod.del(`/api/admin/reviews/${reviews[0].id}`)).status, 200);
});

test('script tags are stored verbatim (escaping is the client’s job) and never executed server-side', async () => {
  const c = await register('hank');
  const r = await c.post('/api/places', validPlace({ name: '<img src=x onerror=alert(1)>' }));
  assert.equal(r.status, 201);
  const mine = (await c.get(`/api/places/${r.body.id}`)).body.place;
  assert.equal(mine.name, '<img src=x onerror=alert(1)>');
});
