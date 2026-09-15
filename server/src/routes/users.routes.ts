/**
 * Admin user management (Super Admin only).
 *
 * Guards:
 *  - you cannot delete yourself
 *  - the last active Super Admin cannot be deleted, demoted or deactivated
 *  - you cannot change your own role or active status
 * Passwords are bcrypt-hashed; resetting one invalidates all sessions of that user.
 */
import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { z } from 'zod';
import { all, get, run } from '../db';
import { notFound, conflict, unprocessable } from '../core/errors';
import { asyncHandler, nowIso, escapeLike } from '../core/utils';
import { validate } from '../middleware/validate';
import { requirePermission } from '../middleware/auth';
import { listQuerySchema, pageMeta, offset } from '../core/pagination';
import { logActivity } from '../services/activity';
import { zodId } from './crud';
import { text, requiredText } from './schemas';

export const usersRouter = Router();

const ROLE_KEYS = ['super_admin', 'editor', 'moderator'] as const;

const passwordSchema = z
  .string()
  .min(10, 'Password must be at least 10 characters')
  .max(128)
  .refine((v) => /[a-zA-Z]/.test(v) && /[0-9]/.test(v), 'Use at least one letter and one number');

const createSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
  username: z
    .string()
    .trim()
    .min(3, 'Username must be at least 3 characters')
    .max(40)
    .regex(/^[a-zA-Z0-9_.-]+$/, 'Username can contain letters, numbers, dots, dashes and underscores'),
  name: requiredText(80, 'Full name'),
  role_key: z.enum(ROLE_KEYS),
  password: passwordSchema,
});

const updateSchema = z.object({
  name: requiredText(80, 'Full name').optional(),
  role_key: z.enum(ROLE_KEYS).optional(),
  is_active: z.coerce.boolean().optional(),
  avatar_url: text(500).optional(),
});

const listSchema = listQuerySchema.extend({ role_key: z.string().trim().max(30).optional() });

const userRow = (id: number) =>
  get<any>(
    `SELECT u.id, u.email, u.username, u.name, u.is_active, u.avatar_url, u.last_login_at, u.created_at, u.updated_at,
            r.key AS role_key, r.name AS role_name
     FROM admin_users u JOIN roles r ON r.id = u.role_id WHERE u.id = ?`,
    [id],
  );

const activeSuperAdminCount = (excludeId?: number) =>
  (
    get<{ c: number }>(
      `SELECT COUNT(*) c FROM admin_users u JOIN roles r ON r.id = u.role_id
       WHERE r.key = 'super_admin' AND u.is_active = 1 ${excludeId ? 'AND u.id != ?' : ''}`,
      excludeId ? [excludeId] : [],
    ) ?? { c: 0 }
  ).c;

// ── ROLES ────────────────────────────────────────────────────────────────────
usersRouter.get('/roles', requirePermission('admin_users:read'), (req, res) => {
  res.json({ data: all(`SELECT id, key, name, description, permissions FROM roles ORDER BY id`) });
});

