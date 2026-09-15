/**
 * PUBLIC CONTENT API — consumed by the two public websites.
 *
 *   RJNX personal site  →  /api/public/website/*
 *   RJNX Esports site   →  /api/public/esports/*
 *
 * Rules:
 *  - No authentication: only PUBLISHED / ACTIVE content is ever returned.
 *  - Admin fields (ids of drafts, password hashes, internal notes…) never leak.
 *  - CORS is enabled for the origins configured in PUBLIC_API_ORIGINS.
 *  - Cross-site POSTs (contact form, applications) are validated, honeypotted
 *    and rate-limited.
 *
 * Any change an admin makes here appears on the public sites immediately —
 * the public sites read these endpoints live (see docs/API.md for caching tips).
 */
import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import { config } from '../config';
import { all, get, run, parseJson } from '../db';
import { AppError } from '../core/errors';
import { validate } from '../middleware/validate';
import { rateLimit } from '../middleware/rateLimit';
import { absoluteUrl } from '../services/mediaRefs';
import { excerpt } from '../core/utils';

export const publicRouter = Router();

// ── CORS for public endpoints ────────────────────────────────────────────────
export const publicCors: RequestHandler = (req, res, next) => {
  const origin = req.get('origin');
  const allow = config.publicApiOrigins;
  if (allow === '*') {
    res.set('Access-Control-Allow-Origin', '*');
  } else if (origin && allow.includes(origin)) {
    res.set('Access-Control-Allow-Origin', origin);
    res.set('Vary', 'Origin');
  }
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  res.set('Access-Control-Max-Age', '600');
  if (req.method === 'OPTIONS') return res.status(204).send();
  next();
};

const cacheShort: RequestHandler = (_req, res, next) => {
  res.set('Cache-Control', 'public, max-age=30');
  next();
};
publicRouter.use(cacheShort);

// ── helpers ──────────────────────────────────────────────────────────────────
const publicSocials = () =>
  all<any>(
    `SELECT platform, url, label FROM social_links
     WHERE owner_type = 'site' AND owner_id = 0 AND is_active = 1 AND url != ''
     ORDER BY sort_order ASC, id ASC`,
  );

// ═════════════════════════════════════════════════════════════════════════════
// RJNX PERSONAL WEBSITE
// ═════════════════════════════════════════════════════════════════════════════

/** Everything the personal site needs for Home + About + footer in one call. */
publicRouter.get('/website/content', (req, res) => {
  const home = get<any>(`SELECT hero_title, hero_subtitle, description, hero_image,
    cta_primary_label, cta_primary_url, cta_secondary_label, cta_secondary_url, updated_at
    FROM website_home WHERE id = 1`);
  const about = get<any>(`SELECT biography, profile_image, updated_at FROM website_about WHERE id = 1`);
  res.json({
    data: {
      home: home
        ? {
            ...home,
            hero_image: absoluteUrl(home.hero_image),
          }
        : null,
      about: about
        ? { ...about, profile_image: absoluteUrl(about.profile_image) }
        : null,
      socials: publicSocials(),
    },
  });
});

/** Home section only. */
publicRouter.get('/website/home', (req, res) => {
  const home = get<any>(`SELECT * FROM website_home WHERE id = 1`);
  res.json({ data: home ? { ...home, hero_image: absoluteUrl(home.hero_image) } : null });
});

/** About section with interests + skills. */
publicRouter.get('/website/about', (req, res) => {
  const about = get<any>(`SELECT * FROM website_about WHERE id = 1`);
  res.json({
    data: about
      ? {
          ...about,
          profile_image: absoluteUrl(about.profile_image),
          interests: parseJson(about.interests, []),
          skills: parseJson(about.skills, []),
        }
      : null,
  });
});

/** Published projects only (featured first). */
publicRouter.get('/website/projects', (req, res) => {
  const rows = all<any>(
    `SELECT id, name, slug, description, image, github_url, live_url, technologies, featured, sort_order
     FROM projects WHERE status = 'published'
     ORDER BY featured DESC, sort_order ASC, id DESC`,
  );
  res.json({
    data: rows.map((r) => ({ ...r, image: absoluteUrl(r.image), technologies: parseJson(r.technologies, []) })),
  });
});

