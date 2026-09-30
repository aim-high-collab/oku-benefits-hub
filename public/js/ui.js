import { h } from './dom.js';

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
  return Number.isNaN(d.getTime()) ? s : d.toLocaleDateString('en-MY', { year: 'numeric', month: 'short', day: 'numeric' });
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
  return h('span', { class: 'stars', role: 'img', 'aria-label': `${label ?? 'Rated'} ${value} out of 5` },
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
    h('strong', {}, message),
    items.length ? h('ul', {}, items.map((m) => h('li', {}, m))) : null);
}

// Shows "value · title", but not when the title already says the value ("10% off" / "10% off drinks").
export const offerLine = (o) => (!o.value_text || o.title.toLowerCase().includes(o.value_text.toLowerCase())
  ? o.title : `${o.value_text} · ${o.title}`);

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
};

export function icon(name, size = 18) {
  const svg = document.createElementNS(NS, 'svg');
  for (const [k, v] of Object.entries({ viewBox: '0 0 24 24', width: size, height: size, fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', class: 'icon' })) svg.setAttribute(k, v);
  svg.innerHTML = ICONS[name].join(''); // constants above only, never user data
  return svg;
}
