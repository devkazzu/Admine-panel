/**
 * Environment configuration.
 * Values are loaded from `.env` (repo root or server/) — never hardcoded.
 * Real secrets live ONLY in .env (git-ignored); .env.example documents keys.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { z } from 'zod';

const here = path.dirname(fileURLToPath(import.meta.url)); // <repo>/server/src
export const serverRoot = path.resolve(here, '..'); // <repo>/server
export const repoRoot = path.resolve(serverRoot, '..'); // <repo>

// Load the first .env we find (cwd when run via npm, server/, or repo root).
for (const p of [
  path.resolve(process.cwd(), '.env'),
  path.join(serverRoot, '.env'),
  path.join(repoRoot, '.env'),
]) {
  if (fs.existsSync(p)) {
    dotenv.config({ path: p });
    break;
  }
}

const envSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(4001),
  NODE_ENV: z.enum(['development', 'production']).default('development'),
  BASE_URL: z.string().trim().default('http://localhost:4001'),
  TRUST_PROXY: z.coerce.boolean().default(false),
  SESSION_SECRET: z.string().trim().optional(),
  COOKIE_SECURE: z.coerce.boolean().optional(),
  DATABASE_PATH: z.string().trim().default('./data/rjnx.db'),
  UPLOADS_DIR: z.string().trim().optional(),
  AUTO_MIGRATE: z.coerce.boolean().default(true),
  MAX_UPLOAD_MB: z.coerce.number().int().min(1).max(64).default(8),
  PUBLIC_API_ORIGINS: z.string().trim().default('*'),
  MAIL_TRANSPORT: z.enum(['console', 'smtp']).default('console'),
  SMTP_HOST: z.string().trim().optional(),
  SMTP_PORT: z.coerce.number().int().optional(),
  SMTP_SECURE: z.coerce.boolean().default(false),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  MAIL_FROM: z.string().trim().optional(),
  ADMIN_NAME: z.string().trim().default('RJNX Admin'),
  ADMIN_EMAIL: z.string().trim().toLowerCase().default('admin@rjnx.local'),
  ADMIN_USERNAME: z.string().trim().default('admin'),
  ADMIN_PASSWORD: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('❌ Invalid environment configuration:');
  for (const issue of parsed.error.issues) {
    console.error(`   ${issue.path.join('.')}: ${issue.message}`);
  }
  process.exit(1);
}
const e = parsed.data;

let sessionSecret = e.SESSION_SECRET;
if (!sessionSecret || sessionSecret.length < 16 || sessionSecret === 'replace-with-a-long-random-string') {
  // Ephemeral secret: sessions are invalidated on restart. Always set a real one in production.
  sessionSecret = crypto.randomBytes(48).toString('hex');
  if (e.NODE_ENV === 'production') {
    console.warn('⚠️  SESSION_SECRET is not set — using an ephemeral secret. Sessions will NOT survive restarts. Set SESSION_SECRET in .env');
  }
}

const isProduction = e.NODE_ENV === 'production';

export const config = {
  env: e.NODE_ENV,
  isProduction,
  port: e.PORT,
  baseUrl: e.BASE_URL.replace(/\/+$/, ''),
  trustProxy: e.TRUST_PROXY,
  sessionSecret,
  cookieSecure: e.COOKIE_SECURE ?? isProduction,
  databasePath: path.isAbsolute(e.DATABASE_PATH) ? e.DATABASE_PATH : path.resolve(serverRoot, e.DATABASE_PATH),
  uploadsDir: e.UPLOADS_DIR
    ? path.isAbsolute(e.UPLOADS_DIR)
      ? e.UPLOADS_DIR
      : path.resolve(serverRoot, e.UPLOADS_DIR)
    : path.join(serverRoot, 'uploads'),
  clientDist: path.resolve(repoRoot, 'client/dist'),
  autoMigrate: e.AUTO_MIGRATE,
  maxUploadBytes: e.MAX_UPLOAD_MB * 1024 * 1024,
  maxUploadMB: e.MAX_UPLOAD_MB,
  publicApiOrigins: e.PUBLIC_API_ORIGINS.trim() === '*' ? '*' : e.PUBLIC_API_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean),
  mail: {
    transport: e.MAIL_TRANSPORT,
    host: e.SMTP_HOST,
    port: e.SMTP_PORT ?? 587,
    secure: e.SMTP_SECURE,
    user: e.SMTP_USER,
    pass: e.SMTP_PASS,
    from: e.MAIL_FROM ?? 'RJNX Admin <no-reply@localhost>',
  },
  bootstrapAdmin: {
    name: e.ADMIN_NAME,
    email: e.ADMIN_EMAIL,
    username: e.ADMIN_USERNAME,
    password: e.ADMIN_PASSWORD,
  },
  session: {
    cookieName: 'rjnx_admin_session',
    ttlMs: 7 * 24 * 60 * 60 * 1000, // 7 days
    slidingRenewThresholdMs: 24 * 60 * 60 * 1000, // renew when < 1 day left
  },
} as const;

export type AppConfig = typeof config;
