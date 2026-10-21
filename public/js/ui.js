import { h } from './dom.js';
import { t, tIn, getLang } from './i18n.js';

export const announce = (msg) => {
  const live = document.getElementById('live');
  live.textContent = '';
  setTimeout(() => { live.textContent = msg; }, 50);
};

export function toast(msg, kind = 'ok') {
  const el = h('div', { class: `toast toast--${kind}`, role: kind === 'error' ? 'alert' : null }, msg);
  const box = document.getElementById('toasts');
  box.replaceChildren(el);
  setTimeout(() => el.remove(), 6000);
}

export const fmtDate = (s) => {
  if (!s) return '';
  const d = new Date(s.includes('T') || s.includes(' ') ? s.replace(' ', 'T') + (s.endsWith('Z') ? '' : 'Z') : s);
  const locale = { ms: 'ms-MY', zh: 'zh-MY' }[getLang()] ?? 'en-MY';
  return Number.isNaN(d.getTime()) ? s : d.toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' });
};

export function distanceKm(a, b) {
  const rad = (x) => (x * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(s));
}

export const fmtDistance = (km) => (km < 1 ? `${Math.round(km * 10) * 100} m` : `${km.toFixed(km < 10 ? 1 : 0)} km`);

export const badge = (text, cls = '') => h('span', { class: `badge ${cls}` }, text);

export function stars(value, label) {
  const n = Math.round(value);
  return h('span', { class: 'stars', role: 'img', 'aria-label': t(label ?? 'Rated {n} out of 5', { n: value }) },
    h('span', { 'aria-hidden': 'true' }, '★'.repeat(n) + '☆'.repeat(5 - n)));
}

/** Standard labelled field. Returns { el, input, setError }. */
export function field({ label, name, type = 'text', value = '', hint, required, error, tag = 'input', options, rows, maxlength, attrs = {} }) {
  const id = `f-${name}-${Math.random().toString(36).slice(2, 7)}`;
  const hintEl = hint ? h('p', { class: 'hint', id: `${id}-hint` }, hint) : null;
  const errEl = h('p', { class: 'field-error', id: `${id}-err`, hidden: true });
  let input;
  if (tag === 'select') {
    input = h('select', { id, name }, options.map(([v, t]) => h('option', { value: v, selected: v === value }, t)));
  } else if (tag === 'textarea') {
    input = h('textarea', { id, name, rows: rows ?? 4, maxlength }, value);
  } else {
    input = h('input', { id, name, type, value, maxlength, ...attrs });
  }
  if (required) input.required = true;
  const describedBy = [hintEl && hintEl.id, errEl.id].filter(Boolean).join(' ');
  input.setAttribute('aria-describedby', describedBy);
  const el = h('div', { class: 'field' },
    h('label', { for: id }, label, required ? h('span', { class: 'req', 'aria-hidden': 'true' }, ' *') : null),
    hintEl, input, errEl);
  const setError = (msg) => {
    errEl.textContent = msg || '';
    errEl.hidden = !msg;
    if (msg) input.setAttribute('aria-invalid', 'true'); else input.removeAttribute('aria-invalid');
  };
  if (error) setError(error);
  return { el, input, setError };
}

export function checkboxGroup({ legend, name, options, selected = [], hint, cls = '' }) {
  const boxes = options.map(([value, text]) => {
    const id = `cb-${name}-${value}`;
    const input = h('input', { type: 'checkbox', id, name, value, checked: selected.includes(value) });
    return { input, el: h('div', { class: 'check' }, input, h('label', { for: id }, text)) };
  });
  const el = h('fieldset', { class: `checks ${cls}` }, h('legend', {}, legend),
    hint ? h('p', { class: 'hint' }, hint) : null, h('div', { class: 'check-grid' }, boxes.map((b) => b.el)));
  return { el, values: () => boxes.filter((b) => b.input.checked).map((b) => b.input.value) };
}

export function radioGroup({ legend, name, options, value, hint }) {
  const inputs = options.map(([v, text]) => {
    const id = `rd-${name}-${v}`;
    const input = h('input', { type: 'radio', name, id, value: v, checked: v === value });
    return { input, el: h('div', { class: 'check' }, input, h('label', { for: id }, text)) };
  });
  const errEl = h('p', { class: 'field-error', hidden: true });
  const el = h('fieldset', { class: 'checks' }, h('legend', {}, legend), hint ? h('p', { class: 'hint' }, hint) : null,
    h('div', { class: 'check-row' }, inputs.map((i) => i.el)), errEl);
  return {
    el,
    value: () => inputs.find((i) => i.input.checked)?.input.value ?? null,
    setError: (m) => { errEl.textContent = m || ''; errEl.hidden = !m; },
  };
}

