import { h } from '../dom.js';
import { api } from '../api.js';
import { field, errorSummary } from '../ui.js';
import { t } from '../i18n.js';
import { googleSignIn, afterLogin } from '../google-signin.js';

function authForm(ctx, { title, intro, submitLabel, withName, path, footer }) {
  const f = {
    name: withName ? field({ label: t('Display name'), name: 'name', required: true, maxlength: 50, hint: t('Shown next to your reviews. Use a nickname if you prefer.'), attrs: { autocomplete: 'nickname' } }) : null,
    email: field({ label: t('Email'), name: 'email', type: 'email', required: true, attrs: { autocomplete: 'email' } }),
    password: field({ label: t('Password'), name: 'password', type: 'password', required: true, hint: withName ? t('At least 8 characters.') : null, attrs: { autocomplete: withName ? 'new-password' : 'current-password' } }),
  };
  const errs = h('div');
  const submit = h('button', { class: 'btn', type: 'submit' }, submitLabel);
  const form = h('form', { novalidate: true, onsubmit: async (e) => {
    e.preventDefault();
    errs.replaceChildren();
    for (const x of Object.values(f)) x?.setError('');
    submit.disabled = true;
    try {
      await api('POST', path, Object.fromEntries(Object.entries(f).filter(([, v]) => v).map(([k, v]) => [k, v.input.value])));
      await afterLogin(ctx, withName ? t('Welcome! Your account is ready.') : t('Welcome back.'));
    } catch (err) {
      for (const [k, m] of Object.entries(err.fields || {})) f[k]?.setError(t(m));
      const s = errorSummary(err.message, err.fields);
      errs.append(s);
      s.focus();
      submit.disabled = false;
    }
  } }, errs, Object.values(f).filter(Boolean).map((x) => x.el), h('div', { class: 'actions' }, submit));
  return h('div', { class: 'page page--narrow' }, h('h1', {}, title), h('p', { class: 'lede' }, intro), googleSignIn(ctx), form, footer);
}

export async function loginView(ctx, root) {
  root.append(authForm(ctx, {
    title: t('Log in'), intro: t('Log in to add places, suggest edits and write reviews.'), submitLabel: t('Log in'), withName: false, path: '/auth/login',
    footer: h('p', {}, `${t('New here?')} `, h('a', { href: '#/register' }, t('Create an account')), '.'),
  }));
  return { title: t('Log in') };
}

export async function registerView(ctx, root) {
  root.append(authForm(ctx, {
    title: t('Create an account'), intro: t('Free. Lets you contribute listings, suggest edits and review places.'), submitLabel: t('Create account'), withName: true, path: '/auth/register',
    footer: h('p', {}, `${t('Already have an account?')} `, h('a', { href: '#/login' }, t('Log in')), '.'),
  }));
  return { title: t('Create account') };
}
