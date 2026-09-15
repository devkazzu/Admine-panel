import crypto from 'node:crypto';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { get as getRow } from '../db/index';

/** Wrap an async handler so rejections reach the error middleware. */
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

export const nowIso = () => new Date().toISOString();

export const sha256 = (value: string) => crypto.createHash('sha256').update(value).digest('hex');

export const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString('hex');

/** Escape %/_ in LIKE patterns so user input can't widen the search. */
export const escapeLike = (value: string) => value.replace(/[\\%_]/g, (c) => `\\${c}`);

/** URL-safe slug. */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/** Ensure a slug is unique within a table (appends -2, -3, …). */
export function uniqueSlug(base: string, table: string, excludeId?: number): string {
  const clean = slugify(base) || 'item';
  let candidate = clean;
  let n = 2;
  for (;;) {
    const row = excludeId
      ? getRow(`SELECT id FROM ${table} WHERE slug = ? AND id != ?`, [candidate, excludeId])
      : getRow(`SELECT id FROM ${table} WHERE slug = ?`, [candidate]);
    if (!row) return candidate;
    candidate = `${clean}-${n++}`;
  }
}

/** Human file size. */
export const formatBytes = (bytes: number): string => {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
};

/** Strip markdown to a plain-text excerpt (for public news listings). */
export function excerpt(markdown: string, max = 180): string {
  const text = markdown
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_`~\-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;
}
