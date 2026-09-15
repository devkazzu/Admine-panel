/**
 * Match management — upcoming / live / completed / cancelled, with quick status
 * transitions and automatic result derivation from scores.
 */
import { Router } from 'express';
import { z } from 'zod';
import { get, run } from '../db';
import { AppError, notFound } from '../core/errors';
import { nowIso } from '../core/utils';
import { validate } from '../middleware/validate';
import { requirePermission } from '../middleware/auth';
import { logActivity } from '../services/activity';
import { crudRouter, zodId } from './crud';
import { httpUrl, mediaPath, text, requiredText, isoDateTime } from './schemas';

const matchBase = z.object({
  team_id: z.coerce.number().int().positive().nullable().default(null),
  opponent_name: requiredText(120, 'Opponent name'),
  opponent_logo: mediaPath,
  game: text(60),
  tournament_id: z.coerce.number().int().positive().nullable().default(null),
  starts_at: isoDateTime,
  stream_url: httpUrl,
  our_score: z.coerce.number().int().min(0).max(9999).nullable().default(null),
  opponent_score: z.coerce.number().int().min(0).max(9999).nullable().default(null),
  result: z.enum(['win', 'loss', 'draw', 'pending']).default('pending'),
  status: z.enum(['upcoming', 'live', 'completed', 'cancelled']).default('upcoming'),
  notes: text(500),
});

const matchSchema = matchBase.refine(
  (m) => m.status !== 'completed' || (m.our_score != null && m.opponent_score != null),
  { message: 'A completed match needs both scores', path: ['our_score'] },
);

const quickStatusSchema = z
  .object({
    status: z.enum(['upcoming', 'live', 'completed', 'cancelled']),
    our_score: z.coerce.number().int().min(0).max(9999).nullable().optional(),
    opponent_score: z.coerce.number().int().min(0).max(9999).nullable().optional(),
  })
  .refine((b) => b.status !== 'completed' || (b.our_score != null && b.opponent_score != null), {
    message: 'Enter both scores to complete a match',
    path: ['our_score'],
  });

const ensureRefs = (data: any) => {
  if (data.team_id != null && !get(`SELECT id FROM teams WHERE id = ?`, [data.team_id])) {
    throw new AppError(422, 'Selected RJNX team does not exist', 'validation_error');
  }
  if (data.tournament_id != null && !get(`SELECT id FROM tournaments WHERE id = ?`, [data.tournament_id])) {
    throw new AppError(422, 'Selected tournament does not exist', 'validation_error');
  }
};

const deriveResult = (our: number, their: number): 'win' | 'loss' | 'draw' =>
  our > their ? 'win' : our < their ? 'loss' : 'draw';

export const matchesRouter = Router();

// Quick status transition: PATCH /:id/status
matchesRouter.patch(
  '/:id/status',
  requirePermission('matches:write'),
  validate({ params: zodId, body: quickStatusSchema }),
  (req, res) => {
    const id = req.validated.params.id;
    const current = get<any>('SELECT * FROM matches WHERE id = ?', [id]);
    if (!current) throw notFound('Match not found');
    const { status, our_score, opponent_score } = req.validated.body;

    const update: Record<string, any> = { status, updated_at: nowIso() };
    if (our_score !== undefined) update.our_score = our_score;
    if (opponent_score !== undefined) update.opponent_score = opponent_score;

    if (status === 'completed') {
      const our = update.our_score ?? current.our_score;
      const their = update.opponent_score ?? current.opponent_score;
      if (our == null || their == null) {
        throw new AppError(422, 'Enter both scores to complete a match', 'validation_error');
      }
      update.result = deriveResult(our, their);
    }

    const sets = Object.keys(update).map((k) => `${k} = @${k}`).join(', ');
    run(`UPDATE matches SET ${sets} WHERE id = @id`, { ...update, id });

    logActivity({
      userId: req.user!.id,
      action: 'status_change',
      resourceType: 'matches',
      resourceId: String(id),
      details: { from: current.status, to: status, opponent: current.opponent_name },
      ip: req.ip,
    });
    res.json({ data: get<any>('SELECT * FROM matches WHERE id = ?', [id]) });
  },
);

// Standard CRUD
matchesRouter.use(
  '/',
  crudRouter({
    table: 'matches',
    resource: 'matches',
    createSchema: matchSchema,
    updateSchema: matchBase.partial(),
    searchFields: ['opponent_name', 'game', 'notes'],
    filterFields: ['status', 'game', 'team_id', 'tournament_id'],
    defaultOrder: `CASE status WHEN 'live' THEN 0 WHEN 'upcoming' THEN 1 ELSE 2 END, starts_at DESC`,
    beforeCreate: (data) => {
      ensureRefs(data);
      if (data.status === 'completed' && data.our_score != null && data.opponent_score != null) {
        data.result = deriveResult(data.our_score, data.opponent_score);
      }
    },
    beforeUpdate: (data, current) => {
      ensureRefs(data);
      if (data.status === 'completed') {
        const our = data.our_score ?? current.our_score;
        const their = data.opponent_score ?? current.opponent_score;
        if (our == null || their == null) {
          throw new AppError(422, 'A completed match needs both scores', 'validation_error');
        }
        data.result = deriveResult(our, their);
      }
    },
    transformOut: (row) => ({
      ...row,
      team_name: row.team_id ? (get<any>('SELECT name FROM teams WHERE id = ?', [row.team_id])?.name ?? null) : null,
      tournament_name: row.tournament_id
        ? (get<any>('SELECT name FROM tournaments WHERE id = ?', [row.tournament_id])?.name ?? null)
        : null,
    }),
  }),
);
