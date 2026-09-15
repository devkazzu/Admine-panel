/**
 * Global admin search — quick jump-to results across major resources.
 * Results respect read permissions per resource.
 */
import { Router } from 'express';
import { z } from 'zod';
import { all } from '../db';
import { validate } from '../middleware/validate';
import { requireAuth, can } from '../middleware/auth';
import { escapeLike } from '../core/utils';

export const searchRouter = Router();

searchRouter.get(
  '/',
  requireAuth,
  validate({ query: z.object({ q: z.string().trim().min(2, 'Type at least 2 characters').max(120) }) }),
  (req, res) => {
    const q = req.validated.query.q;
    const like = `%${escapeLike(q)}%`;
    const groups: { label: string; items: { id: number; title: string; subtitle: string; url: string }[] }[] = [];

    const push = (label: string, perm: string, sql: string, url: (id: number) => string) => {
      if (!can(req.user, perm)) return;
      const rows = all<any>(sql, [like]).map((r) => ({
        id: r.id,
        title: r.title,
        subtitle: r.subtitle ?? '',
        url: url(r.id),
      }));
      if (rows.length) groups.push({ label, items: rows });
    };

    push('Projects', 'projects:read',
      `SELECT id, name AS title, status AS subtitle FROM projects WHERE name LIKE ? OR slug LIKE ? LIMIT 5`,
      (id) => `/website/projects?focus=${id}`);
    push('Teams', 'teams:read',
      `SELECT id, name AS title, game AS subtitle FROM teams WHERE name LIKE ? LIMIT 5`,
      (id) => `/esports/teams?focus=${id}`);
    push('Players', 'players:read',
      `SELECT id, gamer_tag AS title, game AS subtitle FROM players WHERE gamer_tag LIKE ? OR real_name LIKE ? LIMIT 5`,
      (id) => `/esports/players?focus=${id}`);
    push('News', 'news:read',
      `SELECT id, title, status AS subtitle FROM news WHERE title LIKE ? OR slug LIKE ? LIMIT 5`,
      (id) => `/esports/news/${id}/edit`);
    push('Tournaments', 'tournaments:read',
      `SELECT id, name AS title, game AS subtitle FROM tournaments WHERE name LIKE ? LIMIT 5`,
      (id) => `/esports/tournaments?focus=${id}`);
    push('Applications', 'applications:read',
      `SELECT id, gamer_tag AS title, name AS subtitle FROM applications WHERE gamer_tag LIKE ? OR name LIKE ? OR email LIKE ? LIMIT 5`,
      (id) => `/esports/applications?focus=${id}`);
    push('Messages', 'messages:read',
      `SELECT id, name AS title, subject AS subtitle FROM contact_messages WHERE name LIKE ? OR subject LIKE ? OR email LIKE ? LIMIT 5`,
      (id) => `/website/messages?focus=${id}`);
    push('Admin users', 'admin_users:read',
      `SELECT id, name AS title, email AS subtitle FROM admin_users WHERE name LIKE ? OR email LIKE ? OR username LIKE ? LIMIT 5`,
      (id) => `/system/users?focus=${id}`);

    res.json({ data: { groups } });
  },
);
