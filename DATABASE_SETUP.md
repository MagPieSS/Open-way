# Database Setup Guide for Open Way

## Quick Start

### Option 0: No setup — SQLite fallback (default)

If `DATABASE_URL` is unset or doesn't start with `postgres`, `server/db.ts` automatically falls
back to a local SQLite database at `sqlite.db` in the repo root, creating tables on first run.
This is what you get by just running:

```powershell
npm install
npm run dev
```

Good for quickly trying the app out. It is **not** suitable for production (see the warnings in
`server/index.ts` about session storage) and `npm run db:push` (Drizzle migrations) does not apply
to it — the SQLite schema is created and migrated separately in `server/db.ts`. For anything beyond
local exploration, use one of the PostgreSQL options below.

To create a local admin account against the SQLite database:

```powershell
$env:ADMIN_EMAIL = "you@example.com"; $env:ADMIN_PASSWORD = "choose-a-password"; npx tsx scripts/create-admin.ts
```

Omitting `ADMIN_PASSWORD` generates and prints a random one instead of using a fixed default.

---

### Option 1: Local PostgreSQL (Windows)

1. **Install PostgreSQL**
   ```powershell
   # Using Chocolatey (if installed)
   choco install postgresql
   
   # Or download from: https://www.postgresql.org/download/windows/
   ```

2. **Verify Installation**
   ```powershell
   psql --version
   ```

3. **Create Database**
   ```powershell
   # Open PostgreSQL command line
   psql -U postgres
   
   # Type password (default or what you set during installation)
   
   # In the psql prompt, run:
   CREATE DATABASE openway;
   \q  # Exit psql
   ```

4. **Update .env.local**
   ```
   DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/openway
   SESSION_SECRET=your-32-char-secret-key
   ```

5. **Run Migrations**
   ```powershell
   npm run db:push
   ```

6. **Start Dev Server**
   ```powershell
   npm run dev
   ```

7. **Visit**
   ```
   http://localhost:5000
   ```

---

### Option 2: Supabase (Recommended - Free Cloud DB)

1. **Sign Up** at https://supabase.com (free tier)

2. **Create New Project**
   - Project name: `openway`
   - Database password: (save this!)
   - Region: (choose closest to you)

3. **Get Connection String**
   - Go to: Project Settings > Database > Connection String
   - Select "Node.js" tab
   - Copy the full URL

4. **Update .env.local**
   ```
   DATABASE_URL=postgresql://postgres.[PROJECT-ID]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres
   SESSION_SECRET=your-32-char-secret-key
   ```

5. **Run Migrations**
   ```powershell
   npm run db:push
   ```

6. **Start Dev Server**
   ```powershell
   npm run dev
   ```

---

### Option 3: Docker (No Installation)

1. **Ensure Docker is installed**
   ```powershell
   docker --version
   ```

2. **Start PostgreSQL Container**
   ```powershell
   docker run --name openway-postgres `
     -e POSTGRES_USER=postgres `
     -e POSTGRES_PASSWORD=openway123 `
     -e POSTGRES_DB=openway `
     -p 5432:5432 `
     -d postgres:15
   ```

3. **Update .env.local**
   ```
   DATABASE_URL=postgresql://postgres:openway123@localhost:5432/openway
   SESSION_SECRET=your-32-char-secret-key
   ```

4. **Run Migrations**
   ```powershell
   npm run db:push
   ```

5. **Start Dev Server**
   ```powershell
   npm run dev
   ```

---

## Generate SESSION_SECRET

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy the output and paste into `.env.local` for `SESSION_SECRET`.

---

## Verify Connection

`npm run check` only runs the TypeScript compiler (`tsc --noEmit`) — it does **not** verify DB
connectivity. To actually verify the connection, start the dev server and confirm it connects:

```powershell
$env:DATABASE_URL = "postgresql://postgres:password@localhost:5432/openway"
npm run dev
```

Watch the startup logs: with `DATABASE_URL` set to a `postgres://` URL, `server/db.ts` uses the
Postgres pool; you should NOT see the `[db] Using SQLite fallback` log line. Then run
`npm run db:push` to apply the Drizzle schema.

---

## Troubleshooting

### "Could not connect to server"
- Ensure PostgreSQL is running: `psql -U postgres` (should connect)
- Check DATABASE_URL format is correct
- Verify host/port/database name

### "FATAL: password authentication failed"
- Double-check password in DATABASE_URL
- Reset password: `psql -U postgres` then `ALTER USER postgres WITH PASSWORD 'newpassword';`

### Migrations fail
- Ensure database exists: `createdb openway` (or via psql)
- Check permissions: `CREATE DATABASE` privilege needed
- Verify DATABASE_URL is correct

---

## Next Steps

Once database is set up:

1. Start dev server: `npm run dev`
2. Open browser: http://localhost:5000
3. Create account and explore!
