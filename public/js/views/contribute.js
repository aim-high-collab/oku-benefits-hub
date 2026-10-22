import { h, clear } from '../dom.js';
import { api } from '../api.js';
import { field, checkboxGroup, errorSummary, icon } from '../ui.js';
import { t } from '../i18n.js';
import { googleSignIn } from '../google-signin.js';
import { createMap, destroyMap, locate, searchPlaces, usingGoogle, MALAYSIA_CENTER, MALAYSIA_ZOOM } from '../map.js';

// ---------- shared plumbing ----------

/** Requires login; otherwise shows a prompt and returns false. */
function needLogin(ctx, root, what) {
  if (ctx.state.user) return false;
  sessionStorage.setItem('afterLogin', location.hash);
  root.append(h('div', { class: 'page page--narrow' }, h('h1', {}, t('Log in to continue')),
    h('p', {}, t('You need an account to {what}. It takes a minute and helps us keep listings trustworthy.', { what: t(what) })),
    googleSignIn(ctx),
    h('div', { class: 'actions' }, h('a', { class: 'btn', href: '#/login' }, t('Log in')), h('a', { class: 'btn btn--ghost', href: '#/register' }, t('Create account')))));
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
      for (const [k, msg] of Object.entries(err.fields || {})) fields[k]?.setError?.(t(msg));
      const s = errorSummary(err.message, err.fields);
      errs.append(s);
      s.focus();
      submit.disabled = false;
    }
  } }, errs, children, h('div', { class: 'actions' }, submit, h('a', { class: 'btn btn--ghost', href: '#/' }, t('Cancel'))));
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
  const preview = h('img', { class: 'photo-preview', alt: t('Preview of the chosen photo'), hidden: !path, src: path || null });
  const status = h('p', { class: 'hint', role: 'status' });
  const input = h('input', { type: 'file', id, accept: 'image/jpeg,image/png,image/webp' });
  const remove = h('button', { type: 'button', class: 'btn btn--ghost btn--small', hidden: !path, onclick: () => {
    path = '';
    preview.hidden = true;
    remove.hidden = true;
    input.value = '';
    status.textContent = t('Photo removed.');
  } }, t('Remove photo'));
  input.addEventListener('change', async () => {
    const file = input.files[0];
    if (!file) return;
    status.textContent = t('Uploading…');
    try {
      const data = await shrink(file);
      path = (await api('POST', '/uploads', { image: data })).path;
      preview.src = data;
      preview.hidden = false;
      remove.hidden = false;
      status.textContent = t('Photo added. It will be checked with the rest of your submission.');
    } catch (err) {
      status.textContent = t(err.message || 'We could not use that photo. Try a different one.');
      input.value = '';
    }
  });
  const el = h('div', { class: 'field' },
    h('label', { for: id }, t('Photo (optional)')),
    h('p', { class: 'hint' }, t('A photo of the entrance or front helps people see if it will work for them. Only upload pictures you took yourself.')),
    h('div', { class: 'photo-field' }, preview, h('div', {}, input, h('div', { class: 'actions' }, remove))),
    status);
  return { el, value: () => path };
}

// ---------- place form ----------

function offerRow(meta, offer, onRemove) {
  const title = field({ label: t('What is offered'), name: 'offer-title', value: offer.title, required: true, maxlength: 100, attrs: { placeholder: t('e.g. 10% off total bill') } });
  const kind = field({ label: t('Type'), name: 'offer-kind', tag: 'select', value: offer.kind, options: Object.entries(meta.offerKinds) });
  const value = field({ label: t('Value (optional)'), name: 'offer-value', value: offer.value_text, maxlength: 60, attrs: { placeholder: t('e.g. 10% off') } });
  const cond = field({ label: t('Conditions (optional)'), name: 'offer-cond', value: offer.conditions, maxlength: 300, hint: t('e.g. show OKU card, dine-in only, weekdays') });
  const until = field({ label: t('Valid until (optional)'), name: 'offer-until', type: 'date', value: offer.valid_until || '', hint: t('Leave empty if there is no end date.') });
  const el = h('div', { class: 'offer-row', role: 'group', 'aria-label': t('Offer') }, h('div', { class: 'grid-2' }, title.el, kind.el), h('div', { class: 'grid-2' }, value.el, cond.el), until.el,
    h('button', { type: 'button', class: 'btn btn--ghost btn--small', onclick: () => onRemove(el) }, t('Remove this offer')));
  return { el, fields: { title, kind, value_text: value, conditions: cond, valid_until: until }, read: () => ({ title: title.input.value, kind: kind.input.value, value_text: value.input.value, conditions: cond.input.value, valid_until: until.input.value, reported_price: offer.reported_price || '' }) };
}

