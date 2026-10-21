import { h, clear } from '../dom.js';
import { api, qs } from '../api.js';
import { field, distanceKm, fmtDistance, offerLine, icon, groupOf, placeImage, offerIcon, trustOf, trustStamp, workedLine, knownFeatures, accessYes } from '../ui.js';
import { t } from '../i18n.js';
import { createMap, destroyMap, locate } from '../map.js';

const KIND_CHIPS = { free: 'Free', discount: 'Discount', priority: 'Priority', freebie: 'Freebie', volunteer: 'Volunteer' };
const TRUST = [['business', 'Business confirmed'], ['community', 'Community reported'], ['unverified', 'Not yet checked']];
const TRUST_RANK = { business: 0, community: 1, unverified: 2 };
// What each trust label means, for the "How sure?" key beside the count.
const TRUST_KEY = [
  ['business', 'shield', 'Business confirmed', 'The business itself told us the offer is on.'],
  ['community', 'users', 'Community reported', 'Visitors used it and told us if it worked.'],
  ['unverified', 'question', 'Not yet checked', 'Found online or from a tip. Check before you go.'],
];
// The list opens on one area so the count can say where it is for. Klang Valley holds most listings today.
const AREAS = { klang: ['Selangor', 'W.P. Kuala Lumpur', 'W.P. Putrajaya'], all: null };
const AREA_LABEL = { klang: 'Klang Valley', all: 'All of Malaysia' };
// On a phone the list shows this many places, then a "Show more" button.
const FIRST_PAGE = 5;
// Below this width the list and the map are two tabs, and the map only loads when its tab is opened.
const WIDE = window.matchMedia('(min-width: 64rem)');

