import { h, clear } from '../dom.js';
import { api } from '../api.js';
import { badge, stars, fmtDate, field, radioGroup, errorSummary, offerLine, icon, groupOf, placeImage, photoCredit, offerIcon,
  trustOf, trustStamp, workedCounts, workedMeter, mobileNumber, visitorVerdict } from '../ui.js';
import { t, tIn } from '../i18n.js';
import { createMap, destroyMap, directionsUrl, googleMapsUrl, osmUrl, usingGoogle } from '../map.js';

const HONOURED = { yes: 'Discount honoured', no: 'Discount not honoured', not_tried: 'Did not try the discount' };
const VOTED_KEY = 'oku-visits';
const ACCESS_KEY = 'oku-access';
// Shown when most visitors answered "no" to the quick question for this feature.
const NOT_THERE = {
  step_free_entry: 'Steps at the entrance', accessible_toilet: 'No accessible toilet', oku_parking: 'No OKU parking bay', trained_staff: 'Staff were not helpful',
};

// One answer per place per device, kept in localStorage (the answers themselves need no account).
const answeredFor = (key, id) => { try { return JSON.parse(localStorage.getItem(key) || '[]').includes(id); } catch { return false; } };
const rememberAnswer = (key, id) => {
  try { localStorage.setItem(key, JSON.stringify([...JSON.parse(localStorage.getItem(key) || '[]'), id].slice(-200))); } catch { /* storage blocked */ }
};
const votedFor = (id) => answeredFor(VOTED_KEY, id);
const rememberVote = (id) => rememberAnswer(VOTED_KEY, id);

