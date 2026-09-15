/**
 * Activity log — read-only audit trail with filters.
 */
import { Router } from 'express';
import { z } from 'zod';
import { all, get } from '../db';
import { escapeLike } from '../core/utils';
import { validate } from '../middleware/validate';
import { requirePermission } from '../middleware/auth';
import { listQuerySchema, pageMeta, offset } from '../core/pagination';

export const logsRouter = Router();

const ACTIONS = [
  'login', 'logout', 'login_failed', 'create', 'update', 'delete', 'publish', 'unpublish',
  'status_change', 'settings_update', 'password_change', 'password_reset', 'password_reset_requested',
  'media_upload', 'media_delete', 'account_created', 'account_deactivated', 'account_activated', 'role_changed',
] as const;

const listSchema = listQuerySchema.extend({
  action: z.enum(ACTIONS).optional(),
  resource_type: z.string().trim().max(40).optional(),
  user_id: z.coerce.number().int().positive().optional(),
  from: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

logsRouter.get('/', requirePermission('activity_logs:read'), validate({ query: listSchema }), (req, res) => {
  const q = req.validated.query as any;
  const where: string[] = [];
  const params: Record<string, any> = {};
  if (q.q) {
    where.push(`(l.resource_type LIKE @q ESCAPE '\\' OR l.resource_id LIKE @q ESCAPE '\\' OR u.name LIKE @q ESCAPE '\\')`);
    params.q = `%${escapeLike(q.q)}%`;
  }
  if (q.action) {
    where.push('l.action = @action');
    params.action = q.action;
  }
  if (q.resource_type) {
    where.push('l.resource_type = @rt');
    params.rt = q.resource_type;
  }
  if (q.user_id) {
    where.push('l.user_id = @uid');
    params.uid = q.user_id;
  }
  if (q.from) {
    where.push("l.created_at >= @from");
    params.from = `${q.from}T00:00:00`;
  }
  if (q.to) {
    where.push("l.created_at <= @to");
    params.to = `${q.to}T23:59:59.999`;
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = (
    get<{ c: number }>(`SELECT COUNT(*) c FROM activity_logs l LEFT JOIN admin_users u ON u.id = l.user_id ${whereSql}`, params) ?? { c: 0 }
  ).c;
  const rows = all(
    `SELECT l.id, l.user_id, l.action, l.resource_type, l.resource_id, l.details, l.ip, l.created_at,
            u.name AS user_name, u.email AS user_email, r.key AS user_role
     FROM activity_logs l
     LEFT JOIN admin_users u ON u.id = l.user_id
     LEFT JOIN roles r ON r.id = u.role_id
     ${whereSql} ORDER BY l.id DESC LIMIT @limit OFFSET @offset`,
    { ...params, limit: q.perPage, offset: offset(q) },
  );
  res.json({ data: rows, meta: pageMeta(q.page, q.perPage, total) });
});

logsRouter.get('/actions', requirePermission('activity_logs:read'), (req, res) => {
  res.json({ data: ACTIONS });
});