/** YouTube channel + featured videos. No statistics are invented. */
publicRouter.get('/website/youtube', (req, res) => {
  const channel = get<any>(`SELECT channel_url, channel_description, updated_at FROM youtube_channel WHERE id = 1`);
  const videos = all<any>(`SELECT id, title, url, sort_order FROM featured_videos ORDER BY sort_order ASC, id DESC`);
  res.json({ data: { channel: channel ?? null, featured_videos: videos } });
});

/** Active social links — unconfigured platforms simply don't appear. */
publicRouter.get('/website/socials', (req, res) => {
  res.json({ data: publicSocials() });
});

// ═════════════════════════════════════════════════════════════════════════════
// RJNX ESPORTS WEBSITE
// ═════════════════════════════════════════════════════════════════════════════

const publicTeamsQuery = `SELECT id, name, slug, game, logo, description, status, socials, sort_order
  FROM teams WHERE status IN ('active','recruiting')`;

const serializeTeam = (t: any) => ({
  ...t,
  logo: absoluteUrl(t.logo),
  socials: parseJson(t.socials, {}),
});

/** Teams (active + recruiting), each with its current players. */
publicRouter.get('/esports/teams', (req, res) => {
  const teams = all<any>(`${publicTeamsQuery} ORDER BY sort_order ASC, id ASC`).map(serializeTeam);
  const players = all<any>(
    `SELECT id, gamer_tag, real_name, image, game, team_id, role, country, socials, stats
     FROM players WHERE status = 'active' ORDER BY sort_order ASC, gamer_tag ASC`,
  );
  const byTeam = new Map<number, any[]>();
  for (const p of players) {
    const serialized = {
      ...p,
      image: absoluteUrl(p.image),
      socials: parseJson(p.socials, {}),
      stats: parseJson(p.stats, []),
    };
    if (p.team_id != null) {
      if (!byTeam.has(p.team_id)) byTeam.set(p.team_id, []);
      byTeam.get(p.team_id)!.push(serialized);
    }
  }
  res.json({ data: teams.map((t) => ({ ...t, players: byTeam.get(t.id) ?? [] })) });
});

publicRouter.get('/esports/teams/:slug', (req, res) => {
  const team = get<any>(`${publicTeamsQuery} AND slug = ?`, [req.params.slug]);
  if (!team) throw new AppError(404, 'Team not found', 'not_found');
  const players = all<any>(
    `SELECT id, gamer_tag, real_name, image, game, role, country, socials, stats FROM players
     WHERE team_id = ? AND status = 'active' ORDER BY sort_order ASC, gamer_tag ASC`,
    [team.id],
  );
  res.json({
    data: {
      ...serializeTeam(team),
      players: players.map((p) => ({
        ...p,
        image: absoluteUrl(p.image),
        socials: parseJson(p.socials, {}),
        stats: parseJson(p.stats, []),
      })),
    },
  });
});

/** Active players across all teams. */
publicRouter.get('/esports/players', (req, res) => {
  const rows = all<any>(
    `SELECT p.id, p.gamer_tag, p.real_name, p.image, p.game, p.role, p.country, p.socials, p.stats, p.sort_order,
            t.name AS team_name, t.slug AS team_slug
     FROM players p LEFT JOIN teams t ON t.id = p.team_id
     WHERE p.status = 'active' ORDER BY p.sort_order ASC, p.gamer_tag ASC`,
  );
  res.json({
    data: rows.map((p) => ({
      ...p,
      image: absoluteUrl(p.image),
      socials: parseJson(p.socials, {}),
      stats: parseJson(p.stats, []),
    })),
  });
});