/** "3 visitors said yes", "1 said yes · 2 said no" */
function reportCounts(r) {
  if (r.yes && r.no) return t('{y} said yes · {n} said no', { y: r.yes, n: r.no });
  const n = r.yes || r.no;
  if (r.yes) return n === 1 ? t('1 visitor said yes') : t('{n} visitors said yes', { n });
  return n === 1 ? t('1 visitor said no') : t('{n} visitors said no', { n });
}

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
  const hubBtn = isAdmin ? h('button', { type: 'button', class: 'btn btn--ghost', onclick: async () => {
    let hub_checked = '';
    if (!p.hub_verified) {
      hub_checked = window.prompt(t('What did our team check? For example: offer, ramp and toilet, by visit.'));
      if (hub_checked === null) return;
    }
    await api('PATCH', `/admin/places/${p.id}`, { hub_verified: !p.hub_verified, hub_checked });
    ctx.toast(p.hub_verified ? t('Team-checked label removed.') : t('Marked as checked by our team.'));
    refresh();
  } }, p.hub_verified ? t('Remove team-checked label') : t('Mark as checked by our team')) : null;

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
  const drawMeter = () => clear(meterBox).append(...(counts.total
    ? [workedMeter(counts.yes, counts.total), h('p', {}, h('strong', {}, t('Worked {a} of {b} visits', { a: counts.yes, b: counts.total })))]
    : [h('p', { class: 'muted' }, t('No one has reported a visit yet.'))]));
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
        if (!answeredFor(ACCESS_KEY, p.id)) voteStatus.after(accessQuestions());
      } catch (err) {
        voteStatus.textContent = err.message;
        for (const b of voteBtns) b.disabled = false;
      }
    } }, ic ? icon(ic, 18) : null, t(label)));
  if (votedFor(p.id)) voteStatus.textContent = t('You already answered for this place on this device.');

  const trustPanel = h('section', { class: `trust-panel trust-panel--${tr.tier}`, 'aria-labelledby': 'trust-h' },
    h('h2', { id: 'trust-h' }, t('Information source')),
    trustStamp(p, { detail: true, cls: 'stamp--big' }),
    meterBox,
    p.status === 'approved' ? h('div', { class: 'did-it-work' },
      h('h3', {}, t('Been here? Did the OKU offer work?')),
      h('p', { class: 'hint' }, t('No account needed. Your answer updates the count above.')),
      h('div', { class: 'vote-row' }, voteBtns), voteStatus,
      votedFor(p.id) && !answeredFor(ACCESS_KEY, p.id) ? accessQuestions() : null) : null);

  // ----- quick accessibility questions, offered after a "Did it work?" answer -----
  function accessQuestions() {
    const picked = {};
    const status = h('p', { class: 'hint', role: 'status' });
    const rows = Object.entries(meta.accessQuestions).map(([feature, question]) => {
      const choices = [['yes', 'Yes', 'check'], ['no', 'No', 'x'], ['unsure', 'Not sure', 'question']];
      const btns = choices.map(([v, label, ic]) => h('button', {
        type: 'button', class: 'btn btn--ghost btn--small', 'aria-pressed': 'false', onclick: (e) => {
          picked[feature] = v;
          for (const b of btns) b.setAttribute('aria-pressed', String(b === e.currentTarget));
        } }, icon(ic, 16), t(label)));
      return h('fieldset', { class: 'quick-q' }, h('legend', {}, question), h('div', { class: 'vote-row' }, btns));
    });
    const send = h('button', { type: 'button', class: 'btn', onclick: async () => {
      const answers = Object.fromEntries(Object.entries(picked).filter(([, v]) => v !== 'unsure'));
      send.disabled = true;
      try {
        if (Object.keys(answers).length) p.access_reports = (await api('POST', `/places/${p.id}/access`, { answers })).access_reports;
        rememberAnswer(ACCESS_KEY, p.id);
        box.replaceChildren(h('p', { role: 'status' }, h('strong', {}, t('Thank you. The Accessibility section now includes your answers.'))));
        const next = accessibilitySection();
        accSection.replaceWith(next);
        accSection = next;
      } catch (err) {
        status.textContent = t(err.message);
        send.disabled = false;
      }
    } }, t('Send answers'));
    const box = h('div', { class: 'quick-access' },
      h('h3', {}, t('A few quick questions (optional)')),
      h('p', { class: 'hint' }, t('They fill in the Accessibility section for the next visitor. Skip any you are not sure about.')),
      rows, h('div', { class: 'actions' }, send), status);
    return box;
  }

  // ----- what we know about access: listed features plus visitors' Yes / No answers -----
  function accessibilitySection() {
    const reported = Object.keys(p.access_reports ?? {}).filter((f) => visitorVerdict(p, f));
    const features = [...p.accessibility, ...reported.filter((f) => !p.accessibility.includes(f))];
    const item = (f) => {
      const verdict = visitorVerdict(p, f);
      // 'Were staff helpful?' asks less than 'Staff trained to assist', so a visitor's yes is worded as such.
      const label = verdict === 'no' ? t(NOT_THERE[f]) : f === 'trained_staff' && verdict ? t('Helpful staff') : meta.features[f];
      return h('li', {}, icon(verdict === 'no' ? 'x' : 'check', 14),
        h('span', {}, label, verdict ? h('span', { class: 'report-count' }, ` · ${reportCounts(p.access_reports[f])}`) : null));
    };
    return h('section', { class: 'block', 'aria-labelledby': 'acc-h' },
      h('h2', { id: 'acc-h' }, t('Accessibility')),
      features.length
        ? h('ul', { class: 'feature-grid' }, features.map(item))
        : h('p', { class: 'unknown' }, icon('question', 18), h('span', {}, t('Not known yet. Ask the place before you go, or'), ' ',
          h('a', { href: `#/place/${p.id}/edit` }, t('add what you know')), '.')));
  }
  let accSection = accessibilitySection();

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
            verifyBtn, hubBtn)),
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
        accSection,
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
          badge(t(HONOURED[r.discount_honoured]), r.discount_honoured === 'yes' ? 'badge--ok' : r.discount_honoured === 'no' ? 'badge--danger' : 'badge--muted')),
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
    } }, h('h3', {}, mine ? t('Update your review') : t('Write a review')), errs, rating.el, honoured.el, body.el, h('div', { class: 'actions' }, submit));
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
