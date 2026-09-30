import { h, clear } from '../dom.js';
import { api } from '../api.js';
import { badge, fmtDate, offerLine } from '../ui.js';

export async function adminView(ctx, root) {
  const { state } = ctx;
  if (state.user?.role !== 'admin') {
    root.append(h('div', { class: 'page' }, h('h1', {}, 'Moderators only'), h('p', {}, 'You need a moderator account to see this page.')));
    return { title: 'Moderation' };
  }
  const { meta } = state;
  const page = h('div', { class: 'page' });
  root.append(page);

  const fmtVal = (key, v) => {
    if (key === 'offers') return v.length ? v.map(offerLine).join('; ') : '(none)';
    if (key === 'accessibility') return v.length ? v.map((f) => meta.features[f]).join(', ') : '(none)';
    if (key === 'category') return meta.categories[v] ?? meta.benefitCategories[v] ?? v;
    return v === '' || v == null ? '(empty)' : String(v);
  };

  async function decide(url, body, done) {
    try {
      await api('POST', url, body);
      ctx.toast(done);
      await load();
    } catch (err) {
      ctx.toast(err.message, 'error');
    }
  }

  const actions = (base, extra) => {
    const note = h('input', { type: 'text', 'aria-label': 'Note to contributor (optional)', placeholder: 'Note to contributor (optional)', maxlength: 500 });
    return h('div', {}, h('div', { class: 'field' }, note),
      h('div', { class: 'actions' },
        h('button', { type: 'button', class: 'btn btn--small', onclick: () => decide(`${base}/approve`, { note: note.value }, 'Approved.') }, 'Approve'),
        extra,
        h('button', { type: 'button', class: 'btn btn--danger btn--small', onclick: () => decide(`${base}/reject`, { note: note.value }, 'Rejected.') }, 'Reject')));
  };

  async function load() {
    const q = await api('GET', '/admin/queue');
    clear(page).append(
      h('h1', {}, 'Moderation queue'),
      h('p', { class: 'lede' }, `${q.places.length} new place${q.places.length === 1 ? '' : 's'}, ${q.benefits.length} new benefit${q.benefits.length === 1 ? '' : 's'}, ${q.edits.length} edit request${q.edits.length === 1 ? '' : 's'} waiting.`),

      h('section', { class: 'section', 'aria-labelledby': 'q-places' }, h('h2', { id: 'q-places' }, 'New places'),
        q.places.length ? null : h('p', { class: 'muted' }, 'Nothing waiting.'),
        q.places.map((p) => h('article', { class: 'card queue-item' },
          h('h3', {}, p.name),
          h('div', { class: 'badges' }, badge(meta.categories[p.category]), p.submitter_is_owner ? badge('Claims to be the owner', 'badge--warn') : badge('Community submission', 'badge--muted')),
          h('p', { class: 'muted' }, `${[p.address, p.city, p.state].filter(Boolean).join(', ')} · by ${p.submitter ?? 'unknown'} · ${fmtDate(p.created_at)}`),
          p.description ? h('p', {}, p.description) : null,
          p.offers.length ? h('ul', {}, p.offers.map((o) => h('li', {}, `${offerLine(o)} (${meta.offerKinds[o.kind]})${o.conditions ? ` — ${o.conditions}` : ''}`))) : null,
          p.accessibility.length ? h('p', {}, h('strong', {}, 'Accessibility: '), p.accessibility.map((f) => meta.features[f]).join(', ')) : null,
          h('p', {}, h('a', { href: `#/place/${p.id}` }, 'Open listing'), ' · ', h('a', { href: `https://www.openstreetmap.org/?mlat=${p.lat}&mlon=${p.lng}#map=18/${p.lat}/${p.lng}`, target: '_blank', rel: 'noopener noreferrer' }, 'Check location on map')),
          actions(`/admin/places/${p.id}`, p.submitter_is_owner
            ? h('button', { type: 'button', class: 'btn btn--ghost btn--small', onclick: async () => {
              try { await api('POST', `/admin/places/${p.id}/approve`); await api('PATCH', `/admin/places/${p.id}`, { partner_verified: true }); ctx.toast('Approved as verified partner.'); await load(); } catch (e) { ctx.toast(e.message, 'error'); }
            } }, 'Approve as verified partner') : null)))),

      h('section', { class: 'section', 'aria-labelledby': 'q-benefits' }, h('h2', { id: 'q-benefits' }, 'New benefits'),
        q.benefits.length ? null : h('p', { class: 'muted' }, 'Nothing waiting.'),
        q.benefits.map((b) => h('article', { class: 'card queue-item' },
          h('h3', {}, b.title),
          h('p', { class: 'muted' }, `${b.agency} · ${meta.benefitCategories[b.category]} · by ${b.submitter ?? 'unknown'} · ${fmtDate(b.created_at)}`),
          h('p', {}, b.summary),
          b.eligibility ? h('p', {}, h('strong', {}, 'Eligibility: '), b.eligibility) : null,
          b.how_to_apply ? h('p', {}, h('strong', {}, 'How to apply: '), b.how_to_apply) : null,
          b.url ? h('p', {}, 'Source: ', h('a', { href: b.url, target: '_blank', rel: 'noopener noreferrer nofollow' }, b.url)) : h('p', { class: 'muted' }, 'No source link provided.'),
          actions(`/admin/benefits/${b.id}`)))),

      h('section', { class: 'section', 'aria-labelledby': 'q-edits' }, h('h2', { id: 'q-edits' }, 'Edit requests'),
        q.edits.length ? null : h('p', { class: 'muted' }, 'Nothing waiting.'),
        q.edits.map((e) => h('article', { class: 'card queue-item' },
          h('h3', {}, `${e.target_type === 'place' ? 'Place' : 'Benefit'} #${e.target_id}: ${e.current ? (e.current.name ?? e.current.title) : '(deleted)'}`),
          h('p', { class: 'muted' }, `by ${e.submitter ?? 'unknown'} · ${fmtDate(e.created_at)}`),
          e.reason ? h('p', {}, h('strong', {}, 'Reason: '), e.reason) : null,
          h('table', { class: 'diff' }, h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, 'Field'), h('th', { scope: 'col' }, 'Current'), h('th', { scope: 'col' }, 'Proposed'))),
            h('tbody', {}, Object.entries(e.changes).map(([k, v]) => h('tr', {}, h('th', { scope: 'row' }, k), h('td', { class: 'old' }, e.current ? fmtVal(k, e.current[k]) : '—'), h('td', { class: 'new' }, fmtVal(k, v)))))),
          e.target_type === 'place' && e.current ? h('p', {}, h('a', { href: `#/place/${e.target_id}` }, 'Open current listing')) : null,
          e.missing ? h('p', { class: 'notice' }, 'The listing no longer exists. Reject this request.') : null,
          actions(`/admin/edits/${e.id}`)))),
    );
  }

  await load();
  return { title: 'Moderation' };
}
