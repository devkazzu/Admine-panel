/**
 * Esports players — CRUD. Statistics are manually configured key/value pairs
 * (never auto-invented). Socials are per-player.
 */
import { z } from 'zod';
import { get } from '../db';
import { unprocessable } from '../core/errors';
import { crudRouter } from './crud';
import { mediaPath, text, requiredText, socialsSchema, statsSchema } from './schemas';

const playerSchema = z.object({
  gamer_tag: requiredText(40, 'Gamer tag'),
  real_name: text(120),
  image: mediaPath,
  game: text(60),
  team_id: z.coerce.number().int().positive().nullable().default(null),
  role: text(60),
  country: text(60),
  biography: text(3000),
  socials: socialsSchema,
  stats: statsSchema,
  status: z.enum(['active', 'inactive']).default('active'),
  sort_order: z.coerce.number().int().min(0).max(999).default(0),
});

const ensureTeamExists = (teamId: number | null | undefined) => {
  if (teamId == null) return;
  if (!get(`SELECT id FROM teams WHERE id = ?`, [teamId])) {
    throw unprocessable('Selected team does not exist');
  }
};

export const playersRouter = crudRouter({
  table: 'players',
  resource: 'players',
  createSchema: playerSchema,
  updateSchema: playerSchema.partial(),
  searchFields: ['gamer_tag', 'real_name', 'game', 'role', 'country'],
  filterFields: ['status', 'game', 'team_id'],
  jsonFields: ['socials', 'stats'],
  defaultOrder: 'sort_order ASC, gamer_tag ASC',
  beforeCreate: (data) => ensureTeamExists(data.team_id),
  beforeUpdate: (data) => ensureTeamExists(data.team_id),
  transformOut: (row) => ({
    ...row,
    team_name: row.team_id ? (get<any>('SELECT name FROM teams WHERE id = ?', [row.team_id])?.name ?? null) : null,
  }),
});
