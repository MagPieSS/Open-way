import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import * as schema from "@shared/schema";

// Use SQLite for local development
const sqlite = new Database("sqlite.db");
sqlite.pragma("journal_mode = WAL");

export const db = drizzle(sqlite, { schema });
export const pool = null; // Not needed for SQLite
