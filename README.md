# Open Way

Open Way is a community-driven directory of accessibility information for public places
(transit, museums, libraries, parks, restaurants, healthcare, and more), starting with
Philadelphia. Users can browse and search accessible places, leave reviews and tips, sign
petitions, RSVP to events, and (as admins) moderate submitted content.

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
| `npm run db:push` | Push the Drizzle schema to a configured Postgres database |

## Project layout

```
client/src/       React app: pages/, components/, hooks/, lib/
server/           Express app: routes.ts (HTTP endpoints), storage.ts (data access),
                  auth.ts, db.ts, email.ts, geocode.ts, static.ts, index.ts (entrypoint)
shared/           schema.ts (Drizzle schema + zod insert schemas), routes.ts (typed API contract)
scripts/          One-off admin/dev scripts (e.g. create-admin.ts)
script/           Production build script (build.ts)
```

## Testing & CI

Unit tests live alongside the code they cover (`*.test.ts`) and run via Vitest. GitHub Actions
(`.github/workflows/ci.yml`) runs lint, type-check, tests, and a production build on every push
and pull request.

## Security notes

- Sessions require `SESSION_SECRET` (32+ chars) in production; the app fails to start without it.
- 2FA secrets/backup codes are encrypted at rest; set `TWO_FACTOR_ENCRYPTION_KEY` separately from
  `SESSION_SECRET` so rotating one doesn't invalidate the other.
- Login attempts are rate-limited per IP and locked out per-account after repeated failures.
- See [.env.example](./.env.example) for the full list of configuration options.
