import { drizzle as drizzlePg, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { drizzle as drizzleSqlite } from "drizzle-orm/better-sqlite3";
import { Pool } from "pg";
import Database from "better-sqlite3";
import * as schema from "@shared/schema";
import { config } from "dotenv";
import path from "path";

config({ path: ".env.local" });

export const useSqliteFallback = !process.env.DATABASE_URL || !process.env.DATABASE_URL.startsWith("postgres");

// Timestamps as Drizzle's pg-core columns send them: "2026-03-04T05:06:07.000Z".
const ISO_UTC_TIMESTAMP = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2}(?:\.\d+)?)Z$/;

// The schema is written with drizzle-orm/pg-core, so Drizzle hands better-sqlite3 values shaped
// for Postgres. Two of them break under the fallback, so they are converted for every statement
// here instead of at each call site:
// - JS booleans: better-sqlite3 throws "SQLite3 can only bind numbers, strings, bigints, buffers,
//   and null", which crashed banning a user, verifying an email and enabling 2FA.
// - Timestamps: pg-core sends "…T05:06:07.000Z" and, reading back, appends "+0000", which makes an
//   Invalid Date. Account lockouts and token expiry silently stopped working, and same-day SQL
//   comparisons against CURRENT_TIMESTAMP values ("… 05:06:07") were wrong. Storing SQLite's own
//   "YYYY-MM-DD HH:MM:SS" UTC format fixes both.
function adaptParamsForSqlite(sqlite: Database.Database): void {
  const toSqliteParam = (value: unknown) => {
    if (typeof value === "boolean") return value ? 1 : 0;
    if (typeof value === "string") {
      const match = ISO_UTC_TIMESTAMP.exec(value);
      if (match) return `${match[1]} ${match[2]}`;
    }
    return value;
  };
  const originalPrepare = sqlite.prepare.bind(sqlite);

  sqlite.prepare = ((source: string) => {
    const statement = originalPrepare(source);
    const run = statement.run.bind(statement);
    const get = statement.get.bind(statement);
    const all = statement.all.bind(statement);
    const iterate = statement.iterate.bind(statement);
    statement.run = (...params: unknown[]) => run(...params.map(toSqliteParam));
    statement.get = (...params: unknown[]) => get(...params.map(toSqliteParam));
    statement.all = (...params: unknown[]) => all(...params.map(toSqliteParam));
    statement.iterate = (...params: unknown[]) => iterate(...params.map(toSqliteParam));
    return statement;
  }) as typeof sqlite.prepare;
}

let sqliteConnection: Database.Database | undefined;

