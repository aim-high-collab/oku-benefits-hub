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
