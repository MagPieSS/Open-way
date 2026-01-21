import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import * as schema from "@shared/schema";

// Use SQLite for local development
const sqlite = new Database("sqlite.db");
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });
export const pool = null; // Not needed for SQLite

// Initialize database tables
function initializeDatabase() {
  try {
    // Create all tables if they don't exist
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        display_name TEXT,
        two_factor_enabled INTEGER DEFAULT 0,
        two_factor_secret TEXT,
        backup_codes TEXT,
        is_active INTEGER DEFAULT 1,
        is_admin INTEGER DEFAULT 0,
        last_login_at INTEGER,
        created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
      );

      CREATE TABLE IF NOT EXISTS saved_places (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        place_id INTEGER NOT NULL,
        saved_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
        FOREIGN KEY(user_id) REFERENCES users(id),
        FOREIGN KEY(place_id) REFERENCES places(id)
      );

      CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        icon TEXT NOT NULL,
        description TEXT,
        place_count INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS places (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        accessibility_status TEXT NOT NULL,
        description TEXT NOT NULL,
        image_url TEXT,
        address TEXT,
        latitude REAL,
        longitude REAL,
        phone TEXT,
        website TEXT,
        hours TEXT,
        is_featured INTEGER DEFAULT 0,
        view_count INTEGER DEFAULT 0,
        review_count INTEGER DEFAULT 0,
        average_rating REAL,
        updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
        created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
      );

      CREATE TABLE IF NOT EXISTS accessibility_features (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        place_id INTEGER NOT NULL,
        feature_type TEXT NOT NULL,
        available INTEGER DEFAULT 1,
        description TEXT,
        verified_at INTEGER,
        FOREIGN KEY(place_id) REFERENCES places(id)
      );

      CREATE TABLE IF NOT EXISTS place_media (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        place_id INTEGER NOT NULL,
        url TEXT NOT NULL,
        caption TEXT,
        uploaded_by TEXT,
        created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
        FOREIGN KEY(place_id) REFERENCES places(id)
      );

      CREATE TABLE IF NOT EXISTS place_tips (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        place_id INTEGER NOT NULL,
        user_id INTEGER,
        content TEXT NOT NULL,
        author TEXT,
        helpful_count INTEGER DEFAULT 0,
        created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
        FOREIGN KEY(place_id) REFERENCES places(id),
        FOREIGN KEY(user_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS reviews (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        place_id INTEGER NOT NULL,
        user_id INTEGER,
        content TEXT NOT NULL,
        rating INTEGER,
        author_name TEXT,
        author_role TEXT,
        image_url TEXT,
        helpful_count INTEGER DEFAULT 0,
        is_featured INTEGER DEFAULT 0,
        created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
        FOREIGN KEY(place_id) REFERENCES places(id),
        FOREIGN KEY(user_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS signatures (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        display_name TEXT,
        city TEXT,
        message TEXT,
        share_consent INTEGER DEFAULT 0,
        signed_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
        FOREIGN KEY(user_id) REFERENCES users(id),
        UNIQUE(user_id)
      );

      CREATE TABLE IF NOT EXISTS petition_updates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        author TEXT,
        created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
      );

      CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        date INTEGER NOT NULL,
        end_date INTEGER,
        location TEXT,
        address TEXT,
        category TEXT,
        image_url TEXT,
        registration_url TEXT,
        is_featured INTEGER DEFAULT 0,
        created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
      );

      CREATE TABLE IF NOT EXISTS resources (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        category TEXT NOT NULL,
        url TEXT,
        phone TEXT,
        email TEXT,
        address TEXT,
        icon TEXT,
        is_featured INTEGER DEFAULT 0,
        sort_order INTEGER DEFAULT 0,
        created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
      );

      CREATE TABLE IF NOT EXISTS blog_posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        excerpt TEXT,
        content TEXT NOT NULL,
        author TEXT,
        category TEXT,
        image_url TEXT,
        is_featured INTEGER DEFAULT 0,
        is_published INTEGER DEFAULT 1,
        published_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
        created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
      );

      CREATE TABLE IF NOT EXISTS faq_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        question TEXT NOT NULL,
        answer TEXT NOT NULL,
        category TEXT,
        sort_order INTEGER DEFAULT 0,
        created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
      );

      CREATE TABLE IF NOT EXISTS contact_submissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        subject TEXT,
        message TEXT NOT NULL,
        status TEXT DEFAULT 'new',
        created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
      );

      CREATE TABLE IF NOT EXISTS activity_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        activity_type TEXT NOT NULL,
        description TEXT NOT NULL,
        related_id INTEGER,
        related_type TEXT,
        actor_name TEXT,
        created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
      );

      CREATE TABLE IF NOT EXISTS partners (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        logo_url TEXT,
        website TEXT,
        description TEXT,
        is_featured INTEGER DEFAULT 1,
        sort_order INTEGER DEFAULT 0
      );
    `);
    console.log("✅ Database tables initialized successfully");
  } catch (error) {
    console.error("❌ Database initialization error:", error);
  }
}

// Initialize database on import
initializeDatabase();

