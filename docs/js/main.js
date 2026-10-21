import { h, clear } from './dom.js';
import { api } from './api.js';
import { announce, toast, icon, loadPhotoCredits } from './ui.js';
import { t, LANGS, getLang, setLang } from './i18n.js';
import { configureMaps } from './map.js';
import { exploreView } from './views/explore.js';
import { placeView } from './views/place.js';
import { benefitsView } from './views/benefits.js';
import { submitPlaceView, editPlaceView, submitBenefitView, editBenefitView } from './views/contribute.js';
import { loginView, registerView } from './views/auth.js';
import { savedView } from './views/saved.js';
import { contactView } from './views/contact.js';
import { loadSaved } from './saved.js';
import { accountView } from './views/account.js';
import { adminView } from './views/admin.js';
import { howItWorksView } from './views/how-it-works.js';

const main = document.getElementById('main');
const nav = document.getElementById('nav');
const menu = document.getElementById('menu');
const tools = document.getElementById('tools');

export const state = { user: null, meta: null, filters: { q: '', category: '', kind: '', features: [], includeUnknown: true, trust: ['hub', 'business', 'community'], sort: 'recommended' }, loc: null, view: 'list' };

const ctx = {
  state,
  go: (hash) => { location.hash = hash; },
  announce,
  toast,
  async refreshUser() {
    state.user = (await api('GET', '/auth/me')).user;
    await loadSaved(state);
    renderNav();
  },
};

const routes = [
  [/^\/?$/, exploreView],
  [/^\/place\/(\d+)$/, placeView],
  [/^\/place\/(\d+)\/edit$/, editPlaceView],
  [/^\/benefits$/, benefitsView],
  [/^\/benefits\/(\d+)\/edit$/, editBenefitView],
  [/^\/submit\/place$/, submitPlaceView],
  [/^\/submit\/benefit$/, submitBenefitView],
  [/^\/saved$/, savedView],
  [/^\/contact$/, contactView],
  [/^\/login$/, loginView],
  [/^\/register$/, registerView],
  [/^\/account$/, accountView],
  [/^\/admin$/, adminView],
  [/^\/how-it-works$/, howItWorksView],
  [/^\/business$/, () => { location.replace('#/how-it-works'); return { title: '' }; }], // old link, kept working
];

// "Official help" is a short page of links to government schemes; the product itself is a directory of places.
const NAV = [
  ['#/', 'Discover', /^\/?$|^\/place\/\d+$/],
  ['#/submit/place', 'Add a place', /^\/submit\/place/],
  ['#/how-it-works', 'How it works', /^\/how-it-works/],
  ['#/benefits', 'Official help', /^\/benefits/],
  ['#/contact', 'Contact', /^\/contact/],
];

function renderNav() {
  const path = currentPath();
  const account = document.getElementById('account');
  clear(nav);
  clear(account);
  for (const [href, label, re] of NAV) {
    nav.append(h('a', { href, 'aria-current': re.test(path) ? 'page' : null }, t(label)));
  }
  if (state.user) {
    if (state.user.role === 'admin') nav.append(h('a', { href: '#/admin', 'aria-current': path === '/admin' ? 'page' : null }, t('Moderation')));
    account.append(
      h('a', { class: 'linkbtn saved-link', href: '#/saved', 'aria-current': path === '/saved' ? 'page' : null }, icon('bookmark', 18), t('Saved')),
      h('a', { class: 'me', href: '#/account', 'aria-current': path === '/account' ? 'page' : null, title: t('My contributions') },
        h('span', { class: 'avatar', 'aria-hidden': 'true' }, state.user.name.trim().charAt(0).toUpperCase()), h('span', { class: 'me-name' }, state.user.name)),
      h('button', { type: 'button', class: 'linkbtn', onclick: logout }, t('Log out')));
  } else {
    account.append(h('a', { class: 'linkbtn', href: '#/login', 'aria-current': path === '/login' ? 'page' : null }, t('Log in')));
  }
  renderTools();
  document.getElementById('skip').textContent = t('Skip to main content');
  document.querySelector('.brand').setAttribute('aria-label', t('OKU Benefits Hub, home'));
  nav.setAttribute('aria-label', t('Main'));
  clear(document.getElementById('footer-contact')).append(h('a', { href: '#/contact' }, t('Contact us')));
  clear(document.getElementById('footer-map')).append(`${t('Map data ©')} `, h('a', { href: 'https://www.openstreetmap.org/copyright' }, 'OpenStreetMap'), ` ${t('contributors.')}`);
  document.getElementById('footer-note').textContent = t('A community project, not affiliated with JKM or any government agency. Always confirm with the provider before you travel.');
}

