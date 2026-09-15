/**
 * Contact messages submitted through the personal website's contact form.
 * Statuses: unread → read → replied → archived.
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

export const messagesRouter = Router();

const listSchema = listQuerySchema.extend({ status: z.string().trim().max(20).optional() });

messagesRouter.get(
  '/',
  requirePermission('messages:read'),
  validate({ query: listSchema }),
  (req, res) => {
    const q = req.validated.query as any;
    const where: string[] = [];
    const params: Record<string, any> = {};
    if (q.q) {
      where.push(`(name LIKE @q ESCAPE '\\' OR email LIKE @q ESCAPE '\\' OR subject LIKE @q ESCAPE '\\' OR message LIKE @q ESCAPE '\\')`);
      params.q = `%${escapeLike(q.q)}%`;
    }
    if (q.status) {
      where.push('status = @status');
      params.status = q.status;
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const total = (get<{ c: number }>(`SELECT COUNT(*) c FROM contact_messages ${whereSql}`, params) ?? { c: 0 }).c;
    const rows = all(
      `SELECT * FROM contact_messages ${whereSql} ORDER BY created_at DESC LIMIT @limit OFFSET @offset`,
      { ...params, limit: q.perPage, offset: offset(q) },
    );
    res.json({ data: rows, meta: pageMeta(q.page, q.perPage, total) });
  },
);

messagesRouter.get('/:id', requirePermission('messages:read'), validate({ params: zodId }), (req, res) => {
  const row = get<any>('SELECT * FROM contact_messages WHERE id = ?', [req.validated.params.id]);
  if (!row) throw notFound('Message not found');
  res.json({ data: row });
});

const statusSchema = z.object({
  status: z.enum(['unread', 'read', 'replied', 'archived']),
});

messagesRouter.patch(
  '/:id/status',
  requirePermission('messages:write'),
  validate({ params: zodId, body: statusSchema }),
  (req, res) => {
    const id = req.validated.params.id;
    const current = get<any>('SELECT * FROM contact_messages WHERE id = ?', [id]);
    if (!current) throw notFound('Message not found');
    run('UPDATE contact_messages SET status = ?, updated_at = ? WHERE id = ?', [
      req.validated.body.status,
      nowIso(),
      id,
    ]);
    logActivity({
      userId: req.user!.id,
      action: 'status_change',
      resourceType: 'messages',
      resourceId: String(id),
      details: { from: current.status, to: req.validated.body.status, sender: current.name },
      ip: req.ip,
    });
    res.json({ data: get<any>('SELECT * FROM contact_messages WHERE id = ?', [id]) });
  },
);

messagesRouter.delete('/:id', requirePermission('messages:write'), validate({ params: zodId }), (req, res) => {
  const id = req.validated.params.id;
  const current = get<any>('SELECT * FROM contact_messages WHERE id = ?', [id]);
  if (!current) throw notFound('Message not found');
  run('DELETE FROM contact_messages WHERE id = ?', [id]);
  logActivity({
    userId: req.user!.id,
    action: 'delete',
    resourceType: 'messages',
    resourceId: String(id),
    details: { sender: current.name },
    ip: req.ip,
  });
  res.status(204).send();
});
