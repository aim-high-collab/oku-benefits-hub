import { h, clear } from '../dom.js';
import { api, qs } from '../api.js';
import { field, checkboxGroup, badge, stars, distanceKm, fmtDistance, offerLine } from '../ui.js';
import { createMap, destroyMap, pinIcon, locate } from '../map.js';

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
  const q = field({ label: 'Search', name: 'q', type: 'search', value: filters.q, attrs: { placeholder: 'Name, place, or offer (e.g. “10% off”)', autocomplete: 'off' } });
  const category = field({ label: 'Type of place', name: 'category', tag: 'select', value: filters.category,
    options: [['', 'All types'], ...Object.entries(meta.categories)] });
  const kind = field({ label: 'Kind of offer', name: 'kind', tag: 'select', value: filters.kind,
    options: [['', 'Any (or none)'], ...Object.entries(meta.offerKinds)] });
  const sort = field({ label: 'Sort by', name: 'sort', tag: 'select', value: filters.sort,
    options: [['recommended', 'Recommended'], ['nearest', 'Nearest to me'], ['rating', 'Top rated']] });
  const feats = checkboxGroup({ legend: 'Accessibility needs', name: 'features', options: Object.entries(meta.features), selected: filters.features,
    hint: 'Only show places with all ticked features.' });
  const locBtn = h('button', { type: 'button', class: 'btn btn--ghost btn--small', onclick: useLocation }, 'Use my location');
  const locStatus = h('span', { class: 'muted', 'aria-live': 'polite' });
  const details = h('details', { class: 'more', open: filters.features.length > 0 }, h('summary', {}, 'Accessibility filters'), feats.el);

  const form = h('form', { role: 'search', 'aria-label': 'Filter places', onsubmit: (e) => { e.preventDefault(); refresh(); } },
    q.el, h('div', { class: 'filter-row' }, category.el, kind.el), details, h('div', { class: 'filter-row' }, sort.el, h('div', { class: 'field', role: 'group', 'aria-labelledby': 'loc-lbl' },
      h('span', { class: 'label-text', id: 'loc-lbl' }, 'Location'), locBtn, locStatus)));

  const count = h('p', { class: 'result-count', role: 'status' });
  const list = h('ul', { class: 'results', 'aria-label': 'Places' });
  const mapEl = h('div', { id: 'map', role: 'region', 'aria-label': 'Map of places. The results list is an equivalent alternative to the map.' });

  root.append(h('div', { class: 'explore' },
    h('section', { class: 'explore-filters', 'aria-labelledby': 'explore-h' },
      h('h1', { id: 'explore-h' }, 'OKU-friendly places'),
      h('p', { class: 'muted' }, 'Businesses and attractions that offer OKU discounts or perks, and spaces that are accessible. Community-submitted and moderated.'),
      form,
      h('div', { class: 'actions' },
        h('a', { class: 'btn btn--small', href: '#/submit/place' }, 'Add a place or offer'),
        h('a', { class: 'btn btn--ghost btn--small', href: '#/benefits' }, 'Government benefits'))),
    h('div', { class: 'explore-map' }, mapEl),
    h('section', { class: 'explore-results', 'aria-label': 'Results' }, count, list)));

  function readFilters() {
    Object.assign(filters, { q: q.input.value.trim(), category: category.input.value, kind: kind.input.value, features: feats.values(), sort: sort.input.value });
  }

  let timer;
  const debounced = () => { clearTimeout(timer); timer = setTimeout(refresh, 300); };
  q.input.addEventListener('input', debounced);
  for (const el of [category.input, kind.input, sort.input]) el.addEventListener('change', refresh);
  feats.el.addEventListener('change', refresh);

  async function useLocation() {
    locBtn.disabled = true;
    locStatus.textContent = ' Locating…';
    try {
      state.loc = await locate();
      locStatus.textContent = ' Location found.';
      if (sort.input.value === 'recommended') sort.input.value = 'nearest';
      showYou();
      refresh(true);
    } catch (err) {
      locStatus.textContent = ` ${err.message}`;
    } finally {
      locBtn.disabled = false;
    }
  }

  function showYou() {
    if (!state.loc || !map) return;
    youMarker?.remove();
    youMarker = L.circleMarker([state.loc.lat, state.loc.lng], { radius: 8, color: '#fff', weight: 3, fillColor: '#b45309', fillOpacity: 1 })
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
    count.textContent = places.length === 1 ? '1 place found' : `${places.length} places found`;
    clear(list);
    layer.clearLayers();
    markers.clear();
    cards.clear();
    if (!places.length) list.append(h('li', { class: 'empty card' }, 'No places match those filters yet. ', h('a', { href: '#/submit/place' }, 'Know one? Add it.')));
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
    return h('li', { class: 'card place-card', 'data-id': p.id },
      h('h3', {}, h('a', { href: `#/place/${p.id}` }, p.name)),
      h('p', { class: 'meta' }, [meta.categories[p.category], p.city, p.distance != null ? fmtDistance(p.distance) : null].filter(Boolean).join(' · ')),
      h('div', { class: 'badges' },
        p.partner_verified ? badge('✓ Verified partner', 'badge--ok') : null,
        p.review_count ? h('span', {}, stars(p.avg_rating), ` ${p.avg_rating} (${p.review_count})`) : badge('No reviews yet', 'badge--muted')),
      top.length ? h('ul', { class: 'chips', 'aria-label': 'OKU offers' }, top.map((o) => h('li', { class: 'chip' }, offerLine(o)))) : null,
      p.offers.length > 2 ? h('p', { class: 'meta' }, `+${p.offers.length - 2} more`) : null,
      h('div', { class: 'row-actions' },
        h('button', { type: 'button', class: 'btn btn--ghost btn--small', 'aria-label': `Show ${p.name} on the map`, onclick: () => focusOnMap(p) }, 'Show on map')));
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
    title: 'Map & places',
    keepScroll: false,
    mounted() {
      map = createMap(mapEl);
      layer = L.layerGroup().addTo(map);
      showYou();
      refresh(true);
    },
    destroy() { clearTimeout(timer); loadToken++; destroyMap(map); },
  };
}
