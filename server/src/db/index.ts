/**
 * SQLite connection using Node's built-in `node:sqlite` driver.
 *
 * Why not better-sqlite3? It requires a platform-specific native binary
 * (GitHub-hosted prebuild or a node-gyp toolchain). Node ≥ 22.5 ships a
 * synchronous SQLite driver with the same semantics and zero native deps,
 * which keeps installs reproducible on any machine. Requires Node >= 22.5.
 */
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { config } from '../config';

fs.mkdirSync(path.dirname(config.databasePath), { recursive: true });
fs.mkdirSync(config.uploadsDir, { recursive: true });

export const db = new DatabaseSync(config.databasePath);
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');
db.exec('PRAGMA busy_timeout = 5000');

export interface RunResult {
  changes: number | bigint;
  lastInsertRowid: number | bigint;
}

export function all<T = any>(sql: string, params: Record<string, any> | any[] = []): T[] {
  const stmt = db.prepare(sql);
  return (Array.isArray(params) ? stmt.all(...params) : stmt.all(params)) as T[];
}

export function get<T = any>(sql: string, params: Record<string, any> | any[] = []): T | undefined {
  const stmt = db.prepare(sql);
  return (Array.isArray(params) ? stmt.get(...params) : stmt.get(params)) as T | undefined;
}

export function run(sql: string, params: Record<string, any> | any[] = []): RunResult {
  const stmt = db.prepare(sql);
  return (Array.isArray(params) ? stmt.run(...params) : stmt.run(params)) as RunResult;
}

/** Transaction helper (non-nested). */
export function tx<T>(fn: () => T): T {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

/** Parse a JSON column, falling back to the provided default. */
export function parseJson<T>(value: unknown, fallback: T): T {
  if (value == null || value === '') return fallback;
  try {
    return JSON.parse(value as string) as T;
  } catch {
    return fallback;
  }
}
