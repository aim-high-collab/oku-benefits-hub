# OKU Benefits Hub

A community-driven directory and map for Malaysian OKU cardholders to discover **government benefits**,
**merchant discounts** and **accessible spaces**. The goal is to promote OKU benefits in local businesses:
businesses list themselves (or are listed by the community), OKU users find them on a map and review them.

## Features

- **Map + list of places** (OpenStreetMap via Leaflet). Filter by type, kind of offer, accessibility features and
  free text; "use my location" sorts by distance. The list is a full alternative to the map for keyboard and
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

Environment variables (set them in your shell; on Windows PowerShell use `$env:PORT=3000`, in `cmd` use `set PORT=3000`): `PORT`, `DB_PATH` (default `data/oku.db`), `NODE_ENV=production` (secure cookies),
`TRUST_PROXY` (set to `1` behind a reverse proxy), `ADMIN_EMAIL`, `ADMIN_PASSWORD`.

## Important: data accuracy

- The **seeded attractions** (Zoo Negara, KL Bird Park, Petrosains, Planetarium Negara, Muzium Negara) were compiled from web search results on 30 Sep 2026; the official sites could not be opened from the build environment. Their descriptions say so, some pin positions are approximate, and the KL Bird Park and Planetarium Negara concessions rest on secondary sources. Confirm each with the venue and correct it through the normal edit-request flow.
- The seeded **government benefit entries are general starting points**, deliberately without rates or
  thresholds, and show "Not yet verified by a moderator" until someone checks them against the agency source
  and approves an edit. Verify each before launch.

## Architecture

```
server/   Express 5 API + SQLite (node:sqlite)
  meta.js       enumerations shared with the client (/api/meta)
  validate.js   input validation (per-field errors)
  store.js      queries, edit-request diffing/applying
  routes/       auth, places (+reviews, edits), benefits, account, admin
public/   No-build frontend: ES modules, hash routing, Leaflet served from node_modules
test/     API tests (node:test)
```

Security notes: scrypt password hashing; opaque, hashed, HttpOnly SameSite=Lax session cookies; JSON-only
writes with Origin checking; strict CSP (no inline script/style); all user text rendered as text nodes;
in-memory rate limiting (single-instance; use a shared store if you scale out).

## Ideas for later

Bahasa Malaysia translation, photo uploads, business self-service dashboard, map clustering for large
datasets, email verification/password reset, importing OpenStreetMap `wheelchair=*` data.