function locationPicker(meta, initial, lat, lng) {
  const mapEl = h('div', { id: 'picker-map', role: 'region', 'aria-label': t('Location picker map. Click or tap to place the pin, or use the search box or coordinate fields.') });
  const search = field({ label: t('Find address or landmark'), name: 'geo', type: 'search', hint: t('Searches {provider}. Then click the map to fine-tune the pin.', { provider: usingGoogle() ? 'Google Maps' : 'OpenStreetMap' }), attrs: { autocomplete: 'off' } });
  const results = h('ul', { class: 'geo-results', 'aria-label': t('Search results') });
  const status = h('p', { class: 'hint', role: 'status' });
  let map;
  let marker;
  let destroyed = false;

  const setPoint = (la, ln, pan = true, writeInputs = true) => {
    if (writeInputs) {
      lat.input.value = Number(la).toFixed(6);
      lng.input.value = Number(ln).toFixed(6);
    }
    if (!map) return;
    if (!marker) {
      marker = map.addMarker({ lat: la, lng: ln, title: t('Selected location'), draggable: true, onDragEnd: (a, b) => setPoint(a, b, false) });
    } else marker.setPosition(la, ln);
    if (pan) map.setView(la, ln, Math.max(map.getZoom(), 17));
    status.textContent = `${t('Selected location')}: ${Number(la).toFixed(5)}, ${Number(ln).toFixed(5)}`;
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
    status.textContent = t('Searching…');
    clear(results);
    try {
      const found = await searchPlaces(term, meta.bounds);
      status.textContent = found.length ? t('{n} result(s). Choose one to move the pin.', { n: found.length }) : t('No results. Try a nearby landmark or drop the pin on the map.');
      for (const r of found) {
        results.append(h('li', {}, h('button', { type: 'button', onclick: () => { setPoint(r.lat, r.lng); clear(results); } }, r.label)));
      }
    } catch {
      status.textContent = t('Search is unavailable right now. Click the map to place the pin instead.');
    }
  }
  search.input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); doSearch(); } });

  const el = h('div', {},
    search.el,
    h('div', { class: 'actions' },
      h('button', { type: 'button', class: 'btn btn--ghost btn--small', onclick: doSearch }, t('Search')),
      h('button', { type: 'button', class: 'btn btn--ghost btn--small', onclick: async () => {
        try { const p = await locate(); setPoint(p.lat, p.lng); } catch (e) { status.textContent = e.message; }
      } }, t('Use my current location'))),
    results, mapEl, status);

  return {
    el,
    async mount() {
      const has = Number.isFinite(initial?.lat);
      const m = await createMap(mapEl, has ? { center: [initial.lat, initial.lng], zoom: 17 } : { center: MALAYSIA_CENTER, zoom: MALAYSIA_ZOOM });
      if (destroyed) return destroyMap(m);
      map = m;
      map.onClick((la, ln) => setPoint(la, ln, false));
      // the coordinate fields hold the initial point (or whatever was typed while the map loaded)
      const la = parseFloat(lat.input.value);
      const ln = parseFloat(lng.input.value);
      if (Number.isFinite(la) && Number.isFinite(ln)) setPoint(la, ln, !has, false);
    },
    destroy() { destroyed = true; destroyMap(map); },
  };
}

