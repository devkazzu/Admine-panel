/**
 * News / articles — draft → published → archived workflow, Markdown content,
 * SEO fields, slug management and one-click publish/unpublish.
 */
import { Router } from 'express';
import { z } from 'zod';
import { get, run } from '../db';
import { AppError, notFound } from '../core/errors';
import { nowIso, uniqueSlug } from '../core/utils';
import { validate } from '../middleware/validate';
import { requirePermission } from '../middleware/auth';
import { logActivity } from '../services/activity';
import { crudRouter, zodId } from './crud';
import { mediaPath, text, requiredText, isoDateTime } from './schemas';

export const newsRouter = Router();

const newsSchema = z.object({
  title: requiredText(200, 'Title'),
  slug: z.string().trim().max(90).regex(/^[a-z0-9-]*$/, 'Slug can only contain lowercase letters, numbers and dashes').default(''),
  cover_image: mediaPath,
  category: text(60),
  author: text(80),
  content: z.string().max(100000).default(''),
  published_at: isoDateTime.nullable().default(null),
  seo_title: text(200),
  seo_description: text(300),
  status: z.enum(['draft', 'published', 'archived']).default('draft'),
});

newsRouter.use(
  '/',
  crudRouter({
    table: 'news',
    resource: 'news',
    createSchema: newsSchema,
    updateSchema: newsSchema.partial(),
    searchFields: ['title', 'slug', 'category', 'author'],
    filterFields: ['status', 'category'],
    defaultOrder: `COALESCE(published_at, created_at) DESC`,
    beforeCreate: (data, req) => {
      data.slug = uniqueSlug(data.slug || data.title, 'news');
      if (!data.author) data.author = req.user!.name;
      if (data.status === 'published' && !data.published_at) data.published_at = nowIso();
      data.created_by = req.user!.id;
    },
    beforeUpdate: (data, current) => {
      if (data.slug !== undefined) data.slug = uniqueSlug(data.slug || current.title, 'news', current.id);
      if (data.status === 'published' && !current.published_at && !data.published_at) {
        data.published_at = nowIso();
      }
    },
  }),
);

// One-click publish — PATCH /:id/publish
newsRouter.patch(
  '/:id/publish',
  requirePermission('news:write'),
  validate({ params: zodId }),
  (req, res) => {
    const id = req.validated.params.id;
    const current = get<any>('SELECT * FROM news WHERE id = ?', [id]);
    if (!current) throw notFound('Article not found');
    if (current.status === 'published') throw new AppError(409, 'Article is already published', 'conflict');
    run('UPDATE news SET status = ?, published_at = COALESCE(published_at, ?), updated_at = ? WHERE id = ?', [
      'published',
      nowIso(),
      nowIso(),
      id,
    ]);
    logActivity({ userId: req.user!.id, action: 'publish', resourceType: 'news', resourceId: String(id), details: { title: current.title }, ip: req.ip });
    res.json({ data: get<any>('SELECT * FROM news WHERE id = ?', [id]) });
  },
);

// One-click unpublish — PATCH /:id/unpublish
newsRouter.patch(
  '/:id/unpublish',
  requirePermission('news:write'),
  validate({ params: zodId }),
  (req, res) => {
    const id = req.validated.params.id;
    const current = get<any>('SELECT * FROM news WHERE id = ?', [id]);
    if (!current) throw notFound('Article not found');
    if (current.status !== 'published') throw new AppError(409, 'Article is not published', 'conflict');
    run('UPDATE news SET status = ?, updated_at = ? WHERE id = ?', ['draft', nowIso(), id]);
    logActivity({ userId: req.user!.id, action: 'unpublish', resourceType: 'news', resourceId: String(id), details: { title: current.title }, ip: req.ip });
    res.json({ data: get<any>('SELECT * FROM news WHERE id = ?', [id]) });
  },
);
