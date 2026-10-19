import bcrypt from "bcrypt";
import crypto from "crypto";
import Database from "better-sqlite3";
import path from "path";

// Creates (or resets) a local admin account for development.
// Usage: ADMIN_EMAIL=you@example.com ADMIN_PASSWORD=yourpassword npx tsx scripts/create-admin.ts
// If ADMIN_PASSWORD is omitted, a random password is generated and printed once.
async function main() {
  // Same database the app uses: SQLITE_PATH if set (see server/db.ts), else ./sqlite.db.
  const dbPath = path.resolve(process.cwd(), process.env.SQLITE_PATH || "sqlite.db");
  const sqlite = new Database(dbPath);

  const email = (process.env.ADMIN_EMAIL || "admin@openway.local").toLowerCase();
  const password = process.env.ADMIN_PASSWORD || crypto.randomBytes(12).toString("base64url");
  const generated = !process.env.ADMIN_PASSWORD;

  const hash = await bcrypt.hash(password, 12);
  const existing = sqlite.prepare("SELECT id FROM users WHERE email = ?").get(email) as { id: number } | undefined;

  if (existing) {
    sqlite.prepare("UPDATE users SET password_hash = ?, display_name = ?, is_admin = 1, is_active = 1 WHERE id = ?").run(hash, "Admin", existing.id);
  } else {
    sqlite.prepare("INSERT INTO users (email, password_hash, display_name, is_admin, is_active) VALUES (?, ?, ?, 1, 1)").run(email, hash, "Admin");
  }

  console.log(`Admin account ready for ${email}`);
  if (generated) {
    console.log(`Generated password (shown once): ${password}`);
    console.log("Set ADMIN_PASSWORD to choose your own instead of a generated one.");
  } else {
    console.log("Password set from ADMIN_PASSWORD.");
  }
  sqlite.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
