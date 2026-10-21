import { h } from '../dom.js';
import { t } from '../i18n.js';
import { icon } from '../ui.js';
import { CONTACT } from '../contact-info.js';

const LINKS = [
  ['email', 'mail', 'Email', (v) => `mailto:${v}`, (v) => v],
  ['whatsapp', 'chat', 'WhatsApp', (v) => `https://wa.me/${v}`, (v) => `+${v}`],
  ['instagram', 'external', 'Instagram', (v) => `https://instagram.com/${v}`, (v) => `@${v}`],
  ['facebook', 'external', 'Facebook', (v) => `https://facebook.com/${v}`, (v) => v],
  ['tiktok', 'external', 'TikTok', (v) => `https://www.tiktok.com/@${v}`, (v) => `@${v}`],
];

export async function contactView(_ctx, root) {
  const rows = LINKS.filter(([k]) => CONTACT[k]).map(([k, ic, label, href, show]) => h('li', {},
    h('a', { class: 'contact-link', href: href(CONTACT[k]), ...(k === 'email' ? {} : { target: '_blank', rel: 'noopener noreferrer' }) },
      icon(ic, 22), h('span', {}, h('strong', {}, t(label)), h('span', { class: 'muted' }, show(CONTACT[k]))))));
  root.append(h('div', { class: 'page page--narrow' },
    h('h1', {}, t('Contact us')),
    h('p', { class: 'lede' }, t('Questions, ideas, or something wrong on the site? We would love to hear from you.')),
    h('ul', { class: 'contact-list' }, rows),
    h('h2', {}, t('Quick help')),
    h('ul', { class: 'tick-list' },
      h('li', {}, t('Wrong details on a place? Open the place and tap “Suggest an edit”.')),
      h('li', {}, t('Own a business?'), ' ', h('a', { href: '#/how-it-works' }, t('See how to list your place'))),
      h('li', {}, t('Looking for government aid?'), ' ', h('a', { href: '#/benefits' }, t('See Official help')))),
    h('p', { class: 'notice notice--info' }, t('We are a small community team, not a government agency. For your OKU card or JKM aid, contact JKM directly.'))));
  return { title: t('Contact us') };
}
