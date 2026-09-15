/**
 * Authentication routes — login, logout, session, password management.
 *
 * Security properties:
 *  - bcrypt password hashing (never plain text, never reversible)
 *  - opaque session tokens (SHA-256 hashed server-side) in httpOnly cookies
 *  - generic error messages (no user enumeration)
 *  - rate limiting on login / forgot-password
 *  - login attempts (success & failure) recorded in the activity log
 */
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { config } from '../config';
import { get, run } from '../db';
import { unauthorized, badRequest, AppError } from '../core/errors';
import { asyncHandler, nowIso, sha256, randomToken } from '../core/utils';
import { validate } from '../middleware/validate';
import { requireAuth } from '../middleware/auth';
import { rateLimit } from '../middleware/rateLimit';
import { logActivity } from '../services/activity';
import { sendMail, mailerMode } from '../services/mailer';
import type { SessionUser } from '../core/types';

export const authRouter = Router();

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, prefix: 'login' });
const forgotLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 5, prefix: 'forgot' });

const loginSchema = z.object({
  identifier: z.string().trim().min(3, 'Enter your email or username').max(200),
  password: z.string().min(1, 'Enter your password').max(200),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Enter your current password').max(200),
  newPassword: z.string().min(10, 'New password must be at least 10 characters').max(128),
});

const forgotSchema = z.object({ email: z.string().trim().toLowerCase().email('Enter a valid email') });

const resetSchema = z.object({
  token: z.string().trim().min(32).max(128),
  newPassword: z.string().min(10, 'New password must be at least 10 characters').max(128),
});

interface UserRow {
  id: number;
  email: string;
  username: string;
  name: string;
  password_hash: string;
  is_active: number;
  avatar_url: string;
  role_key: string;
  role_name: string;
  permissions: string;
}

const findUserByIdentifier = (identifier: string): UserRow | undefined =>
  get<UserRow>(
    `SELECT u.*, r.key AS role_key, r.name AS role_name, r.permissions
     FROM admin_users u JOIN roles r ON r.id = u.role_id
     WHERE LOWER(u.email) = LOWER(?) OR LOWER(u.username) = LOWER(?)`,
    [identifier, identifier],
  );

const toSafeUser = (u: UserRow): Omit<SessionUser, 'sessionId'> => ({
  id: u.id,
  email: u.email,
  username: u.username,
  name: u.name,
  roleKey: u.role_key,
  roleName: u.role_name,
  permissions: JSON.parse(u.permissions) as string[],
  avatarUrl: u.avatar_url,
});

function createSession(res: any, userId: number, ip: string, userAgent: string): string {
  const token = randomToken(32);
  run(
    `INSERT INTO sessions (token_hash, user_id, expires_at, created_at, ip, user_agent) VALUES (?, ?, ?, ?, ?, ?)`,
    [sha256(token), userId, new Date(Date.now() + config.session.ttlMs).toISOString(), nowIso(), ip ?? '', userAgent ?? ''],
  );
  res.cookie(config.session.cookieName, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.cookieSecure,
    maxAge: config.session.ttlMs,
    path: '/',
  });
  return token;
}

// ── LOGIN ────────────────────────────────────────────────────────────────────
authRouter.post(
  '/login',
  loginLimiter,
  validate({ body: loginSchema }),
  asyncHandler(async (req, res) => {
    const { identifier, password } = req.validated.body;
    const user = findUserByIdentifier(identifier);

    const fail = (uid: number | null): never => {
      logActivity({ userId: uid, action: 'login_failed', resourceType: 'auth', details: { identifier }, ip: req.ip });
      throw unauthorized('Invalid credentials');
    };

    if (!user) fail(null);
    const ok = await bcrypt.compare(password, user!.password_hash);
    if (!ok) fail(user!.id);
    if (user!.is_active !== 1) {
      logActivity({ userId: user!.id, action: 'login_failed', resourceType: 'auth', details: { reason: 'deactivated' }, ip: req.ip });
      throw new AppError(403, 'This account has been deactivated. Contact a Super Admin.', 'account_deactivated');
    }

    createSession(res, user!.id, req.ip ?? '', req.get('user-agent') ?? '');
    run('UPDATE admin_users SET last_login_at = ? WHERE id = ?', [nowIso(), user!.id]);
    logActivity({ userId: user!.id, action: 'login', resourceType: 'auth', ip: req.ip });
    res.json({ data: { user: toSafeUser(user!) } });
  }),
);