// ── LIST ─────────────────────────────────────────────────────────────────────
usersRouter.get('/', requirePermission('admin_users:read'), validate({ query: listSchema }), (req, res) => {
  const q = req.validated.query as any;
  const where: string[] = [];
  const params: Record<string, any> = {};
  if (q.q) {
    where.push(`(u.name LIKE @q ESCAPE '\\' OR u.email LIKE @q ESCAPE '\\' OR u.username LIKE @q ESCAPE '\\')`);
    params.q = `%${escapeLike(q.q)}%`;
  }
  if (q.role_key) {
    where.push('r.key = @role');
    params.role = q.role_key;
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = (
    get<{ c: number }>(`SELECT COUNT(*) c FROM admin_users u JOIN roles r ON r.id = u.role_id ${whereSql}`, params) ?? { c: 0 }
  ).c;
  const rows = all(
    `SELECT u.id, u.email, u.username, u.name, u.is_active, u.avatar_url, u.last_login_at, u.created_at, u.updated_at,
            r.key AS role_key, r.name AS role_name
     FROM admin_users u JOIN roles r ON r.id = u.role_id
     ${whereSql} ORDER BY u.created_at ASC LIMIT @limit OFFSET @offset`,
    { ...params, limit: q.perPage, offset: offset(q) },
  );
  res.json({ data: rows, meta: pageMeta(q.page, q.perPage, total) });
});

// ── CREATE ──────────────────────────────────────────────────────────────────
usersRouter.post(
  '/',
  requirePermission('admin_users:write'),
  validate({ body: createSchema }),
  asyncHandler(async (req, res) => {
    const data = req.validated.body;
    const role = get<{ id: number }>(`SELECT id FROM roles WHERE key = ?`, [data.role_key]);
    if (!role) throw unprocessable('Unknown role');
    const hash = await bcrypt.hash(data.password, 12);
    let info;
    try {
      info = run(
        `INSERT INTO admin_users (email, username, name, password_hash, role_id, is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
        [data.email, data.username, data.name, hash, role.id, nowIso(), nowIso()],
      );
    } catch (err: any) {
      if (String(err?.message).includes('UNIQUE constraint failed')) {
        throw conflict('A user with that email or username already exists');
      }
      throw err;
    }
    logActivity({
      userId: req.user!.id,
      action: 'account_created',
      resourceType: 'admin_users',
      resourceId: String(info.lastInsertRowid),
      details: { email: data.email, role: data.role_key },
      ip: req.ip,
    });
    res.status(201).json({ data: userRow(Number(info.lastInsertRowid)) });
  }),
);

// ── UPDATE ──────────────────────────────────────────────────────────────────
usersRouter.patch('/:id', requirePermission('admin_users:write'), validate({ params: zodId, body: updateSchema }), (req, res) => {
  const id = req.validated.params.id;
  const current = get<any>(
    `SELECT u.*, r.key AS role_key FROM admin_users u JOIN roles r ON r.id = u.role_id WHERE u.id = ?`,
    [id],
  );
  if (!current) throw notFound('Admin user not found');

  const { name, role_key, is_active, avatar_url } = req.validated.body;

  if (id === req.user!.id && (role_key !== undefined || is_active !== undefined)) {
    throw conflict('You cannot change your own role or active status');
  }
  const demoting = role_key !== undefined && role_key !== 'super_admin' && current.role_key === 'super_admin';
  const deactivating = is_active === false && current.is_active === 1;
  if ((demoting || deactivating) && current.role_key === 'super_admin' && activeSuperAdminCount(id) === 0) {
    throw conflict('Cannot remove the last active Super Admin');
  }

  const sets: string[] = [];
  const params: Record<string, any> = {};
  if (name !== undefined) {
    sets.push('name = @name');
    params.name = name;
  }
  if (avatar_url !== undefined) {
    sets.push('avatar_url = @avatar_url');
    params.avatar_url = avatar_url;
  }
  if (role_key !== undefined) {
    const role = get<{ id: number }>(`SELECT id FROM roles WHERE key = ?`, [role_key]);
    if (!role) throw unprocessable('Unknown role');
    sets.push('role_id = @role_id');
    params.role_id = role.id;
  }
  if (is_active !== undefined) {
    sets.push('is_active = @is_active');
    params.is_active = is_active ? 1 : 0;
  }
  if (sets.length) {
    run(`UPDATE admin_users SET ${sets.join(', ')}, updated_at = @__u WHERE id = @__id`, {
      ...params,
      __u: nowIso(),
      __id: id,
    });
  }
  if (role_key !== undefined && role_key !== current.role_key) {
    logActivity({ userId: req.user!.id, action: 'role_changed', resourceType: 'admin_users', resourceId: String(id), details: { from: current.role_key, to: role_key }, ip: req.ip });
  }
  if (is_active !== undefined && is_active !== Boolean(current.is_active)) {
    logActivity({ userId: req.user!.id, action: is_active ? 'account_activated' : 'account_deactivated', resourceType: 'admin_users', resourceId: String(id), ip: req.ip });
  }
  logActivity({ userId: req.user!.id, action: 'update', resourceType: 'admin_users', resourceId: String(id), details: { fields: Object.keys(req.validated.body) }, ip: req.ip });
  res.json({ data: userRow(id) });
});

// ── ADMIN-PASSWORD RESET (Super Admin sets a new password directly) ─────────
usersRouter.post(
  '/:id/reset-password',
  requirePermission('admin_users:write'),
  validate({ params: zodId, body: z.object({ newPassword: passwordSchema }) }),
  asyncHandler(async (req, res) => {
    const id = req.validated.params.id;
    if (!get('SELECT id FROM admin_users WHERE id = ?', [id])) throw notFound('Admin user not found');
    const hash = await bcrypt.hash(req.validated.body.newPassword, 12);
    run('UPDATE admin_users SET password_hash = ?, updated_at = ? WHERE id = ?', [hash, nowIso(), id]);
    run('DELETE FROM sessions WHERE user_id = ?', [id]);
    logActivity({ userId: req.user!.id, action: 'password_reset', resourceType: 'admin_users', resourceId: String(id), details: { by: 'super_admin' }, ip: req.ip });
    res.json({ data: { ok: true } });
  }),
);

// ── DELETE ──────────────────────────────────────────────────────────────────
usersRouter.delete('/:id', requirePermission('admin_users:write'), validate({ params: zodId }), (req, res) => {
  const id = req.validated.params.id;
  const current = get<any>(`SELECT u.*, r.key AS role_key FROM admin_users u JOIN roles r ON r.id = u.role_id WHERE u.id = ?`, [id]);
  if (!current) throw notFound('Admin user not found');
  if (id === req.user!.id) throw conflict('You cannot delete your own account');
  if (current.role_key === 'super_admin' && activeSuperAdminCount(id) === 0) {
    throw conflict('Cannot delete the last active Super Admin');
  }
  run('DELETE FROM admin_users WHERE id = ?', [id]); // sessions cascade
  logActivity({ userId: req.user!.id, action: 'delete', resourceType: 'admin_users', resourceId: String(id), details: { email: current.email }, ip: req.ip });
  res.status(204).send();
});
