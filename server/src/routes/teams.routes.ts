/**
 * Esports teams — CRUD with Active / Inactive / Recruiting statuses.
 * Deleting a team keeps players/matches (their team link is cleared).
 */
import { z } from 'zod';
import { crudRouter } from './crud';
import { uniqueSlug } from '../core/utils';
import { mediaPath, text, requiredText, socialsSchema } from './schemas';

const teamSchema = z.object({
  name: requiredText(100, 'Team name'),
  slug: z.string().trim().max(80).regex(/^[a-z0-9-]*$/, 'Slug can only contain lowercase letters, numbers and dashes').default(''),
  game: text(60),
  logo: mediaPath,
  description: text(2000),
  status: z.enum(['active', 'inactive', 'recruiting']).default('active'),
  socials: socialsSchema,
  sort_order: z.coerce.number().int().min(0).max(999).default(0),
});

export const teamsRouter = crudRouter({
  table: 'teams',
  resource: 'teams',
  createSchema: teamSchema,
  updateSchema: teamSchema.partial(),
  searchFields: ['name', 'game', 'description'],
  filterFields: ['status', 'game'],
  jsonFields: ['socials'],
  defaultOrder: 'sort_order ASC, id ASC',
  beforeCreate: (data) => {
    data.slug = uniqueSlug(data.slug || data.name, 'teams');
  },
  beforeUpdate: (data, current) => {
    if (data.slug !== undefined) data.slug = uniqueSlug(data.slug || current.name, 'teams', current.id);
  },
});
