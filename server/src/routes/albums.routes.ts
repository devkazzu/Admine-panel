/**
 * Esports media gallery — albums that reference media library items
 * (no duplicated files). Images are managed as an ordered set per album.
 */
import { Router } from 'express';
import { z } from 'zod';
import { all, get, run, tx } from '../db';
import { notFound, unprocessable } from '../core/errors';
import { nowIso, uniqueSlug } from '../core/utils';
import { validate } from '../middleware/validate';
import { requirePermission } from '../middleware/auth';
import { logActivity } from '../services/activity';
import { crudRouter, zodId } from './crud';
import { optionalIsoDate, text, requiredText } from './schemas';
import { absoluteUrl } from '../services/mediaRefs';

export const albumsRouter = Router();

const albumSchema = z.object({
  title: requiredText(140, 'Album title'),
  slug: z.string().trim().max(90).regex(/^[a-z0-9-]*$/, 'Slug can only contain lowercase letters, numbers and dashes').default(''),
  description: text(1000),
  event_date: optionalIsoDate,
  status: z.enum(['draft', 'published']).default('draft'),
});

const withImages = (album: any) => {
  if (!album) return album;
  const images = all<any>(
    `SELECT i.media_id AS id, i.caption, i.sort_order, m.filename, m.path, m.mime, m.alt_text, m.width, m.height
     FROM media_album_images i JOIN media m ON m.id = i.media_id
     WHERE i.album_id = ? ORDER BY i.sort_order ASC, i.media_id ASC`,
    [album.id],
  );
  return { ...album, images: images.map((img) => ({ ...img, url: absoluteUrl(img.path) })) };
};

const withCounts = (album: any) => ({
  ...album,
  image_count: (get<{ c: number }>('SELECT COUNT(*) c FROM media_album_images WHERE album_id = ?', [album.id]) ?? { c: 0 }).c,
});

albumsRouter.use(
  '/',
  crudRouter({
    table: 'media_albums',
    resource: 'media_albums',
    createSchema: albumSchema,
    updateSchema: albumSchema.partial(),
    searchFields: ['title', 'description'],
    filterFields: ['status'],
    defaultOrder: 'event_date DESC, id DESC',
    beforeCreate: (data) => {
      data.slug = uniqueSlug(data.slug || data.title, 'media_albums');
    },
    beforeUpdate: (data, current) => {
      if (data.slug !== undefined) data.slug = uniqueSlug(data.slug || current.title, 'media_albums', current.id);
    },
    transformOut: withCounts,
  }),
);

// Full album (with images) — GET /:id/full
albumsRouter.get('/:id/full', requirePermission('media_albums:read'), validate({ params: zodId }), (req, res) => {
  const album = get<any>('SELECT * FROM media_albums WHERE id = ?', [req.validated.params.id]);
  if (!album) throw notFound('Album not found');
  res.json({ data: withImages(album) });
});

// Replace the album's image set — PUT /:id/images
const imagesSchema = z.object({
  images: z
    .array(
      z.object({
        media_id: z.coerce.number().int().positive(),
        caption: text(200),
        sort_order: z.coerce.number().int().min(0).max(999).default(0),
      }),
    )
    .max(200, 'An album can hold at most 200 images'),
});

albumsRouter.put(
  '/:id/images',
  requirePermission('media_albums:write'),
  validate({ params: zodId, body: imagesSchema }),
  (req, res) => {
    const id = req.validated.params.id;
    const album = get<any>('SELECT * FROM media_albums WHERE id = ?', [id]);
    if (!album) throw notFound('Album not found');

    const { images } = req.validated.body;
    for (const img of images) {
      if (!get('SELECT id FROM media WHERE id = ?', [img.media_id])) {
        throw unprocessable(`Media #${img.media_id} does not exist in the library`);
      }
    }

    tx(() => {
      run('DELETE FROM media_album_images WHERE album_id = ?', [id]);
      for (const img of images) {
        run(
          'INSERT INTO media_album_images (album_id, media_id, caption, sort_order) VALUES (?, ?, ?, ?)',
          [id, img.media_id, img.caption, img.sort_order],
        );
      }
      run('UPDATE media_albums SET updated_at = ? WHERE id = ?', [nowIso(), id]);
    });

    logActivity({
      userId: req.user!.id,
      action: 'update',
      resourceType: 'media_albums',
      resourceId: String(id),
      details: { title: album.title, images: images.length },
      ip: req.ip,
    });
    res.json({ data: withImages(get<any>('SELECT * FROM media_albums WHERE id = ?', [id])) });
  },
);
