/**
 * List-query parsing shared by all admin list endpoints:
 *   ?page=1&perPage=20&q=search&sort=field&order=asc
 * Pagination is always capped; sort must be whitelisted by the caller.
 */
import { z } from 'zod';

export const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().max(120).optional().default(''),
});

export type ListQuery = z.infer<typeof listQuerySchema>;

export interface PageMeta {
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
}

export function pageMeta(page: number, perPage: number, total: number): PageMeta {
  return { page, perPage, total, totalPages: Math.max(1, Math.ceil(total / perPage)) };
}

export const offset = (q: { page: number; perPage: number }) => (q.page - 1) * q.perPage;
