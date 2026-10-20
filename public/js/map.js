// Map provider adapter. Google Maps (JavaScript API) when the server sends a key in /api/meta,
// otherwise Leaflet (global `L`) with OpenStreetMap tiles. Views only use the handle returned by createMap.
export const MALAYSIA_CENTER = [4.2105, 108.0];
export const MALAYSIA_ZOOM = 6;

let google = null; // { key, mapId } from /api/meta
let googleFailed = false;
let googleLoad;

export function configureMaps(cfg) {
  google = cfg?.provider === 'google' && cfg.key ? cfg : null;
}

export const usingGoogle = () => Boolean(google) && !googleFailed;

export async function createMap(el, { center = MALAYSIA_CENTER, zoom = MALAYSIA_ZOOM } = {}) {
  if (usingGoogle()) {
    try {
      return await googleMap(el, center, zoom);
    } catch (err) {
      console.warn('Google Maps failed to load; falling back to OpenStreetMap.', err);
      googleFailed = true;
    }
  }
  return leafletMap(el, center, zoom);
}

export function destroyMap(map) {
  map?.destroy();
}

// `label` (e.g. the result number) is drawn inside the pin so list and map can be matched without colour.
function pinEl(tone = '', label = '') {
  const span = document.createElement('span');
  span.className = `pin ${tone}${label ? ' pin--label' : ''}`;
  if (label) {
    const b = document.createElement('b');
    b.textContent = label;
    span.append(b);
  }
  return span;
}

// ---------- Leaflet ----------

function leafletIcon(tone, label) {
  return L.divIcon({ className: 'pin-wrap', html: pinEl(tone, label).outerHTML, iconSize: [36, 40], iconAnchor: [18, 38], popupAnchor: [0, -34] });
}

function leafletMap(el, center, zoom) {
  // Zoom animation is off: Leaflet's delayed zoom-end callback throws if the map is removed during the
  // animation (we tear maps down on every route change), and it is kinder to reduced-motion users.
  const map = L.map(el, { center, zoom, worldCopyJump: true, zoomAnimation: false, markerZoomAnimation: false });
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);
  return {
    addMarker({ lat, lng, tone, label, title, popup, draggable = false, onClick, onDragEnd }) {
      const m = L.marker([lat, lng], { icon: leafletIcon(tone, label), title, alt: title, keyboard: true, draggable }).addTo(map);
      if (popup) m.bindPopup(popup);
      if (onClick) m.on('click', onClick);
      if (onDragEnd) m.on('dragend', () => { const p = m.getLatLng(); onDragEnd(p.lat, p.lng); });
      return {
        setPosition: (la, ln) => m.setLatLng([la, ln]),
        openPopup: () => m.openPopup(),
        remove: () => m.remove(),
      };
    },
    addYouMarker(lat, lng) {
      const m = L.circleMarker([lat, lng], { radius: 8, color: '#fff', weight: 3, fillColor: '#2563eb', fillOpacity: 1 })
        .bindTooltip('You are here').addTo(map);
      return { remove: () => m.remove() };
    },
    fitTo(points, maxZoom) {
      if (points.length) map.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lng])).pad(0.2), { maxZoom });
    },
    setView: (lat, lng, z) => map.setView([lat, lng], z),
    getZoom: () => map.getZoom(),
    onClick: (cb) => map.on('click', (e) => cb(e.latlng.lat, e.latlng.lng)),
    // Leaflet throws if a map is removed mid-animation (e.g. navigating away right after fitBounds).
    destroy() {
      map.stop();
      map.off();
      map.remove();
    },
  };
}

// ---------- Google Maps ----------

function loadGoogle() {
  googleLoad ??= new Promise((resolve, reject) => {
    const cb = '__okuGoogleMapsReady';
    window[cb] = () => { delete window[cb]; resolve(); };
    // Called by the API when the key is invalid or not allowed for this site.
    window.gm_authFailure = () => {
      googleFailed = true;
      console.warn('Google Maps rejected the API key. Check the key, its HTTP referrer restrictions and billing. Using OpenStreetMap from now on.');
    };
    const s = document.createElement('script');
    s.src = `https://maps.googleapis.com/maps/api/js?${new URLSearchParams({ key: google.key, v: 'weekly', loading: 'async', callback: cb, region: 'MY' })}`;
    s.async = true;
    s.onerror = () => { googleLoad = null; s.remove(); reject(new Error('Could not load the Google Maps script.')); };
    document.head.append(s);
  });
  return googleLoad;
}

const coord = (v, k) => (typeof v[k] === 'function' ? v[k]() : v[k]);

