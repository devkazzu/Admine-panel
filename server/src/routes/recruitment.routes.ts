/**
 * Recruitment openings — Open / Closed positions with application deadlines.
 */
import { z } from 'zod';
import { crudRouter } from './crud';
import { optionalIsoDate, text, requiredText } from './schemas';

const openingSchema = z.object({
  position: requiredText(120, 'Position'),
  game: text(60),
  role: text(60),
  description: text(3000),
  requirements: text(3000),
  status: z.enum(['open', 'closed']).default('open'),
  deadline: optionalIsoDate,
});

export const recruitmentRouter = crudRouter({
  table: 'recruitment_openings',
  resource: 'recruitment',
  createSchema: openingSchema,
  updateSchema: openingSchema.partial(),
  searchFields: ['position', 'game', 'role'],
  filterFields: ['status', 'game'],
  defaultOrder: 'created_at DESC',
});
