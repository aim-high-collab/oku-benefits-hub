import { h, clear } from '../dom.js';
import { api } from '../api.js';
import { field, checkboxGroup, errorSummary } from '../ui.js';
import { createMap, destroyMap, pinIcon, locate, MALAYSIA_CENTER, MALAYSIA_ZOOM } from '../map.js';

// ---------- shared plumbing ----------

/** Requires login; otherwise shows a prompt and returns false. */
function needLogin(ctx, root, what) {
  if (ctx.state.user) return false;
  sessionStorage.setItem('afterLogin', location.hash);
  root.append(h('div', { class: 'page page--narrow' }, h('h1', {}, 'Log in to continue'),
    h('p', {}, `You need an account to ${what}. It takes a minute and helps us keep listings trustworthy.`),
    h('div', { class: 'actions' }, h('a', { class: 'btn', href: '#/login' }, 'Log in'), h('a', { class: 'btn btn--ghost', href: '#/register' }, 'Create account'))));
  return true;
}

/** Runs `send`, shows errors as a focused summary + inline messages. */
function formShell({ children, submitLabel, onSubmit, fields = {} }) {
  const errs = h('div');
  const submit = h('button', { class: 'btn', type: 'submit' }, submitLabel);
  const form = h('form', { novalidate: true, onsubmit: async (e) => {
    e.preventDefault();
    clear(errs);
    for (const f of Object.values(fields)) f.setError?.('');
    submit.disabled = true;
    try {
      await onSubmit();
    } catch (err) {
      for (const [k, msg] of Object.entries(err.fields || {})) fields[k]?.setError?.(msg);
      const s = errorSummary(err.message, err.fields);
      errs.append(s);
      s.focus();
      submit.disabled = false;
    }
  } }, errs, children, h('div', { class: 'actions' }, submit, h('a', { class: 'btn btn--ghost', href: '#/' }, 'Cancel')));
  return form;
}

// ---------- photo picker ----------

/** Downscales in the browser (phone photos are huge) and re-encodes as JPEG before uploading. */
async function shrink(file, max = 1280) {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.82);
}

function photoPicker(initial) {
  let path = initial || '';
  const id = `photo-${Math.random().toString(36).slice(2, 7)}`;
  const preview = h('img', { class: 'photo-preview', alt: 'Preview of the chosen photo', hidden: !path, src: path || null });
  const status = h('p', { class: 'hint', role: 'status' });
  const input = h('input', { type: 'file', id, accept: 'image/jpeg,image/png,image/webp' });
  const remove = h('button', { type: 'button', class: 'btn btn--ghost btn--small', hidden: !path, onclick: () => {
    path = '';
    preview.hidden = true;
    remove.hidden = true;
    input.value = '';
    status.textContent = 'Photo removed.';
  } }, 'Remove photo');
  input.addEventListener('change', async () => {
    const file = input.files[0];
    if (!file) return;
    status.textContent = 'Uploading…';
    try {
      const data = await shrink(file);
      path = (await api('POST', '/uploads', { image: data })).path;
      preview.src = data;
      preview.hidden = false;
      remove.hidden = false;
      status.textContent = 'Photo added. It will be checked with the rest of your submission.';
    } catch (err) {
      status.textContent = err.message || 'We could not use that photo. Try a different one.';
      input.value = '';
    }
  });
  const el = h('div', { class: 'field' },
    h('label', { for: id }, 'Photo (optional)'),
    h('p', { class: 'hint' }, 'A photo of the entrance or front helps people see if it will work for them. Only upload pictures you took yourself.'),
    h('div', { class: 'photo-field' }, preview, h('div', {}, input, h('div', { class: 'actions' }, remove))),
    status);
  return { el, value: () => path };
}

// ---------- place form ----------

function offerRow(meta, offer, onRemove) {
  const title = field({ label: 'What is offered', name: 'offer-title', value: offer.title, required: true, maxlength: 100, attrs: { placeholder: 'e.g. 10% off total bill' } });
  const kind = field({ label: 'Type', name: 'offer-kind', tag: 'select', value: offer.kind, options: Object.entries(meta.offerKinds) });
  const value = field({ label: 'Value (optional)', name: 'offer-value', value: offer.value_text, maxlength: 60, attrs: { placeholder: 'e.g. 10% off' } });
  const cond = field({ label: 'Conditions (optional)', name: 'offer-cond', value: offer.conditions, maxlength: 300, hint: 'e.g. show OKU card, dine-in only, weekdays' });
  const el = h('div', { class: 'offer-row', role: 'group', 'aria-label': 'Offer' }, h('div', { class: 'grid-2' }, title.el, kind.el), h('div', { class: 'grid-2' }, value.el, cond.el),
    h('button', { type: 'button', class: 'btn btn--ghost btn--small', onclick: () => onRemove(el) }, 'Remove this offer'));
  return { el, fields: { title, kind, value_text: value, conditions: cond }, read: () => ({ title: title.input.value, kind: kind.input.value, value_text: value.input.value, conditions: cond.input.value }) };
}