// Language switch, Calm mode and (on phones) the menu button: always visible in the header.
function renderTools() {
  const calm = document.documentElement.classList.contains('calm');
  const menuOpen = menu.classList.contains('is-open');
  clear(tools).append(
    h('div', { class: 'lang', role: 'group', 'aria-label': t('Language') }, LANGS.map(([code, short, name]) => h('button', {
      type: 'button', lang: code, 'aria-pressed': String(getLang() === code), 'aria-label': name, title: name,
      onclick: () => { if (getLang() === code) return; setLang(code); route(); },
    }, short))),
    h('button', { type: 'button', class: 'toggle', 'aria-pressed': String(calm), onclick: () => {
      const on = document.documentElement.classList.toggle('calm');
      try { localStorage.setItem('oku-calm', on ? '1' : '0'); } catch { /* storage blocked */ }
      route();
    } }, h('span', { class: 'switch', 'aria-hidden': 'true' }), h('span', { class: 'toggle-text' }, t('Calm mode'))),
    h('button', { type: 'button', class: 'menu-btn', 'aria-expanded': String(menuOpen), 'aria-controls': 'menu', onclick: (e) => {
      const open = menu.classList.toggle('is-open');
      e.currentTarget.setAttribute('aria-expanded', String(open));
    } }, icon('menu', 22), h('span', { class: 'sr-only' }, t('Menu'))));
}

async function logout() {
  await api('POST', '/auth/logout');
  await ctx.refreshUser();
  toast(t('You are logged out.'));
  ctx.go('#/');
}

// The label lists from /api/meta (categories, features, offer kinds...) are English; read them through t() so
// every select, checkbox and badge built from them follows the chosen language.
const LABELS = ['categories', 'features', 'offerKinds', 'sources', 'benefitCategories', 'accessQuestions'];
const translated = (meta) => ({ ...meta, ...Object.fromEntries(LABELS.map((k) => [k, new Proxy(meta[k], { get: (o, key) => (typeof o[key] === 'string' ? t(o[key]) : o[key]) })])) });

const currentPath = () => location.hash.replace(/^#/, '').split('?')[0] || '/';

let current = null;
let token = 0;

async function route() {
  const mine = ++token;
  const path = currentPath();
  current?.destroy?.();
  current = null;
  menu.classList.remove('is-open');
  renderNav();
  const match = routes.map(([re, view]) => [re.exec(path), view]).find(([m]) => m);
  clear(main);
  if (!match) {
    main.append(h('div', { class: 'page' }, h('h1', { tabindex: '-1' }, t('Page not found')), h('p', {}, h('a', { href: '#/' }, t('Back to the map')))));
    document.title = `${t('Not found')} · OKU Benefits Hub`;
    return;
  }
  const [m, view] = match;
  main.append(h('p', { class: 'loading' }, t('Loading…')));
  const root = h('div', { class: 'view' });
  try {
    const result = await view(ctx, root, m.slice(1));
    if (mine !== token) { result?.destroy?.(); return; }
    clear(main).append(root);
    current = result;
    document.title = `${result?.title ? `${result.title} · ` : ''}OKU Benefits Hub`;
    result?.mounted?.();
    if (!result?.keepScroll) window.scrollTo(0, 0);
    const h1 = root.querySelector('h1');
    if (h1) { h1.setAttribute('tabindex', '-1'); h1.focus({ preventScroll: true }); }
  } catch (err) {
    if (mine !== token) return;
    clear(main).append(h('div', { class: 'page' },
      h('h1', { tabindex: '-1' }, err.status === 404 ? t('Not found') : t('Something went wrong')),
      h('p', {}, t(err.message)), h('p', {}, h('a', { href: '#/' }, t('Back to the map')))));
    document.title = `${t('Error')} · OKU Benefits Hub`;
  }
}

try {
  const [meta, me] = await Promise.all([api('GET', '/meta'), api('GET', '/auth/me'), loadPhotoCredits()]);
  state.meta = translated(meta);
  state.user = me.user;
  configureMaps(meta.maps);
} catch {
  clear(main).append(h('div', { class: 'page' }, h('h1', {}, t('We can’t reach the server')), h('p', {}, t('Please check your connection and reload.'))));
  throw new Error('boot failed');
}
window.addEventListener('hashchange', route);
route();
