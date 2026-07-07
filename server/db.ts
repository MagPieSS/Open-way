import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { drizzle as drizzleSqlite } from "drizzle-orm/better-sqlite3";
import { Pool } from "pg";
import Database from "better-sqlite3";
import * as schema from "@shared/schema";
import { config } from "dotenv";
import path from "path";

config({ path: ".env.local" });

const useSqliteFallback = !process.env.DATABASE_URL || !process.env.DATABASE_URL.startsWith("postgres");

if (useSqliteFallback) {
  const sqlitePath = path.resolve(process.cwd(), "sqlite.db");
  const sqlite = new Database(sqlitePath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  const tableDefinitions = [
    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      display_name TEXT,
      two_factor_enabled BOOLEAN DEFAULT false,
      two_factor_secret TEXT,
      backup_codes TEXT,
      is_active BOOLEAN DEFAULT true,
      is_admin BOOLEAN DEFAULT false,
      is_banned BOOLEAN DEFAULT false,
      ban_reason TEXT,
      last_login_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS places (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      accessibility_status TEXT NOT NULL,
      description TEXT NOT NULL,
      image_url TEXT,
      image_urls TEXT,
      address TEXT,
      latitude REAL,
      longitude REAL,
      phone TEXT,
      website TEXT,
      hours TEXT,
      accessibility_source TEXT,
      verification_status TEXT DEFAULT 'community',
      submitted_by INTEGER,
      last_checked_at TIMESTAMP,
      is_featured BOOLEAN DEFAULT false,
      view_count INTEGER DEFAULT 0,
      review_count INTEGER DEFAULT 0,
      average_rating REAL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      icon TEXT NOT NULL,
      description TEXT,
      place_count INTEGER DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS accessibility_features (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      place_id INTEGER NOT NULL,
      feature_type TEXT NOT NULL,
      available BOOLEAN DEFAULT true,
      description TEXT,
      verified_at TIMESTAMP,
      FOREIGN KEY (place_id) REFERENCES places(id)
    )`,
    `CREATE TABLE IF NOT EXISTS place_media (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      place_id INTEGER NOT NULL,
      url TEXT NOT NULL,
      caption TEXT,
      uploaded_by TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (place_id) REFERENCES places(id)
    )`,
    `CREATE TABLE IF NOT EXISTS place_tips (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      place_id INTEGER NOT NULL,
      user_id INTEGER,
      content TEXT NOT NULL,
      author TEXT,
      helpful_count INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (place_id) REFERENCES places(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`,
    `CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      place_id INTEGER NOT NULL,
      user_id INTEGER,
      content TEXT NOT NULL,
      rating INTEGER,
      author_name TEXT,
      author_role TEXT,
      image_url TEXT,
      helpful_count INTEGER DEFAULT 0,
      is_featured BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (place_id) REFERENCES places(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`,
    `CREATE TABLE IF NOT EXISTS petitions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      goal_signatures INTEGER DEFAULT 1000,
      created_by INTEGER NOT NULL,
      creator_name TEXT,
      status TEXT DEFAULT 'active',
      image_url TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id)
    )`,
    `CREATE TABLE IF NOT EXISTS signatures (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      petition_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      display_name TEXT,
      city TEXT,
      message TEXT,
      share_consent BOOLEAN DEFAULT false,
      signed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (petition_id) REFERENCES petitions(id),
      FOREIGN KEY (user_id) REFERENCES users(id),
      UNIQUE(user_id, petition_id)
    )`,
    `CREATE TABLE IF NOT EXISTS petition_updates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      petition_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      author TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (petition_id) REFERENCES petitions(id)
    )`,
    `CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      date TIMESTAMP NOT NULL,
      end_date TIMESTAMP,
      location TEXT,
      address TEXT,
      category TEXT,
      image_url TEXT,
      registration_url TEXT,
      is_featured BOOLEAN DEFAULT false,
      status TEXT DEFAULT 'active',
      created_by INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id)
    )`,
    `CREATE TABLE IF NOT EXISTS resources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      category TEXT NOT NULL,
      url TEXT,
      phone TEXT,
      email TEXT,
      address TEXT,
      icon TEXT,
      is_featured BOOLEAN DEFAULT false,
      sort_order INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS blog_posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      excerpt TEXT,
      content TEXT NOT NULL,
      author TEXT,
      category TEXT,
      image_url TEXT,
      is_featured BOOLEAN DEFAULT false,
      is_published BOOLEAN DEFAULT true,
      published_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS faq_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      question TEXT NOT NULL,
      answer TEXT NOT NULL,
      category TEXT,
      sort_order INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS contact_submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      subject TEXT,
      message TEXT NOT NULL,
      status TEXT DEFAULT 'new',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS activity_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      activity_type TEXT NOT NULL,
      description TEXT NOT NULL,
      related_id INTEGER,
      related_type TEXT,
      actor_name TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS partners (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      logo_url TEXT,
      website TEXT,
      description TEXT,
      is_featured BOOLEAN DEFAULT true,
      sort_order INTEGER DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS community_posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      author_name TEXT,
      parent_id INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`,
    `CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token TEXT NOT NULL UNIQUE,
      expires_at TIMESTAMP NOT NULL,
      used_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`,
    `CREATE TABLE IF NOT EXISTS reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      report_type TEXT NOT NULL,
      reportable_id INTEGER NOT NULL,
      reportable_type TEXT NOT NULL,
      reporter_id INTEGER NOT NULL,
      reason TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (reporter_id) REFERENCES users(id)
    )`,
    `CREATE TABLE IF NOT EXISTS saved_places (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      place_id INTEGER NOT NULL,
      saved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (place_id) REFERENCES places(id)
    )`
  ];

  for (const statement of tableDefinitions) {
    sqlite.exec(statement);
  }

  console.log(`[db] Using SQLite fallback at ${sqlitePath}`);
}

export const db = useSqliteFallback
  ? drizzleSqlite(new Database(path.resolve(process.cwd(), "sqlite.db")), { schema })
  : drizzlePg(new Pool({ connectionString: process.env.DATABASE_URL }), { schema });

export const pool = useSqliteFallback ? undefined : new Pool({ connectionString: process.env.DATABASE_URL });

