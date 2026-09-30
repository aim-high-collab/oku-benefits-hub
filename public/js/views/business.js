import { h } from '../dom.js';

export async function businessView(ctx, root) {
  root.append(h('div', { class: 'page' },
    h('h1', {}, 'For businesses and attractions'),
    h('p', { class: 'lede' }, 'If you give OKU cardholders free entry, a discount or a bit of extra help, put it here. Listing is free, and people planning a trip will be able to find you on the map.'),
    h('div', { class: 'actions' }, h('a', { class: 'btn', href: '#/submit/place' }, 'List your business'), h('a', { class: 'btn btn--ghost', href: '#/' }, 'See the map')),
    h('div', { class: 'section' }, h('h2', {}, 'How it works'),
      h('ol', { class: 'steps' },
        h('li', {}, h('h3', {}, 'Make an account'), h('p', {}, 'Choose “Add a place”, and tick the box saying you own or manage the business.')),
        h('li', {}, h('h3', {}, 'Describe the offer'), h('p', {}, 'Drop a pin on your location, say what OKU cardholders get, and tick the accessibility features you actually have.')),
        h('li', {}, h('h3', {}, 'We check it'), h('p', {}, 'A person reviews the listing. Owner-submitted listings can be marked as verified partners, which shows up first in results.'))),
      h('h2', {}, 'What makes a good listing'),
      h('ul', {},
        h('li', {}, 'A simple offer your staff can remember: “10% off the bill with an OKU card”.'),
        h('li', {}, 'Honest accessibility details. Visitors say whether the offer was honoured and how getting around really was, so it pays to brief your team.'),
        h('li', {}, 'Up-to-date information. Already listed by a customer? Log in and use “Suggest an edit” on your page, and mention that you are the owner.')))));
  return { title: 'For businesses' };
}
