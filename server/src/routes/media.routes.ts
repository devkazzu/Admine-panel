/**
 * Media library — upload (auto-optimized), browse, search, meta editing,
 * copy-URL and safe deletion (blocked while content still references a file).
 *
 * Image optimization: every upload is resized to at most 1920px and converted
 * to WebP (~82 quality) by sharp; a 480px thumbnail is generated for grids.
 * Animated GIFs are kept as-is to preserve animation.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { Router } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import { z } from 'zod';
import { config } from '../config';
import { all, get, run } from '../db';
import { AppError, notFound, conflict } from '../core/errors';
import { asyncHandler, nowIso, escapeLike } from '../core/utils';
import { validate } from '../middleware/validate';
import { requirePermission } from '../middleware/auth';
import { listQuerySchema, pageMeta, offset } from '../core/pagination';
import { logActivity } from '../services/activity';
import { findMediaReferences, absoluteUrl } from '../services/mediaRefs';
import { zodId } from './crud';

export const mediaRouter = Router();

const ALLOWED_MIME = /^image\/(jpeg|png|webp|gif|avif)$/i;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.maxUploadBytes, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME.test(file.mimetype)) {
      return cb(new AppError(415, 'Only image files are allowed (JPEG, PNG, WebP, GIF, AVIF)', 'unsupported_media'));
    }
    cb(null, true);
  },
});

const serialize = (row: any) => ({
  ...row,
  url: absoluteUrl(row.path),
  thumb_url: row.thumb_path ? absoluteUrl(row.thumb_path) : absoluteUrl(row.path),
});

// ── LIST ─────────────────────────────────────────────────────────────────────
const listSchema = listQuerySchema.extend({ format: z.string().trim().max(10).optional() });

mediaRouter.get('/', requirePermission('media:read'), validate({ query: listSchema }), (req, res) => {
  const q = req.validated.query as any;
  const where: string[] = [];
  const params: Record<string, any> = {};
  if (q.q) {
    where.push(`(original_name LIKE @q ESCAPE '\\' OR alt_text LIKE @q ESCAPE '\\' OR filename LIKE @q ESCAPE '\\')`);
    params.q = `%${escapeLike(q.q)}%`;
  }
  if (q.format) {
    where.push('format = @format');
    params.format = q.format;
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = (get<{ c: number }>(`SELECT COUNT(*) c FROM media ${whereSql}`, params) ?? { c: 0 }).c;
  const rows = all(
    `SELECT * FROM media ${whereSql} ORDER BY created_at DESC LIMIT @limit OFFSET @offset`,
    { ...params, limit: q.perPage, offset: offset(q) },
  );
  res.json({ data: rows.map(serialize), meta: pageMeta(q.page, q.perPage, total) });
});

// ── UPLOAD ──────────────────────────────────────────────────────────────────
mediaRouter.post(
  '/',
  requirePermission('media:write'),
  upload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new AppError(400, 'No file uploaded (field name must be "file")', 'bad_request');

    const original = req.file;
    const id = crypto.randomUUID();
    const now = new Date();
    const relDir = path.posix.join('media', String(now.getFullYear()), String(now.getMonth() + 1).padStart(2, '0'));
    const absDir = path.join(config.uploadsDir, relDir);
    fs.mkdirSync(absDir, { recursive: true });

    const meta = await sharp(original.buffer).metadata();
    if (!meta.width || !meta.height) {
      throw new AppError(422, 'This file is not a valid image', 'invalid_image');
    }

    const isGif = meta.format === 'gif';
    const fullExt = isGif ? 'gif' : 'webp';

    // Optimized full-size image (max 1920px, WebP q82). GIFs kept as-is.
    const fullBuf = isGif
      ? original.buffer
      : await sharp(original.buffer)
          .rotate()
          .resize({ width: 1920, height: 1920, fit: 'inside', withoutEnlargement: true })
          .webp({ quality: 82 })
          .toBuffer();

    // Small thumbnail for grids/pickers.
    const thumbBuf = await sharp(original.buffer, isGif ? { pages: 1 } : undefined)
      .rotate()
      .resize({ width: 480, height: 480, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 75 })
      .toBuffer();

    const fullRel = `/uploads/${relDir}/${id}.${fullExt}`;
    const thumbRel = `/uploads/${relDir}/t_${id}.webp`;
    fs.writeFileSync(path.join(config.uploadsDir, relDir, `${id}.${fullExt}`), fullBuf);
    fs.writeFileSync(path.join(config.uploadsDir, relDir, `t_${id}.webp`), thumbBuf);

    const outMeta = await sharp(fullBuf, isGif ? { pages: 1 } : undefined).metadata();
    const safeName = path
      .basename(original.originalname || 'upload')
      .replace(/[^a-zA-Z0-9._ -]/g, '')
      .slice(0, 120);

    const info = run(
      `INSERT INTO media (filename, original_name, path, thumb_path, mime, format, size, width, height, alt_text, folder, uploaded_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        safeName,
        fullRel,
        thumbRel,
        isGif ? 'image/gif' : 'image/webp',
        fullExt,
        fullBuf.length,
        outMeta.width ?? meta.width,
        outMeta.height ?? meta.height,
        '',
        '',
        req.user!.id,
        nowIso(),
        nowIso(),
      ],
    );

    const row = get<any>('SELECT * FROM media WHERE id = ?', [Number(info.lastInsertRowid)]);
    logActivity({
      userId: req.user!.id,
      action: 'media_upload',
      resourceType: 'media',
      resourceId: String(info.lastInsertRowid),
      details: { file: safeName, size: fullBuf.length },
      ip: req.ip,
    });
    res.status(201).json({ data: serialize(row) });
  }),
);

// ── READ ONE ────────────────────────────────────────────────────────────────
mediaRouter.get('/:id', requirePermission('media:read'), validate({ params: zodId }), (req, res) => {
  const row = get<any>('SELECT * FROM media WHERE id = ?', [req.validated.params.id]);
  if (!row) throw notFound('Media not found');
  res.json({ data: serialize(row) });
});

// ── UPDATE META ─────────────────────────────────────────────────────────────
const metaSchema = z.object({
  alt_text: z.string().trim().max(200).optional(),
  original_name: z.string().trim().min(1).max(120).optional(),
  folder: z.string().trim().max(60).optional(),
});

mediaRouter.patch('/:id', requirePermission('media:write'), validate({ params: zodId, body: metaSchema }), (req, res) => {
  const id = req.validated.params.id;
  if (!get('SELECT id FROM media WHERE id = ?', [id])) throw notFound('Media not found');
  const data = req.validated.body;
  const keys = Object.keys(data);
  if (keys.length) {
    const sets = keys.map((k) => `${k} = @${k}`).join(', ');
    run(`UPDATE media SET ${sets}, updated_at = @__u WHERE id = @__id`, { ...data, __u: nowIso(), __id: id });
  }
  logActivity({ userId: req.user!.id, action: 'update', resourceType: 'media', resourceId: String(id), details: { fields: keys }, ip: req.ip });
  res.json({ data: serialize(get<any>('SELECT * FROM media WHERE id = ?', [id])) });
});

// ── REFERENCES (used by the UI to explain why deletion is blocked) ──────────
mediaRouter.get('/:id/references', requirePermission('media:write'), validate({ params: zodId }), (req, res) => {
  const row = get<any>('SELECT * FROM media WHERE id = ?', [req.validated.params.id]);
  if (!row) throw notFound('Media not found');
  res.json({ data: findMediaReferences(row.id, row.path) });
});

// ── DELETE ──────────────────────────────────────────────────────────────────
mediaRouter.delete('/:id', requirePermission('media:write'), validate({ params: zodId }), (req, res) => {
  const id = req.validated.params.id;
  const row = get<any>('SELECT * FROM media WHERE id = ?', [id]);
  if (!row) throw notFound('Media not found');

  const refs = findMediaReferences(id, row.path);
  if (refs.length > 0) {
    throw conflict(
      'This image is still in use — remove it from the content below first',
      refs.map((r) => `${r.resource}${r.label ? ` "${r.label}"` : ''}${r.id ? ` (#${r.id})` : ''}`),
    );
  }

  for (const p of [row.path, row.thumb_path]) {
    if (!p) continue;
    const abs = path.join(config.uploadsDir, p.replace(/^\/uploads\//, ''));
    try {
      fs.unlinkSync(abs);
    } catch {
      /* file may already be gone */
    }
  }
  run('DELETE FROM media WHERE id = ?', [id]);
  logActivity({ userId: req.user!.id, action: 'media_delete', resourceType: 'media', resourceId: String(id), details: { file: row.original_name }, ip: req.ip });
  res.status(204).send();
});
