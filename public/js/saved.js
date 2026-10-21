// "Save" bookmarks: kept on the person's account, so they follow them to any device.
import { h, clear } from './dom.js';
import { api } from './api.js';
import { t } from './i18n.js';
import { icon } from './ui.js';

/** Loads the ids of saved places into state.saved (empty when logged out). */
export async function loadSaved(state) {
  state.saved = new Set();
  if (!state.user) return;
  try {
    state.saved = new Set((await api('GET', '/me/saved')).places.map((p) => p.id));
  } catch { /* the list is a convenience; the page still works without it */ }
}

/** A Save / Saved toggle. Logged out, it sends the person to log in and brings them back. */
export function saveButton(ctx, place, { small = false } = {}) {
  const btn = h('button', { type: 'button', class: small ? 'save-btn save-btn--small' : 'btn btn--ghost save-btn' });
  const paint = () => {
    const on = ctx.state.saved?.has(place.id) ?? false;
    btn.setAttribute('aria-pressed', String(on));
    clear(btn).append(icon('bookmark', small ? 18 : 18), small ? h('span', { class: 'sr-only' }, on ? t('Saved: {name}', { name: place.name }) : t('Save {name}', { name: place.name })) : t(on ? 'Saved' : 'Save'));
    if (small) btn.title = on ? t('Saved') : t('Save');
  };
  btn.addEventListener('click', async () => {
    if (!ctx.state.user) {
      sessionStorage.setItem('afterLogin', location.hash || '#/');
      ctx.toast(t('Log in to save places.'));
      ctx.go('#/login');
      return;
    }
    const on = ctx.state.saved.has(place.id);
    btn.disabled = true;
    try {
      await api(on ? 'DELETE' : 'PUT', `/me/saved/${place.id}`);
      if (on) ctx.state.saved.delete(place.id); else ctx.state.saved.add(place.id);
      paint();
      ctx.toast(on ? t('Removed from Saved.') : t('Saved. Find it under Saved.'));
    } catch (e) { ctx.toast(e.message, 'error'); }
    btn.disabled = false;
  });
  paint();
  return btn;
}
