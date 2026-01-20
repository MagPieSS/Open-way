# Database Setup Guide for Open Way

## Quick Start

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
   http://localhost:5173
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

Test your connection:

```powershell
$env:DATABASE_URL = "postgresql://postgres:password@localhost:5432/openway"
npm run check
```

If successful, you'll see TypeScript compilation pass without errors.

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
2. Open browser: http://localhost:5173
3. Create account and explore!
