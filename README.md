# OKU Benefits Hub

A community-driven directory and map for Malaysian OKU cardholders to discover **government benefits**,
**merchant discounts** and **accessible spaces**. The goal is to promote OKU benefits in local businesses:
businesses list themselves (or are listed by the community), OKU users find them on a map and review them.

## Features

- **Map + photo cards** (OpenStreetMap via Leaflet). Filter by kind of offer (free, discount, priority, freebie,
  volunteer), type of place, accessibility features and free text; "use my location" sorts by distance. The list is a full alternative to the map for keyboard and
  screen-reader users.
- **Community submissions**: anyone with an account can add a place (with offers, accessibility features and a
  pinned location, with address search via Nominatim) or a government benefit.
- **Edit requests**: on any listing, "Suggest an edit" sends a proposed change with a reason. Moderators see a
  field-by-field diff and approve or reject it; nothing changes until approval.
- **Moderation queue** (`/#/admin`): new places, new benefits and edit requests. Owners who tick "I own this
  business" can be approved as a **✓ Verified partner** (badge, first in results, green pin).
- **Reviews** with overall and accessibility ratings, plus *"Was the OKU offer honoured?"* — surfaced on the
  listing as a trust signal for businesses that say they participate.
- **Government benefits directory** with agency links and a "verified by a moderator on <date>" indicator.
- **Business landing page** explaining how to get listed.

- **Photos**: submitters can attach a photo (resized in the browser, checked server-side, stored in
  `data/uploads`, shown after moderation). Listings without a photo get a colourful illustrated cover.
- **Volunteer places & social enterprises**: a "Social enterprise & volunteering" category and a "Volunteer with us"
  offer type, for places like Autism Café Project, Bake with Dignity and Tender Hearts.

## Run it

Requires Node.js **22.13+** (uses the built-in `node:sqlite`; no native modules).

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # API tests
```

On first start a moderator account is created: `ADMIN_EMAIL` / `ADMIN_PASSWORD` if set, otherwise
`admin@example.com` with a random password printed to the console (development only; in production the
variables are required). See `.env.example`.

| Command | What it does |
| --- | --- |
| `npm start` | Start the server (also seeds benefits and the attractions above on an empty database) |
| `npm run dev` | Watch mode |

`UPLOAD_DIR` (default: `uploads` next to the database), and environment variables (set them in your shell; on Windows PowerShell use `$env:PORT=3000`, in `cmd` use `set PORT=3000`): `PORT`, `DB_PATH` (default `data/oku.db`), `NODE_ENV=production` (secure cookies),
`TRUST_PROXY` (set to `1` behind a reverse proxy), `ADMIN_EMAIL`, `ADMIN_PASSWORD`.

## Important: data accuracy

- The **seeded places** (Zoo Negara, KL Bird Park, Petrosains, Planetarium Negara, Muzium Negara, Aquaria KLCC, Sunway Lagoon, Sunway Putra Mall, Autism Café Project, Bake with Dignity, Tender Hearts) were compiled from web search results on 30 Sep 2026; the official sites could not be opened from the build environment. Their descriptions say so, all pin positions are approximate, and the KL Bird Park, Planetarium Negara and Aquaria KLCC concessions rest on secondary sources. The Autism Café Project has moved several times, so check its address. Confirm each with the venue and correct it through the normal edit-request flow.
- The seeded **government benefit entries are general starting points**, deliberately without rates or
  thresholds, and show "Not yet verified by a moderator" until someone checks them against the agency source
  and approves an edit. Verify each before launch.

## Free preview to share (no server)

`npm run build:static` writes a browser-only copy of the site to `docs/` (sample data baked in; anything visitors add
or review stays in their own browser). It is committed, so you can host `docs/` for free:
GitHub Pages (Settings > Pages > Deploy from a branch > pick the branch and `/docs`; the repo must be public on a free
plan), or drag the `docs` folder onto Netlify Drop / Cloudflare Pages. Re-run the build after changing the app.

## Deploying from GitHub

The app needs Node 22.13+, one running copy, and a **persistent disk** (the database and uploaded photos are files).
`render.yaml` describes this for [Render](https://render.com): New > Blueprint > choose this repo, then enter
`ADMIN_EMAIL` and `ADMIN_PASSWORD` when asked. It deploys the repo's default branch and redeploys on every push.
Railway and Fly.io work too: use `npm start`, attach a volume, and set the environment variables listed below.
Back up the database file and the uploads folder regularly.

## Adding real photos to the seeded places

No photos are bundled: the build environment could not download any, and Google Maps photos cannot be copied.
Drop photos you took or are licensed to use into `public/img/places/` named after the place slug
(`zoo-negara.jpg`, `petrosains.png`, `bake-with-dignity.webp`, ... the slugs are in `server/seed.js`) and restart;
they are attached automatically. Photos submitted through the site work without any of this.

## Architecture

```
server/   Express 5 API + SQLite (node:sqlite)
  meta.js       enumerations shared with the client (/api/meta)
  validate.js   input validation (per-field errors)
  store.js      queries, edit-request diffing/applying
  routes/       auth, places (+reviews, edits), benefits, account, admin
public/   No-build frontend: ES modules, hash routing, Leaflet + fonts served from node_modules,
          illustrated covers in img/cover, logo in img/logo-mark.svg
test/     API tests (node:test)
```

Security notes: scrypt password hashing; opaque, hashed, HttpOnly SameSite=Lax session cookies; JSON-only
writes with Origin checking; strict CSP (no inline script/style); all user text rendered as text nodes;
in-memory rate limiting (single-instance; use a shared store if you scale out).

## Ideas for later

Bahasa Malaysia translation, photo uploads, business self-service dashboard, map clustering for large
datasets, email verification/password reset, importing OpenStreetMap `wheelchair=*` data.