// ---------- "How do you know?" ----------

const SOURCE_HINTS = {
  used_it: 'Shows as “Shared by the community”.',
  heard: 'Shows as “Shared by the community”. Others can confirm it after they visit.',
};

/** For community members: how they know about the offer (used it, or saw / heard about it). */
function sourcePicker(meta) {
  const errEl = h('p', { class: 'field-error', hidden: true });
  const inputs = Object.entries(meta.sources).filter(([v]) => SOURCE_HINTS[v]).map(([v, text]) => {
    const id = `src-${v}`;
    const input = h('input', { type: 'radio', name: 'source', id, value: v, 'aria-describedby': `${id}-hint` });
    return { input, el: h('div', { class: 'check check--card' }, input,
      h('label', { for: id }, h('strong', {}, t(text)), h('span', { class: 'hint', id: `${id}-hint` }, t(SOURCE_HINTS[v])))) };
  });
  const el = h('fieldset', { class: 'group--inner' }, h('legend', {}, t('How do you know about this offer?')), errEl,
    h('div', { class: 'check-stack' }, inputs.map((i) => i.el)));
  return {
    el,
    value: () => inputs.find((i) => i.input.checked)?.input.value ?? '',
    setError: (m) => { errEl.textContent = m || ''; errEl.hidden = !m; if (m) inputs[0].input.focus(); },
  };
}

// ---------- "Who are you submitting as?" ----------

const CONTRIBUTORS = [
  ['community', 'Community member / Visitor', 'I’m sharing information about a place or benefit I know about.'],
  ['business', 'Business owner / Authorised representative', 'I represent this business and am authorised to provide or confirm its information.'],
];

/**
 * One entry point for everyone: the choice shows the fields that fit. Choosing "business" records who they say they
 * are, nothing more: the listing still shows "Shared by the community" until a moderator confirms the offer.
 */
function contributorSection(meta) {
  const errEl = h('p', { class: 'field-error', hidden: true });
  const source = sourcePicker(meta);
  const f = {
    source_url: field({ label: t('Where did you find this information? (optional)'), name: 'source_url', type: 'url', maxlength: 300, hint: t('A link to the business’s own page or post helps a moderator check it. Include https://') }),
    note: field({ label: t('Your own experience (optional)'), name: 'note', tag: 'textarea', rows: 3, maxlength: 500, hint: t('For example, when you went and whether you got the offer. Only moderators see this.') }),
    rep_name: field({ label: t('Your name'), name: 'rep_name', required: true, maxlength: 80 }),
    rep_role: field({ label: t('Your role (optional)'), name: 'rep_role', maxlength: 80, hint: t('For example, owner, manager or marketing staff.') }),
    rep_contact: field({ label: t('Email or phone we can reach you on'), name: 'rep_contact', required: true, maxlength: 120, hint: t('Only moderators see this. We use it to confirm the offer with you.') }),
  };
  const community = h('div', { class: 'contrib-more', hidden: true }, source.el, f.source_url.el, f.note.el);
  const business = h('div', { class: 'contrib-more', hidden: true },
    h('p', { class: 'note-box' }, icon('question', 18), ' ', t('Checking that you represent the business is not available yet. Choosing this option does not mark the listing “Confirmed by business”. It shows as “Shared by the community” until a moderator confirms the offer with you. We will not ask for SSM or other documents.')),
    h('div', { class: 'grid-2' }, f.rep_name.el, f.rep_role.el), f.rep_contact.el);
  const inputs = CONTRIBUTORS.map(([v, label, hint]) => {
    const id = `who-${v}`;
    const input = h('input', { type: 'radio', name: 'contributor_type', id, value: v, 'aria-describedby': `${id}-hint`, onchange: () => {
      community.hidden = v !== 'community';
      business.hidden = v !== 'business';
      errEl.hidden = true;
    } });
    return { input, el: h('div', { class: 'check check--card' }, input,
      h('label', { for: id }, h('strong', {}, t(label)), h('span', { class: 'hint', id: `${id}-hint` }, t(hint)))) };
  });
  const type = () => inputs.find((i) => i.input.checked)?.input.value ?? '';
  const el = h('fieldset', { class: 'group' }, h('legend', {}, t('5. Who are you submitting as?')), errEl,
    h('div', { class: 'check-stack' }, inputs.map((i) => i.el)), community, business);
  return {
    el,
    fields: { source, ...f, contributor_type: { setError: (m) => { errEl.textContent = m || ''; errEl.hidden = !m; if (m) inputs[0].input.focus(); } } },
    /** Client-side check before sending; returns field errors, empty when fine. */
    check() {
      const v = type();
      if (!v) return { contributor_type: t('Choose who you are submitting as.') };
      if (v === 'community' && !source.value()) return { source: t('Choose how you know about this place.') };
      if (v === 'business') {
        const e = {};
        if (f.rep_name.input.value.trim().length < 2) e.rep_name = t('Enter your name.');
        if (f.rep_contact.input.value.trim().length < 5) e.rep_contact = t('Enter an email or phone number we can reach you on.');
        return e;
      }
      return {};
    },
    payload() {
      const v = type();
      const val = (k) => f[k].input.value;
      return {
        contributor_type: v,
        source: v === 'business' ? 'owner' : source.value(),
        is_owner: v === 'business',
        contributor: v === 'business'
          ? { rep_name: val('rep_name'), rep_role: val('rep_role'), rep_contact: val('rep_contact') }
          : { note: val('note'), source_url: val('source_url') },
      };
    },
  };
}

