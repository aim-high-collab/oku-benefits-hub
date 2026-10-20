import { h, clear } from '../dom.js';
import { api } from '../api.js';
import { badge, stars, fmtDate, field, radioGroup, errorSummary, offerLine, icon, groupOf, placeImage, photoCredit, offerIcon,
  trustOf, trustStamp, workedCounts, workedMeter, mobileNumber } from '../ui.js';
import { t, tIn } from '../i18n.js';
import { createMap, destroyMap, directionsUrl, googleMapsUrl, osmUrl, usingGoogle } from '../map.js';

const HONOURED = { yes: 'Discount honoured', no: 'Discount not honoured', not_tried: 'Did not try the discount' };
const VOTED_KEY = 'oku-visits';

const votedFor = (id) => { try { return JSON.parse(localStorage.getItem(VOTED_KEY) || '[]').includes(id); } catch { return false; } };
const rememberVote = (id) => {
  try { localStorage.setItem(VOTED_KEY, JSON.stringify([...JSON.parse(localStorage.getItem(VOTED_KEY) || '[]'), id].slice(-200))); } catch { /* storage blocked */ }
};

export async function placeView(ctx, root, [id]) {
  const { state } = ctx;
  const { meta } = state;
  const [{ place: p }, { reviews }] = await Promise.all([api('GET', `/places/${id}`), api('GET', `/places/${id}/reviews`)]);
  const isAdmin = state.user?.role === 'admin';
  let map;
  let destroyed = false;

  const honouredTotal = p.honoured_yes + p.honoured_no;
  const refresh = () => ctx.go(`#/place/${p.id}?r=${Date.now()}`);
  const first = p.offers[0];
  const mobile = mobileNumber(p.phone);
  const tel = p.phone ? p.phone.replace(/[^\d+]/g, '') : '';

  const verifyBtn = isAdmin ? h('button', { type: 'button', class: 'btn btn--ghost', onclick: async () => {
    await api('PATCH', `/admin/places/${p.id}`, { partner_verified: !p.partner_verified });
    ctx.toast(p.partner_verified ? t('Partner badge removed.') : t('Marked as business confirmed.'));
    refresh();
  } }, p.partner_verified ? t('Remove business-confirmed label') : t('Mark as business confirmed')) : null;

  // ----- "Show the cashier": a large card to turn round at the till -----
  const cashier = h('dialog', { class: 'cashier', 'aria-labelledby': 'cashier-h' },
    h('p', { class: 'hint', id: 'cashier-h' }, t('Turn your phone round to show this.')),
    h('p', { class: 'cashier-big', lang: 'ms' }, `Saya pemegang kad OKU. Boleh saya dapat tawaran OKU${first ? `: ${offerLine(first, 'ms')}` : ''}?`),
    h('p', { lang: 'en' }, `I have an OKU card. Can I get the OKU offer${first ? `: ${offerLine(first, 'en')}` : ''}?`),
    h('p', { lang: 'zh' }, `我是OKU卡持有人。可以给我OKU优惠吗${first ? `：${offerLine(first, 'zh')}` : ''}？`),
    trustStamp(p, { detail: true }),
    h('form', { method: 'dialog' }, h('button', { class: 'btn btn--ghost', type: 'submit' }, t('Close'))));

  // ----- trust panel -----
  const tr = trustOf(p);
  const counts = { ...workedCounts(p) };
  const meterBox = h('div', { class: 'worked' });
  const drawMeter = () => clear(meterBox).append(counts.total
    ? [workedMeter(counts.yes, counts.total), h('p', {}, h('strong', {}, t('Worked {a} of {b} visits', { a: counts.yes, b: counts.total })))]
    : h('p', { class: 'muted' }, t('No one has reported a visit yet.')));
  drawMeter();

  const voteStatus = h('p', { class: 'hint', role: 'status' });
  const voteBtns = [['yes', 'Yes', 'check'], ['no', 'No', 'x'], ['partly', 'Partly', null]].map(([v, label, ic]) => h('button', {
    type: 'button', class: 'btn btn--ghost', disabled: votedFor(p.id), onclick: async () => {
      for (const b of voteBtns) b.disabled = true;
      try {
        const r = await api('POST', `/places/${p.id}/visits`, { worked: v });
        Object.assign(p, r);
        Object.assign(counts, workedCounts(p));
        drawMeter();
        rememberVote(p.id);
        voteStatus.textContent = t('Thank you. Your answer is counted.');
      } catch (err) {
        voteStatus.textContent = err.message;
        for (const b of voteBtns) b.disabled = false;
      }
    } }, ic ? icon(ic, 18) : null, t(label)));
  if (votedFor(p.id)) voteStatus.textContent = t('You already answered for this place on this device.');

  const trustPanel = h('section', { class: `trust-panel trust-panel--${tr.tier}`, 'aria-labelledby': 'trust-h' },
    h('h2', { id: 'trust-h' }, t('How sure is this?')),
    trustStamp(p, { detail: true, cls: 'stamp--big' }),
    meterBox,
    p.status === 'approved' ? h('div', { class: 'did-it-work' },
      h('h3', {}, t('Been here? Did the OKU offer work?')),
      h('p', { class: 'hint' }, t('No account needed. Your answer updates the count above.')),
      h('div', { class: 'vote-row' }, voteBtns), voteStatus) : null);

  // ----- contact: messages before calls -----
  const contactBtns = h('div', { class: 'contact-btns' },
    mobile ? h('a', { class: 'btn', href: `https://wa.me/${mobile}`, target: '_blank', rel: 'noopener noreferrer' }, icon('chat', 18), t('WhatsApp')) : null,
    mobile ? h('a', { class: 'btn btn--ghost', href: `sms:+${mobile}` }, icon('chat', 18), t('SMS')) : null,
    tel ? h('a', { class: 'btn btn--ghost', href: `tel:${tel}` }, icon('phone', 18), t('Call {n}', { n: p.phone })) : null,
    h('a', { class: 'btn btn--ghost', href: directionsUrl(p), target: '_blank', rel: 'noopener noreferrer' }, icon('directions', 18), t('Directions')));

  root.append(h('div', { class: 'page page--wide' },
    h('nav', { class: 'crumbs', 'aria-label': t('Breadcrumb') }, h('a', { href: '#/' }, t('Places')), h('span', { 'aria-hidden': 'true' }, '/'), h('span', {}, p.city || p.state || meta.categories[p.category])),
    p.status !== 'approved' ? h('p', { class: 'notice' }, t('This listing is awaiting moderator approval. Only you and moderators can see it.')) : null,
    h('header', { class: `place-head tone-${groupOf(p.category)}` },
      placeImage(p, 'place-banner'),
      h('div', {},
        h('h1', {}, p.name),
        h('p', { class: 'muted place-sub' }, [meta.categories[p.category], [p.address, p.city].filter(Boolean).join(', ')].filter(Boolean).join(' · ')), photoCredit(p))),
    h('div', { class: 'place-grid' },
      h('div', { class: 'place-main' },
        h('section', { class: 'glance', 'aria-labelledby': 'glance-h' },
          h('h2', { id: 'glance-h' }, t('At a glance')),
          first ? [
            h('p', { class: 'glance-offer' }, offerIcon(first.kind), h('strong', {}, offerLine(first))),
            first.conditions ? h('p', {}, t(first.conditions)) : null,
            first.valid_until ? h('p', {}, h('strong', {}, t('Valid until {date}', { date: fmtDate(first.valid_until) }))) : null,
            first.kind !== 'volunteer' ? h('p', {}, t('Bring your OKU card.')) : null,
          ] : h('p', { class: 'muted' }, t('Nothing listed yet.')),
          trustStamp(p, { detail: true }),
          h('div', { class: 'actions' },
            first && first.kind !== 'volunteer' ? h('button', { type: 'button', class: 'btn btn--sun', onclick: () => cashier.showModal() }, icon('card', 18), t('Show the cashier')) : null,
            p.status === 'approved' ? h('a', { class: 'btn btn--ghost', href: `#/place/${p.id}/edit` }, icon('edit', 16), t('Suggest an edit')) : null,
            verifyBtn)),
        h('section', { class: 'block', 'aria-labelledby': 'contact-h' }, h('h2', { id: 'contact-h' }, t('Ask before you go')), contactBtns),
        first && first.kind !== 'volunteer' ? h('section', { class: 'block', 'aria-labelledby': 'claim-h' },
          h('h2', { id: 'claim-h' }, t('How to claim')),
          h('ol', { class: 'claim-steps' },
            h('li', {}, t('Go to the counter or ticket desk as usual.')),
            h('li', {}, t('Show your OKU card before you pay.')),
            h('li', {}, t('Check the price or receipt shows the OKU offer.')))) : null,
        p.offers.length > 1 || (first && (first.conditions || first.value_text)) ? h('section', { class: 'block', 'aria-labelledby': 'offers-h' },
          h('h2', { id: 'offers-h' }, t('Offers & ways to help')),
          h('ul', { class: 'offer-list' }, p.offers.map((o) => h('li', { class: `offer-card offer-card--${o.kind}` },
            h('div', { class: 'offer-kind' }, offerIcon(o.kind), meta.offerKinds[o.kind]),
            h('strong', {}, offerLine(o)),
            o.conditions ? h('p', {}, t(o.conditions)) : null,
            o.valid_until ? h('p', {}, t('Valid until {date}', { date: fmtDate(o.valid_until) })) : null)))) : null,
        h('section', { class: 'block', 'aria-labelledby': 'acc-h' },
          h('h2', { id: 'acc-h' }, t('Accessibility')),
          p.accessibility.length
            ? h('ul', { class: 'feature-grid' }, p.accessibility.map((f) => h('li', {}, icon('check', 14), meta.features[f])))
            : h('p', { class: 'unknown' }, icon('question', 18), h('span', {}, t('Not known yet. Ask the place before you go, or'), ' ',
              h('a', { href: `#/place/${p.id}/edit` }, t('add what you know')), '.'))),
        p.description ? h('section', { class: 'block', 'aria-labelledby': 'about-h' }, h('h2', { id: 'about-h' }, t('About this place')), h('p', { class: 'place-about' }, t(p.description))) : null,
        reviewsSection()),
      h('aside', { class: 'place-side', 'aria-label': t('Location and contact') },
        trustPanel,
        h('p', { class: 'hint side-note' }, t('Offer ended or wrong? Answer “No” above, or suggest an edit.')),
        h('div', { class: 'side-map' },
          h('div', { id: 'mini-map', role: 'region', 'aria-label': t('Map showing {name}', { name: p.name }) }),
          h('ul', { class: 'contact-list' },
            h('li', {}, icon('pin', 18), h('span', {}, [p.address, p.city, p.state].filter(Boolean).join(', '))),
            p.website ? h('li', {}, icon('globe', 18), h('a', { href: p.website, rel: 'noopener noreferrer nofollow', target: '_blank' }, p.website.replace(/^https?:\/\//, '').replace(/\/$/, ''))) : null),
          h('p', { class: 'side-link' }, usingGoogle()
            ? h('a', { href: googleMapsUrl(p), target: '_blank', rel: 'noopener noreferrer' }, t('Open in Google Maps'))
            : h('a', { href: osmUrl(p), target: '_blank', rel: 'noopener noreferrer' }, t('Open in OpenStreetMap')))))),
    cashier));

  function reviewsSection() {
    const wrap = h('section', { class: 'block', 'aria-labelledby': 'rev-h' }, h('h2', { id: 'rev-h' }, t('Reviews')));
    if (p.status !== 'approved') return wrap;
    if (p.review_count) {
      wrap.append(h('div', { class: 'review-summary' },
        h('div', { class: 'big-rating' }, p.avg_rating),
        h('div', {}, stars(p.avg_rating), h('p', { class: 'muted' }, p.review_count === 1 ? t('1 review') : t('{n} reviews', { n: p.review_count }),
          honouredTotal ? ` · ${t('Discount honoured for {a} of {b} who tried it', { a: p.honoured_yes, b: honouredTotal })}` : ''))));
    }
    wrap.append(reviewForm());
    if (!reviews.length) wrap.append(h('p', { class: 'muted' }, t('No reviews yet')));
    for (const r of reviews) {
      wrap.append(h('article', { class: 'review' },
        h('header', {}, h('strong', {}, r.author), stars(r.rating), h('span', { class: 'muted' }, fmtDate(r.created_at))),
        h('div', { class: 'pills' },
          badge(t(HONOURED[r.discount_honoured]), r.discount_honoured === 'yes' ? 'badge--ok' : r.discount_honoured === 'no' ? 'badge--danger' : 'badge--muted'),
          r.access_rating ? h('span', { class: 'muted' }, `${t('Accessibility')} `, stars(r.access_rating, 'Accessibility rated {n} out of 5')) : null),
        r.body ? h('p', {}, r.body) : null,
        isAdmin ? h('button', { type: 'button', class: 'btn btn--danger btn--small', onclick: async () => {
          if (!confirm(t('Remove this review?'))) return;
          await api('DELETE', `/admin/reviews/${r.id}`);
          refresh();
        } }, t('Remove review')) : null));
    }
    return wrap;
  }

  function reviewForm() {
    if (!state.user) {
      return h('div', { class: 'notice notice--info' }, h('p', {}, t('To write a longer review, log in or create an account. You can answer “Did the OKU offer work?” without one.')),
        h('p', {}, h('a', { href: '#/login' }, t('Log in')), ' · ', h('a', { href: '#/register' }, t('Create an account'))));
    }
    const mine = reviews.find((r) => r.author === state.user.name);
    const rating = radioGroup({ legend: t('Overall rating (1 = poor, 5 = excellent)'), name: 'rating', value: String(mine?.rating ?? ''), options: [1, 2, 3, 4, 5].map((n) => [String(n), String(n)]) });
    const access = radioGroup({ legend: t('Accessibility rating (optional)'), name: 'access', value: String(mine?.access_rating ?? ''), options: [1, 2, 3, 4, 5].map((n) => [String(n), String(n)]) });
    const honoured = radioGroup({ legend: t('Was the OKU offer honoured?'), name: 'honoured', value: mine?.discount_honoured ?? 'not_tried',
      options: [['yes', t('Yes')], ['no', t('No')], ['not_tried', t('I did not try it')]] });
    const body = field({ label: t('Your review (optional)'), name: 'body', tag: 'textarea', maxlength: 1000, value: mine?.body ?? '',
      hint: t('What was access like? Was staff helpful? Please do not share personal details.') });
    const errs = h('div');
    const submit = h('button', { class: 'btn', type: 'submit' }, mine ? t('Update my review') : t('Post review'));
    return h('form', { class: 'review-form', 'aria-label': t('Write a review'), novalidate: true, onsubmit: async (e) => {
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
        ctx.toast(t('Thank you, your review is posted.'));
        refresh();
      } catch (err) {
        const s = errorSummary(err.message, err.fields);
        errs.append(s);
        s.focus();
        submit.disabled = false;
      }
    } }, h('h3', {}, mine ? t('Update your review') : t('Write a review')), errs, rating.el, access.el, honoured.el, body.el, h('div', { class: 'actions' }, submit));
  }

  return {
    title: p.name,
    async mounted() {
      const m = await createMap(document.getElementById('mini-map'), { center: [p.lat, p.lng], zoom: 16 });
      if (destroyed) return destroyMap(m);
      map = m;
      map.addMarker({ lat: p.lat, lng: p.lng, tone: `tone-${groupOf(p.category)} pin--${tr.tier}`, title: p.name });
    },
    destroy() { destroyed = true; cashier.close?.(); destroyMap(map); },
  };
}