async function googleMap(el, [lat, lng], zoom) {
  await loadGoogle();
  const gm = window.google.maps;
  const [{ Map, InfoWindow }, { AdvancedMarkerElement }] = await Promise.all([gm.importLibrary('maps'), gm.importLibrary('marker')]);
  const map = new Map(el, {
    center: { lat, lng },
    zoom,
    mapId: google.mapId,
    clickableIcons: false,
    streetViewControl: false,
    mapTypeControl: false,
    fullscreenControl: true,
  });
  const info = new InfoWindow();
  const markers = new Set();

  const marker = (position, content, title, extra = {}) => {
    const m = new AdvancedMarkerElement({ map, position, content, title, ...extra });
    markers.add(m);
    return m;
  };

  return {
    addMarker({ lat: la, lng: ln, tone, label, title, popup, draggable = false, onClick, onDragEnd }) {
      const wrap = document.createElement('div');
      wrap.className = 'pin-wrap gm-pin';
      wrap.append(pinEl(tone, label));
      const m = marker({ lat: la, lng: ln }, wrap, title, { gmpDraggable: draggable });
      const openPopup = () => {
        info.setContent(popup());
        info.open({ anchor: m, map });
      };
      if (popup || onClick) m.addListener('click', () => { if (popup) openPopup(); onClick?.(); });
      if (onDragEnd) m.addListener('dragend', () => onDragEnd(coord(m.position, 'lat'), coord(m.position, 'lng')));
      return {
        setPosition: (a, b) => { m.position = { lat: a, lng: b }; },
        openPopup: () => { if (popup) openPopup(); },
        remove: () => { if (info.anchor === m) info.close(); m.map = null; markers.delete(m); },
      };
    },
    addYouMarker(la, ln) {
      const dot = document.createElement('span');
      dot.className = 'you-dot';
      const m = marker({ lat: la, lng: ln }, dot, 'You are here');
      return { remove: () => { m.map = null; markers.delete(m); } };
    },
    fitTo(points, maxZoom) {
      if (!points.length) return;
      const bounds = new gm.LatLngBounds();
      for (const p of points) bounds.extend({ lat: p.lat, lng: p.lng });
      // fitBounds has no maxZoom, so clamp once the new viewport settles.
      gm.event.addListenerOnce(map, 'idle', () => { if (map.getZoom() > maxZoom) map.setZoom(maxZoom); });
      map.fitBounds(bounds, 40);
    },
    setView: (la, ln, z) => { map.setCenter({ lat: la, lng: ln }); map.setZoom(z); },
    getZoom: () => map.getZoom(),
    onClick: (cb) => map.addListener('click', (e) => { if (e.latLng) cb(e.latLng.lat(), e.latLng.lng()); }),
    destroy() {
      info.close();
      for (const m of markers) m.map = null;
      markers.clear();
      gm.event.clearInstanceListeners(map);
      el.replaceChildren();
    },
  };
}

// ---------- address search (location picker) ----------

// Returns up to five { label, lat, lng } matches inside Malaysia.
export async function searchPlaces(term, bounds) {
  if (usingGoogle()) {
    try {
      await loadGoogle();
      const { Place } = await window.google.maps.importLibrary('places');
      const { places } = await Place.searchByText({
        textQuery: term,
        fields: ['displayName', 'formattedAddress', 'location'],
        locationRestriction: { south: bounds.minLat, west: bounds.minLng, north: bounds.maxLat, east: bounds.maxLng },
        maxResultCount: 5,
        region: 'my',
      });
      return places.map((p) => ({
        label: [p.displayName, p.formattedAddress].filter(Boolean).join(', '),
        lat: p.location.lat(),
        lng: p.location.lng(),
      }));
    } catch (err) {
      console.warn('Google place search failed; trying OpenStreetMap.', err);
    }
  }
  const res = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=my&limit=5&q=${encodeURIComponent(term)}`, { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error('search failed');
  return (await res.json()).map((r) => ({ label: r.display_name, lat: +r.lat, lng: +r.lon }));
}

// ---------- links (no API key needed) ----------

// Google Maps opens the app on most phones, which is what most people in Malaysia navigate with.
export const directionsUrl = (p) => `https://www.google.com/maps/dir/?api=1&destination=${p.lat}%2C${p.lng}`;
export const googleMapsUrl = (p) => `https://www.google.com/maps/search/?api=1&query=${p.lat}%2C${p.lng}`;
export const osmUrl = (p) => `https://www.openstreetmap.org/?mlat=${p.lat}&mlon=${p.lng}#map=18/${p.lat}/${p.lng}`;

export function locate() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Your browser does not support location.'));
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => reject(new Error('We could not get your location. Check your browser’s location permission.')),
      { timeout: 10000, maximumAge: 60000 },
    );
  });
}