function placeForm(ctx, initial, { mode, onSubmit }) {
  const { meta } = ctx.state;
  const f = {
    name: field({ label: t('Business or place name'), name: 'name', value: initial.name, required: true, maxlength: 120 }),
    category: field({ label: t('Category'), name: 'category', tag: 'select', value: initial.category, options: Object.entries(meta.categories) }),
    description: field({ label: t('Description (optional)'), name: 'description', tag: 'textarea', value: initial.description, maxlength: 1000, rows: 3, hint: t('What is it, and anything helpful for OKU visitors?') }),
    address: field({ label: t('Street address'), name: 'address', value: initial.address, required: true, maxlength: 250 }),
    city: field({ label: t('Town / city'), name: 'city', value: initial.city, maxlength: 80 }),
    state: field({ label: t('State'), name: 'state', tag: 'select', value: initial.state, options: [['', t('Select state')], ...meta.states.map((s) => [s, s])] }),
    phone: field({ label: t('Phone (optional)'), name: 'phone', type: 'tel', value: initial.phone, maxlength: 30 }),
    website: field({ label: t('Website (optional)'), name: 'website', type: 'url', value: initial.website, maxlength: 300, hint: t('Include https://') }),
  };
  const lat = field({ label: t('Latitude'), name: 'lat', type: 'number', value: initial.lat ?? '', required: true, attrs: { step: 'any' } });
  const lng = field({ label: t('Longitude'), name: 'lng', type: 'number', value: initial.lng ?? '', required: true, attrs: { step: 'any' } });
  const picker = locationPicker(meta, initial, lat, lng);
  const guest = !ctx.state.user;
  const photo = guest ? { el: h('p', { class: 'hint note-box' }, icon('question', 18), ' ', t('Log in to add a photo. You can still send everything else.')), value: () => '' } : photoPicker(initial.image);
  const who = mode === 'create' ? contributorSection(meta) : null;
  const feats = checkboxGroup({ legend: t('Accessibility features'), name: 'features', options: Object.entries(meta.features), selected: initial.accessibility, hint: t('Tick what you have seen or know is available.') });
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

  const reason = mode === 'edit'
    ? field({ label: t('Why are you suggesting this change?'), name: 'reason', tag: 'textarea', rows: 3, maxlength: 500, hint: t('Optional but helps moderators verify quickly, e.g. “Visited on 3 March; the offer is now 15%.”') })
    : null;

  const fields = { ...f, lat, lng, ...(who ? who.fields : {}), offers: { setError: (m) => { offersErr.textContent = m || ''; offersErr.hidden = !m; } } };
  const form = formShell({
    fields,
    submitLabel: mode === 'create' ? t('Submit for review') : t('Send edit request'),
    onSubmit: () => {
      const problems = who?.check() ?? {};
      if (Object.keys(problems).length) {
        const err = new Error(t('Please fix the highlighted fields.'));
        err.fields = problems;
        throw err;
      }
      return onSubmit({
      ...Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v.input.value])),
      lat: lat.input.value === '' ? null : Number(lat.input.value),
      lng: lng.input.value === '' ? null : Number(lng.input.value),
      accessibility: feats.values(),
      image: photo.value(),
      offers: [...offerRows].map((r) => r.read()),
    }, { ...(who?.payload() ?? {}), reason: reason?.input.value ?? '' });
    },
    children: [
      h('fieldset', { class: 'group' }, h('legend', {}, t('1. About the place')), f.name.el, f.category.el, f.description.el, photo.el),
      h('fieldset', { class: 'group' }, h('legend', {}, t('2. Where is it?')), f.address.el, h('div', { class: 'grid-2' }, f.city.el, f.state.el),
        picker.el, h('div', { class: 'grid-2' }, lat.el, lng.el)),
      h('fieldset', { class: 'group' }, h('legend', {}, t('3. OKU offers')),
        h('p', { class: 'hint' }, t('Discounts, freebies, priority service, or a chance to volunteer. Leave empty if it is simply an accessible space.')),
        offersBox, offersErr,
        h('div', { class: 'actions' }, h('button', { type: 'button', class: 'btn btn--ghost btn--small', onclick: () => addOffer().fields.title.input.focus() }, t('Add another offer')))),
      h('fieldset', { class: 'group' }, h('legend', {}, t('4. Accessibility & contact')), feats.el, h('div', { class: 'grid-2' }, f.phone.el, f.website.el)),
      who?.el, reason?.el,
    ],
  });
  return { form, picker };
}

