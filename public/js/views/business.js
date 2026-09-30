import { h } from '../dom.js';

export async function businessView(ctx, root) {
  root.append(h('div', { class: 'page' },
    h('h1', {}, 'For businesses & attractions'),
    h('p', { class: 'lede' }, 'Many OKU cardholders and their families look for places that welcome them before they travel. Get listed for free, show your offer on the map, and be found.'),
    h('div', { class: 'actions' }, h('a', { class: 'btn', href: '#/submit/place' }, 'List your business'), h('a', { class: 'btn btn--ghost', href: '#/' }, 'See the map')),
    h('h2', {}, 'How it works'),
    h('ol', { class: 'steps' },
      h('li', { class: 'card' }, h('h3', {}, 'Create an account'), h('p', {}, 'Sign up and choose “Add a place or offer”. Tick that you own or manage the business.')),
      h('li', { class: 'card' }, h('h3', {}, 'Describe your offer'), h('p', {}, 'Pin your location, say what OKU cardholders get (a discount, a freebie, priority service) and which accessibility features you have.')),
      h('li', { class: 'card' }, h('h3', {}, 'Get verified'), h('p', {}, 'A moderator reviews the listing. Owner-submitted listings can earn the ✓ Verified partner badge and appear first in results.'))),
    h('h2', {}, 'What makes a good listing'),
    h('ul', {},
      h('li', {}, 'A clear, simple offer staff can remember: “10% off the bill with an OKU card”.'),
      h('li', {}, 'Honest accessibility information. Visitors review whether the offer was honoured and how access actually was.'),
      h('li', {}, 'Staff who know about the offer. The reviews on this site show when a discount was honoured, so brief your team.')),
    h('p', { class: 'notice notice--info' }, 'Already listed by a customer? Log in and use “Suggest an edit” on your listing to add offers or correct details, then tell us you are the owner in the reason.')));
  return { title: 'For businesses' };
}
