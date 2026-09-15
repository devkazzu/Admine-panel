/**
 * Typed HTTP errors used across the API. Handlers throw these; the global
 * error middleware maps them to proper status codes + JSON bodies.
 */
export class AppError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, message: string, code = 'error', details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (msg: string, details?: unknown) => new AppError(400, msg, 'bad_request', details);
export const unauthorized = (msg = 'Authentication required') => new AppError(401, msg, 'unauthorized');
export const forbidden = (msg = 'You do not have permission to perform this action') => new AppError(403, msg, 'forbidden');
export const notFound = (msg = 'Resource not found') => new AppError(404, msg, 'not_found');
export const conflict = (msg: string, details?: unknown) => new AppError(409, msg, 'conflict', details);
export const unprocessable = (msg: string, details?: unknown) => new AppError(422, msg, 'validation_error', details);
export const tooMany = (msg = 'Too many requests, please slow down') => new AppError(429, msg, 'rate_limited');

/** Validation failure carrying structured zod issues for the frontend. */
export class ValidationError extends AppError {
  constructor(issues: { path: (string | number)[]; message: string }[]) {
    super(422, 'Validation failed', 'validation_error', issues);
  }
}