/** Puts server-side field errors onto the matching controls and returns a summary element. */
export function errorSummary(message, fields = {}) {
  const items = [...new Set(Object.values(fields))];
  return h('div', { class: 'error-summary', role: 'alert', tabindex: '-1' },
    h('strong', {}, t(message)),
    items.length ? h('ul', {}, items.map((m) => h('li', {}, t(m)))) : null);
}

// Shows "value · title", but not when the title already says the value ("10% off" / "10% off drinks").
export function offerLine(o, code = getLang()) {
  const title = tIn(code, o.title);
  const value = tIn(code, o.value_text);
  return !value || title.toLowerCase().includes(value.toLowerCase()) ? title : `${value} · ${title}`;
}

// ---------- icons (stroke icons, 24x24 viewBox) ----------
const NS = 'http://www.w3.org/2000/svg';
const ICONS = {
  search: ['<circle cx="11" cy="11" r="7"/>', '<path d="m20 20-3.5-3.5"/>'],
  check: ['<path d="M20 6 9 17l-5-5"/>'],
  pin: ['<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>', '<circle cx="12" cy="10" r="3"/>'],
  phone: ['<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z"/>'],
  globe: ['<circle cx="12" cy="12" r="10"/>', '<path d="M2 12h20"/>', '<path d="M12 2a15 15 0 0 1 4 10 15 15 0 0 1-4 10 15 15 0 0 1-4-10 15 15 0 0 1 4-10Z"/>'],
  directions: ['<path d="m3 11 19-9-9 19-2-8-8-2Z"/>'],
  edit: ['<path d="M17 3a2.8 2.8 0 0 1 4 4L7.500 20.500 2 22l1.500-5.500Z"/>'],
  star: ['<path d="m12 2 3.100 6.300 6.900 1-5 4.900 1.200 6.900L12 17.800 5.800 21.100 7 14.200 2 9.300l6.900-1Z" fill="currentColor"/>'],
  locate: ['<circle cx="12" cy="12" r="3"/>', '<circle cx="12" cy="12" r="8"/>', '<path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>'],
  verified: ['<path d="M3.900 8.600a4 4 0 0 1 4.800-4.800 4 4 0 0 1 6.700 0 4 4 0 0 1 4.800 4.800 4 4 0 0 1 0 6.700 4 4 0 0 1-4.800 4.800 4 4 0 0 1-6.700 0 4 4 0 0 1-4.800-4.800 4 4 0 0 1 0-6.700Z"/>', '<path d="m9 12 2 2 4-4"/>'],
  plus: ['<path d="M12 5v14M5 12h14"/>'],
  users: ['<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>', '<circle cx="9" cy="7" r="4"/>', '<path d="M22 21v-2a4 4 0 0 0-3-3.900M16 3.100a4 4 0 0 1 0 7.800"/>'],
  question: ['<circle cx="12" cy="12" r="10"/>', '<path d="M9.100 9a3 3 0 0 1 5.800 1c0 2-3 3-3 3M12 17h.01"/>'],
  shield: ['<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/>', '<path d="m9 12 2 2 4-4"/>'],
  chat: ['<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z"/>'],
  list: ['<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>'],
  map: ['<path d="M9 3 3 6v15l6-3 6 3 6-3V3l-6 3-6-3Z"/>', '<path d="M9 3v15M15 6v15"/>'],
  sliders: ['<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>'],
  x: ['<path d="M18 6 6 18M6 6l12 12"/>'],
  card: ['<rect x="2" y="5" width="20" height="14" rx="2"/>', '<path d="M6 10h8M6 14h12"/>'],
  external: ['<path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>'],
  menu: ['<path d="M4 6h16M4 12h16M4 18h16"/>'],
  heart: ['<path d="M19 14c1.500-1.500 3-3.200 3-5.500A5.500 5.500 0 0 0 16.500 3c-1.800 0-3 .5-4.500 2-1.500-1.500-2.700-2-4.500-2A5.500 5.500 0 0 0 2 8.500c0 2.300 1.500 4 3 5.500l7 7Z"/>'],
};

