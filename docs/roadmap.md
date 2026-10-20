# Open Way roadmap

Updated 2026-10-17. Priorities: **P0** broken, unsafe or misleading; **P1** finding, understanding,
contributing and trusting information; **P2** richer information and integrations; **P3** longer term.
Evidence for the product decisions is in [research.md](./research.md).

## Done on branch `improve/trust-and-safety`

Each item has automated tests unless noted.

| Priority | Item | Proof |
|---|---|---|
| P0 | Text stored as typed (no `&#x27;` on pages) | `server/sanitize.test.ts` |
| P0 | Photo uploads stripped of GPS/device metadata | `server/images.test.ts` |
| P0 | Fabricated seed content removed; unsourced claims removed from pages | `server/seed.test.ts` |
| P0 | Maps blank: CARTO tiles now need a key; switched to OpenStreetMap tiles | browser check |
| P1 | Per-feature evidence: venue / reported / confirmed / disagreeing / unknown, with dates and freshness | `shared/accessibility.test.ts`, `server/evidence.test.ts` |
| P1 | "Share what you found", "Still accurate?", and "Report a problem with this listing" (signed-out reports go to moderation) | `evidence.test.ts`, browser checks |
| P1 | Admin queue for signed-out reports; place edits record source, verification and check date | `evidence.test.ts`, browser checks |
| P1 | Places page: need filters on reported facts, URL-kept filters, address/ZIP search, one request instead of ~2 per place | `evidence.test.ts`, browser checks |
| P1 | Places with no accessibility information removed; "Unknown" is no longer a place status | `seed.test.ts`, `security.test.ts` |
| P1 | SEPTA elevator outage page with live data and an explicit "unavailable" state | `server/septa.test.ts`, browser check |
| P1 | Google sign-in replaces passwords (PKCE, state check, verified emails only, `ADMIN_EMAILS`, "sign out of other devices"); password, reset, email-verification and 2FA code removed | `server/google-auth.test.ts`, `security.test.ts` |
| P1 | App accessibility: skip link, focus on route change, page titles, disclosure navigation, named icon buttons, carousel pause, reduced motion, 24px targets, contrast fixes in light/dark/high contrast | axe (WCAG 2.2 A/AA tags) and scripted keyboard checks |

## First deployment checklist

The site isn't deployed yet. A fresh Postgres database starts clean, so the cleanup scripts
(`decode-legacy-entities`, `remove-unknown-places`) aren't needed for it.

1. **Database:** create a Postgres database and set `DATABASE_URL`. Run `npm run db:push` to create the
   tables.
2. **Environment** (set in the host's settings, never committed):
   - `NODE_ENV=production`
   - `SESSION_SECRET`: a random string of 32+ characters
   - `APP_BASE_URL`: the site's public address, e.g. `https://openway.example.org`
   - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `ADMIN_EMAILS` (your Google email)
3. **Build and start:** `npm ci && npm run build`, then `npm run start`. The host must allow native
   modules (`sharp`, `better-sqlite3`).
4. **Uploads need persistent storage.** Photos are saved to `uploads/` on local disk; on hosts with
   temporary disks they vanish on every redeploy. Use a persistent volume (or move uploads to object
   storage).
5. **Content:** set `OPENWAY_SEED_ON_STARTUP=true` for the first start (adds the sourced places, FAQ and
   resources), then turn it off.
6. **Google sign-in:** add `https://<your-domain>/api/auth/google/callback` as an authorized redirect
   URI on the Google OAuth client, and publish the app in Google Auth Platform so anyone can sign in.
   Your account becomes admin on first sign-in through `ADMIN_EMAILS`.
7. **Talk to disabled Philadelphians** before building more (see research gaps).

## Next three (highest value)

1. **P1 — Usability testing with disabled users.** Five or more sessions covering the scenarios in the
   brief (step-free restaurant, blind museum visitor, sensory library visit, SEPTA elevator, reporting a
   barrier, conflicting reports).
   - Acceptance: each scenario attempted with real participants, findings written up, top three issues
     fixed or scheduled.
   - Depends on: recruitment (e.g. through the City's Office for People with Disabilities or local groups).
2. **P1 — Grow sourced listings.** Add places only with sourced facts (venue pages, official data), with
   check dates.
   - Acceptance: at least 30 places across transit, libraries, parks and restaurants, each with at least
     one dated, sourced key fact; the seed test keeps passing.
   - Depends on: curation time; link checking (some venue sites block automated requests).

3. **P1 — First deployment.** Put the site online following the checklist above.
   - Acceptance: the public URL serves the app over HTTPS; Google sign-in works there; an uploaded photo
     survives a redeploy; `npm run db:push` and the seed ran once.
   - Depends on: choosing a host with Postgres and a persistent disk; a domain (optional).

## P1 — other

- **Reviews and tips fold into evidence.** Let a review carry structured feature answers.
  - Acceptance: answers count in the summaries.
- **Suggest an edit** for place fields (hours, address, closed), going to the admin queue.
- **Moderation audit log** (who published, rejected, banned and when).
  - Acceptance: every admin action is recorded and visible to admins.
- **Notify contributors** when their pending report is published or rejected (needs email or OAuth).

## P2 — richer information and integrations

- **Link transit places to SEPTA live elevator status.** Add a station field, match on GTFS `stop_name`
  plus line, and show live outages on the place page.
  - Acceptance: a station page shows outages or "unavailable", never a false "all working".
- **SEPTA GTFS `wheelchair_boarding`** as a dated official source for stations.
  - Note: `0` means unknown, not inaccessible.
- **Polling places:** import the City Commissioners' accessibility codes as dated official facts,
  refreshed weekly before elections.
- **Measurements:** optional door width and step height on reports, with ADA reference values shown for
  context (never "ADA-compliant: yes").
- **Sensory profile per place** (sound, light, crowding, quiet space, quiet hours), following the
  Franklin Institute guide's scales.
- **Photo tags** (entrance, restroom, route) and automatic face blurring for uploads.
- **Duplicate-place detection** on submission (name plus address, or the City AIS parcel once a key is
  granted).
- **Map:** marker clustering, so nearby markers don't overlap. This is the one remaining axe failure:
  2.5.8 target size on the home mini-map.
- **Code-splitting:** the client bundle is 1.2 MB (346 KB gzipped). Lazy-load the admin dashboard,
  charts and maps.
  - Acceptance: initial JS under 500 KB minified.
- **Lint:** add `eslint-plugin-jsx-a11y`; include `scripts/` in `npm run check`.
- **Dependencies:** upgrade to Tailwind 4 and drizzle-orm 0.45.
- **Migrations:** replace `db:push` and the hand-written SQLite DDL with generated Drizzle migrations
  for both drivers.
- **Text spacing (WCAG 1.4.12):** the root font size is forced in px and line-height uses `!important`.

## P3 — longer term

- **Personal needs profile** stored on the device: rank and filter places by someone's own needs
  (maximum step height, hearing loop, quiet space).
- **Venue-claimed listings:** venues add official facts that stay labelled as venue claims.
- **OpenDataPhilly integrations:** DVRPC curb ramps near a place, labelled "estimated, 2018 imagery".
- **Search at scale:** `pg_trgm` and PostGIS once data volume needs them.
- **Code structure:** split `server/routes.ts` by area.