if (useSqliteFallback) {
  // SQLITE_PATH lets tests run against ":memory:" instead of the developer's real sqlite.db.
  const configuredPath = process.env.SQLITE_PATH || "sqlite.db";
  const sqlitePath = configuredPath === ":memory:" ? configuredPath : path.resolve(process.cwd(), configuredPath);
  const sqlite = new Database(sqlitePath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  adaptParamsForSqlite(sqlite);

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
      email_verified BOOLEAN DEFAULT false,
      failed_login_attempts INTEGER DEFAULT 0,
      locked_until TIMESTAMP,
      session_version INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS email_verification_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token TEXT NOT NULL UNIQUE,
      expires_at TIMESTAMP NOT NULL,
      used_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
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
      status TEXT,
      source_type TEXT,
      source_url TEXT,
      description TEXT,
      verified_at TIMESTAMP,
      FOREIGN KEY (place_id) REFERENCES places(id)
    )`,
    `CREATE TABLE IF NOT EXISTS accessibility_observations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      place_id INTEGER NOT NULL,
      feature_type TEXT NOT NULL,
      status TEXT NOT NULL,
      note TEXT,
      observed_at TIMESTAMP NOT NULL,
      user_id INTEGER,
      moderation_status TEXT NOT NULL DEFAULT 'published',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (place_id) REFERENCES places(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`,
    `CREATE INDEX IF NOT EXISTS accessibility_observations_place_idx ON accessibility_observations (place_id)`,
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
      reporter_id INTEGER,
      content_type TEXT NOT NULL,
      content_id INTEGER NOT NULL,
      reason TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      resolved_by INTEGER,
      resolved_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (reporter_id) REFERENCES users(id),
      FOREIGN KEY (resolved_by) REFERENCES users(id)
    )`,
    `CREATE TABLE IF NOT EXISTS review_votes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      review_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (review_id) REFERENCES reviews(id),
      FOREIGN KEY (user_id) REFERENCES users(id),
      UNIQUE(user_id, review_id)
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

  // Lightweight migrations for databases created before certain columns/tables existed.
  // CREATE TABLE IF NOT EXISTS above is a no-op against tables that already exist with an
  // older shape, so new columns and the reports-table rename have to be applied explicitly.
  const columnExists = (tableName: string, columnName: string): boolean => {
    const columns = sqlite.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>;
    return columns.some((col) => col.name === columnName);
  };

  const userColumnMigrations: Array<[string, string]> = [
    ["email_verified", "BOOLEAN DEFAULT false"],
    ["failed_login_attempts", "INTEGER DEFAULT 0"],
    ["locked_until", "TIMESTAMP"],
    ["session_version", "INTEGER DEFAULT 0"],
  ];
  for (const [column, definition] of userColumnMigrations) {
    if (!columnExists("users", column)) {
      sqlite.exec(`ALTER TABLE users ADD COLUMN ${column} ${definition}`);
    }
  }

  const featureColumnMigrations: Array<[string, string]> = [
    ["status", "TEXT"],
    ["source_type", "TEXT"],
    ["source_url", "TEXT"],
  ];
  for (const [column, definition] of featureColumnMigrations) {
    if (!columnExists("accessibility_features", column)) {
      sqlite.exec(`ALTER TABLE accessibility_features ADD COLUMN ${column} ${definition}`);
    }
  }

  if (columnExists("reports", "report_type") && !columnExists("reports", "content_type")) {
    console.log("[db] Migrating legacy reports table schema...");
    sqlite.exec(`ALTER TABLE reports RENAME TO reports_legacy`);
    sqlite.exec(`CREATE TABLE reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reporter_id INTEGER NOT NULL,
      content_type TEXT NOT NULL,
      content_id INTEGER NOT NULL,
      reason TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      resolved_by INTEGER,
      resolved_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (reporter_id) REFERENCES users(id),
      FOREIGN KEY (resolved_by) REFERENCES users(id)
    )`);
    sqlite.exec(`
      INSERT INTO reports (id, reporter_id, content_type, content_id, reason, status, created_at)
      SELECT id, reporter_id, reportable_type, reportable_id, reason, status, created_at FROM reports_legacy
    `);
    sqlite.exec(`DROP TABLE reports_legacy`);
  } else if (!columnExists("reports", "resolved_by")) {
    sqlite.exec(`ALTER TABLE reports ADD COLUMN resolved_by INTEGER REFERENCES users(id)`);
    sqlite.exec(`ALTER TABLE reports ADD COLUMN resolved_at TIMESTAMP`);
  }

  // Signed-out visitors can now report problems with a listing, so reporter_id may be null.
  // SQLite can't drop NOT NULL in place; rebuild the table keeping every row.
  const reporterColumn = (sqlite.prepare(`PRAGMA table_info(reports)`).all() as Array<{ name: string; notnull: number }>)
    .find((col) => col.name === "reporter_id");
  if (reporterColumn?.notnull) {
    console.log("[db] Allowing anonymous reports (reports.reporter_id nullable)...");
    sqlite.exec(`
      BEGIN;
      CREATE TABLE reports_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        reporter_id INTEGER,
        content_type TEXT NOT NULL,
        content_id INTEGER NOT NULL,
        reason TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        resolved_by INTEGER,
        resolved_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (reporter_id) REFERENCES users(id),
        FOREIGN KEY (resolved_by) REFERENCES users(id)
      );
      INSERT INTO reports_new (id, reporter_id, content_type, content_id, reason, status, resolved_by, resolved_at, created_at)
        SELECT id, reporter_id, content_type, content_id, reason, status, resolved_by, resolved_at, created_at FROM reports;
      DROP TABLE reports;
      ALTER TABLE reports_new RENAME TO reports;
      COMMIT;
    `);
  }

  // Rewrite timestamps saved before adaptParamsForSqlite existed ("…T…Z") into SQLite's format.
  const tableNames = sqlite.prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'`)
    .all() as Array<{ name: string }>;
  for (const { name: table } of tableNames) {
    const columns = sqlite.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string; type: string }>;
    for (const { name: column } of columns.filter((c) => c.type.toUpperCase() === "TIMESTAMP")) {
      sqlite.exec(`
        UPDATE ${table}
        SET ${column} = replace(substr(${column}, 1, length(${column}) - 1), 'T', ' ')
        WHERE ${column} GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T*Z'
      `);
    }
  }

  console.log(`[db] Using SQLite fallback at ${sqlitePath}`);

  sqliteConnection = sqlite;
}

// `schema` is written in drizzle-orm/pg-core, so the Postgres driver's type is the source of
// truth for storage.ts's query builder calls. The SQLite fallback is intentionally treated as
// structurally compatible here (matching column names/affinities, .returning() support, portable
// SQL only — see the CASE WHEN / gte / lt usage in storage.ts) rather than duplicating the schema
// in sqlite-core just to satisfy the type checker; TypeScript can't usefully unify the two
// drivers' generic builder types, so mixing them via a plain union broke every query call.
export const db = (
  useSqliteFallback
    ? drizzleSqlite(sqliteConnection!, { schema })
    : drizzlePg(new Pool({ connectionString: process.env.DATABASE_URL }), { schema })
) as NodePgDatabase<typeof schema>;

export const pool = useSqliteFallback ? undefined : new Pool({ connectionString: process.env.DATABASE_URL });