/** Matches — ?status=upcoming|live|completed|cancelled (default: upcoming+live). */
publicRouter.get('/esports/matches', (req, res) => {
  const status = typeof req.query.status === 'string' ? req.query.status : '';
  const allowed = ['upcoming', 'live', 'completed', 'cancelled'];
  if (status && !allowed.includes(status)) {
    throw new AppError(400, `status must be one of: ${allowed.join(', ')}`, 'bad_request');
  }
  const where = status ? `m.status = @s` : `m.status IN ('upcoming','live')`;
  const order = status === 'completed' || status === 'cancelled' ? 'm.starts_at DESC' : 'm.starts_at ASC';
  const rows = all<any>(
    `SELECT m.id, m.team_id, m.opponent_name, m.opponent_logo, m.game, m.starts_at, m.stream_url,
            m.our_score, m.opponent_score, m.result, m.status, m.notes,
            t.name AS team_name, t.slug AS team_slug, t.logo AS team_logo, tn.name AS tournament_name
     FROM matches m
     LEFT JOIN teams t ON t.id = m.team_id
     LEFT JOIN tournaments tn ON tn.id = m.tournament_id
     WHERE ${where} ORDER BY ${order} LIMIT 100`,
    status ? { s: status } : {},
  );
  res.json({ data: rows.map((m) => ({ ...m, opponent_logo: absoluteUrl(m.opponent_logo), team_logo: absoluteUrl(m.team_logo) })) });
});

/** Completed results (newest first) + cancelled. */
publicRouter.get('/esports/results', (req, res) => {
  const rows = all<any>(
    `SELECT m.id, m.team_id, m.opponent_name, m.opponent_logo, m.game, m.starts_at, m.our_score,
            m.opponent_score, m.result, m.status, m.notes,
            t.name AS team_name, t.slug AS team_slug, tn.name AS tournament_name
     FROM matches m
     LEFT JOIN teams t ON t.id = m.team_id
     LEFT JOIN tournaments tn ON tn.id = m.tournament_id
     WHERE m.status IN ('completed','cancelled')
     ORDER BY m.starts_at DESC LIMIT 200`,
  );
  res.json({ data: rows.map((m) => ({ ...m, opponent_logo: absoluteUrl(m.opponent_logo) })) });
});

publicRouter.get('/esports/tournaments', (req, res) => {
  const rows = all<any>(
    `SELECT id, name, game, organizer, start_date, end_date, location, is_online, prize_pool, description, status, result
     FROM tournaments ORDER BY start_date DESC LIMIT 200`,
  );
  res.json({ data: rows });
});

publicRouter.get('/esports/achievements', (req, res) => {
  const rows = all<any>(
    `SELECT id, title, description, game, tournament, date, position, image
     FROM achievements ORDER BY date DESC, sort_order ASC LIMIT 200`,
  );
  res.json({ data: rows.map((a) => ({ ...a, image: absoluteUrl(a.image) })) });
});

/** Published news — listing (with excerpt) and full article by slug. */
publicRouter.get('/esports/news', (req, res) => {
  const category = typeof req.query.category === 'string' ? req.query.category : '';
  const limitRaw = typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) : 50;
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 50) : 50;
  const where = [`status = 'published'`, `(published_at IS NULL OR published_at <= @now)`];
  const params: Record<string, any> = { now: new Date().toISOString(), limit };
  if (category) {
    where.push('category = @cat');
    params.cat = category;
  }
  const rows = all<any>(
    `SELECT id, title, slug, cover_image, category, author, published_at, seo_title, seo_description, content
     FROM news WHERE ${where.join(' AND ')}
     ORDER BY published_at DESC LIMIT @limit`,
    params,
  );
  res.json({
    data: rows.map((n) => ({
      id: n.id,
      title: n.title,
      slug: n.slug,
      cover_image: absoluteUrl(n.cover_image),
      category: n.category,
      author: n.author,
      published_at: n.published_at,
      seo_title: n.seo_title || n.title,
      seo_description: n.seo_description || excerpt(n.content),
      excerpt: excerpt(n.content),
    })),
  });
});

publicRouter.get('/esports/news/:slug', (req, res) => {
  const row = get<any>(
    `SELECT id, title, slug, cover_image, category, author, content, published_at, seo_title, seo_description
     FROM news WHERE slug = ? AND status = 'published'`,
    [req.params.slug],
  );
  if (!row) throw new AppError(404, 'Article not found', 'not_found');
  res.json({ data: { ...row, cover_image: absoluteUrl(row.cover_image) } });
});

