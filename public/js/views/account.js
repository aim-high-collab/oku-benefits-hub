import { h } from '../dom.js';
import { api } from '../api.js';
import { badge, fmtDate } from '../ui.js';
import { t } from '../i18n.js';

const STATUS = { pending: ['Awaiting review', 'badge--warn'], approved: ['Approved', 'badge--ok'], rejected: ['Not accepted', 'badge--danger'] };
const statusBadge = (s) => badge(t(STATUS[s][0]), STATUS[s][1]);

export async function accountView(ctx, root) {
  if (!ctx.state.user) {
    sessionStorage.setItem('afterLogin', '#/account');
    ctx.go('#/login');
    return { title: t('Log in') };
  }
  const { places, benefits, edits } = await api('GET', '/me/submissions');
  const section = (title, items, render) => h('section', { class: 'section', 'aria-label': title },
    h('h2', {}, title),
    items.length ? h('ul', { class: 'plain-list' }, items.map((i) => h('li', { class: 'card' }, render(i)))) : h('p', { class: 'muted' }, t('Nothing here yet.')));

  root.append(h('div', { class: 'page page--narrow' },
    h('h1', {}, t('My contributions')),
    h('p', { class: 'lede' }, t('Signed in as {name} ({email}).', { name: ctx.state.user.name, email: ctx.state.user.email })),
    h('div', { class: 'actions' }, h('a', { class: 'btn', href: '#/submit/place' }, t('Add a place')), h('a', { class: 'btn btn--ghost', href: '#/submit/benefit' }, t('Add a benefit'))),
    section(t('Places I submitted'), places, (p) => [h('a', { href: `#/place/${p.id}` }, h('strong', {}, p.name)), ' ', statusBadge(p.status), h('span', { class: 'muted' }, ` · ${fmtDate(p.created_at)}`)]),
    section(t('Benefits I submitted'), benefits, (b) => [h('strong', {}, t(b.title)), ' ', statusBadge(b.status), h('span', { class: 'muted' }, ` · ${fmtDate(b.created_at)}`)]),
    section(t('Edits I suggested'), edits, (e) => [h('strong', {}, e.target_name ?? t('(removed listing)')), ' ', statusBadge(e.status), h('span', { class: 'muted' }, ` · ${fmtDate(e.created_at)}`),
      e.review_note ? h('p', { class: 'muted' }, `${t('Moderator note')}: ${e.review_note}`) : null])));
  return { title: t('My contributions') };
}
