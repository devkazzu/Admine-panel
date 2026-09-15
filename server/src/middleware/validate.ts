/**
 * Zod validation middleware. Parsed values are placed on `req.validated`
 * (body/query/params) so handlers never touch raw input.
 */
import type { RequestHandler } from 'express';
import { ZodError, type ZodTypeAny } from 'zod';
import { ValidationError } from '../core/errors';

interface Schemas {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
}

export function validate(schemas: Schemas): RequestHandler {
  return (req, _res, next) => {
    try {
      req.validated = {};
      if (schemas.params) req.validated.params = schemas.params.parse(req.params);
      if (schemas.query) req.validated.query = schemas.query.parse(req.query);
      if (schemas.body) req.validated.body = schemas.body.parse(req.body);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        next(
          new ValidationError(
            err.issues.map((i) => ({ path: i.path.map(String), message: i.message })),
          ),
        );
      } else next(err);
    }
  };
}
