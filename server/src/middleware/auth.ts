/**
 * Session authentication + role-based authorization.
 *
 * - The browser holds only an opaque random token in an httpOnly cookie.
 * - The server stores the SHA-256 hash of that token in `sessions`.
 * - Passwords are bcrypt hashes; nothing reversible is ever stored.
 */
import type { RequestHandler } from 'express';
import { config } from '../config';
import { get, run } from '../db';
import { forbidden, unauthorized } from '../core/errors';
import { nowIso, sha256 } from '../core/utils';
import type { SessionUser } from '../core/types';

export const loadSession: RequestHandler = (req, _res, next) => {
  req.user = null;
  const raw = req.cookies?.[config.session.cookieName];
  if (typeof raw === 'string' && raw.length >= 32) {
    const row = get<{
      session_id: number;
      expires_at: string;
      user_id: number;
      email: string;
      username: string;
      name: string;
      avatar_url: string;
      is_active: number;
      role_key: string;
      role_name: string;
      permissions: string;
    }>(
      `SELECT s.id AS session_id, s.expires_at,
              u.id AS user_id, u.email, u.username, u.name, u.avatar_url, u.is_active,
              r.key AS role_key, r.name AS role_name, r.permissions
       FROM sessions s
       JOIN admin_users u ON u.id = s.user_id
       JOIN roles r ON r.id = u.role_id
       WHERE s.token_hash = ?`,
      [sha256(raw)],
    );
    if (row && new Date(row.expires_at).getTime() > Date.now() && row.is_active === 1) {
      req.user = {
        id: row.user_id,
        email: row.email,
        username: row.username,
        name: row.name,
        roleKey: row.role_key,
        roleName: row.role_name,
        permissions: JSON.parse(row.permissions) as string[],
        avatarUrl: row.avatar_url,
        sessionId: row.session_id,
      };
      // Sliding expiry: extend the session when less than a day remains.
      const remaining = new Date(row.expires_at).getTime() - Date.now();
      if (remaining < config.session.slidingRenewThresholdMs) {
        run('UPDATE sessions SET expires_at = ? WHERE id = ?', [
          new Date(Date.now() + config.session.ttlMs).toISOString(),
          row.session_id,
        ]);
      }
    }
  }
  next();
};

export const requireAuth: RequestHandler = (req, _res, next) => {
  if (!req.user) return next(unauthorized());
  next();
};

export const can = (user: SessionUser | null | undefined, permission: string): boolean =>
  !!user && (user.permissions.includes('*') || user.permissions.includes(permission));

export const requirePermission =
  (permission: string): RequestHandler =>
  (req, _res, next) => {
    if (!req.user) return next(unauthorized());
    if (!can(req.user, permission)) return next(forbidden(`Missing permission: ${permission}`));
    next();
  };
