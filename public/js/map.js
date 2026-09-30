// Thin wrappers around Leaflet (global `L`) with OpenStreetMap tiles.
export const MALAYSIA_CENTER = [4.2105, 108.0];
export const MALAYSIA_ZOOM = 6;

export function createMap(el, { center = MALAYSIA_CENTER, zoom = MALAYSIA_ZOOM } = {}) {
  // Zoom animation is off: Leaflet's delayed zoom-end callback throws if the map is removed during the
// animation (we tear maps down on every route change), and it is kinder to reduced-motion users.
  const map = L.map(el, { center, zoom, worldCopyJump: true, zoomAnimation: false, markerZoomAnimation: false });
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);
  return map;
}

export function pinIcon(tone = '') {
  return L.divIcon({
    className: 'pin-wrap',
    html: `<span class="pin ${tone}"></span>`,
    iconSize: [32, 38],
    iconAnchor: [16, 36],
    popupAnchor: [0, -32],
  });
}

export const directionsUrl = (p) => `https://www.openstreetmap.org/directions?to=${p.lat}%2C${p.lng}`;
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

// Leaflet throws if a map is removed mid-animation (e.g. navigating away right after fitBounds).
export function destroyMap(map) {
  if (!map) return;
  map.stop();
  map.off();
  map.remove();
}
