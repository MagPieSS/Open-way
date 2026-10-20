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
- **Server:** Express + TypeScript, session-based auth with Google sign-in (no passwords stored)
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

### Google sign-in

People sign in with their Google account; Open Way stores no passwords. Browsing and reporting a
barrier work without signing in. To make sign-in work (locally or deployed):

1. In [Google Cloud Console](https://console.cloud.google.com/), create a project (e.g. "Open Way").
2. Open **Google Auth Platform** (APIs & Services → OAuth consent screen in older layouts) and set it
   up: app name, a support email, audience **External**. Open Way only asks for `openid` and `email`.
3. Under **Clients**, create an OAuth client of type **Web application**. Add this
   **Authorized redirect URI** (it must match exactly):
   - local: `http://localhost:5000/api/auth/google/callback`
   - deployed: `https://<your-domain>/api/auth/google/callback` (add when you deploy)
4. Put the values in `.env.local` (never commit it):
   ```
   GOOGLE_CLIENT_ID=...apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=...
   APP_BASE_URL=http://localhost:5000
   ADMIN_EMAILS=you@gmail.com
   ```
5. Restart `npm run dev`, open http://localhost:5000/login (use `localhost`, not `127.0.0.1`, so it
   matches the redirect URI) and choose "Sign in with Google". Accounts listed in `ADMIN_EMAILS`
   become admins when they sign in.

While the app is in Google's "Testing" mode, only the test users you add on the Audience page can sign
in. Publish it to let anyone with a Google account sign in.

To make an existing account an admin later: `npx tsx scripts/grant-admin.ts someone@example.com`.

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
scripts/          Admin/maintenance scripts (grant-admin, seed-places, decode-legacy-entities,
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
- No passwords are stored: Google verifies identity and email address. Sign-in uses PKCE and a
  one-time state check, and only returns people to same-site pages.
- Sign-in attempts are rate-limited per IP. "Sign out of other devices" (Profile) ends every other
  session for an account.
- Set `APP_BASE_URL` everywhere so the Google redirect address can't be changed by a forged Host header.
- Uploaded photos are re-encoded to remove location and device metadata.
- The dev server listens on 127.0.0.1 unless `HOST` is set.
- See [.env.example](./.env.example) for the full list of configuration options.
