# Open Way

Open Way is a community-driven directory of accessibility information for public places
(transit, museums, libraries, parks, restaurants, healthcare, and more), starting with
Philadelphia. Each place shows its accessibility feature by feature (step-free entrance,
restroom, and so on), with where the information came from, when it was last confirmed, and
whether reports agree. Anyone can share what they found or report a problem; signed-out
reports go to a moderation queue. There is also a live SEPTA elevator outage page.

How the information is labelled, and the research behind it, is in
[docs/research.md](./docs/research.md). What's next is in [docs/roadmap.md](./docs/roadmap.md).

## Stack

- **Client:** React 18 + TypeScript + Vite + Tailwind CSS + TanStack Query + wouter (routing)
- **Server:** Express + TypeScript, session-based auth (bcrypt + optional TOTP 2FA)
- **Database:** Drizzle ORM against PostgreSQL, with an automatic SQLite fallback for local dev
  (see [DATABASE_SETUP.md](./DATABASE_SETUP.md))
- **Shared:** `shared/schema.ts` and `shared/routes.ts` define the DB schema and typed API
  contract used by both client and server

## Getting started

```powershell
npm install
npm run dev
```

This starts the Express server (default port `5000`), which also serves the Vite dev client —
open http://localhost:5000. With no `DATABASE_URL` set, the app automatically uses a local SQLite
database (`sqlite.db`) so there's nothing else to configure to try it out.

For a real Postgres database, email sending, and other optional integrations, copy
[`.env.example`](./.env.example) to `.env.local` and fill in the values you need — see
[DATABASE_SETUP.md](./DATABASE_SETUP.md) for step-by-step Postgres setup options.

### Creating an admin account

```powershell
$env:ADMIN_EMAIL = "you@example.com"; $env:ADMIN_PASSWORD = "choose-a-password"; npx tsx scripts/create-admin.ts
```

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the dev server (Express + Vite middleware) |
| `npm run build` | Production build (client bundle + server bundle into `dist/`) |
| `npm run start` | Run the production build (`dist/index.cjs`) |
| `npm run check` | TypeScript type-check (`tsc --noEmit`) |
| `npm run lint` | Lint the codebase with ESLint |
| `npm run format` | Format the codebase with Prettier |
| `npm run test` | Run unit tests with Vitest |
| `npm run seed:places` | Add the sourced Philadelphia places (`-- --update` also overwrites existing ones) |
| `npm run db:push` | Push the Drizzle schema to a configured Postgres database |

### Maintenance scripts

All are dry runs unless `--apply` is passed. Back up the database first.

| Command | Description |
| --- | --- |
| `npx tsx scripts/decode-legacy-entities.ts` | Restore text saved HTML-encoded by the old sanitizer (`&#x27;` → `'`) |
| `npx tsx scripts/remove-unknown-places.ts` | Delete places with no accessibility information (status `Unknown`) |

Set `SQLITE_PATH` to point any script (and the app) at a different SQLite file.

## Project layout

```
client/src/       React app: pages/, components/ (accessibility/, admin/), hooks/, lib/
server/           Express app: app.ts (middleware), routes.ts (HTTP endpoints), storage.ts (data access),
                  accessibility-summary.ts, uploads.ts + images.ts (photo handling), septa.ts,
                  seed.ts + seed-data/, auth.ts, db.ts, index.ts (entrypoint)
shared/           schema.ts (Drizzle schema), routes.ts (typed API contract),
                  accessibility.ts (feature catalog and evidence rules)
scripts/          Admin/maintenance scripts (create-admin, seed-places, decode-legacy-entities,
                  remove-unknown-places)
docs/             research.md, roadmap.md
script/           Production build script (build.ts)
```

## Testing & CI

Unit and route tests live alongside the code they cover (`*.test.ts`) and run via Vitest against
an in-memory SQLite database, so they never touch your `sqlite.db`. Route tests start the real app
on a random port (`server/test-helpers.ts`). GitHub Actions (`.github/workflows/ci.yml`) runs lint,
type-check, tests and a production build on pushes and pull requests to `main` and `dev`.

## Security notes

- Sessions require `SESSION_SECRET` (32+ chars) in production; the app fails to start without it.
- 2FA secrets/backup codes are encrypted at rest; set `TWO_FACTOR_ENCRYPTION_KEY` separately from
  `SESSION_SECRET` so rotating one doesn't invalidate the other.
- Login attempts are rate-limited per IP and locked out per-account after repeated failures.
- Set `APP_BASE_URL` in production so email links always point at your site.
- Uploaded photos are re-encoded to remove location and device metadata.
- The dev server listens on 127.0.0.1 unless `HOST` is set.
- See [.env.example](./.env.example) for the full list of configuration options.
