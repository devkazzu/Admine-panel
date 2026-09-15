/**
 * Generic, config-driven CRUD router factory.
 *
 * Gives every resource the same, consistent behaviour:
 *  - GET    /            paginated list with ?q= search + whitelisted filters
 *  - POST   /            create            (write permission)
 *  - GET    /:id         read one          (read permission)
 *  - PATCH  /:id         update            (write permission)
 *  - DELETE /:id         delete            (write permission)
 *  - activity logging, JSON column (de)serialization, 404/409 handling
 *
 * All SQL uses prepared statements with bound parameters; column names come
 * from zod schemas / whitelists — never from user input.
 */
import { Router, type Request } from 'express';
import { z, type ZodTypeAny } from 'zod';
import { all, get, run, parseJson } from '../db';
import { notFound } from '../core/errors';
import { nowIso, escapeLike } from '../core/utils';
import { validate } from '../middleware/validate';
import { requirePermission } from '../middleware/auth';
import { listQuerySchema, pageMeta, offset } from '../core/pagination';
import { logActivity } from '../services/activity';

export interface CrudOptions {
  /** SQL table name. */
  table: string;
  /** Permission + activity-log resource key, e.g. 'projects'. */
  resource: string;
  createSchema: ZodTypeAny;
  updateSchema: ZodTypeAny;
  /** Text columns matched against ?q= */
  searchFields?: string[];
  /** Columns allowing exact-match ?column=value filters. */
  filterFields?: string[];
  /** Columns stored as JSON text and parsed on read. */
  jsonFields?: string[];
  /** Whitelisted ORDER BY clause. */
  defaultOrder?: string;
  readPerm?: string;
  writePerm?: string;
  /** Transform a DB row before it is sent to the client. */
  transformOut?: (row: any, req: Request) => any;
  /** Hook: mutate/validate data before INSERT (throw AppError to reject). */
  beforeCreate?: (data: Record<string, any>, req: Request) => void;
  /** Hook: mutate/validate data before UPDATE (throw AppError to reject). */
  beforeUpdate?: (data: Record<string, any>, current: any, req: Request) => void;
  /** Hook: block deletion by throwing (e.g. AppError 409). */
  beforeDelete?: (current: any, req: Request) => void;
  /** Hook after a row is created. */
  afterCreate?: (row: any, req: Request) => void;
  /** Extra WHERE clause for list queries (SQL snippet; params merged in). */
  listWhere?: { sql: string; params?: Record<string, any> };
}

const zodId = z.object({ id: z.coerce.number().int().positive() });

