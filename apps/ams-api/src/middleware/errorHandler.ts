import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { logger } from '../utils/logger.js';

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly message: string,
    public readonly code?: string
  ) {
    super(message);
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(msg: string)  { return new AppError(400, msg, 'BAD_REQUEST'); }
  static unauthorized(msg = 'Unauthorized') { return new AppError(401, msg, 'UNAUTHORIZED'); }
  static forbidden(msg = 'Forbidden')       { return new AppError(403, msg, 'FORBIDDEN'); }
  static notFound(res: string)    { return new AppError(404, `${res} not found`, 'NOT_FOUND'); }
  static conflict(msg: string)    { return new AppError(409, msg, 'CONFLICT'); }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: { code: err.code, message: err.message } });
    return;
  }
  if (err instanceof ZodError) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Validation failed', details: err.flatten().fieldErrors } });
    return;
  }
  logger.error('Unhandled error', { message: err.message, stack: err.stack });
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } });
}
