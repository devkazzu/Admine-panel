/**
 * Simple in-memory fixed-window rate limiter.
 * Sufficient for a single-instance admin panel; swap for a Redis store if the
 * API is ever scaled horizontally.
 */
import type { RequestHandler } from 'express';
import { tooMany } from '../core/errors';

interface Bucket {
  count: number;
  resetAt: number;
}

export function rateLimit(options: { windowMs: number; max: number; prefix: string }): RequestHandler {
  const buckets = new Map<string, Bucket>();

  // Periodic cleanup so the map doesn't grow forever.
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(key);
    }
  }, options.windowMs);
  timer.unref?.();

  return (req, res, next) => {
    const ip = (req.ip || req.socket.remoteAddress || 'unknown').toString();
    const key = `${options.prefix}:${ip}`;
    const now = Date.now();
    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + options.windowMs };
      buckets.set(key, bucket);
    }
    bucket.count += 1;
    if (bucket.count > options.max) {
      res.set('Retry-After', Math.ceil((bucket.resetAt - now) / 1000).toString());
      return next(tooMany());
    }
    next();
  };
}