export function crudRouter(opts: CrudOptions): Router {
  const router = Router();
  const readPerm = opts.readPerm ?? `${opts.resource}:read`;
  const writePerm = opts.writePerm ?? `${opts.resource}:write`;
  const order = opts.defaultOrder ?? 'created_at DESC';

  const filterShape: Record<string, z.ZodOptional<z.ZodString>> = {};
  for (const f of opts.filterFields ?? []) filterShape[f] = z.string().trim().max(60).optional();
  const listSchema = listQuerySchema.extend(filterShape);

  const serialize = (data: Record<string, any>) => {
    const out = { ...data };
    for (const [k, v] of Object.entries(out)) {
      // SQLite has no boolean type — store 0/1.
      if (typeof v === 'boolean') out[k] = v ? 1 : 0;
    }
    for (const f of opts.jsonFields ?? []) {
      if (out[f] !== undefined && out[f] !== null && typeof out[f] !== 'string') {
        out[f] = JSON.stringify(out[f]);
      }
    }
    return out;
  };

  const parseRow = (row: any, req: Request) => {
    if (!row) return row;
    const out = { ...row };
    for (const f of opts.jsonFields ?? []) {
      if (out[f] !== undefined) out[f] = parseJson(out[f], f === 'socials' ? {} : []);
    }
    return opts.transformOut ? opts.transformOut(out, req) : out;
  };

  const fetchOne = (id: number) => get<any>(`SELECT * FROM ${opts.table} WHERE id = ?`, [id]);
  const displayName = (row: any, id: any) =>
    row?.name ?? row?.title ?? row?.gamer_tag ?? row?.position ?? row?.platform ?? String(id);

  // ── LIST ───────────────────────────────────────────────────────────────────
  router.get('/', requirePermission(readPerm), validate({ query: listSchema }), (req, res) => {
    const q = req.validated.query as any;
    const where: string[] = [];
    const params: Record<string, any> = {};

    if (q.q && opts.searchFields?.length) {
      where.push(`(${opts.searchFields.map((f, i) => `${f} LIKE @q${i} ESCAPE '\\'`).join(' OR ')})`);
      opts.searchFields.forEach((_, i) => {
        params[`q${i}`] = `%${escapeLike(q.q)}%`;
      });
    }
    for (const f of opts.filterFields ?? []) {
      const v = q[f];
      if (v !== undefined && v !== '' && v !== null) {
        where.push(`${f} = @f_${f}`);
        params[`f_${f}`] = v;
      }
    }
    if (opts.listWhere) {
      where.push(opts.listWhere.sql);
      Object.assign(params, opts.listWhere.params ?? {});
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const total = (get<{ count: number }>(`SELECT COUNT(*) AS count FROM ${opts.table} ${whereSql}`, params) ?? { count: 0 }).count;
    const rows = all<any>(`SELECT * FROM ${opts.table} ${whereSql} ORDER BY ${order} LIMIT @limit OFFSET @offset`, {
      ...params,
      limit: q.perPage,
      offset: offset(q),
    });
    res.json({ data: rows.map((r) => parseRow(r, req)), meta: pageMeta(q.page, q.perPage, total) });
  });

  // ── CREATE ─────────────────────────────────────────────────────────────────
  router.post('/', requirePermission(writePerm), validate({ body: opts.createSchema }), (req, res) => {
    const data = serialize(req.validated.body);
    opts.beforeCreate?.(data, req);
    const keys = Object.keys(data);
    if (keys.length === 0) {
      return res.status(400).json({ error: { message: 'No fields to insert', code: 'bad_request' } });
    }
    const cols = keys.join(', ');
    const placeholders = keys.map((k) => `@${k}`).join(', ');
    const info = run(`INSERT INTO ${opts.table} (${cols}) VALUES (${placeholders})`, data);
    const row = fetchOne(Number(info.lastInsertRowid));
    opts.afterCreate?.(row, req);
    logActivity({
      userId: req.user!.id,
      action: 'create',
      resourceType: opts.resource,
      resourceId: String(info.lastInsertRowid),
      details: { name: displayName(row, info.lastInsertRowid) },
      ip: req.ip,
    });
    res.status(201).json({ data: parseRow(row, req) });
  });

  // ── READ ONE ───────────────────────────────────────────────────────────────
  router.get('/:id', requirePermission(readPerm), validate({ params: zodId }), (req, res) => {
    const row = fetchOne(req.validated.params.id);
    if (!row) throw notFound(`${opts.resource} not found`);
    res.json({ data: parseRow(row, req) });
  });

  // ── UPDATE ─────────────────────────────────────────────────────────────────
  router.patch('/:id', requirePermission(writePerm), validate({ params: zodId, body: opts.updateSchema }), (req, res) => {
    const id = req.validated.params.id;
    const current = fetchOne(id);
    if (!current) throw notFound(`${opts.resource} not found`);
    const data = serialize(req.validated.body);
    opts.beforeUpdate?.(data, current, req);
    const keys = Object.keys(data);
    if (keys.length === 0) return res.json({ data: parseRow(current, req) });
    const sets = keys.map((k) => `${k} = @${k}`).join(', ');
    run(`UPDATE ${opts.table} SET ${sets}, updated_at = @__updated WHERE id = @__id`, {
      ...data,
      __updated: nowIso(),
      __id: id,
    });
    const row = fetchOne(id);

    // Log publish/unpublish transitions explicitly.
    if (data.status !== undefined && current.status !== data.status) {
      if (data.status === 'published') {
        logActivity({ userId: req.user!.id, action: 'publish', resourceType: opts.resource, resourceId: String(id), ip: req.ip });
      } else if (current.status === 'published') {
        logActivity({ userId: req.user!.id, action: 'unpublish', resourceType: opts.resource, resourceId: String(id), ip: req.ip });
      } else {
        logActivity({ userId: req.user!.id, action: 'status_change', resourceType: opts.resource, resourceId: String(id), details: { from: current.status, to: data.status }, ip: req.ip });
      }
    }
    logActivity({
      userId: req.user!.id,
      action: 'update',
      resourceType: opts.resource,
      resourceId: String(id),
      details: { fields: keys },
      ip: req.ip,
    });
    res.json({ data: parseRow(row, req) });
  });

  // ── DELETE ─────────────────────────────────────────────────────────────────
  router.delete('/:id', requirePermission(writePerm), validate({ params: zodId }), (req, res) => {
    const id = req.validated.params.id;
    const current = fetchOne(id);
    if (!current) throw notFound(`${opts.resource} not found`);
    opts.beforeDelete?.(current, req);
    run(`DELETE FROM ${opts.table} WHERE id = ?`, [id]);
    logActivity({
      userId: req.user!.id,
      action: 'delete',
      resourceType: opts.resource,
      resourceId: String(id),
      details: { name: displayName(current, id) },
      ip: req.ip,
    });
    res.status(204).send();
  });

  return router;
}

/** Shared param schema for custom routes. */
export { zodId };
