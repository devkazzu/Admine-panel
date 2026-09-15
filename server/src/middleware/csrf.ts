/**
 * CSRF protection for state-changing admin API calls.
 *
 * Defence in depth (SameSite=Lax cookies + both checks below):
 *  1. A custom header `X-Requested-With: fetch` that browsers won't send
 *     cross-site without a CORS preflight we never approve for admin routes.
 *  2. If an Origin header is present, its host must match the request Host.
 *
 * Public endpoints (/api/public/*) are exempt — they are consumed cross-origin
 * by the public websites and are protected by CORS, validation + rate limits.
 */
import type { RequestHandler } from 'express';
import { forbidden } from '../core/errors';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export const csrfGuard: RequestHandler = (req, res, next) => {
  if (SAFE_METHODS.has(req.method)) return next();
  if (req.path.startsWith('/public/')) return next();

  const header = req.get('x-requested-with');
  if (header !== 'fetch') {
    return next(forbidden('Missing anti-CSRF header'));
  }
  const origin = req.get('origin');
  if (origin) {
    try {
      const originHost = new URL(origin).host;
      const host = req.get('host');
      if (host && originHost !== host) {
        return next(forbidden('Cross-origin request rejected'));
      }
    } catch {
      return next(forbidden('Invalid origin header'));
    }
  }
  next();
};
