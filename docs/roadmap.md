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
| P1 | App accessibility: skip link, focus on route change, page titles, disclosure navigation, named icon buttons, carousel pause, reduced motion, 24px targets, contrast fixes in light/dark/high contrast | axe (WCAG 2.2 A/AA tags) and scripted keyboard checks |

## Needs a person (can't be done in code)

1. **Postgres deployments: run `npm run db:push`** for the new `review_votes` and
   `accessibility_observations` tables and the new columns (`users.session_version`,
   `accessibility_features.status/source_type/source_url`, nullable `reports.reporter_id`). Existing
   sessions are signed out once.
2. **Clean deployed data:** run `npx tsx scripts/decode-legacy-entities.ts` (dry run, then `--apply`),
   `npx tsx scripts/remove-unknown-places.ts` (dry run, then `--apply`), and
   `npm run seed:places -- --update` to label venue-sourced facts. Back up first.
3. **Talk to disabled Philadelphians** before building more (see research gaps).

## Next three (highest value)

1. **P1 — Google sign-in (planned).** Replace password accounts with Google OAuth.
   - Acceptance: sign-in and sign-out work with Google; sessions are regenerated at sign-in; bans and
     `session_version` still apply; password, reset and 2FA pages are removed or redirect; existing
     accounts are matched by verified email; route tests cover sign-in, a banned user and a revoked session.
   - Depends on: Google Cloud OAuth client ID/secret; `google-auth-library` is already a dependency.
2. **P1 — Usability testing with disabled users.** Five or more sessions covering the scenarios in the
   brief (step-free restaurant, blind museum visitor, sensory library visit, SEPTA elevator, reporting a
   barrier, conflicting reports).
   - Acceptance: each scenario attempted with real participants, findings written up, top three issues
     fixed or scheduled.
   - Depends on: recruitment (e.g. through the City's Office for People with Disabilities or local groups).
3. **P1 — Grow sourced listings.** Add places only with sourced facts (venue pages, official data), with
   check dates.
   - Acceptance: at least 30 places across transit, libraries, parks and restaurants, each with at least
     one dated, sourced key fact; the seed test keeps passing.
   - Depends on: curation time; link checking (some venue sites block automated requests).

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
