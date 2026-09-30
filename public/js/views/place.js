import { h, clear } from '../dom.js';
import { api } from '../api.js';
import { badge, stars, fmtDate, field, radioGroup, errorSummary, offerLine } from '../ui.js';
import { createMap, destroyMap, pinIcon, directionsUrl, osmUrl } from '../map.js';

const HONOURED = { yes: 'Discount was honoured', no: 'Discount was not honoured', not_tried: 'Did not try the discount' };

export async function placeView(ctx, root, [id]) {
  const { state } = ctx;
  const { meta } = state;
  const [{ place: p }, { reviews }] = await Promise.all([api('GET', `/places/${id}`), api('GET', `/places/${id}/reviews`)]);
  const isAdmin = state.user?.role === 'admin';
  let map;

  const honouredTotal = p.honoured_yes + p.honoured_no;
  const summary = p.review_count
    ? h('p', {}, stars(p.avg_rating), ` ${p.avg_rating} from ${p.review_count} review${p.review_count === 1 ? '' : 's'}`,
      honouredTotal ? ` · Discount honoured for ${p.honoured_yes} of ${honouredTotal} who tried it` : '')
    : h('p', { class: 'muted' }, 'No reviews yet. Be the first to share your experience.');

  const contact = [
    ['Address', [p.address, p.city, p.state].filter(Boolean).join(', ')],
    p.phone ? ['Phone', h('a', { href: `tel:${p.phone.replace(/[^\d+]/g, '')}` }, p.phone)] : null,
    p.website ? ['Website', h('a', { href: p.website, rel: 'noopener noreferrer nofollow', target: '_blank' }, p.website.replace(/^https?:\/\//, '').replace(/\/$/, ''))] : null,
  ].filter(Boolean);

  const verifyBtn = isAdmin ? h('button', { type: 'button', class: 'btn btn--ghost btn--small', onclick: async () => {
    await api('PATCH', `/admin/places/${p.id}`, { partner_verified: !p.partner_verified });
    ctx.toast(p.partner_verified ? 'Partner badge removed.' : 'Marked as verified partner.');
    ctx.go(`#/place/${p.id}?r=${Date.now()}`);
  } }, p.partner_verified ? 'Remove partner badge' : 'Mark as verified partner') : null;

  root.append(h('div', { class: 'page page--wide' },
    h('a', { class: 'back', href: '#/' }, '← Back to the map'),
    p.status !== 'approved' ? h('p', { class: 'notice' }, 'This listing is awaiting moderator approval. Only you and moderators can see it.') : null,
    h('div', { class: 'place-head' },
      h('div', {},
        h('h1', {}, p.name),
        h('div', { class: 'badges' }, badge(meta.categories[p.category]),
          p.partner_verified ? badge('Verified partner', 'badge--ok') : null),
        summary),
      h('div', { class: 'actions' },
        h('a', { class: 'btn', href: directionsUrl(p), target: '_blank', rel: 'noopener noreferrer' }, 'Get directions'),
        p.status === 'approved' ? h('a', { class: 'btn btn--ghost', href: `#/place/${p.id}/edit` }, 'Suggest an edit') : null,
        verifyBtn)),
    p.description ? h('p', {}, p.description) : null,
    h('div', { class: 'two-col' },
      h('div', {},
        h('section', { class: 'section', 'aria-labelledby': 'offers-h' }, h('h2', { id: 'offers-h' }, 'OKU offers'),
          p.offers.length
            ? h('ul', { class: 'offer-list' }, p.offers.map((o) => h('li', { class: 'offer' },
              h('strong', {}, offerLine(o)),
              h('span', { class: 'meta' }, meta.offerKinds[o.kind]),
              o.conditions ? h('span', {}, ` — ${o.conditions}`) : null)))
            : h('p', { class: 'muted' }, 'No offers listed. Do they offer one? ', h('a', { href: `#/place/${p.id}/edit` }, 'Suggest an edit'), '.'),
          h('p', { class: 'hint' }, 'Bring your OKU card. Offers can change, so it is worth confirming before you go.')),
        h('section', { class: 'section', 'aria-labelledby': 'acc-h' }, h('h2', { id: 'acc-h' }, 'Accessibility'),
          p.accessibility.length
            ? h('ul', { class: 'chips' }, p.accessibility.map((f) => h('li', { class: 'chip chip--feature' }, meta.features[f])))
            : h('p', { class: 'muted' }, 'No accessibility features recorded yet.'))),
      h('div', {},
        h('section', { class: 'section', 'aria-labelledby': 'loc-h' }, h('h2', { id: 'loc-h' }, 'Location & contact'),
          h('dl', { class: 'dl' }, contact.map(([k, v]) => [h('dt', {}, k), h('dd', {}, v)])),
          h('div', { id: 'mini-map', role: 'region', 'aria-label': `Map showing ${p.name}`, style: null }),
          h('p', { class: 'hint' }, h('a', { href: osmUrl(p), target: '_blank', rel: 'noopener noreferrer' }, 'Open in OpenStreetMap'))))),
    reviewsSection()));

  function reviewsSection() {
    const wrap = h('section', { class: 'section', 'aria-labelledby': 'rev-h' }, h('h2', { id: 'rev-h' }, 'Reviews'));
    if (p.status !== 'approved') return wrap;
    wrap.append(reviewForm());
    if (!reviews.length) wrap.append(h('p', { class: 'muted' }, 'No reviews yet.'));
    for (const r of reviews) {
      wrap.append(h('article', { class: 'review' },
        h('header', {}, h('strong', {}, r.author), stars(r.rating), h('span', { class: 'muted' }, fmtDate(r.created_at)),
          badge(HONOURED[r.discount_honoured], r.discount_honoured === 'yes' ? 'badge--ok' : r.discount_honoured === 'no' ? 'badge--danger' : 'badge--muted'),
          r.access_rating ? h('span', {}, 'Accessibility: ', stars(r.access_rating, 'Accessibility rated')) : null),
        r.body ? h('p', {}, r.body) : null,
        isAdmin ? h('button', { type: 'button', class: 'btn btn--danger btn--small', onclick: async () => {
          if (!confirm('Remove this review?')) return;
          await api('DELETE', `/admin/reviews/${r.id}`);
          ctx.go(`#/place/${p.id}?r=${Date.now()}`);
        } }, 'Remove review') : null));
    }
    return wrap;
  }

  function reviewForm() {
    if (!state.user) {
      return h('p', { class: 'notice notice--info' }, h('a', { href: '#/login' }, 'Log in'), ' or ', h('a', { href: '#/register' }, 'create an account'), ' to write a review.');
    }
    const mine = reviews.find((r) => r.author === state.user.name);
    const rating = radioGroup({ legend: 'Overall rating (1 = poor, 5 = excellent)', name: 'rating', value: String(mine?.rating ?? ''), options: [1, 2, 3, 4, 5].map((n) => [String(n), String(n)]) });
    const access = radioGroup({ legend: 'Accessibility rating (optional)', name: 'access', value: String(mine?.access_rating ?? ''), options: [1, 2, 3, 4, 5].map((n) => [String(n), String(n)]) });
    const honoured = radioGroup({ legend: 'Was the OKU offer honoured?', name: 'honoured', value: mine?.discount_honoured ?? 'not_tried',
      options: [['yes', 'Yes'], ['no', 'No'], ['not_tried', 'I did not try it']] });
    const body = field({ label: 'Your review (optional)', name: 'body', tag: 'textarea', maxlength: 1000, value: mine?.body ?? '',
      hint: 'What was access like? Was staff helpful? Please do not share personal details.' });
    const errs = h('div');
    const submit = h('button', { class: 'btn', type: 'submit' }, mine ? 'Update my review' : 'Post review');
    return h('form', { class: 'review-form', 'aria-label': 'Write a review', novalidate: true, onsubmit: async (e) => {
      e.preventDefault();
      clear(errs);
      submit.disabled = true;
      try {
        await api('POST', `/places/${p.id}/reviews`, {
          rating: rating.value() ? Number(rating.value()) : null,
          access_rating: access.value() ? Number(access.value()) : null,
          discount_honoured: honoured.value(),
          body: body.input.value,
        });
        ctx.toast('Thank you – your review is posted.');
        ctx.go(`#/place/${p.id}?r=${Date.now()}`);
      } catch (err) {
        const s = errorSummary(err.message, err.fields);
        errs.append(s);
        s.focus();
        submit.disabled = false;
      }
    } }, h('h3', {}, mine ? 'Update your review' : 'Write a review'), errs, rating.el, access.el, honoured.el, body.el, submit);
  }

  return {
    title: p.name,
    mounted() {
      map = createMap(document.getElementById('mini-map'), { center: [p.lat, p.lng], zoom: 16 });
      L.marker([p.lat, p.lng], { icon: pinIcon(p.partner_verified ? 'pin--partner' : ''), title: p.name, alt: p.name }).addTo(map);
    },
    destroy() { destroyMap(map); },
  };
}
