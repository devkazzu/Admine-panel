/**
 * RJNX personal website content — single-record blocks (Home, About, YouTube
 * channel) plus featured videos CRUD.
 */
import { Router } from 'express';
import { z } from 'zod';
import { get, run, parseJson } from '../db';
import { notFound } from '../core/errors';
import { nowIso } from '../core/utils';
import { validate } from '../middleware/validate';
import { requirePermission } from '../middleware/auth';
import { logActivity } from '../services/activity';
import { crudRouter } from './crud';
import { httpUrl, mediaPath, text, requiredText, interestsSchema, skillsSchema } from './schemas';

export const websiteRouter = Router();

// ── helpers ──────────────────────────────────────────────────────────────────
function getSingleton(table: string): any {
  const row = get<any>(`SELECT * FROM ${table} WHERE id = 1`);
  if (row && table === 'website_about') {
    return { ...row, interests: parseJson(row.interests, []), skills: parseJson(row.skills, []) };
  }
  return row;
}

function putSingleton(table: string, resource: string) {
  return (req: any, res: any) => {
    const current = getSingleton(table);
    if (!current) throw notFound(`${resource} record missing — run migrations`);
    const data = req.validated.body;
    const keys = Object.keys(data);
    const sets = keys.map((k) => `${k} = @${k}`).join(', ');
    run(`UPDATE ${table} SET ${sets}, updated_at = @__u, updated_by = @__b WHERE id = 1`, {
      ...data,
      __u: nowIso(),
      __b: req.user.id,
    });
    logActivity({
      userId: req.user.id,
      action: 'update',
      resourceType: resource,
      resourceId: 'home',
      details: { fields: keys },
      ip: req.ip,
    });
    res.json({ data: getSingleton(table) });
  };
}

const singleParam = { params: z.object({}) };

// ── HOME ─────────────────────────────────────────────────────────────────────
const homeSchema = z.object({
  hero_title: text(160),
  hero_subtitle: text(200),
  description: text(2000),
  hero_image: mediaPath,
  cta_primary_label: text(60),
  cta_primary_url: httpUrl,
  cta_secondary_label: text(60),
  cta_secondary_url: httpUrl,
});

websiteRouter.get('/home', requirePermission('website_content:read'), (req, res) => {
  res.json({ data: getSingleton('website_home') });
});
websiteRouter.put('/home', requirePermission('website_content:write'), validate({ ...singleParam, body: homeSchema }), putSingleton('website_home', 'website_home'));

// ── ABOUT ────────────────────────────────────────────────────────────────────
const aboutSchema = z.object({
  biography: text(5000),
  profile_image: mediaPath,
  interests: interestsSchema,
  skills: skillsSchema,
});

websiteRouter.get('/about', requirePermission('website_content:read'), (req, res) => {
  res.json({ data: getSingleton('website_about') });
});
websiteRouter.put('/about', requirePermission('website_content:write'), validate({ ...singleParam, body: aboutSchema }), putSingleton('website_about', 'website_about'));

// ── YOUTUBE CHANNEL ──────────────────────────────────────────────────────────
const youtubeSchema = z.object({
  channel_url: httpUrl.refine((v) => v === '' || /youtube\.com|youtu\.be/i.test(v), 'Enter a valid YouTube channel URL'),
  channel_description: text(1000),
});

websiteRouter.get('/youtube', requirePermission('website_content:read'), (req, res) => {
  res.json({ data: getSingleton('youtube_channel') });
});
websiteRouter.put('/youtube', requirePermission('website_content:write'), validate({ ...singleParam, body: youtubeSchema }), putSingleton('youtube_channel', 'youtube_channel'));

// ── FEATURED VIDEOS ──────────────────────────────────────────────────────────
const youtubeVideoUrl = z
  .string()
  .trim()
  .min(5)
  .max(200)
  .refine(
    (v) => /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\/\S+$/i.test(v) || /^[A-Za-z0-9_-]{11}$/.test(v),
    'Enter a YouTube video URL or 11-character video ID',
  );

const videoCreate = z.object({
  title: requiredText(140, 'Title'),
  url: youtubeVideoUrl,
  sort_order: z.coerce.number().int().min(0).max(999).default(0),
});

websiteRouter.use(
  '/youtube/videos',
  crudRouter({
    table: 'featured_videos',
    resource: 'videos',
    createSchema: videoCreate,
    updateSchema: videoCreate.partial(),
    searchFields: ['title', 'url'],
    defaultOrder: 'sort_order ASC, id DESC',
  }),
);
