import bcrypt from "bcrypt";
import Database from "better-sqlite3";
import path from "path";

async function main() {
  const dbPath = path.resolve(process.cwd(), "sqlite.db");
  const sqlite = new Database(dbPath);
  const password = "AdminOpenWay2026!";
  const hash = await bcrypt.hash(password, 12);
  const existing = sqlite.prepare("SELECT id FROM users WHERE email = ?").get("admin@openway.local");

  if (existing) {
    sqlite.prepare("UPDATE users SET password_hash = ?, display_name = ?, is_admin = 1, is_active = 1 WHERE id = ?").run(hash, "Admin", existing.id);
  } else {
    sqlite.prepare("INSERT INTO users (email, password_hash, display_name, is_admin, is_active) VALUES (?, ?, ?, 1, 1)").run("admin@openway.local", hash, "Admin");
  }

  console.log("Admin account ready for admin@openway.local");
  console.log("Password: AdminOpenWay2026!");
  sqlite.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