/** Published media albums (gallery) with their images. */
publicRouter.get('/esports/media', (req, res) => {
  const albums = all<any>(`SELECT id, title, slug, description, event_date FROM media_albums WHERE status = 'published' ORDER BY event_date DESC, id DESC`);
  const out = albums.map((a) => {
    const images = all<any>(
      `SELECT i.media_id AS id, i.caption, m.path, m.alt_text, m.width, m.height
       FROM media_album_images i JOIN media m ON m.id = i.media_id
       WHERE i.album_id = ? ORDER BY i.sort_order ASC, i.media_id ASC`,
      [a.id],
    );
    return { ...a, images: images.map((i) => ({ id: i.id, caption: i.caption, url: absoluteUrl(i.path), alt: i.alt_text, width: i.width, height: i.height })) };
  });
  res.json({ data: out });
});

/** Open recruitment openings (deadline not passed). */
publicRouter.get('/esports/recruitment', (req, res) => {
  const rows = all<any>(
    `SELECT id, position, game, role, description, requirements, deadline
     FROM recruitment_openings
     WHERE status = 'open' AND (deadline IS NULL OR deadline >= date('now'))
     ORDER BY created_at DESC`,
  );
  res.json({ data: rows });
});

/** Public settings subset (brand, SEO defaults, configured contact info). */
publicRouter.get('/settings', (req, res) => {
  const keys = ['site_name', 'site_description', 'seo_title', 'seo_description', 'contact_email', 'contact_discord', 'contact_other'];
  const out: Record<string, string> = {};
  for (const k of keys) {
    const v = get<{ value: string }>('SELECT value FROM settings WHERE key = ?', [k])?.value ?? '';
    if (v !== '') out[k] = v;
  }
  const og = get<{ value: string }>('SELECT value FROM settings WHERE key = ?', ['seo_og_image'])?.value ?? '';
  if (og) out.seo_og_image = absoluteUrl(og);
  res.json({ data: out });
});

// ── Public submissions (from the public websites) ────────────────────────────
const submitLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 10, prefix: 'public-submit' });

const contactSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  email: z.string().trim().email('A valid email is required').max(200),
  subject: z.string().trim().max(200).default(''),
  message: z.string().trim().min(1, 'Message is required').max(5000),
  website: z.string().max(0).optional().default(''), // honeypot — must stay empty
});

publicRouter.post('/contact', submitLimiter, validate({ body: contactSchema }), (req, res) => {
  const { name, email, subject, message } = req.validated.body;
  const info = run(
    `INSERT INTO contact_messages (name, email, subject, message, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'unread', datetime('now'), datetime('now'))`,
    [name, email, subject, message],
  );
  res.status(201).json({ data: { id: Number(info.lastInsertRowid), received: true } });
});

const applicationSchema = z.object({
  opening_id: z.coerce.number().int().positive().nullable().optional(),
  name: z.string().trim().min(1, 'Name is required').max(120),
  gamer_tag: z.string().trim().min(1, 'Gamer tag is required').max(40),
  email: z.string().trim().email('A valid email is required').max(200),
  age: z.coerce.number().int().min(13, 'You must be at least 13').max(99).nullable().optional(),
  game: z.string().trim().max(60).default(''),
  role: z.string().trim().max(60).default(''),
  experience: z.string().trim().max(2000).default(''),
  profile_link: z.string().trim().max(300).default(''),
  message: z.string().trim().max(5000).default(''),
  website: z.string().max(0).optional().default(''), // honeypot
});

publicRouter.post('/applications', submitLimiter, validate({ body: applicationSchema }), (req, res) => {
  const data = req.validated.body;
  let openingId: number | null = null;
  if (data.opening_id) {
    const opening = get<{ id: number }>(
      `SELECT id FROM recruitment_openings WHERE id = ? AND status = 'open' AND (deadline IS NULL OR deadline >= date('now'))`,
      [data.opening_id],
    );
    if (!opening) {
      throw new AppError(422, 'This recruitment opening is closed or does not exist', 'validation_error');
    }
    openingId = opening.id;
  }
  const info = run(
    `INSERT INTO applications (opening_id, name, gamer_tag, email, age, game, role, experience, profile_link, message, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', datetime('now'), datetime('now'))`,
    [openingId, data.name, data.gamer_tag, data.email, data.age ?? null, data.game, data.role, data.experience, data.profile_link, data.message],
  );
  res.status(201).json({ data: { id: Number(info.lastInsertRowid), received: true } });
});
