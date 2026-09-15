/**
 * Tournaments — CRUD records with online/offline, prize pool and result.
 */
import { z } from 'zod';
import { AppError } from '../core/errors';
import { crudRouter } from './crud';
import { isoDate, optionalIsoDate, text, requiredText } from './schemas';

const tournamentBase = z.object({
  name: requiredText(140, 'Tournament name'),
  game: text(60),
  organizer: text(120),
  start_date: isoDate,
  end_date: optionalIsoDate,
  location: text(160),
  is_online: z.coerce.boolean().default(false),
  prize_pool: text(60),
  description: text(3000),
  status: z.enum(['upcoming', 'ongoing', 'completed', 'cancelled']).default('upcoming'),
  result: text(300),
});

const tournamentSchema = tournamentBase.refine((t) => !t.end_date || t.end_date >= t.start_date, {
  message: 'End date must be after the start date',
  path: ['end_date'],
});

export const tournamentsRouter = crudRouter({
  table: 'tournaments',
  resource: 'tournaments',
  createSchema: tournamentSchema,
  updateSchema: tournamentBase.partial(),
  searchFields: ['name', 'game', 'organizer', 'location'],
  filterFields: ['status', 'game'],
  defaultOrder: 'start_date DESC, id DESC',
  beforeUpdate: (data, current) => {
    const end = data.end_date !== undefined ? data.end_date : current.end_date;
    const start = data.start_date ?? current.start_date;
    if (end && end < start) {
      throw new AppError(422, 'End date must be after the start date', 'validation_error', [
        { path: ['end_date'], message: 'End date must be after the start date' },
      ]);
    }
  },
});
