import { h } from '../dom.js';
import { api } from '../api.js';
import { field, errorSummary } from '../ui.js';

function authForm(ctx, { title, intro, submitLabel, withName, path, footer }) {
  const f = {
    name: withName ? field({ label: 'Display name', name: 'name', required: true, maxlength: 50, hint: 'Shown next to your reviews. Use a nickname if you prefer.', attrs: { autocomplete: 'nickname' } }) : null,
    email: field({ label: 'Email', name: 'email', type: 'email', required: true, attrs: { autocomplete: 'email' } }),
    password: field({ label: 'Password', name: 'password', type: 'password', required: true, hint: withName ? 'At least 8 characters.' : null, attrs: { autocomplete: withName ? 'new-password' : 'current-password' } }),
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
      await ctx.refreshUser();
      ctx.toast(withName ? 'Welcome! Your account is ready.' : 'Welcome back.');
      const next = sessionStorage.getItem('afterLogin');
      sessionStorage.removeItem('afterLogin');
      ctx.go(next || '#/');
    } catch (err) {
      for (const [k, m] of Object.entries(err.fields || {})) f[k]?.setError(m);
      const s = errorSummary(err.message, err.fields);
      errs.append(s);
      s.focus();
      submit.disabled = false;
    }
  } }, errs, Object.values(f).filter(Boolean).map((x) => x.el), h('div', { class: 'actions' }, submit));
  return h('div', { class: 'page page--narrow' }, h('h1', {}, title), h('p', { class: 'lede' }, intro), form, footer);
}

export async function loginView(ctx, root) {
  root.append(authForm(ctx, {
    title: 'Log in', intro: 'Log in to add places, suggest edits and write reviews.', submitLabel: 'Log in', withName: false, path: '/auth/login',
    footer: h('p', {}, 'New here? ', h('a', { href: '#/register' }, 'Create an account'), '.'),
  }));
  return { title: 'Log in' };
}

export async function registerView(ctx, root) {
  root.append(authForm(ctx, {
    title: 'Create an account', intro: 'Free. Lets you contribute listings, suggest edits and review places.', submitLabel: 'Create account', withName: true, path: '/auth/register',
    footer: h('p', {}, 'Already have an account? ', h('a', { href: '#/login' }, 'Log in'), '.'),
  }));
  return { title: 'Create account' };
}