function locationPicker(meta, initial, lat, lng) {
  const mapEl = h('div', { id: 'picker-map', role: 'region', 'aria-label': 'Location picker map. Click or tap to place the pin, or use the search box or coordinate fields.' });
  const search = field({ label: 'Find address or landmark', name: 'geo', type: 'search', hint: 'Searches OpenStreetMap. Then click the map to fine-tune the pin.', attrs: { autocomplete: 'off' } });
  const results = h('ul', { class: 'geo-results', 'aria-label': 'Search results' });
  const status = h('p', { class: 'hint', role: 'status' });
  let map;
  let marker;

  const setPoint = (la, ln, pan = true, writeInputs = true) => {
    if (writeInputs) {
      lat.input.value = Number(la).toFixed(6);
      lng.input.value = Number(ln).toFixed(6);
    }
    if (!map) return;
    if (!marker) {
      marker = L.marker([la, ln], { icon: pinIcon(), draggable: true, keyboard: true, title: 'Selected location' }).addTo(map);
      marker.on('dragend', () => { const p = marker.getLatLng(); setPoint(p.lat, p.lng, false); });
    } else marker.setLatLng([la, ln]);
    if (pan) map.setView([la, ln], Math.max(map.getZoom(), 17));
    status.textContent = `Selected location: ${Number(la).toFixed(5)}, ${Number(ln).toFixed(5)}`;
  };

  const syncFromInputs = () => {
    const la = parseFloat(lat.input.value);
    const ln = parseFloat(lng.input.value);
    if (Number.isFinite(la) && Number.isFinite(ln)) setPoint(la, ln);
  };
  lat.input.addEventListener('change', syncFromInputs);
  lng.input.addEventListener('change', syncFromInputs);

  async function doSearch() {
    const term = search.input.value.trim();
    if (!term) return;
    status.textContent = 'Searching…';
    clear(results);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=my&limit=5&q=${encodeURIComponent(term)}`, { headers: { accept: 'application/json' } });
      const found = await res.json();
      status.textContent = found.length ? `${found.length} result${found.length === 1 ? '' : 's'}. Choose one to move the pin.` : 'No results. Try a nearby landmark or drop the pin on the map.';
      for (const r of found) {
        results.append(h('li', {}, h('button', { type: 'button', onclick: () => { setPoint(+r.lat, +r.lon); clear(results); } }, r.display_name)));
      }
    } catch {
      status.textContent = 'Search is unavailable right now. Click the map to place the pin instead.';
    }
  }
  search.input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); doSearch(); } });

  const el = h('div', {},
    search.el,
    h('div', { class: 'actions' },
      h('button', { type: 'button', class: 'btn btn--ghost btn--small', onclick: doSearch }, 'Search'),
      h('button', { type: 'button', class: 'btn btn--ghost btn--small', onclick: async () => {
        try { const p = await locate(); setPoint(p.lat, p.lng); } catch (e) { status.textContent = e.message; }
      } }, 'Use my current location')),
    results, mapEl, status);

  return {
    el,
    mount() {
      const has = Number.isFinite(initial?.lat);
      map = createMap(mapEl, has ? { center: [initial.lat, initial.lng], zoom: 17 } : { center: MALAYSIA_CENTER, zoom: MALAYSIA_ZOOM });
      map.on('click', (e) => setPoint(e.latlng.lat, e.latlng.lng, false));
      if (has) setPoint(initial.lat, initial.lng, false, false);
    },
    destroy() { destroyMap(map); },
  };
}

function placeForm(ctx, initial, { mode, onSubmit }) {
  const { meta } = ctx.state;
  const f = {
    name: field({ label: 'Business or place name', name: 'name', value: initial.name, required: true, maxlength: 120 }),
    category: field({ label: 'Type of place', name: 'category', tag: 'select', value: initial.category, options: Object.entries(meta.categories) }),
    description: field({ label: 'Description (optional)', name: 'description', tag: 'textarea', value: initial.description, maxlength: 1000, rows: 3, hint: 'What is it, and anything helpful for OKU visitors?' }),
    address: field({ label: 'Street address', name: 'address', value: initial.address, required: true, maxlength: 250 }),
    city: field({ label: 'Town / city', name: 'city', value: initial.city, maxlength: 80 }),
    state: field({ label: 'State', name: 'state', tag: 'select', value: initial.state, options: [['', 'Select state'], ...meta.states.map((s) => [s, s])] }),
    phone: field({ label: 'Phone (optional)', name: 'phone', type: 'tel', value: initial.phone, maxlength: 30 }),
    website: field({ label: 'Website (optional)', name: 'website', type: 'url', value: initial.website, maxlength: 300, hint: 'Include https://' }),
  };
  const lat = field({ label: 'Latitude', name: 'lat', type: 'number', value: initial.lat ?? '', required: true, attrs: { step: 'any' } });
  const lng = field({ label: 'Longitude', name: 'lng', type: 'number', value: initial.lng ?? '', required: true, attrs: { step: 'any' } });
  const picker = locationPicker(meta, initial, lat, lng);
  const photo = photoPicker(initial.image);
  const feats = checkboxGroup({ legend: 'Accessibility features', name: 'features', options: Object.entries(meta.features), selected: initial.accessibility, hint: 'Tick what you have seen or know is available.' });
  const offersBox = h('div');
  const offerRows = new Set();
  const addOffer = (o = { title: '', kind: 'discount', value_text: '', conditions: '' }) => {
    const row = offerRow(meta, o, (el) => { offerRows.delete(row); el.remove(); });
    offerRows.add(row);
    offersBox.append(row.el);
    return row;
  };
  initial.offers.forEach(addOffer);
  if (!initial.offers.length && mode === 'create') addOffer();
  const offersErr = h('p', { class: 'field-error', hidden: true });

  const owner = mode === 'create'
    ? h('div', { class: 'check' }, h('input', { type: 'checkbox', id: 'is-owner' }),
      h('label', { for: 'is-owner' }, 'I own or manage this business and want to be listed as a participating partner. A moderator will verify this.'))
    : null;
  const reason = mode === 'edit'
    ? field({ label: 'Why are you suggesting this change?', name: 'reason', tag: 'textarea', rows: 3, maxlength: 500, hint: 'Optional but helps moderators verify quickly, e.g. “Visited on 3 March; the offer is now 15%.”' })
    : null;

  const fields = { ...f, lat, lng, offers: { setError: (m) => { offersErr.textContent = m || ''; offersErr.hidden = !m; } } };
  const form = formShell({
    fields,
    submitLabel: mode === 'create' ? 'Submit for review' : 'Send edit request',
    onSubmit: () => onSubmit({
      ...Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v.input.value])),
      lat: lat.input.value === '' ? null : Number(lat.input.value),
      lng: lng.input.value === '' ? null : Number(lng.input.value),
      accessibility: feats.values(),
      image: photo.value(),
      offers: [...offerRows].map((r) => r.read()),
    }, { is_owner: owner ? owner.querySelector('input').checked : false, reason: reason?.input.value ?? '' }),
    children: [
      h('fieldset', { class: 'group' }, h('legend', {}, '1. About the place'), f.name.el, f.category.el, f.description.el, photo.el),
      h('fieldset', { class: 'group' }, h('legend', {}, '2. Where is it?'), f.address.el, h('div', { class: 'grid-2' }, f.city.el, f.state.el),
        picker.el, h('div', { class: 'grid-2' }, lat.el, lng.el)),
      h('fieldset', { class: 'group' }, h('legend', {}, '3. OKU offers'),
        h('p', { class: 'hint' }, 'Discounts, freebies, priority service, or a chance to volunteer. Leave empty if it is simply an accessible space.'),
        offersBox, offersErr,
        h('div', { class: 'actions' }, h('button', { type: 'button', class: 'btn btn--ghost btn--small', onclick: () => addOffer().fields.title.input.focus() }, 'Add another offer'))),
      h('fieldset', { class: 'group' }, h('legend', {}, '4. Accessibility & contact'), feats.el, h('div', { class: 'grid-2' }, f.phone.el, f.website.el)),
      owner, reason?.el,
    ],
  });
  return { form, picker };
}

const blankPlace = { image: '', name: '', category: 'restaurant', description: '', address: '', city: '', state: '', phone: '', website: '', accessibility: [], offers: [] };

export async function submitPlaceView(ctx, root) {
  if (needLogin(ctx, root, 'add a place')) return { title: 'Log in' };
  const { form, picker } = placeForm(ctx, blankPlace, {
    mode: 'create',
    onSubmit: async (data, extra) => {
      const res = await api('POST', '/places', { ...data, is_owner: extra.is_owner });
      ctx.toast(res.status === 'approved' ? 'Published.' : 'Thank you! A moderator will review it shortly.');
      ctx.go(res.status === 'approved' ? `#/place/${res.id}` : '#/account');
    },
  });
  root.append(h('div', { class: 'page page--narrow' }, h('h1', {}, 'Add a place'),
    h('p', { class: 'lede' }, 'Know a business that gives OKU discounts, a place that is genuinely accessible, or a group that welcomes volunteers? Add it so others can find it. A person checks every submission before it appears.'), form));
  return { title: 'Add a place', mounted: () => picker.mount(), destroy: () => picker.destroy() };
}

