/**
 * Achievements — trophy cabinet entries (title, position, tournament, image).
 */
import { z } from 'zod';
import { crudRouter } from './crud';
import { isoDate, mediaPath, text, requiredText } from './schemas';

const achievementSchema = z.object({
  title: requiredText(140, 'Title'),
  description: text(1000),
  game: text(60),
  tournament: text(140),
  date: isoDate,
  position: text(20),
  image: mediaPath,
  sort_order: z.coerce.number().int().min(0).max(999).default(0),
});

export const achievementsRouter = crudRouter({
  table: 'achievements',
  resource: 'achievements',
  createSchema: achievementSchema,
  updateSchema: achievementSchema.partial(),
  searchFields: ['title', 'game', 'tournament'],
  filterFields: ['game'],
  defaultOrder: 'date DESC, id DESC',
});
