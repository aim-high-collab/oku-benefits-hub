import { h, clear } from './dom.js';
import { api } from './api.js';
import { announce, toast, icon } from './ui.js';
import { exploreView } from './views/explore.js';
import { placeView } from './views/place.js';
import { benefitsView } from './views/benefits.js';
import { submitPlaceView, editPlaceView, submitBenefitView, editBenefitView } from './views/contribute.js';
import { loginView, registerView } from './views/auth.js';
import { accountView } from './views/account.js';
import { adminView } from './views/admin.js';
import { businessView } from './views/business.js';

const main = document.getElementById('main');
const nav = document.getElementById('nav');

export const state = { user: null, meta: null, filters: { q: '', category: '', kind: '', features: [], sort: 'recommended' }, loc: null };

const ctx = {
  state,
  go: (hash) => { location.hash = hash; },
  announce,
  toast,
  async refreshUser() {
    state.user = (await api('GET', '/auth/me')).user;
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
  [/^\/login$/, loginView],
  [/^\/register$/, registerView],
  [/^\/account$/, accountView],
  [/^\/admin$/, adminView],
  [/^\/business$/, businessView],
];

const NAV = [
  ['#/', 'Places', /^\/?$|^\/place/],
  ['#/benefits', 'Benefits', /^\/benefits/],
  ['#/business', 'For business', /^\/business/],
];

function renderNav() {
  const path = currentPath();
  const account = document.getElementById('account');
  clear(nav);
  clear(account);
  for (const [href, label, re] of NAV) {
    nav.append(h('a', { href, 'aria-current': re.test(path) ? 'page' : null }, label));
  }
  if (state.user) {
    if (state.user.role === 'admin') nav.append(h('a', { href: '#/admin', 'aria-current': path === '/admin' ? 'page' : null }, 'Moderation'));
    account.append(
      h('a', { class: 'btn btn--small', href: '#/submit/place' }, icon('plus', 16), 'Add a place'),
      h('a', { class: 'me', href: '#/account', 'aria-current': path === '/account' ? 'page' : null, title: 'My contributions' },
        h('span', { class: 'avatar', 'aria-hidden': 'true' }, state.user.name.trim().charAt(0).toUpperCase()), h('span', { class: 'me-name' }, state.user.name)),
      h('button', { type: 'button', class: 'linkbtn', onclick: logout }, 'Log out'));
  } else {
    account.append(
      h('a', { class: 'linkbtn', href: '#/login', 'aria-current': path === '/login' ? 'page' : null }, 'Log in'),
      h('a', { class: 'btn btn--small', href: '#/register' }, 'Sign up'));
  }
}

async function logout() {
  await api('POST', '/auth/logout');
  await ctx.refreshUser();
  toast('You are logged out.');
  ctx.go('#/');
}

const currentPath = () => location.hash.replace(/^#/, '').split('?')[0] || '/';

let current = null;
let token = 0;

async function route() {
  const mine = ++token;
  const path = currentPath();
  current?.destroy?.();
  current = null;
  renderNav();
  const match = routes.map(([re, view]) => [re.exec(path), view]).find(([m]) => m);
  clear(main);
  if (!match) {
    main.append(h('div', { class: 'page' }, h('h1', { tabindex: '-1' }, 'Page not found'), h('p', {}, h('a', { href: '#/' }, 'Back to the map'))));
    document.title = 'Not found · OKU Benefits Hub';
    return;
  }
  const [m, view] = match;
  main.append(h('p', { class: 'loading' }, 'Loading…'));
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
      h('h1', { tabindex: '-1' }, err.status === 404 ? 'Not found' : 'Something went wrong'),
      h('p', {}, err.message), h('p', {}, h('a', { href: '#/' }, 'Back to the map'))));
    document.title = 'Error · OKU Benefits Hub';
  }
}

try {
  const [meta, me] = await Promise.all([api('GET', '/meta'), api('GET', '/auth/me')]);
  state.meta = meta;
  state.user = me.user;
} catch {
  clear(main).append(h('div', { class: 'page' }, h('h1', {}, 'We can’t reach the server'), h('p', {}, 'Please check your connection and reload.')));
  throw new Error('boot failed');
}
window.addEventListener('hashchange', route);
route();
