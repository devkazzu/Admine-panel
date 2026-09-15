/**
 * Centralized site settings — grouped key/value store.
 * Groups: general (brand), seo (defaults), contact (public contact info).
 * Real contact information is never invented — empty until an admin sets it.
 */
import { Router } from 'express';
import { z } from 'zod';
import { get, run } from '../db';
import { nowIso } from '../core/utils';
import { validate } from '../middleware/validate';
import { requirePermission } from '../middleware/auth';
import { logActivity } from '../services/activity';
import { mediaPath, text } from './schemas';

export const settingsRouter = Router();

const GROUPS: Record<string, { keys: string[]; schema: z.ZodTypeAny }> = {
  general: {
    keys: ['site_name', 'site_description', 'site_logo', 'site_favicon'],
    schema: z.object({
      site_name: z.string().trim().min(1, 'Site name is required').max(80),
      site_description: text(300),
      site_logo: mediaPath,
      site_favicon: mediaPath,
    }),
  },
  seo: {
    keys: ['seo_title', 'seo_description', 'seo_og_image'],
    schema: z.object({
      seo_title: z.string().trim().min(1, 'Default title is required').max(120),
      seo_description: text(300),
      seo_og_image: mediaPath,
    }),
  },
  contact: {
    keys: ['contact_email', 'contact_discord', 'contact_other'],
    schema: z.object({
      contact_email: z.union([z.literal(''), z.string().trim().email('Enter a valid email')]),
      contact_discord: text(100),
      contact_other: text(500),
    }),
  },
};

const readAll = () => {
  const out: Record<string, Record<string, string>> = { general: {}, seo: {}, contact: {} };
  for (const [group, def] of Object.entries(GROUPS)) {
    for (const key of def.keys) {
      out[group][key] = get<{ value: string }>('SELECT value FROM settings WHERE key = ?', [key])?.value ?? '';
    }
  }
  return out;
};

settingsRouter.get('/', requirePermission('settings:read'), (req, res) => {
  res.json({ data: readAll() });
});

settingsRouter.put(
  '/:group',
  requirePermission('settings:write'),
  validate({ params: z.object({ group: z.enum(['general', 'seo', 'contact']) }), body: z.object({}).passthrough() }),
  (req, res, next) => {
    const group = req.validated.params.group;
    const def = GROUPS[group];
    const parsed = def.schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(422).json({
        error: {
          message: 'Validation failed',
          code: 'validation_error',
          details: parsed.error.issues.map((i) => ({ path: i.path.map(String), message: i.message })),
        },
      });
    }
    const data = parsed.data as Record<string, string>;
    for (const [key, value] of Object.entries(data)) {
      run(
        `INSERT INTO settings (key, value, updated_at, updated_by) VALUES (?, ?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at, updated_by = excluded.updated_by`,
        [key, value, nowIso(), req.user!.id],
      );
    }
    logActivity({
      userId: req.user!.id,
      action: 'settings_update',
      resourceType: 'settings',
      resourceId: group,
      details: { keys: Object.keys(data) },
      ip: req.ip,
    });
    res.json({ data: readAll() });
  },
);
