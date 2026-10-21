import { h } from '../dom.js';
import { api } from '../api.js';
import { t } from '../i18n.js';
import { offerLine, offerIcon, placeImage, trustStamp, groupOf } from '../ui.js';
import { saveButton } from '../saved.js';

export async function savedView(ctx, root) {
  if (!ctx.state.user) {
    sessionStorage.setItem('afterLogin', '#/saved');
    root.append(h('div', { class: 'page page--narrow' }, h('h1', {}, t('Saved places')),
      h('p', {}, t('Log in to see the places you saved.')),
      h('div', { class: 'actions' }, h('a', { class: 'btn', href: '#/login' }, t('Log in')), h('a', { class: 'btn btn--ghost', href: '#/register' }, t('Create account')))));
    return { title: t('Saved places') };
  }
  const { places } = await api('GET', '/me/saved');
  const meta = ctx.state.meta;
  root.append(h('div', { class: 'page page--mid' },
    h('h1', {}, t('Saved places')),
    places.length
      ? h('ul', { class: 'saved-list' }, places.map((p) => {
        const first = p.offers[0];
        return h('li', { class: `result tone-${groupOf(p.category)}` },
          placeImage(p, 'result-thumb'),
          h('div', { class: 'result-body' },
            h('h2', {}, h('a', { href: `#/place/${p.id}` }, p.name)),
            h('p', { class: 'result-meta' }, [meta.categories[p.category], p.city].filter(Boolean).join(' · ')),
            first ? h('p', { class: 'result-offer' }, offerIcon(first.kind), h('strong', {}, offerLine(first))) : null,
            h('div', { class: 'result-foot' }, trustStamp(p), saveButton(ctx, p))));
      }))
      : h('div', { class: 'empty' }, h('p', {}, t('Nothing saved yet. Tap Save on any place to keep it here.')), h('a', { class: 'btn', href: '#/' }, t('Discover places')))));
  return { title: t('Saved places') };
}