export async function editPlaceView(ctx, root, [id]) {
  if (needLogin(ctx, root, 'suggest an edit')) return { title: 'Log in' };
  const { place } = await api('GET', `/places/${id}`);
  const { form, picker } = placeForm(ctx, place, {
    mode: 'edit',
    onSubmit: async (data, extra) => {
      await api('POST', `/places/${id}/edits`, { changes: data, reason: extra.reason });
      ctx.toast('Thanks! Your suggested edit is waiting for moderator review.');
      ctx.go(`#/place/${id}`);
    },
  });
  root.append(h('div', { class: 'page page--narrow' }, h('h1', {}, `Suggest an edit: ${place.name}`),
    h('p', { class: 'lede' }, 'Change anything that is wrong or out of date. Nothing changes on the listing until a moderator approves your request.'), form));
  return { title: `Edit ${place.name}`, mounted: () => picker.mount(), destroy: () => picker.destroy() };
}

// ---------- benefit form ----------

function benefitForm(ctx, initial, { mode, onSubmit }) {
  const { meta } = ctx.state;
  const f = {
    title: field({ label: 'Benefit name', name: 'title', value: initial.title, required: true, maxlength: 140 }),
    agency: field({ label: 'Agency or provider', name: 'agency', value: initial.agency, required: true, maxlength: 120, hint: 'e.g. JKM, LHDN, a local council' }),
    category: field({ label: 'Category', name: 'category', tag: 'select', value: initial.category, options: Object.entries(meta.benefitCategories) }),
    summary: field({ label: 'What does it offer?', name: 'summary', tag: 'textarea', value: initial.summary, required: true, maxlength: 600, rows: 4 }),
    eligibility: field({ label: 'Who can apply? (optional)', name: 'eligibility', tag: 'textarea', value: initial.eligibility, maxlength: 800, rows: 3 }),
    how_to_apply: field({ label: 'How to apply (optional)', name: 'how_to_apply', tag: 'textarea', value: initial.how_to_apply, maxlength: 800, rows: 3 }),
    url: field({ label: 'Official web page (optional)', name: 'url', type: 'url', value: initial.url, maxlength: 300, hint: 'Link to the agency page so others can confirm. Include https://' }),
  };
  const reason = mode === 'edit'
    ? field({ label: 'Why are you suggesting this change?', name: 'reason', tag: 'textarea', rows: 3, maxlength: 500, hint: 'A source link or date helps moderators verify.' })
    : null;
  return formShell({
    fields: f,
    submitLabel: mode === 'create' ? 'Submit for review' : 'Send edit request',
    onSubmit: () => onSubmit(Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v.input.value])), reason?.input.value ?? ''),
    children: [Object.values(f).map((x) => x.el), reason?.el],
  });
}

