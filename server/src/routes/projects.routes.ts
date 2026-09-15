/**
 * Projects (RJNX personal website) — full CRUD with draft/publish workflow.
 */
import { z } from 'zod';
import { crudRouter } from './crud';
import { uniqueSlug } from '../core/utils';
import { httpUrl, mediaPath, text, requiredText, tagsSchema } from './schemas';

const projectSchema = z.object({
  name: requiredText(140, 'Project name'),
  slug: z
    .string()
    .trim()
    .max(80)
    .regex(/^[a-z0-9-]*$/, 'Slug can only contain lowercase letters, numbers and dashes')
    .default(''),
  description: text(3000),
  image: mediaPath,
  github_url: httpUrl,
  live_url: httpUrl,
  technologies: tagsSchema,
  status: z.enum(['draft', 'published']).default('draft'),
  featured: z.coerce.boolean().default(false),
  sort_order: z.coerce.number().int().min(0).max(999).default(0),
});

export const projectsRouter = crudRouter({
  table: 'projects',
  resource: 'projects',
  createSchema: projectSchema,
  updateSchema: projectSchema.partial(),
  searchFields: ['name', 'slug', 'description'],
  filterFields: ['status'],
  jsonFields: ['technologies'],
  defaultOrder: 'sort_order ASC, id DESC',
  beforeCreate: (data) => {
    data.slug = uniqueSlug(data.slug || data.name, 'projects');
  },
  beforeUpdate: (data, current) => {
    if (data.slug !== undefined) data.slug = uniqueSlug(data.slug || current.name, 'projects', current.id);
  },
});
