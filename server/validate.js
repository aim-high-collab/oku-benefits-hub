import { HttpError } from './http.js';
import { CATEGORIES, STATES, FEATURES, OFFER_KINDS, BENEFIT_CATEGORIES, MY_BOUNDS } from './meta.js';

// Each field spec: (value, errors, key) => cleaned value. Errors accumulate in `errors`.
const text = ({ min = 0, max, label }) => (v, errors, key) => {
  const s = typeof v === 'string' ? v.trim().replace(/\r\n/g, '\n') : '';
  if (s.length < min) errors[key] = min === 1 ? `${label} is required.` : `${label} must be at least ${min} characters.`;
  else if (s.length > max) errors[key] = `${label} must be at most ${max} characters.`;
  return s;
};

const oneOf = (options, label) => (v, errors, key) => {
  if (!Object.hasOwn(options, v)) errors[key] = `Choose a valid ${label}.`;
  return v;
};

const stateField = (v, errors, key) => {
  if (v === '' || v == null) return '';
  if (!STATES.includes(v)) errors[key] = 'Choose a valid state.';
  return v;
};

const phone = (v, errors, key) => {
  const s = typeof v === 'string' ? v.trim() : '';
  if (s.length > 30 || !/^[0-9+\-\s()]*$/.test(s)) errors[key] = 'Enter a valid phone number.';
  return s;
};

const url = (v, errors, key) => {
  const s = typeof v === 'string' ? v.trim() : '';
  if (!s) return '';
  try {
    const u = new URL(s);
    if (!['http:', 'https:'].includes(u.protocol) || s.length > 300) throw new Error();
    return u.href;
  } catch {
    errors[key] = 'Enter a full web address starting with http:// or https://';
    return s;
  }
};

export const IMAGE_PATH = /^\/uploads\/[a-f0-9]{32}\.(jpg|png|webp)$/;
const image = (v, errors, key) => {
  const s = typeof v === 'string' ? v.trim() : '';
  if (s && !IMAGE_PATH.test(s)) errors[key] = 'Upload the photo again.';
  return s;
};

const coord = (min, max, label) => (v, errors, key) => {
  const n = typeof v === 'number' ? v : Number.NaN;
  if (!Number.isFinite(n) || n < min || n > max) errors[key] = `${label} must be inside Malaysia. Pick the location on the map.`;
  return n;
};

const features = (v, errors, key) => {
  if (!Array.isArray(v) || v.length > 30 || v.some((f) => !Object.hasOwn(FEATURES, f))) {
    errors[key] = 'Invalid accessibility features.';
    return [];
  }
  return Object.keys(FEATURES).filter((f) => v.includes(f)); // canonical order, de-duplicated
};

const offerSpec = {
  title: text({ min: 2, max: 100, label: 'Offer title' }),
  kind: oneOf(OFFER_KINDS, 'offer type'),
  value_text: text({ max: 60, label: 'Offer value' }),
  conditions: text({ max: 300, label: 'Conditions' }),
};

const offers = (v, errors, key) => {
  if (!Array.isArray(v) || v.length > 10) {
    errors[key] = 'Provide up to 10 offers.';
    return [];
  }
  return v.map((o, i) => {
    const sub = {};
    const clean = {};
    for (const [k, fn] of Object.entries(offerSpec)) clean[k] = fn(o?.[k], sub, k);
    for (const [k, msg] of Object.entries(sub)) errors[`${key}.${i}.${k}`] = msg;
    return clean;
  });
};

export const PLACE_SPEC = {
  name: text({ min: 2, max: 120, label: 'Name' }),
  category: oneOf(CATEGORIES, 'category'),
  description: text({ max: 1000, label: 'Description' }),
  address: text({ min: 3, max: 250, label: 'Address' }),
  city: text({ max: 80, label: 'City' }),
  state: stateField,
  lat: coord(MY_BOUNDS.minLat, MY_BOUNDS.maxLat, 'Location'),
  lng: coord(MY_BOUNDS.minLng, MY_BOUNDS.maxLng, 'Location'),
  phone,
  website: url,
  image,
  accessibility: features,
  offers,
};

export const BENEFIT_SPEC = {
  title: text({ min: 3, max: 140, label: 'Title' }),
  agency: text({ min: 2, max: 120, label: 'Agency' }),
  category: oneOf(BENEFIT_CATEGORIES, 'category'),
  summary: text({ min: 10, max: 600, label: 'Summary' }),
  eligibility: text({ max: 800, label: 'Eligibility' }),
  how_to_apply: text({ max: 800, label: 'How to apply' }),
  url,
};

/**
 * Validate `body` against `spec`. In `partial` mode only keys present in body are checked
 * (used for edit requests). Throws a 422 HttpError with per-field messages.
 */
export function clean(body, spec, { partial = false } = {}) {
  const errors = {};
  const out = {};
  const src = body && typeof body === 'object' ? body : {};
  for (const [key, fn] of Object.entries(spec)) {
    if (partial && !(key in src)) continue;
    const fallback = key === 'offers' || key === 'accessibility' ? [] : '';
    out[key] = fn(key in src ? src[key] : fallback, errors, key);
  }
  if (Object.keys(errors).length) throw new HttpError(422, 'Please fix the highlighted fields.', errors);
  return out;
}

export const cleanReason = (v) => {
  const errors = {};
  const s = text({ max: 500, label: 'Reason' })(v, errors, 'reason');
  if (errors.reason) throw new HttpError(422, errors.reason, errors);
  return s;
};

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function cleanCredentials(body, { withName }) {
  const errors = {};
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!EMAIL_RE.test(email) || email.length > 200) errors.email = 'Enter a valid email address.';
  const password = typeof body?.password === 'string' ? body.password : '';
  if (withName && (password.length < 8 || password.length > 200)) errors.password = 'Password must be 8–200 characters.';
  if (!withName && !password) errors.password = 'Enter your password.';
  let name = '';
  if (withName) name = text({ min: 2, max: 50, label: 'Name' })(body?.name, errors, 'name');
  if (Object.keys(errors).length) throw new HttpError(422, 'Please fix the highlighted fields.', errors);
  return { email, password, name };
}
