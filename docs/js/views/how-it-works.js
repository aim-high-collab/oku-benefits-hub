import { h } from '../dom.js';
import { t } from '../i18n.js';
import { icon } from '../ui.js';
import { TRUST_KEY } from './explore.js';

// One page for everyone who contributes: community members and businesses both start from "Add a place".
// Only describes what the app really does today; business verification and listing claims are marked as not yet available.
export async function howItWorksView(ctx, root) {
  const addBtn = (cls = 'btn btn--sun') => h('a', { class: cls, href: '#/submit/place' }, t('Add a place'));
  root.append(h('div', { class: 'page page--mid' },
    h('div', { class: 'biz-hero' },
      h('h1', {}, t('Help more people discover OKU benefits.')),
      h('p', { class: 'lede' }, t('Know a place that offers an OKU discount, free entry, accessible facilities, or a welcoming experience? Share it with the community. Businesses can also confirm their offers and manage their listings.')),
      h('div', { class: 'actions' }, addBtn(), h('a', { class: 'btn btn--ghost', href: '#/' }, t('Explore places')))),

    h('section', { 'aria-labelledby': 'how-steps' },
      h('h2', { id: 'how-steps' }, t('How community submissions work')),
      h('ol', { class: 'steps' },
        h('li', {}, h('h3', {}, t('Add a place')), h('p', {}, t('Give the place name, category and location, and the offer or accessibility details you know about. You need a free account to add a place; browsing needs none.'))),
        h('li', {}, h('h3', {}, t('Share what you know')), h('p', {}, t('Describe the offer, and add a source link, a photo or your own experience if you have them. Only the name, location and at least one offer or accessibility feature are required.'))),
        h('li', {}, h('h3', {}, t('Review and update')), h('p', {}, t('A moderator reviews every new place before it appears. After that, anyone can say whether they got the OKU offer, and members can suggest an edit when something changes.'))))),

    h('section', { 'aria-labelledby': 'how-labels' },
      h('h2', { id: 'how-labels' }, t('What the labels mean')),
      h('p', {}, t('A listing shows where its information comes from. It does not mean every place gives a discount or that every accessibility detail has been checked.')),
      h('ul', { class: 'how-labels' }, TRUST_KEY.map(([tier, ic, label, text]) => h('li', {},
        h('span', { class: `stamp stamp--${tier}` }, icon(ic, 18), h('strong', {}, t(label))), h('p', {}, t(text)))))),

    h('section', { 'aria-labelledby': 'how-community' },
      h('h2', { id: 'how-community' }, t('Share useful information with the community.')),
      h('p', {}, t('You don’t need to represent a business to add it. Tell us what you know and how you know it, and your listing shows as “Shared by the community”.')),
      h('div', { class: 'actions' }, addBtn('btn'))),

    h('section', { 'aria-labelledby': 'how-business' },
      h('h2', { id: 'how-business' }, t('Are you a business owner or authorised representative?')),
      h('p', { class: 'lede' }, t('Confirm your offers, keep your listing up to date, and help OKU cardholders understand what your business provides.')),
      h('ul', { class: 'tick-list' },
        h('li', {}, h('strong', {}, t('Submitting a new place: ')), t('choose “Add a place”, then “Business owner / Authorised representative”, and leave a name and contact for us.')),
        h('li', {}, h('strong', {}, t('Confirming a specific offer: ')), t('a moderator confirms the offer with you, and only then does the listing show “Confirmed by business”. Saying you represent the business does not do this by itself.')),
        h('li', {}, h('strong', {}, t('Claiming or managing an existing listing: ')), t('not available yet. For now, log in and use “Suggest an edit” on your listing, and mention that you represent the business.'))),
      h('p', { class: 'note-box' }, icon('question', 18), ' ', t('Checking that someone represents a business is not available yet. We do not ask for SSM or other documents.')),
      h('h3', {}, t('What makes a good listing')),
      h('ul', { class: 'tick-list' },
        h('li', {}, t('A simple offer your staff can remember: “10% off the bill with an OKU card”.')),
        h('li', {}, t('A real photo of your entrance. It helps people decide if the place will work for them.')),
        h('li', {}, t('Honest accessibility details. Visitors say whether the offer was honoured and how access really was, so it pays to brief your team.')),
        h('li', {}, t('Volunteer slots or jobs for people with disabilities? Add them as an offer so people can find and support you.'))),
      h('div', { class: 'actions' }, addBtn('btn')))));
  return { title: t('How it works') };
}
