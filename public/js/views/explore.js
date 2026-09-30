import { h, clear } from '../dom.js';
import { api, qs } from '../api.js';
import { field, checkboxGroup, distanceKm, fmtDistance, offerLine, icon, badge } from '../ui.js';
import { createMap, destroyMap, pinIcon, locate } from '../map.js';

const KIND_CHIPS = { free: 'Free', discount: 'Discount', priority: 'Priority', freebie: 'Freebie', other: 'Other' };

export async function exploreView(ctx, root) {
  const { state } = ctx;
  const { meta, filters } = state;
  let places = [];
  let map;
  let layer;
  let youMarker;
  const markers = new Map();
  const cards = new Map();
  let loadToken = 0;

  // ----- filters -----
  const q = field({ label: 'Search places', name: 'q', type: 'search', value: filters.q, attrs: { placeholder: 'Search by name, area or offer', autocomplete: 'off' } });
  q.el.querySelector('label').classList.add('sr-only');
  q.el.classList.add('search-field');
  q.el.prepend(icon('search', 18));

  const kindBtns = Object.entries({ '': 'All', ...KIND_CHIPS }).map(([value, text]) => {
    const btn = h('button', { type: 'button', class: 'chip-btn', 'aria-pressed': String(filters.kind === value), onclick: () => {
      filters.kind = value;
      for (const [v, b] of kindBtns.map((x) => [x.value, x.btn])) b.setAttribute('aria-pressed', String(v === value));
      refresh();
    } }, text);
    return { value, btn };
  });
  const kindRow = h('div', { class: 'chip-row', role: 'group', 'aria-label': 'Kind of offer' }, kindBtns.map((k) => k.btn));

  const category = field({ label: 'Type of place', name: 'category', tag: 'select', value: filters.category,
    options: [['', 'All types'], ...Object.entries(meta.categories)] });
  const sort = field({ label: 'Sort by', name: 'sort', tag: 'select', value: filters.sort,
    options: [['recommended', 'Recommended'], ['nearest', 'Nearest to me'], ['rating', 'Top rated']] });
  const feats = checkboxGroup({ legend: 'Accessibility needs', name: 'features', options: Object.entries(meta.features), selected: filters.features,
    hint: 'Only show places with all ticked features.' });
  const locBtn = h('button', { type: 'button', class: 'btn btn--ghost btn--icon', title: 'Sort by distance from me', 'aria-label': 'Use my location to sort by distance', onclick: useLocation }, icon('locate', 20));
  const locStatus = h('p', { class: 'hint', 'aria-live': 'polite' });
  const details = h('details', { class: 'more', open: filters.features.length > 0 }, h('summary', {}, 'Accessibility needs'), feats.el);

  const form = h('form', { role: 'search', 'aria-label': 'Filter places', onsubmit: (e) => { e.preventDefault(); refresh(); } },
    h('div', { class: 'search-row' }, q.el, locBtn),
    locStatus,
    kindRow,
    h('div', { class: 'filter-row' }, category.el, sort.el),
    details);

  const count = h('p', { class: 'result-count', role: 'status' });
  const list = h('ul', { class: 'results', 'aria-label': 'Places' });
  const mapEl = h('div', { id: 'map', role: 'region', 'aria-label': 'Map of places. The results list is an equivalent alternative to the map.' });

  root.append(h('div', { class: 'explore' },
    h('section', { class: 'panel', 'aria-labelledby': 'explore-h' },
      h('div', { class: 'panel-head' },
        h('h1', { id: 'explore-h' }, 'Places for OKU cardholders'),
        form),
      h('div', { class: 'panel-list' },
        h('div', { class: 'count-row' }, count, h('a', { class: 'add-link', href: '#/submit/place' }, icon('plus', 15), 'Add a place')),
        list)),
    h('div', { class: 'explore-map' }, mapEl)));

  function readFilters() {
    Object.assign(filters, { q: q.input.value.trim(), category: category.input.value, features: feats.values(), sort: sort.input.value });
  }

  let timer;
  q.input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(refresh, 300); });
  for (const el of [category.input, sort.input]) el.addEventListener('change', refresh);
  feats.el.addEventListener('change', refresh);

  async function useLocation() {
    locBtn.disabled = true;
    locStatus.textContent = 'Locating…';
    try {
      state.loc = await locate();
      locStatus.textContent = 'Sorted by distance from you.';
      sort.input.value = 'nearest';
      showYou();
      refresh(true);
    } catch (err) {
      locStatus.textContent = err.message;
    } finally {
      locBtn.disabled = false;
    }
  }

  function showYou() {
    if (!state.loc || !map) return;
    youMarker?.remove();
    youMarker = L.circleMarker([state.loc.lat, state.loc.lng], { radius: 8, color: '#fff', weight: 3, fillColor: '#2563eb', fillOpacity: 1 })
      .bindTooltip('You are here').addTo(map);
  }

  // ----- data -----
  async function refresh(fit = true) {
    readFilters();
    const mine = ++loadToken;
    let data;
    try {
      data = await api('GET', `/places${qs({ q: filters.q, category: filters.category, kind: filters.kind, features: filters.features.join(',') })}`);
    } catch (err) {
      count.textContent = err.message;
      return;
    }
    if (mine !== loadToken) return;
    places = data.places;
    if (state.loc) for (const p of places) p.distance = distanceKm(state.loc, p);
    if (filters.sort === 'nearest' && state.loc) places.sort((a, b) => a.distance - b.distance);
    else if (filters.sort === 'rating') places.sort((a, b) => (b.avg_rating ?? 0) - (a.avg_rating ?? 0) || b.review_count - a.review_count);
    render(fit === true);
  }

  function popupFor(p) {
    return h('div', {}, h('h3', {}, p.name), h('p', {}, meta.categories[p.category]),
      p.offers[0] ? h('p', {}, h('strong', {}, offerLine(p.offers[0]))) : null,
      h('a', { href: `#/place/${p.id}` }, 'View details'));
  }

  function render(fit) {
    count.textContent = places.length === 1 ? '1 place' : `${places.length} places`;
    clear(list);
    layer.clearLayers();
    markers.clear();
    cards.clear();
    if (!places.length) list.append(h('li', { class: 'empty' }, h('strong', {}, 'No places match yet.'), h('p', {}, 'Try removing a filter, or '), h('a', { href: '#/submit/place' }, 'add one you know')));
    for (const p of places) {
      const li = placeCard(p);
      cards.set(p.id, li);
      list.append(li);
      const m = L.marker([p.lat, p.lng], { icon: pinIcon(p.partner_verified ? 'pin--partner' : ''), title: p.name, alt: p.name, keyboard: true })
        .bindPopup(() => popupFor(p));
      m.on('click', () => highlight(p.id, true));
      m.addTo(layer);
      markers.set(p.id, m);
    }
    if (fit && places.length) {
      const b = L.latLngBounds(places.map((p) => [p.lat, p.lng]));
      map.fitBounds(b.pad(0.2), { maxZoom: 15 });
    }
  }

  function placeCard(p) {
    const top = p.offers.slice(0, 2);
    return h('li', { class: 'result', 'data-id': p.id },
      h('div', { class: 'result-top' },
        h('span', { class: 'result-cat' }, meta.categories[p.category]),
        p.distance != null ? h('span', { class: 'result-dist' }, fmtDistance(p.distance)) : null),
      h('h3', {}, h('a', { href: `#/place/${p.id}` }, p.name)),
      h('p', { class: 'result-addr' }, [p.address, p.city].filter(Boolean).join(', ')),
      top.map((o) => h('p', { class: `deal deal--${o.kind}` }, icon('check', 16), h('span', {}, offerLine(o)))),
      p.offers.length > 2 ? h('p', { class: 'result-more' }, `+${p.offers.length - 2} more offer${p.offers.length - 2 === 1 ? '' : 's'}`) : null,
      h('div', { class: 'result-foot' },
        p.review_count ? h('span', { class: 'rating' }, icon('star', 14), h('strong', {}, p.avg_rating), ` (${p.review_count})`) : h('span', { class: 'muted' }, 'No reviews yet'),
        p.partner_verified ? badge('Verified partner', 'badge--ok') : null,
        h('button', { type: 'button', class: 'linkbtn result-map', 'aria-label': `Show ${p.name} on the map`, onclick: () => focusOnMap(p) }, icon('pin', 15), 'Map')));
  }

  function highlight(id, scroll) {
    for (const [pid, li] of cards) li.classList.toggle('is-active', pid === id);
    if (scroll) cards.get(id)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  function focusOnMap(p) {
    map.setView([p.lat, p.lng], Math.max(map.getZoom(), 16));
    markers.get(p.id)?.openPopup();
    highlight(p.id, false);
    document.getElementById('map').scrollIntoView({ block: 'nearest' });
  }

  return {
    title: 'Places',
    mounted() {
      map = createMap(mapEl);
      layer = L.layerGroup().addTo(map);
      showYou();
      refresh(true);
    },
    destroy() { clearTimeout(timer); loadToken++; destroyMap(map); },
  };
}
