import { h } from '../dom.js';
import { t } from '../i18n.js';

export async function businessView(ctx, root) {
  root.append(h('div', { class: 'page page--mid' },
    h('div', { class: 'biz-hero' },
      h('h1', {}, t('Got a discount, a ramp or an open door?')),
      h('p', { class: 'lede' }, t('If you give OKU cardholders free entry, a discount, or a little extra help, put it on the map. Listing is free, and people planning a trip will find you.')),
      h('div', { class: 'actions' }, h('a', { class: 'btn btn--sun', href: '#/submit/place' }, t('List your place')), h('a', { class: 'btn btn--ghost', href: '#/' }, t('See the map')))),
    h('h2', {}, t('How it works')),
    h('ol', { class: 'steps' },
      h('li', {}, h('h3', {}, t('Make an account')), h('p', {}, t('Choose “Add a place” and tick the box saying you own or manage it.'))),
      h('li', {}, h('h3', {}, t('Say what you offer')), h('p', {}, t('Drop a pin, add a photo, describe the offer and tick the accessibility features you really have.'))),
      h('li', {}, h('h3', {}, t('We check it')), h('p', {}, t('A person reviews it. Owner listings can become verified partners and show up first.')))),
    h('h2', {}, t('What makes a good listing')),
    h('ul', { class: 'tick-list' },
      h('li', {}, t('A simple offer your staff can remember: “10% off the bill with an OKU card”.')),
      h('li', {}, t('A real photo of your entrance. It helps people decide if the place will work for them.')),
      h('li', {}, t('Honest accessibility details. Visitors say whether the offer was honoured and how access really was, so it pays to brief your team.')),
      h('li', {}, t('Volunteer slots or jobs for people with disabilities? Add them as an offer so people can find and support you.'))),
    h('p', { class: 'notice notice--info' }, t('Already listed by a customer? Log in and use “Suggest an edit” on your page, and mention that you are the owner.'))));
  return { title: t('For businesses') };
}
