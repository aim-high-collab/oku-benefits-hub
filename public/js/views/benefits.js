import { h, clear } from '../dom.js';
import { api, qs } from '../api.js';
import { field, badge, fmtDate } from '../ui.js';

export async function benefitsView(ctx, root) {
  const { meta } = ctx.state;
  const q = field({ label: 'Search benefits', name: 'q', type: 'search', attrs: { placeholder: 'e.g. allowance, tax, transport', autocomplete: 'off' } });
  const category = field({ label: 'Category', name: 'category', tag: 'select', options: [['', 'All categories'], ...Object.entries(meta.benefitCategories)] });
  const count = h('p', { class: 'result-count', role: 'status' });
  const list = h('ul', { class: 'benefit-list', 'aria-label': 'Government benefits' });

  root.append(h('div', { class: 'page' },
    h('h1', {}, 'Government benefits for OKU'),
    h('p', { class: 'lede' }, 'A community-maintained guide to what is available from government agencies. Rules and amounts change, so use the agency link or office to confirm before you apply.'),
    h('form', { role: 'search', class: 'card', onsubmit: (e) => { e.preventDefault(); load(); } },
      h('div', { class: 'grid-2' }, q.el, category.el)),
    h('div', { class: 'actions' }, h('a', { class: 'btn', href: '#/submit/benefit' }, 'Add a benefit')),
    count, list));

  let timer;
  q.input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(load, 300); });
  category.input.addEventListener('change', load);

  async function load() {
    const { benefits } = await api('GET', `/benefits${qs({ q: q.input.value.trim(), category: category.input.value })}`);
    count.textContent = benefits.length === 1 ? '1 benefit' : `${benefits.length} benefits`;
    clear(list);
    if (!benefits.length) list.append(h('li', { class: 'empty card' }, 'Nothing matches. ', h('a', { href: '#/submit/benefit' }, 'Add a benefit you know of.')));
    for (const b of benefits) {
      list.append(h('li', { class: 'card benefit' },
        h('h2', {}, b.title),
        h('p', { class: 'muted' }, b.agency),
        h('div', { class: 'badges' }, badge(meta.benefitCategories[b.category]),
          b.last_verified ? badge(`Verified ${fmtDate(b.last_verified)}`, 'badge--ok') : badge('Not yet verified by a moderator', 'badge--warn')),
        h('p', {}, b.summary),
        b.eligibility ? h('p', {}, h('strong', {}, 'Who can apply: '), b.eligibility) : null,
        b.how_to_apply ? h('p', {}, h('strong', {}, 'How to apply: '), b.how_to_apply) : null,
        h('div', { class: 'actions' },
          b.url ? h('a', { class: 'btn btn--small', href: b.url, target: '_blank', rel: 'noopener noreferrer' }, 'Official website') : null,
          h('a', { class: 'btn btn--ghost btn--small', href: `#/benefits/${b.id}/edit`, 'aria-label': `Suggest an edit to ${b.title}` }, 'Suggest an edit'))));
    }
  }

  await load();
  return { title: 'Government benefits', destroy() { clearTimeout(timer); } };
}
