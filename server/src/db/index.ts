/**
 * Accès à la base locale SQLite (node:sqlite, aucune dépendance native).
 *
 * DATA_MODE=local utilise ce module. DATA_MODE=supabase est prévu pour la
 * production : voir supabase/migrations + README (adaptateur à brancher sur
 * l'API REST/PostgREST de Supabase).
 */
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

export type SqlPrimitive = string | number | null;
export type Row = Record<string, SqlPrimitive>;

let database: DatabaseSync | null = null;

const migrationsDir = fileURLToPath(new URL('./migrations/', import.meta.url));

export function openDatabase(filePath: string): DatabaseSync {
  if (filePath !== ':memory:') {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
  }
  const db = new DatabaseSync(filePath);
  db.exec('PRAGMA foreign_keys = ON;');
  if (filePath !== ':memory:') {
    db.exec('PRAGMA journal_mode = WAL;');
    db.exec('PRAGMA busy_timeout = 5000;');
  }
  return db;
}

export function migrate(db: DatabaseSync): string[] {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );`);

  const applied = new Set(
    (db.prepare('SELECT name FROM schema_migrations').all() as Array<{ name: string }>).map((r) => r.name),
  );

  const files = fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort();

  const newlyApplied: string[] = [];
  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    db.exec('BEGIN IMMEDIATE;');
    try {
      db.exec(sql);
      db.prepare('INSERT INTO schema_migrations (name) VALUES (?)').run(file);
      db.exec('COMMIT;');
      newlyApplied.push(file);
    } catch (error) {
      db.exec('ROLLBACK;');
      throw new Error(`Migration ${file} échouée : ${(error as Error).message}`);
    }
  }
  return newlyApplied;
}

export function initDatabase(filePath: string): DatabaseSync {
  const db = openDatabase(filePath);
  migrate(db);
  database = db;
  return db;
}

export function getDb(): DatabaseSync {
  if (!database) throw new Error("La base de données n'est pas initialisée.");
  return database;
}

export function closeDatabase(): void {
  database?.close();
  database = null;
}

/** Exécute `fn` dans une transaction IMMEDIATE (verrou d'écriture immédiat). */
export function transaction<T>(fn: (db: DatabaseSync) => T): T {
  const db = getDb();
  db.exec('BEGIN IMMEDIATE;');
  try {
    const result = fn(db);
    db.exec('COMMIT;');
    return result;
  } catch (error) {
    db.exec('ROLLBACK;');
    throw error;
  }
}

export function queryAll<T = Row>(sql: string, params: SqlPrimitive[] = []): T[] {
  return getDb().prepare(sql).all(...params) as T[];
}

export function queryOne<T = Row>(sql: string, params: SqlPrimitive[] = []): T | null {
  const row = getDb().prepare(sql).get(...params) as T | undefined;
  return row ?? null;
}

export function execute(sql: string, params: SqlPrimitive[] = []): { changes: number; lastInsertRowid: number } {
  const result = getDb().prepare(sql).run(...params);
  return { changes: Number(result.changes), lastInsertRowid: Number(result.lastInsertRowid) };
}
