/**
 * Shared zod field validators used across resources.
 */
import { z } from 'zod';

export const PLATFORMS = ['youtube', 'github', 'instagram', 'discord', 'x', 'tiktok', 'twitch', 'facebook'] as const;

/** '' or a valid http(s) URL. Optional — defaults to ''. */
export const httpUrl = z
  .string()
  .trim()
  .max(500)
  .refine((v) => v === '' || /^https?:\/\/\S+$/i.test(v), 'Enter a valid http(s) URL')
  .default('');

/** '' or a media-library path or an absolute http(s) URL. Optional — defaults to ''. */
export const mediaPath = z
  .string()
  .trim()
  .max(500)
  .refine(
    (v) => v === '' || v.startsWith('/uploads/') || /^https?:\/\/\S+$/i.test(v),
    'Choose an image from the media library or paste an http(s) URL',
  )
  .default('');

export const isoDate = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the date picker (YYYY-MM-DD)');
/** Optional date: accepts undefined / '' / null → null. */
export const optionalIsoDate = z
  .union([isoDate, z.literal(''), z.null()])
  .optional()
  .transform((v) => (v === '' || v === undefined || v === null ? null : v));
export const isoDateTime = z
  .string()
  .trim()
  .refine((v) => !Number.isNaN(Date.parse(v)), 'Invalid date/time');

const platformUrl = z
  .string()
  .trim()
  .max(300)
  .refine((v) => v === '' || /^https?:\/\/\S+$/i.test(v) || v.startsWith('mailto:'), 'Enter a valid http(s) URL');

/** Social links map: { platform: url } — empty values dropped. */
export const socialsSchema = z
  .object({
    youtube: platformUrl.optional(),
    github: platformUrl.optional(),
    instagram: platformUrl.optional(),
    discord: platformUrl.optional(),
    x: platformUrl.optional(),
    tiktok: platformUrl.optional(),
    twitch: platformUrl.optional(),
    facebook: platformUrl.optional(),
  })
  .default({})
  .transform((obj) => {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (typeof v === 'string' && v.trim() !== '') out[k] = v.trim();
    }
    return out;
  });

/** Manually configurable player statistics. */
export const statsSchema = z
  .array(
    z.object({
      label: z.string().trim().min(1, 'Label is required').max(40),
      value: z.string().trim().min(1, 'Value is required').max(30),
    }),
  )
  .max(20, 'At most 20 statistics')
  .default([]);

export const tagsSchema = z
  .array(z.string().trim().min(1).max(40))
  .max(20, 'At most 20 items')
  .default([]);

/** Interests list for the About section. */
export const interestsSchema = z
  .array(z.string().trim().min(1).max(60))
  .max(24, 'At most 24 interests')
  .default([]);

export const skillsSchema = z
  .array(
    z.object({
      name: z.string().trim().min(1, 'Skill name is required').max(60),
      level: z.coerce.number().int().min(0).max(100),
    }),
  )
  .max(30, 'At most 30 skills')
  .default([]);

export const text = (max: number) => z.string().trim().max(max).default('');
export const requiredText = (max: number, field = 'This field') =>
  z.string().trim().min(1, `${field} is required`).max(max, `${field} must be at most ${max} characters`);