const blankPlace = { image: '', name: '', category: 'restaurant', description: '', address: '', city: '', state: '', phone: '', website: '', accessibility: [], offers: [] };

export async function submitPlaceView(ctx, root) {
  if (needLogin(ctx, root, 'add a place')) return { title: t('Log in') };
  const { form, picker } = placeForm(ctx, blankPlace, {
    mode: 'create',
    onSubmit: async (data, extra) => {
      const { reason, ...who } = extra;
      const res = await api('POST', '/places', { ...data, ...who });
      ctx.toast(res.status === 'approved' ? t('Published.') : t('Thank you! A moderator will check it before it appears.'));
      ctx.go(res.status === 'approved' ? `#/place/${res.id}` : '#/account');
    },
  });
  root.append(h('div', { class: 'page page--narrow' }, h('h1', {}, t('Add a place')),
    h('p', { class: 'lede' }, t('Know a business that gives OKU discounts, a place that is genuinely accessible, or a group that welcomes volunteers? Add it so others can find it.')),
    h('p', {}, t('Community members and business owners both start here. You will say which you are near the end of the form.'), ' ', h('a', { href: '#/how-it-works' }, t('How it works'))),
    h('p', { class: 'note-box' }, icon('shield', 18), ' ', t('A moderator checks every suggestion before it appears.')), form));
  return { title: t('Add a place'), mounted: () => picker.mount(), destroy: () => picker.destroy() };
}

export async function editPlaceView(ctx, root, [id]) {
  if (needLogin(ctx, root, 'suggest an edit')) return { title: t('Log in') };
  const { place } = await api('GET', `/places/${id}`);
  const { form, picker } = placeForm(ctx, place, {
    mode: 'edit',
    onSubmit: async (data, extra) => {
      await api('POST', `/places/${id}/edits`, { changes: data, reason: extra.reason });
      ctx.toast(t('Thanks! Your suggested edit is waiting for moderator review.'));
      ctx.go(`#/place/${id}`);
    },
  });
  root.append(h('div', { class: 'page page--narrow' }, h('h1', {}, `${t('Suggest an edit')}: ${place.name}`),
    h('p', { class: 'lede' }, t('Change anything that is wrong or out of date. Nothing changes on the listing until a moderator approves your request.')), form));
  return { title: `${t('Suggest an edit')}: ${place.name}`, mounted: () => picker.mount(), destroy: () => picker.destroy() };
}

