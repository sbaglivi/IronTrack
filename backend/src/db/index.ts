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
      password_hash TEXT NOT NULL,
      updated_at INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS exercises (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      aliases TEXT NOT NULL DEFAULT '[]',
      created_at INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS workout_templates (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      exercises TEXT NOT NULL,
      is_public INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL DEFAULT 0,
      deleted_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS workout_instances (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      template_id TEXT,
      name TEXT NOT NULL,
      date INTEGER NOT NULL,
      exercises TEXT NOT NULL,
      notes TEXT DEFAULT '',
      is_draft INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL DEFAULT 0,
      deleted_at INTEGER
    );
  `);

  // Migrate existing DBs: add new columns if missing
  function addMissingColumns(
    table: string,
    cols: { name: string; ddl: string }[]
  ) {
    const existing = (sqlite.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map((c) => c.name);
    for (const { name, ddl } of cols) {
      if (!existing.includes(name)) sqlite.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
    }
  }

  addMissingColumns("users", [
    { name: "updated_at", ddl: "updated_at INTEGER NOT NULL DEFAULT 0" },
  ]);
  addMissingColumns("exercises", [
    { name: "aliases",    ddl: "aliases TEXT NOT NULL DEFAULT '[]'" },
    { name: "created_at", ddl: "created_at INTEGER NOT NULL DEFAULT 0" },
    { name: "updated_at", ddl: "updated_at INTEGER NOT NULL DEFAULT 0" },
  ]);
  addMissingColumns("workout_templates", [
    { name: "updated_at", ddl: "updated_at INTEGER NOT NULL DEFAULT 0" },
    { name: "deleted_at", ddl: "deleted_at INTEGER" },
  ]);
  addMissingColumns("workout_instances", [
    { name: "updated_at", ddl: "updated_at INTEGER NOT NULL DEFAULT 0" },
    { name: "deleted_at", ddl: "deleted_at INTEGER" },
  ]);

  // Indexes for efficient sync queries
  sqlite.exec(`
    CREATE INDEX IF NOT EXISTS idx_templates_user_updated ON workout_templates(user_id, updated_at);
    CREATE INDEX IF NOT EXISTS idx_instances_user_updated ON workout_instances(user_id, updated_at);
  `);

  return drizzle(sqlite, { schema });
}

export const db = createDb();
export type Db = ReturnType<typeof createDb>;
