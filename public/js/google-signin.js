// "Continue with Google" via Google Identity Services. Shown only when the server has a Google client ID.
import { h } from './dom.js';
import { api } from './api.js';
import { t, getLang } from './i18n.js';

let loading;
const loadGsi = () => (loading ??= new Promise((ok, fail) => {
  const s = h('script', { src: 'https://accounts.google.com/gsi/client', async: true });
  s.onload = ok;
  s.onerror = () => { loading = null; fail(); };
  document.head.append(s);
}));

/** After any login: refresh the header, then go where the person was heading (or home). */
export async function afterLogin(ctx, message) {
  await ctx.refreshUser();
  ctx.toast(message);
  const next = sessionStorage.getItem('afterLogin') || '#/';
  sessionStorage.removeItem('afterLogin');
  if (location.hash === next) window.dispatchEvent(new HashChangeEvent('hashchange'));
  else ctx.go(next);
}

/** The Google button with an "or use email" divider under it, or null when Google sign-in is not set up. */
export function googleSignIn(ctx) {
  const clientId = ctx.state.meta?.googleClientId;
  if (!clientId) return null;
  const box = h('div', { class: 'google-btn' });
  const err = h('p', { class: 'field-error', role: 'alert', hidden: true });
  const showError = (msg) => { err.textContent = msg; err.hidden = false; };
  loadGsi().then(() => {
    google.accounts.id.initialize({ client_id: clientId, callback: async ({ credential }) => {
      err.hidden = true;
      try {
        const res = await api('POST', '/auth/google', { credential });
        await afterLogin(ctx, res.user ? t('Welcome, {name}.', { name: res.user.name }) : t('Welcome back.'));
      } catch (e) { showError(e.message); }
    } });
    google.accounts.id.renderButton(box, { theme: 'outline', size: 'large', shape: 'pill', text: 'continue_with', width: 300,
      locale: { ms: 'ms', zh: 'zh_CN' }[getLang()] ?? 'en' });
  }).catch(() => showError(t('Google sign-in could not load. You can still use email.')));
  return h('div', { class: 'google-signin' }, box, err, h('p', { class: 'or-line' }, h('span', {}, t('or use email'))));
}
