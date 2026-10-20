import { h, clear } from '../dom.js';
import { api, qs } from '../api.js';
import { field, distanceKm, fmtDistance, offerLine, icon, groupOf, placeImage, offerIcon, trustOf, trustStamp, workedLine, accessScore } from '../ui.js';
import { t } from '../i18n.js';
import { createMap, destroyMap, locate } from '../map.js';

const KIND_CHIPS = { free: 'Free', discount: 'Discount', priority: 'Priority', freebie: 'Freebie', volunteer: 'Volunteer' };
const TRUST = [['business', 'Business confirmed'], ['community', 'Community reported'], ['unverified', 'Not yet checked']];
const TRUST_RANK = { business: 0, community: 1, unverified: 2 };
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
  const mapEl = h('div', { id: 'map', role: 'region', 'aria-label': t('Map of places. The same places are in the list, with the same numbers.') });
  const tabs = ['list', 'map'].map((v) => h('button', { type: 'button', role: 'tab', 'aria-selected': String(state.view === v), 'aria-controls': `${v}-panel`, id: `${v}-tab`,
    onclick: () => showView(v) }, icon(v, 20), t(v === 'list' ? 'List' : 'Map')));
  const listPanel = h('div', { class: 'panel-list', id: 'list-panel', role: 'tabpanel', 'aria-labelledby': 'list-tab' },
    h('div', { class: 'count-row' }, count, h('a', { class: 'add-link', href: '#/submit/place' }, icon('plus', 16), t('Add a place'))),
    list);
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
    const n = activeFilterCount();
    clear(filtersBtn).append(icon('sliders', 16), n ? t('Filters · {n}', { n }) : t('Filters'));
    const mine = ++loadToken;
    let data;
    try {
      // "Not known" places have no features recorded, so the feature filter is applied here when they are included.
      const features = filters.includeUnknown ? '' : filters.features.join(',');
      data = await api('GET', `/places${qs({ q: filters.q, category: filters.category, kind: filters.kind, features })}`);
    } catch (err) {
      count.textContent = err.message;
      return;
    }
    if (mine !== loadToken || destroyed) return;
    places = data.places
      .filter((p) => !filters.includeUnknown || !p.accessibility.length || filters.features.every((f) => p.accessibility.includes(f)))
      .filter((p) => filters.trust.includes(trustOf(p).tier));
    if (state.loc) for (const p of places) p.distance = distanceKm(state.loc, p);
    if (filters.sort === 'nearest' && state.loc) places.sort((a, b) => a.distance - b.distance);
    else if (filters.sort === 'access') places.sort((a, b) => (b.avg_access ?? 0) - (a.avg_access ?? 0) || b.access_count - a.access_count);
    else places.sort((a, b) => TRUST_RANK[trustOf(a).tier] - TRUST_RANK[trustOf(b).tier]); // checked ones first
    render();
  }

  function popupFor(p, n) {
    return h('div', {}, h('h3', {}, `${n}. ${p.name}`), h('p', {}, meta.categories[p.category]),
      p.offers[0] ? h('p', {}, h('strong', {}, offerLine(p.offers[0]))) : null,
      h('a', { href: `#/place/${p.id}` }, t('View details')));
  }

  function render() {
    count.textContent = places.length === 1 ? t('1 place') : t('{n} places', { n: places.length });
    showBtn.textContent = t('Show {n} places', { n: places.length });
    clear(list);
    cards.clear();
    if (!places.length) list.append(h('li', { class: 'empty' }, h('strong', {}, t('No places match yet.')), h('p', {}, t('Try removing a filter, or'), ' ', h('a', { href: '#/submit/place' }, t('add one you know')))));
    places.forEach((p, i) => {
      const li = placeCard(p, i + 1);
      cards.set(p.id, li);
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
        workedLine(p) || accessScore(p) ? h('p', { class: 'result-stats' }, workedLine(p), accessScore(p)) : null,
        h('div', { class: 'result-foot' },
          trustStamp(p),
          h('button', { type: 'button', class: 'linkbtn result-map', 'aria-label': `${t('Show on map')}: ${p.name}`, onclick: () => focusOnMap(p) }, icon('pin', 16), t('Map')))));
  }

  function highlight(id, scroll) {
    for (const [pid, li] of cards) li.classList.toggle('is-active', pid === id);
    if (scroll) cards.get(id)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  async function focusOnMap(p) {
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