export function icon(name, size = 18) {
  const svg = document.createElementNS(NS, 'svg');
  for (const [k, v] of Object.entries({ viewBox: '0 0 24 24', width: size, height: size, fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', class: 'icon' })) svg.setAttribute(k, v);
  svg.innerHTML = ICONS[name].join(''); // constants above only, never user data
  return svg;
}

// ---------- category colours & place images ----------
const GROUP = {
  restaurant: 'food', cafe: 'food', grocery: 'shop', retail: 'shop', healthcare: 'care', attraction: 'fun', entertainment: 'fun',
  hotel: 'stay', education: 'learn', services: 'place', social: 'together', other: 'place',
};
export const groupOf = (category) => GROUP[category] ?? 'place';

export const isCalm = () => document.documentElement.classList.contains('calm');

/** The place's own photo, or an illustrated cover for its kind of place. Calm mode loads neither. */
export function placeImage(place, cls = '') {
  if (isCalm()) return null;
  return h('img', {
    class: `photo ${place.image ? '' : 'photo--cover'} ${cls}`.replace(/\s+/g, ' ').trim(),
    src: place.image || `img/cover/${groupOf(place.category)}.svg`,
    alt: place.image ? t('Photo of {name}', { name: place.name }) : '',
    loading: 'lazy', width: 640, height: 256,
  });
}

// Credits for the freely licensed photos in img/places/ (author, licence, source page), keyed by file name.
let credits = null;
export const loadPhotoCredits = () => fetch('img/places/credits.json').then((r) => (r.ok ? r.json() : {})).catch(() => ({})).then((c) => { credits = c; });

/** "Photo: author, licence" with a link to the source, for photos that need attribution. */
export function photoCredit(place) {
  const c = place.image && !isCalm() ? credits?.[place.image.split('/').pop()] : null;
  if (!c) return null;
  return h('p', { class: 'photo-credit' }, `${t('Photo')}: ${c.author} · `,
    h('a', { href: c.source, target: '_blank', rel: 'noopener noreferrer' }, c.license), ` · Wikimedia Commons`);
}

export const offerIcon = (kind) => icon(kind === 'volunteer' ? 'heart' : 'check', 18);

// ---------- trust: business-confirmed, community-reported, not yet checked ----------

export const workedCounts = (p) => {
  const yes = (p.honoured_yes ?? 0) + (p.visits_yes ?? 0);
  return { yes, total: yes + (p.honoured_no ?? 0) + (p.visits_no ?? 0) + (p.visits_partly ?? 0) };
};

/** Which of the three trust levels a listing is at, with a short explanation. */
export function trustOf(p) {
  const { yes, total } = workedCounts(p);
  if (p.partner_verified) {
    return { tier: 'business', icon: 'shield', label: t('Business confirmed'), detail: p.verified_at ? t('by the business · {date}', { date: fmtDate(p.verified_at) }) : '' };
  }
  if (total > 0 || p.source === 'used_it') {
    return { tier: 'community', icon: 'users', label: t('Community reported'), detail: yes ? t('{n} visits said it worked', { n: yes }) : t('suggested by a visitor who used it') };
  }
  return { tier: 'unverified', icon: 'question', label: t('Not yet checked'), detail: t('from web sources or a tip · confirm before you go') };
}

/** The trust label: icon, word and border style all differ, so colour is never the only cue. */
export function trustStamp(p, { detail = false, cls = '' } = {}) {
  const tr = trustOf(p);
  return h('span', { class: `stamp stamp--${tr.tier} ${cls}`.trim() }, icon(tr.icon, 18),
    h('span', {}, h('strong', {}, tr.label), detail && tr.detail ? h('span', { class: 'stamp-detail' }, tr.detail) : null));
}

/** "Worked 3 of 4 visits" for a list card, or nothing when no one has reported a visit yet. */
export function workedLine(p) {
  const { yes, total } = workedCounts(p);
  return total ? h('span', { class: 'worked-line' }, icon('check', 16), t('Worked {a} of {b} visits', { a: yes, b: total })) : null;
}

/** What visitors said about one feature: 'yes' or 'no' by majority, or null when no one has answered. */
export function visitorVerdict(p, feature) {
  const r = p.access_reports?.[feature];
  if (!r || !(r.yes + r.no)) return null;
  return r.yes >= r.no ? 'yes' : 'no';
}

/** Features we can say a place has: listed ones visitors haven't contradicted, plus ones visitors said yes to. */
export function knownFeatures(p) {
  const out = p.accessibility.filter((f) => visitorVerdict(p, f) !== 'no');
  for (const f of Object.keys(p.access_reports ?? {})) if (visitorVerdict(p, f) === 'yes' && !out.includes(f)) out.push(f);
  return out;
}

/** Total "yes" answers to the quick accessibility questions, for sorting. */
export const accessYes = (p) => Object.values(p.access_reports ?? {}).reduce((n, r) => n + r.yes, 0);

/** Ten squares, filled in proportion. Decorative: the sentence next to it carries the meaning. */
export function workedMeter(yes, total) {
  const filled = total ? Math.round((yes / total) * 10) : 0;
  return h('span', { class: 'meter', 'aria-hidden': 'true' }, Array.from({ length: 10 }, (_, i) => h('span', { class: i < filled ? 'on' : '' })));
}

/** Malaysian mobile numbers (01x…) can take WhatsApp and SMS; returns the number in international form. */
export function mobileNumber(phone) {
  const d = String(phone || '').replace(/\D/g, '');
  if (/^01\d{7,9}$/.test(d)) return `6${d}`;
  if (/^601\d{7,9}$/.test(d)) return d;
  return null;
}
