/**
 * Site-level social links. Only active links with a URL are exposed publicly —
 * unconfigured platforms simply never appear on the public website.
 */
import { z } from 'zod';
import { crudRouter } from './crud';
import { PLATFORMS, httpUrl, text } from './schemas';

const socialSchema = z.object({
  platform: z.enum(PLATFORMS),
  url: httpUrl.refine((v) => v !== '', 'URL is required'),
  label: text(80),
  is_active: z.coerce.boolean().default(true),
  sort_order: z.coerce.number().int().min(0).max(999).default(0),
});

export const socialsRouter = crudRouter({
  table: 'social_links',
  resource: 'socials',
  createSchema: socialSchema,
  updateSchema: socialSchema.partial(),
  searchFields: ['platform', 'label', 'url'],
  filterFields: ['platform', 'is_active'],
  jsonFields: [],
  defaultOrder: 'sort_order ASC, id ASC',
  listWhere: { sql: `owner_type = 'site' AND owner_id = 0` },
  beforeCreate: (data) => {
    data.owner_type = 'site';
    data.owner_id = 0;
  },
});
