import { h, clear } from '../dom.js';
import { api, qs } from '../api.js';
import { field, badge, fmtDate, icon } from '../ui.js';
import { t } from '../i18n.js';

/** "Government resources": a short, clearly-labelled set of links out to government agencies, not a portal of our own. */
export async function benefitsView(ctx, root) {
  const { meta } = ctx.state;
  const q = field({ label: t('Search official help'), name: 'q', type: 'search', attrs: { placeholder: t('e.g. allowance, tax, transport'), autocomplete: 'off' } });
  const category = field({ label: t('Category'), name: 'category', tag: 'select', options: [['', t('All categories')], ...Object.entries(meta.benefitCategories)] });
  const count = h('p', { class: 'result-count', role: 'status' });
  const list = h('ul', { class: 'benefit-list', 'aria-label': t('Government resources') });

  root.append(h('div', { class: 'page page--mid' },
    h('h1', {}, t('Government help for OKU')),
    h('p', { class: 'note-box note-box--dashed' }, icon('external', 18), ' ',
      t('We don’t run these schemes and can’t check if you qualify. Each link opens the agency’s own website.'), ' ',
      t('Rules and amounts change. Check with the agency before you apply.')),
    h('form', { role: 'search', class: 'filters-inline', onsubmit: (e) => { e.preventDefault(); load(); } }, q.el, category.el),
    count, list,
    h('div', { class: 'actions' },
      h('a', { class: 'btn btn--sun', href: '#/' }, t('Back to places that say yes')),
      h('a', { class: 'btn btn--ghost btn--small', href: '#/submit/benefit' }, t('Something out of date?')))));

  let timer;
  q.input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(load, 300); });
  category.input.addEventListener('change', load);

  async function load() {
    const { benefits } = await api('GET', `/benefits${qs({ q: q.input.value.trim(), category: category.input.value })}`);
    count.textContent = benefits.length === 1 ? t('1 link') : t('{n} links', { n: benefits.length });
    clear(list);
    if (!benefits.length) list.append(h('li', { class: 'empty' }, t('Nothing matches.')));
    for (const b of benefits) {
      list.append(h('li', { class: 'card benefit' },
        h('div', { class: 'benefit-body' },
          h('p', { class: 'agency' }, h('strong', {}, t(b.agency)), ' · ', meta.benefitCategories[b.category]),
          h('h2', {}, t(b.title)),
          h('p', {}, t(b.summary)),
          b.eligibility || b.how_to_apply ? h('dl', { class: 'facts' },
            b.eligibility ? [h('dt', {}, t('Who can apply')), h('dd', {}, t(b.eligibility))] : null,
            b.how_to_apply ? [h('dt', {}, t('How to apply')), h('dd', {}, t(b.how_to_apply))] : null) : null,
          h('div', { class: 'actions' },
            b.url ? h('a', { class: 'btn btn--small', href: b.url, target: '_blank', rel: 'noopener noreferrer' }, t('Official website (opens in a new tab)'), ' ', icon('external', 16)) : null,
            b.last_verified ? badge(t('Link checked {date}', { date: fmtDate(b.last_verified) }), 'badge--ok') : null,
            h('a', { class: 'linkbtn', href: `#/benefits/${b.id}/edit`, 'aria-label': `${t('Suggest an edit')}: ${t(b.title)}` }, t('Suggest an edit'))))));
    }
  }

  await load();
  return { title: t('Government resources'), destroy() { clearTimeout(timer); } };
}
