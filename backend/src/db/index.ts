import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import * as schema from "./schema";

const dbPath = process.env.DATABASE_PATH ?? "./irontrack.db";

export function createDb(path: string = dbPath) {
  const sqlite = new Database(path);
  sqlite.exec("PRAGMA journal_mode = WAL;");
  sqlite.exec("PRAGMA foreign_keys = ON;");

  // Create tables if they don't exist (matches existing SQLite schema exactly)
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS exercises (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      aliases TEXT NOT NULL DEFAULT '[]',
      created_at INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS workout_templates (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      exercises TEXT NOT NULL,
      is_public INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS workout_instances (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      template_id TEXT,
      name TEXT NOT NULL,
      date INTEGER NOT NULL,
      exercises TEXT NOT NULL,
      notes TEXT DEFAULT '',
      is_draft INTEGER NOT NULL DEFAULT 0
    );
  `);

  // Migrate existing DBs: add new columns if missing
  const exerciseCols = sqlite
    .prepare("PRAGMA table_info(exercises)")
    .all() as { name: string }[];
  const colNames = exerciseCols.map((c) => c.name);
  if (!colNames.includes("aliases")) {
    sqlite.exec("ALTER TABLE exercises ADD COLUMN aliases TEXT NOT NULL DEFAULT '[]'");
  }
  if (!colNames.includes("created_at")) {
    sqlite.exec("ALTER TABLE exercises ADD COLUMN created_at INTEGER NOT NULL DEFAULT 0");
  }

  return drizzle(sqlite, { schema });
}

export const db = createDb();
export type Db = ReturnType<typeof createDb>;