// ── CURRENT SESSION ──────────────────────────────────────────────────────────
authRouter.get('/me', requireAuth, (req, res) => {
  const { sessionId, ...safe } = req.user!;
  res.json({ data: { user: safe } });
});

// ── LOGOUT ───────────────────────────────────────────────────────────────────
authRouter.post('/logout', requireAuth, (req, res) => {
  run('DELETE FROM sessions WHERE id = ?', [req.user!.sessionId]);
  res.clearCookie(config.session.cookieName, { path: '/' });
  logActivity({ userId: req.user!.id, action: 'logout', resourceType: 'auth', ip: req.ip });
  res.json({ data: { ok: true } });
});

// ── CHANGE PASSWORD (authenticated) ─────────────────────────────────────────
authRouter.put(
  '/change-password',
  requireAuth,
  validate({ body: changePasswordSchema }),
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.validated.body;
    const user = get<{ password_hash: string }>('SELECT password_hash FROM admin_users WHERE id = ?', [req.user!.id]);
    if (!user || !(await bcrypt.compare(currentPassword, user.password_hash))) {
      throw badRequest('Current password is incorrect');
    }
    const hash = await bcrypt.hash(newPassword, 12);
    run('UPDATE admin_users SET password_hash = ?, updated_at = ? WHERE id = ?', [hash, nowIso(), req.user!.id]);
    // Invalidate every OTHER session of this user.
    run('DELETE FROM sessions WHERE user_id = ? AND id != ?', [req.user!.id, req.user!.sessionId]);
    logActivity({ userId: req.user!.id, action: 'password_change', resourceType: 'auth', ip: req.ip });
    res.json({ data: { ok: true } });
  }),
);

// ── FORGOT PASSWORD ─────────────────────────────────────────────────────────
authRouter.post(
  '/forgot-password',
  forgotLimiter,
  validate({ body: forgotSchema }),
  asyncHandler(async (req, res) => {
    const { email } = req.validated.body;
    const user = get<{ id: number; email: string; name: string }>(
      'SELECT id, email, name FROM admin_users WHERE LOWER(email) = LOWER(?) AND is_active = 1',
      [email],
    );

    if (user) {
      const token = randomToken(32);
      run(
        `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?)`,
        [user.id, sha256(token), new Date(Date.now() + 60 * 60 * 1000).toISOString(), nowIso()],
      );
      const link = `${config.baseUrl}/reset-password?token=${token}`;
      await sendMail(
        user.email,
        'RJNX Admin — password reset',
        [
          `Hi ${user.name},`,
          ``,
          `A password reset was requested for your RJNX Admin account.`,
          `Open the link below within 1 hour to choose a new password:`,
          ``,
          link,
          ``,
          `If you did not request this, you can safely ignore this email.`,
        ].join('\n'),
      );
      logActivity({ userId: user.id, action: 'password_reset_requested', resourceType: 'auth', ip: req.ip });
    }

    // Always the same response — no account enumeration.
    res.json({
      data: {
        message:
          mailerMode === 'smtp'
            ? 'If an account with that email exists, a reset link has been sent.'
            : 'If an account with that email exists, a reset link has been generated. With MAIL_TRANSPORT=console the link is printed in the server log — ask the operator to hand it over, or configure SMTP to email it automatically.',
      },
    });
  }),
);

// ── RESET PASSWORD (with token) ─────────────────────────────────────────────
authRouter.post(
  '/reset-password',
  validate({ body: resetSchema }),
  asyncHandler(async (req, res) => {
    const { token, newPassword } = req.validated.body;
    const row = get<{ id: number; user_id: number; expires_at: string; used_at: string | null }>(
      'SELECT * FROM password_reset_tokens WHERE token_hash = ?',
      [sha256(token)],
    );
    if (!row || row.used_at || new Date(row.expires_at).getTime() < Date.now()) {
      throw new AppError(400, 'This reset link is invalid or has expired', 'invalid_reset_token');
    }
    const hash = await bcrypt.hash(newPassword, 12);
    run('UPDATE admin_users SET password_hash = ?, updated_at = ? WHERE id = ?', [hash, nowIso(), row.user_id]);
    run('UPDATE password_reset_tokens SET used_at = ? WHERE id = ?', [nowIso(), row.id]);
    run('DELETE FROM sessions WHERE user_id = ?', [row.user_id]);
    logActivity({ userId: row.user_id, action: 'password_reset', resourceType: 'auth', ip: req.ip });
    res.json({ data: { ok: true } });
  }),
);