// ---------- benefit form ----------

function benefitForm(ctx, initial, { mode, onSubmit }) {
  const { meta } = ctx.state;
  const f = {
    title: field({ label: t('Benefit name'), name: 'title', value: initial.title, required: true, maxlength: 140 }),
    agency: field({ label: t('Agency or provider'), name: 'agency', value: initial.agency, required: true, maxlength: 120, hint: t('e.g. JKM, LHDN, a local council') }),
    category: field({ label: t('Category'), name: 'category', tag: 'select', value: initial.category, options: Object.entries(meta.benefitCategories) }),
    summary: field({ label: t('What does it offer?'), name: 'summary', tag: 'textarea', value: initial.summary, required: true, maxlength: 600, rows: 4 }),
    eligibility: field({ label: t('Who can apply? (optional)'), name: 'eligibility', tag: 'textarea', value: initial.eligibility, maxlength: 800, rows: 3 }),
    how_to_apply: field({ label: t('How to apply (optional)'), name: 'how_to_apply', tag: 'textarea', value: initial.how_to_apply, maxlength: 800, rows: 3 }),
    url: field({ label: t('Official web page (optional)'), name: 'url', type: 'url', value: initial.url, maxlength: 300, hint: t('Link to the agency page so others can confirm. Include https://') }),
  };
  const reason = mode === 'edit'
    ? field({ label: t('Why are you suggesting this change?'), name: 'reason', tag: 'textarea', rows: 3, maxlength: 500, hint: t('A source link or date helps moderators verify.') })
    : null;
  return formShell({
    fields: f,
    submitLabel: mode === 'create' ? t('Submit for review') : t('Send edit request'),
    onSubmit: () => onSubmit(Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v.input.value])), reason?.input.value ?? ''),
    children: [Object.values(f).map((x) => x.el), reason?.el],
  });
}

const blankBenefit = { title: '', agency: '', category: 'financial', summary: '', eligibility: '', how_to_apply: '', url: '' };

export async function submitBenefitView(ctx, root) {
  if (needLogin(ctx, root, 'add a benefit')) return { title: t('Log in') };
  const form = benefitForm(ctx, blankBenefit, {
    mode: 'create',
    onSubmit: async (data) => {
      const res = await api('POST', '/benefits', data);
      ctx.toast(res.status === 'approved' ? t('Published.') : t('Thank you! A moderator will review it shortly.'));
      ctx.go(res.status === 'approved' ? '#/benefits' : '#/account');
    },
  });
  root.append(h('div', { class: 'page page--narrow' }, h('h1', {}, t('Add a government benefit')),
    h('p', { class: 'lede' }, t('Share a benefit, allowance, concession or relief that OKU cardholders can claim. Please include an official source where you can.')), form));
  return { title: t('Add a benefit') };
}

export async function editBenefitView(ctx, root, [id]) {
  if (needLogin(ctx, root, 'suggest an edit')) return { title: t('Log in') };
  const { benefit } = await api('GET', `/benefits/${id}`);
  const form = benefitForm(ctx, benefit, {
    mode: 'edit',
    onSubmit: async (data, reason) => {
      await api('POST', `/benefits/${id}/edits`, { changes: data, reason });
      ctx.toast(t('Thanks! Your suggested edit is waiting for moderator review.'));
      ctx.go('#/benefits');
    },
  });
  root.append(h('div', { class: 'page page--narrow' }, h('h1', {}, `${t('Suggest an edit')}: ${t(benefit.title)}`), form));
  return { title: `${t('Suggest an edit')}: ${t(benefit.title)}` };
}
