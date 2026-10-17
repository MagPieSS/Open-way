# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Open Way is a community accessibility directory for public places (Philadelphia-first): browse/search
places, reviews and tips, petitions, events, blog/FAQ/resources, plus an admin moderation surface.

## Commands

```powershell
npm run dev                  # Express + Vite middleware on http://localhost:5000 (PORT overrides)
npm run build                # script/build.ts: vite client -> dist/public, esbuild server -> dist/index.cjs
npm run start                # run the production bundle
npm run check                # tsc (noEmit); excludes **/*.test.ts
npm run lint                 # eslint
npm run test                 # vitest run (node env, **/*.test.ts)
npm run db:push              # drizzle-kit push — Postgres only, requires DATABASE_URL
npx vitest run server/auth.test.ts          # single test file
npx vitest run -t "locks the account"       # single test by name
# create/reset a local admin (writes directly to sqlite.db):
$env:ADMIN_EMAIL="you@example.com"; $env:ADMIN_PASSWORD="pw"; npx tsx scripts/create-admin.ts
```

No client-side test setup exists (vitest runs in `node` environment), so tests cover server modules and
pure shared/client logic (e.g. `shared/accessibility.ts`, `client/src/lib/*`) only.

## Architecture

One Express process serves both the API and the client: `server/app.ts` `createApp()` builds the middleware
stack, `registerRoutes()` mounts every `/api/*` endpoint and the error handler; `server/index.ts` then, in
development, attaches Vite as middleware (`server/vite.ts`) or in production serves `dist/public`
(`server/static.ts`), and listens. The catch-all client route must stay last, which is why
`setupVite`/`serveStatic` run after `createApp()`.

Server layers: `app.ts` (security, session, CSRF, logging) → `routes.ts` (HTTP handlers) → `storage.ts`
(`IStorage` / `DatabaseStorage`, all data access) → `db.ts` (driver selection). Rate limiters and
`validateCsrf` live in `server/middleware.ts`; limiters are skipped when `NODE_ENV=test`.

Route tests (`server/*.test.ts` using `server/test-helpers.ts`) run the real app on an ephemeral port against
an in-memory SQLite database (`SQLITE_PATH=:memory:` is set in `vitest.config.ts`), so they never touch
`sqlite.db`. Prefer a route test for anything involving auth, validation or permissions.

`shared/` is the contract used by both sides. `shared/schema.ts` holds the Drizzle tables, `drizzle-zod`
insert schemas, and inferred types; `shared/routes.ts` exports an `api` object mapping each endpoint to its
method/path/input schema/response schemas plus `buildUrl()`. Server handlers register paths as
`app.get(api.places.list.path, ...)` — changing a path in `shared/routes.ts` moves it on both sides at once.

### Dual-database setup (read before touching schema or queries)

`shared/schema.ts` is written entirely in `drizzle-orm/pg-core`. When `DATABASE_URL` is unset or non-Postgres,
`server/db.ts` opens `sqlite.db` instead, creates tables from **hand-written `CREATE TABLE` DDL in that file**,
applies its own ad-hoc column migrations, and casts the SQLite Drizzle instance to `NodePgDatabase`. Consequences:

- A new table or column needs edits in **both** `shared/schema.ts` and the `tableDefinitions` array (plus a
  migration entry for existing local DBs) in `server/db.ts`. `npm run db:push` does not touch SQLite.
- Column defaults must use the raw-SQL form (``sql`CURRENT_TIMESTAMP` `` / ``sql`FALSE` ``), not `.defaultNow()` or a JS
  boolean — the Postgres-flavored forms don't bind under better-sqlite3 and crash inserts at runtime.
- Compare booleans through the local `boolEq()` helper in `server/storage.ts`; better-sqlite3 rejects raw
  `true`/`false` binds, so `eq(places.isFeatured, true)` throws under the fallback.
- Keep query SQL portable (see the `CASE WHEN` / `gte` / `lt` usage in `storage.ts`); the type checker cannot
  catch dialect drift because of the cast.
- `server/storage.integration.test.ts` exists specifically to catch this class of bug by writing to the real
  SQLite fallback. Extend it when adding write paths.

`.env.local` is loaded by `dotenv` inside `server/db.ts` (and `drizzle.config.ts`) — importing `db.ts` is what
makes env vars available, so nothing should read `process.env` config before that module is evaluated.

### Auth, session, CSRF

Session-based auth (`openway.sid` cookie, bcrypt, optional TOTP 2FA in `server/auth.ts`; 2FA secrets and backup
codes are encrypted with `TWO_FACTOR_ENCRYPTION_KEY`, falling back to a key derived from `SESSION_SECRET`).
Postgres uses `connect-pg-simple`; without it sessions fall back to an in-memory store (dev only).

State-changing endpoints compose `requireAuth`/`requireAdmin` (defined in `routes.ts`) with `validateCsrf` and a
rate limiter. `validateCsrf` only enforces for authenticated sessions; the client side of it lives in
`client/src/lib/queryClient.ts`, where `apiRequest()` fetches `/api/csrf-token`, caches it, sends
`X-CSRF-Token`, and retries once on a 403 mentioning a security token. Non-GET requests should go through
`apiRequest()` rather than raw `fetch`.

### Client data fetching

Two coexisting patterns:

1. Contract-driven hooks (`hooks/use-places.ts`, `use-petition.ts`, `use-reviews.ts`) supply their own
   `queryFn`, build URLs from `api.*.path` / `buildUrl()`, and validate responses against the contract's zod
   schema. Prefer this for new endpoints.
2. The default `queryFn` in `queryClient.ts` joins the query key with `/` to form the URL, so
   `queryKey: ["/api/places", placeId, "place-reviews"]` fetches `/api/places/:id/place-reviews`.

Defaults are `staleTime: Infinity`, no refetch on focus/interval, `retry: false` — mutations must explicitly
`invalidateQueries` or the UI will not update.

### Accessibility settings are a real subsystem

`client/src/hooks/use-settings.ts` is a persisted zustand store that toggles classes on `<html>`
(`dark`, `high-contrast`, `text-size-*`, `font-atkinson|opendyslexic|system`, `leading-*`, `link-underlines`,
`enhanced-focus`) and drives `ReadAloudProvider` (Web Speech). New UI must work under all of these — use the
token/class system in `client/src/index.css` and `tailwind.config.ts` rather than hardcoded colors, sizes, or
fonts, and respect `reducedMotion` in framer-motion animations.

### Other notable behavior

- `registerRoutes()` seeds demo content only when `OPENWAY_SEED_ON_STARTUP=true`; leave it off by default.
- Uploads are stored on local disk under `uploads/` and served at `/uploads`; `routes.ts` enforces the allowed
  MIME types, 10MB cap, and generated filename pattern. `/api/uploads/proxy` is deliberately excluded from the
  JSON body parser in `index.ts` so it can read the raw buffer.
- Email (password reset, verification) goes through Resend in `server/email.ts`; without `RESEND_API_KEY` +
  `RESET_EMAIL_FROM` it logs to the console in dev and silently no-ops in production.
- `script/build.ts` keeps an explicit allowlist of server deps to bundle; everything else stays external. Adding
  a server dependency that must be bundled means adding it there.
- `express-async-errors` is imported first in `index.ts` on purpose — Express 4 would otherwise crash the
  process on a rejected promise in an async handler. `uncaughtException` intentionally exits.
- Path aliases `@/*` (client/src), `@shared/*`, `@assets/*` are declared in `tsconfig.json`, `vite.config.ts`,
  and `vitest.config.ts` — all three need updating if aliases change.