export async function exploreView(ctx, root) {
  const { state } = ctx;
  const { meta, filters } = state;
  let places = [];
  let map;
  let mapLoading = null;
  let destroyed = false;
  let youMarker;
  const markers = new Map();
  const cards = new Map();
  let loadToken = 0;
  let showAll = false;
  filters.area ??= 'klang';
  const areaName = (a) => (AREA_LABEL[a] ? t(AREA_LABEL[a]) : a);

  // ----- search and quick filters -----
  const q = field({ label: t('Search places'), name: 'q', type: 'search', value: filters.q, attrs: { placeholder: t('Search a place, town or offer'), autocomplete: 'off' } });
  q.el.querySelector('label').classList.add('sr-only');
  q.el.classList.add('search-field');
  q.el.prepend(icon('search', 18));

  const kindBtns = Object.entries({ '': 'All', ...KIND_CHIPS }).map(([value, text]) => {
    const btn = h('button', { type: 'button', class: 'chip-btn', 'data-kind': value, 'aria-pressed': String(filters.kind === value), onclick: () => {
      filters.kind = value;
      for (const k of kindBtns) k.btn.setAttribute('aria-pressed', String(k.value === value));
      refresh();
    } }, icon('check', 16), t(text));
    return { value, btn };
  });

  // ----- the filters sheet -----
  const category = field({ label: t('Type of place'), name: 'category', tag: 'select', value: filters.category,
    options: [['', t('All types')], ...Object.entries(meta.categories)] });
  const sort = field({ label: t('Sort by'), name: 'sort', tag: 'select', value: filters.sort,
    options: [['recommended', t('Recommended')], ['nearest', t('Nearest to me')], ['access', t('Best access')]] });
  const box = (name, value, text, checked) => {
    const id = `cb-${name}-${value}`;
    const input = h('input', { type: 'checkbox', id, name, value, checked });
    return { input, el: h('div', { class: 'check' }, input, h('label', { for: id }, text)) };
  };
  const featBoxes = Object.entries(meta.features).map(([v, text]) => box('features', v, text, filters.features.includes(v)));
  const unknownBox = box('unknown', 'yes', '', filters.includeUnknown);
  unknownBox.el.querySelector('label').append(h('strong', {}, t('Also show places where we don’t know yet')), ' ', t('They are marked “Not known”, so you can ask before you go.'));
  unknownBox.el.classList.add('check--card');
  const trustBoxes = TRUST.map(([v, text]) => box('trust', v, t(text), filters.trust.includes(v)));

  const sheetId = 'filter-sheet';
  const filtersBtn = h('button', { type: 'button', class: 'chip-btn chip-btn--filters', 'aria-expanded': 'false', 'aria-controls': sheetId, onclick: () => toggleSheet() });
  const showBtn = h('button', { type: 'button', class: 'btn', onclick: () => toggleSheet(false) });
  const sheet = h('div', { class: 'filter-sheet', id: sheetId, hidden: true, role: 'group', 'aria-label': t('Filters') },
    h('div', { class: 'sheet-head' }, h('h2', {}, t('Filters')),
      h('button', { type: 'button', class: 'btn btn--ghost btn--icon', 'aria-label': t('Close filters'), onclick: () => toggleSheet(false) }, icon('x', 20))),
    h('div', { class: 'filter-row' }, category.el, sort.el),
    h('fieldset', { class: 'checks' }, h('legend', {}, t('Getting in and around')), h('p', { class: 'hint' }, t('Only show places with all ticked features.')),
      h('div', { class: 'check-grid' }, featBoxes.map((b) => b.el))),
    unknownBox.el,
    h('fieldset', { class: 'checks' }, h('legend', {}, t('How sure')), h('div', { class: 'check-row' }, trustBoxes.map((b) => b.el))),
    h('div', { class: 'actions' },
      h('button', { type: 'button', class: 'btn btn--ghost', onclick: clearFilters }, t('Clear')), showBtn));

  function toggleSheet(open = sheet.hidden) {
    sheet.hidden = !open;
    filtersBtn.setAttribute('aria-expanded', String(open));
    if (open) sheet.querySelector('select')?.focus();
    else filtersBtn.focus();
  }

  function clearFilters() {
    category.input.value = '';
    sort.input.value = 'recommended';
    for (const b of featBoxes) b.input.checked = false;
    unknownBox.input.checked = true;
    for (const b of trustBoxes) b.input.checked = true;
    refresh();
  }

  function activeFilterCount() {
    return (filters.category ? 1 : 0) + filters.features.length + (filters.trust.length < 3 ? 1 : 0) + (filters.sort !== 'recommended' ? 1 : 0);
  }

  const locBtn = h('button', { type: 'button', class: 'btn btn--ghost btn--icon', title: t('Use my location to sort by distance'), 'aria-label': t('Use my location to sort by distance'), onclick: useLocation }, icon('locate', 20));
  const locStatus = h('p', { class: 'hint', 'aria-live': 'polite' });

  const form = h('form', { role: 'search', 'aria-label': t('Search places'), onsubmit: (e) => { e.preventDefault(); refresh(); } },
    h('div', { class: 'search-row' }, q.el, locBtn),
    locStatus,
    h('div', { class: 'chip-row', role: 'group', 'aria-label': t('Kind of offer') }, filtersBtn, kindBtns.map((k) => k.btn)),
    sheet);

  // ----- list / map -----
  const count = h('p', { class: 'result-count', role: 'status' });
  const list = h('ol', { class: 'results', 'aria-label': t('Places') });
  const moreBtn = h('button', { type: 'button', class: 'btn btn--ghost more-btn', hidden: true, onclick: () => { showAll = true; render(); list.children[FIRST_PAGE]?.querySelector('a')?.focus(); } });

  // ----- area, and the key to the three trust labels -----
  const area = field({ label: t('Area'), name: 'area', tag: 'select', value: filters.area,
    options: [['klang', t('Klang Valley')], ['all', t('All of Malaysia')], ...meta.states.map((st) => [st, st])] });
  area.el.classList.add('area-field');
  area.el.hidden = true;
  const areaBtn = h('button', { type: 'button', class: 'linkbtn area-btn', 'aria-expanded': 'false', 'aria-controls': 'area-field',
    onclick: () => toggleArea() }, t('Change area'));
  area.el.id = 'area-field';
  area.input.addEventListener('change', () => { filters.area = area.input.value; toggleArea(false); refresh(); });
  function toggleArea(open = area.el.hidden) {
    area.el.hidden = !open;
    areaBtn.setAttribute('aria-expanded', String(open));
    if (open) area.input.focus();
  }

  const keyId = 'trust-key';
  const key = h('div', { class: 'trust-key', id: keyId, hidden: true },
    h('h2', {}, t('What the labels mean')),
    h('ul', {}, TRUST_KEY.map(([tier, ic, label, text]) => h('li', {},
      h('span', { class: `stamp stamp--${tier}` }, icon(ic, 18), h('strong', {}, t(label))), h('span', {}, t(text))))));
  const keyBtn = h('button', { type: 'button', class: 'linkbtn key-btn', 'aria-expanded': 'false', 'aria-controls': keyId, onclick: () => {
    key.hidden = !key.hidden;
    keyBtn.setAttribute('aria-expanded', String(!key.hidden));
  } }, icon('question', 18), t('How sure?'));

  const addCard = h('aside', { class: 'add-card', 'aria-labelledby': 'add-card-h' },
    h('h2', { id: 'add-card-h' }, t('Know a place that says yes?')),
    h('p', {}, t('Add it in two minutes. No account needed.')),
    h('a', { class: 'btn', href: '#/submit/place' }, icon('plus', 18), t('Add a place')));
  const mapEl = h('div', { id: 'map', role: 'region', 'aria-label': t('Map of places. The same places are in the list, with the same numbers.') });
  const tabs = ['list', 'map'].map((v) => h('button', { type: 'button', role: 'tab', 'aria-selected': String(state.view === v), 'aria-controls': `${v}-panel`, id: `${v}-tab`,
    onclick: () => showView(v) }, icon(v, 20), t(v === 'list' ? 'List' : 'Map')));
  const listPanel = h('div', { class: 'panel-list', id: 'list-panel', role: 'tabpanel', 'aria-labelledby': 'list-tab' },
    h('div', { class: 'count-row' }, h('div', { class: 'count-where' }, count, areaBtn), keyBtn),
    area.el, key,
    list, moreBtn, addCard);
  const mapPanel = h('div', { class: 'explore-map', id: 'map-panel', role: 'tabpanel', 'aria-labelledby': 'map-tab' }, mapEl);
  const explore = h('div', { class: `explore is-${state.view}` },
    h('section', { class: 'panel', 'aria-labelledby': 'explore-h' },
      h('div', { class: 'panel-head' },
        h('h1', { id: 'explore-h' }, t('Places that say'), ' ', h('span', { class: 'hl' }, t('yes')), ' ', t('to your OKU card')),
        form,
        h('div', { class: 'view-switch', role: 'tablist', 'aria-label': t('Show results as') }, tabs)),
      listPanel),
    mapPanel);
  root.append(explore);

  function showView(v) {
    state.view = v;
    explore.classList.toggle('is-list', v === 'list');
    explore.classList.toggle('is-map', v === 'map');
    tabs.forEach((b, i) => b.setAttribute('aria-selected', String(['list', 'map'][i] === v)));
    if (v === 'map') ensureMap();
  }

  function readFilters() {
    Object.assign(filters, {
      q: q.input.value.trim(), category: category.input.value, sort: sort.input.value,
      features: featBoxes.filter((b) => b.input.checked).map((b) => b.input.value),
      includeUnknown: unknownBox.input.checked,
      trust: trustBoxes.filter((b) => b.input.checked).map((b) => b.input.value),
    });
  }

  let timer;
  q.input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(refresh, 300); });
  sheet.addEventListener('change', () => refresh());

  async function useLocation() {
    locBtn.disabled = true;
    locStatus.textContent = t('Locating…');
    try {
      state.loc = await locate();
      locStatus.textContent = t('Sorted by distance from you.');
      sort.input.value = 'nearest';
      showYou();
      refresh();
    } catch (err) {
      locStatus.textContent = err.message;
    } finally {
      locBtn.disabled = false;
    }
  }

  function showYou() {
    if (!state.loc || !map) return;
    youMarker?.remove();
    youMarker = map.addYouMarker(state.loc.lat, state.loc.lng);
  }

  // ----- data -----
  async function refresh() {
    readFilters();
    showAll = false;
    const n = activeFilterCount();
    clear(filtersBtn).append(icon('sliders', 16), n ? t('Filters · {n}', { n }) : t('Filters'));
    const mine = ++loadToken;
    let data;
    try {
      // Features are filtered here: visitors' Yes / No answers count too, and "Not known" places may be included.
      data = await api('GET', `/places${qs({ q: filters.q, category: filters.category, kind: filters.kind })}`);
    } catch (err) {
      count.textContent = err.message;
      return;
    }
    if (mine !== loadToken || destroyed) return;
    places = data.places
      .filter((p) => {
        const known = knownFeatures(p);
        return !filters.features.length || (known.length ? filters.features.every((f) => known.includes(f)) : filters.includeUnknown);
      })
      .filter((p) => filters.trust.includes(trustOf(p).tier))
      .filter((p) => filters.area === 'all' || (AREAS[filters.area] ?? [filters.area]).includes(p.state));
    if (state.loc) for (const p of places) p.distance = distanceKm(state.loc, p);
    if (filters.sort === 'nearest' && state.loc) places.sort((a, b) => a.distance - b.distance);
    else if (filters.sort === 'access') places.sort((a, b) => accessYes(b) - accessYes(a) || knownFeatures(b).length - knownFeatures(a).length);
    else places.sort((a, b) => TRUST_RANK[trustOf(a).tier] - TRUST_RANK[trustOf(b).tier]); // checked ones first
    render();
  }

  function popupFor(p, n) {
    return h('div', {}, h('h3', {}, `${n}. ${p.name}`), h('p', {}, meta.categories[p.category]),
      p.offers[0] ? h('p', {}, h('strong', {}, offerLine(p.offers[0]))) : null,
      h('a', { href: `#/place/${p.id}` }, t('View details')));
  }

  function render() {
    const where = filters.area === 'all' ? t('Malaysia') : areaName(filters.area);
    count.textContent = places.length === 1 ? t('1 place in {area}', { area: where }) : t('{n} places in {area}', { n: places.length, area: where });
    // Phones show the first few; wide screens scroll the panel instead.
    const cut = !showAll && !WIDE.matches && places.length > FIRST_PAGE + 1;
    moreBtn.hidden = !cut;
    if (cut) moreBtn.textContent = t('Show {n} more places', { n: places.length - FIRST_PAGE });
    showBtn.textContent = t('Show {n} places', { n: places.length });
    clear(list);
    cards.clear();
    if (!places.length) list.append(h('li', { class: 'empty' }, h('strong', {}, t('No places match yet.')), h('p', {}, t('Try removing a filter, or'), ' ', h('a', { href: '#/submit/place' }, t('add one you know')))));
    places.forEach((p, i) => {
      const li = placeCard(p, i + 1);
      cards.set(p.id, li);
      if (cut && i >= FIRST_PAGE) li.hidden = true;
      list.append(li);
    });
    drawMarkers(true);
  }

  function drawMarkers(fit) {
    if (!map) return;
    for (const m of markers.values()) m.remove();
    markers.clear();
    places.forEach((p, i) => {
      const tier = trustOf(p).tier;
      markers.set(p.id, map.addMarker({ lat: p.lat, lng: p.lng, label: String(i + 1), tone: `tone-${groupOf(p.category)} pin--${tier}`, title: `${i + 1}. ${p.name}`,
        popup: () => popupFor(p, i + 1), onClick: () => highlight(p.id, WIDE.matches) }));
    });
    if (fit) map.fitTo(places, 15);
  }

  function placeCard(p, n) {
    const first = p.offers[0];
    return h('li', { class: `result tone-${groupOf(p.category)}`, 'data-id': p.id },
      h('span', { class: 'result-num', 'aria-hidden': 'true' }, n),
      placeImage(p, 'result-thumb'),
      h('div', { class: 'result-body' },
        h('h3', {}, h('a', { href: `#/place/${p.id}` }, p.name)),
        h('p', { class: 'result-meta' }, [meta.categories[p.category], p.city, p.distance != null ? fmtDistance(p.distance) : null].filter(Boolean).join(' · ')),
        first ? h('p', { class: 'result-offer' }, offerIcon(first.kind), h('span', {}, h('strong', {}, offerLine(first)),
          p.offers.length > 1 ? h('span', { class: 'muted' }, ` · ${t('+{n} more', { n: p.offers.length - 1 })}`) : null)) : null,
        workedLine(p) ? h('p', { class: 'result-stats' }, workedLine(p)) : null,
        h('div', { class: 'result-foot' },
          trustStamp(p),
          h('button', { type: 'button', class: 'linkbtn result-map', 'aria-label': `${t('Show on map')}: ${p.name}`, onclick: () => focusOnMap(p) }, icon('pin', 16), t('Map')))));
  }

  function highlight(id, scroll) {
    for (const [pid, li] of cards) li.classList.toggle('is-active', pid === id);
    if (scroll) cards.get(id)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  async function focusOnMap(p) {
    cards.get(p.id)?.removeAttribute('hidden');
    if (!WIDE.matches) showView('map');
    await ensureMap();
    if (!map) return;
    map.setView(p.lat, p.lng, Math.max(map.getZoom(), 16));
    markers.get(p.id)?.openPopup();
    highlight(p.id, false);
    if (WIDE.matches) mapEl.scrollIntoView({ block: 'nearest' });
  }

  function ensureMap() {
    mapLoading ??= createMap(mapEl).then((m) => {
      if (destroyed) return destroyMap(m);
      map = m;
      showYou();
      drawMarkers(true);
    });
    return mapLoading;
  }

  const onResize = () => { if (WIDE.matches) ensureMap(); };
  WIDE.addEventListener('change', onResize);

  return {
    title: t('Places'),
    async mounted() {
      if (WIDE.matches || state.view === 'map') ensureMap();
      await refresh();
    },
    destroy() { destroyed = true; clearTimeout(timer); loadToken++; WIDE.removeEventListener('change', onResize); destroyMap(map); },
  };
}
