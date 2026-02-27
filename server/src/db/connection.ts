import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from '../config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const dbFilePath = path.resolve(__dirname, '../../', config.dbPath);
const dbDir = path.dirname(dbFilePath);

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

let db: SqlJsDatabase;

export async function initDb(): Promise<SqlJsDatabase> {
  if (db) return db;

  const SQL = await initSqlJs();

  // Load existing DB file if it exists
  if (fs.existsSync(dbFilePath)) {
    const fileBuffer = fs.readFileSync(dbFilePath);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  // ── Column migrations FIRST (safe ALTER TABLE — errors are silently ignored) ─
  // These must run before schema.sql so that any CREATE INDEX statements that
  // reference new columns succeed even on databases created before this migration.
  // SQLite does not support IF NOT EXISTS for ALTER TABLE, so we swallow errors.
  const columnMigrations = [
    `ALTER TABLE users ADD COLUMN dob TEXT`,
    `ALTER TABLE users ADD COLUMN deleted_at TEXT`,
    `ALTER TABLE reports ADD COLUMN is_priority INTEGER NOT NULL DEFAULT 0`,
  ];
  for (const migration of columnMigrations) {
    try { db.run(migration + ';'); } catch { /* column already exists or table not yet created */ }
  }

  // Run schema (exec handles multiple statements)
  const schemaPath = path.resolve(__dirname, 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf-8');
  // Split and run each statement separately since sql.js run() only handles single statements
  const statements = schema.split(';').map(s => s.trim()).filter(s => s.length > 0);
  for (const stmt of statements) {
    db.run(stmt + ';');
  }

  // Save periodically
  setInterval(() => saveDb(), 5000);

  return db;
}

export function saveDb(): void {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbFilePath, buffer);
}

export function getDb(): SqlJsDatabase {
  if (!db) throw new Error('Database not initialized. Call initDb() first.');
  return db;
}

// Helper to run a query and get all results as objects
export function queryAll<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T[] {
  const stmt = getDb().prepare(sql);
  stmt.bind(params as any[]);
  const results: T[] = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject() as T);
  }
  stmt.free();
  return results;
}

// Helper to run a query and get first result
export function queryOne<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T | undefined {
  const results = queryAll<T>(sql, params);
  return results[0];
}

// Helper to run an INSERT/UPDATE/DELETE
export function execute(sql: string, params: unknown[] = []): void {
  getDb().run(sql, params as any[]);
}

// Get last inserted row ID
export function lastInsertRowId(): number {
  const result = queryOne<{ id: number }>('SELECT last_insert_rowid() as id');
  return result?.id ?? 0;
}
