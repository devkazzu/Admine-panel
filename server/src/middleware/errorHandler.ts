/**
 * Centralized JSON error handling — every failure path returns a consistent
 * `{ error: { message, code, details? } }` body with a proper status code.
 */
import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { AppError, ValidationError } from '../core/errors';
import { config } from '../config';

export const apiNotFound: RequestHandler = (req, res) => {
  res.status(404).json({ error: { message: `No such API endpoint: ${req.method} ${req.path}`, code: 'not_found' } });
};

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof AppError) {
    return res.status(err.status).json({
      error: { message: err.message, code: err.code, ...(err.details !== undefined ? { details: err.details } : {}) },
    });
  }
  if (err instanceof ZodError) {
    return res.status(422).json({
      error: {
        message: 'Validation failed',
        code: 'validation_error',
        details: err.issues.map((i) => ({ path: i.path.map(String), message: i.message })),
      },
    });
  }
  // SQLite unique/foreign-key violations → friendly 409
  const msg = err?.message ?? '';
  if (typeof msg === 'string' && msg.includes('UNIQUE constraint failed')) {
    const column = msg.split('UNIQUE constraint failed:')[1]?.trim().split('.').pop();
    return res.status(409).json({
      error: {
        message: `A record with this ${column || 'value'} already exists`,
        code: 'conflict',
      },
    });
  }
  if (typeof msg === 'string' && msg.includes('FOREIGN KEY constraint failed')) {
    return res.status(409).json({ error: { message: 'Related record does not exist', code: 'conflict' } });
  }
  console.error(`💥 [${req.method} ${req.path}]`, err);
  return res.status(500).json({
    error: {
      message: config.isProduction ? 'Internal server error' : String(err?.message || err),
      code: 'internal_error',
    },
  });
};

// Multer-specific errors get clean status codes.
export function normalizeMulterError(err: any): AppError | null {
  if (!err || typeof err !== 'object') return null;
  if (err.code === 'LIMIT_FILE_SIZE') {
    return new AppError(413, `File is too large (max ${config.maxUploadMB} MB)`, 'file_too_large');
  }
  return null;
}

// Attach multer normalization into the chain by wrapping errorHandler.
export const errorHandlerWithMulter: ErrorRequestHandler = (err, req, res, next) => {
  const normalized = normalizeMulterError(err);
  return errorHandler(normalized ?? err, req, res, next);
};

// Re-export ValidationError type usage guard for TS
export { ValidationError };
