import { h, clear } from '../dom.js';
import { api, qs } from '../api.js';
import { field, badge, fmtDate } from '../ui.js';

export async function benefitsView(ctx, root) {
  const { meta } = ctx.state;
  const q = field({ label: 'Search benefits', name: 'q', type: 'search', attrs: { placeholder: 'e.g. allowance, tax, transport', autocomplete: 'off' } });
  const category = field({ label: 'Category', name: 'category', tag: 'select', options: [['', 'All categories'], ...Object.entries(meta.benefitCategories)] });
  const count = h('p', { class: 'result-count', role: 'status' });
  const list = h('ul', { class: 'benefit-list', 'aria-label': 'Government benefits' });

  root.append(h('div', { class: 'page page--mid' },
    h('div', { class: 'title-row' }, h('h1', {}, 'Government benefits'), h('a', { class: 'btn btn--small btn--sun', href: '#/submit/benefit' }, 'Add a benefit')),
    h('p', { class: 'lede' }, 'What the government offers, gathered in one place. Rules and amounts change, so check with the agency before you apply. If something is out of date, tell us with “Suggest an edit”.'),
    h('form', { role: 'search', class: 'filters-inline', onsubmit: (e) => { e.preventDefault(); load(); } }, q.el, category.el),
    count, list));

  let timer;
  q.input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(load, 300); });
  category.input.addEventListener('change', load);

  async function load() {
    const { benefits } = await api('GET', `/benefits${qs({ q: q.input.value.trim(), category: category.input.value })}`);
    count.textContent = benefits.length === 1 ? '1 benefit' : `${benefits.length} benefits`;
    clear(list);
    if (!benefits.length) list.append(h('li', { class: 'empty' }, 'Nothing matches. ', h('a', { href: '#/submit/benefit' }, 'Add a benefit you know of.')));
    for (const b of benefits) {
      const tone = `tone-b${(Object.keys(meta.benefitCategories).indexOf(b.category) % 6) + 1}`;
      list.append(h('li', { class: `card benefit ${tone}` },
        h('div', { class: 'benefit-top' },
          h('span', { class: 'sticker' }, meta.benefitCategories[b.category]),
          h('h2', {}, b.title),
          h('p', { class: 'agency' }, b.agency)),
        h('div', { class: 'benefit-body' },
          h('div', { class: 'pills' }, b.last_verified ? badge(`Checked ${fmtDate(b.last_verified)}`, 'badge--ok') : badge('Not yet verified', 'badge--warn')),
          h('p', {}, b.summary),
          b.eligibility || b.how_to_apply ? h('dl', { class: 'facts' },
            b.eligibility ? [h('dt', {}, 'Who can apply'), h('dd', {}, b.eligibility)] : null,
            b.how_to_apply ? [h('dt', {}, 'How to apply'), h('dd', {}, b.how_to_apply)] : null) : null,
          h('div', { class: 'actions' },
            b.url ? h('a', { class: 'btn btn--small', href: b.url, target: '_blank', rel: 'noopener noreferrer' }, 'Official website') : null,
            h('a', { class: 'btn btn--small btn--ghost', href: `#/benefits/${b.id}/edit`, 'aria-label': `Suggest an edit to ${b.title}` }, 'Suggest an edit')))));
    }
  }

  await load();
  return { title: 'Government benefits', destroy() { clearTimeout(timer); } };
}
