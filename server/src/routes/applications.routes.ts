/**
 * Recruitment applications — submitted from the public esports website.
 * Admins review and move them through: new → reviewing → shortlisted →
 * accepted / rejected.
 */
import { Router } from 'express';
import { z } from 'zod';
import { all, get, run } from '../db';
import { notFound } from '../core/errors';
import { nowIso, escapeLike } from '../core/utils';
import { validate } from '../middleware/validate';
import { requirePermission } from '../middleware/auth';
import { listQuerySchema, pageMeta, offset } from '../core/pagination';
import { logActivity } from '../services/activity';
import { zodId } from './crud';

export const applicationsRouter = Router();

const listSchema = listQuerySchema.extend({
  status: z.string().trim().max(20).optional(),
  opening_id: z.coerce.number().int().positive().optional(),
});

applicationsRouter.get(
  '/',
  requirePermission('applications:read'),
  validate({ query: listSchema }),
  (req, res) => {
    const q = req.validated.query as any;
    const where: string[] = [];
    const params: Record<string, any> = {};
    if (q.q) {
      where.push(`(a.name LIKE @q ESCAPE '\\' OR a.gamer_tag LIKE @q ESCAPE '\\' OR a.email LIKE @q ESCAPE '\\' OR a.game LIKE @q ESCAPE '\\')`);
      params.q = `%${escapeLike(q.q)}%`;
    }
    if (q.status) {
      where.push('a.status = @status');
      params.status = q.status;
    }
    if (q.opening_id) {
      where.push('a.opening_id = @opening_id');
      params.opening_id = q.opening_id;
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const total = (get<{ c: number }>(`SELECT COUNT(*) c FROM applications a ${whereSql}`, params) ?? { c: 0 }).c;
    const rows = all(
      `SELECT a.*, o.position AS opening_position, o.game AS opening_game
       FROM applications a LEFT JOIN recruitment_openings o ON o.id = a.opening_id
       ${whereSql} ORDER BY a.created_at DESC LIMIT @limit OFFSET @offset`,
      { ...params, limit: q.perPage, offset: offset(q) },
    );
    res.json({ data: rows, meta: pageMeta(q.page, q.perPage, total) });
  },
);

applicationsRouter.get('/:id', requirePermission('applications:read'), validate({ params: zodId }), (req, res) => {
  const row = get<any>(
    `SELECT a.*, o.position AS opening_position, o.game AS opening_game, o.role AS opening_role
     FROM applications a LEFT JOIN recruitment_openings o ON o.id = a.opening_id
     WHERE a.id = ?`,
    [req.validated.params.id],
  );
  if (!row) throw notFound('Application not found');
  res.json({ data: row });
});

const statusSchema = z.object({
  status: z.enum(['new', 'reviewing', 'shortlisted', 'rejected', 'accepted']),
});

applicationsRouter.patch(
  '/:id/status',
  requirePermission('applications:write'),
  validate({ params: zodId, body: statusSchema }),
  (req, res) => {
    const id = req.validated.params.id;
    const current = get<any>('SELECT * FROM applications WHERE id = ?', [id]);
    if (!current) throw notFound('Application not found');
    run('UPDATE applications SET status = ?, updated_at = ? WHERE id = ?', [
      req.validated.body.status,
      nowIso(),
      id,
    ]);
    logActivity({
      userId: req.user!.id,
      action: 'status_change',
      resourceType: 'applications',
      resourceId: String(id),
      details: { from: current.status, to: req.validated.body.status, applicant: current.gamer_tag },
      ip: req.ip,
    });
    res.json({ data: get<any>('SELECT * FROM applications WHERE id = ?', [id]) });
  },
);

const notesSchema = z.object({ admin_notes: z.string().trim().max(2000) });

applicationsRouter.patch(
  '/:id/notes',
  requirePermission('applications:write'),
  validate({ params: zodId, body: notesSchema }),
  (req, res) => {
    const id = req.validated.params.id;
    if (!get('SELECT id FROM applications WHERE id = ?', [id])) throw notFound('Application not found');
    run('UPDATE applications SET admin_notes = ?, updated_at = ? WHERE id = ?', [
      req.validated.body.admin_notes,
      nowIso(),
      id,
    ]);
    res.json({ data: get<any>('SELECT * FROM applications WHERE id = ?', [id]) });
  },
);

applicationsRouter.delete('/:id', requirePermission('applications:write'), validate({ params: zodId }), (req, res) => {
  const id = req.validated.params.id;
  const current = get<any>('SELECT * FROM applications WHERE id = ?', [id]);
  if (!current) throw notFound('Application not found');
  run('DELETE FROM applications WHERE id = ?', [id]);
  logActivity({
    userId: req.user!.id,
    action: 'delete',
    resourceType: 'applications',
    resourceId: String(id),
    details: { applicant: current.gamer_tag },
    ip: req.ip,
  });
  res.status(204).send();
});