const blankBenefit = { title: '', agency: '', category: 'financial', summary: '', eligibility: '', how_to_apply: '', url: '' };

export async function submitBenefitView(ctx, root) {
  if (needLogin(ctx, root, 'add a benefit')) return { title: 'Log in' };
  const form = benefitForm(ctx, blankBenefit, {
    mode: 'create',
    onSubmit: async (data) => {
      const res = await api('POST', '/benefits', data);
      ctx.toast(res.status === 'approved' ? 'Published.' : 'Thank you! A moderator will review it shortly.');
      ctx.go(res.status === 'approved' ? '#/benefits' : '#/account');
    },
  });
  root.append(h('div', { class: 'page page--narrow' }, h('h1', {}, 'Add a government benefit'),
    h('p', { class: 'lede' }, 'Share a benefit, allowance, concession or relief that OKU cardholders can claim. Please include an official source where you can.'), form));
  return { title: 'Add a benefit' };
}

export async function editBenefitView(ctx, root, [id]) {
  if (needLogin(ctx, root, 'suggest an edit')) return { title: 'Log in' };
  const { benefit } = await api('GET', `/benefits/${id}`);
  const form = benefitForm(ctx, benefit, {
    mode: 'edit',
    onSubmit: async (data, reason) => {
      await api('POST', `/benefits/${id}/edits`, { changes: data, reason });
      ctx.toast('Thanks! Your suggested edit is waiting for moderator review.');
      ctx.go('#/benefits');
    },
  });
  root.append(h('div', { class: 'page page--narrow' }, h('h1', {}, `Suggest an edit: ${benefit.title}`), form));
  return { title: `Edit ${benefit.title}` };
}
