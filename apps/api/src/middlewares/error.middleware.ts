import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';

export class AppError extends Error {
  public statusCode?: number;
  public code?: string;
  public errors?: Record<string, string[]>;

  constructor(message: string, statusCode = 500, errors?: Record<string, string[]>, code?: string) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.errors = errors;
    this.code = code;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const statusCode = typeof err.statusCode === 'number' && err.statusCode >= 400 && err.statusCode <= 599
    ? err.statusCode
    : 500;

  const isProd = process.env.NODE_ENV === 'production';
  const message =
    statusCode === 500 && isProd
      ? 'An unexpected error occurred. Please try again later.'
      : err.message || 'Internal Server Error';

  const errorCode =
    err.code ||
    (statusCode === 400
      ? 'BAD_REQUEST'
      : statusCode === 401
      ? 'UNAUTHORIZED'
      : statusCode === 403
      ? 'FORBIDDEN'
      : statusCode === 404
      ? 'NOT_FOUND'
      : statusCode === 409
      ? 'CONFLICT'
      : statusCode === 429
      ? 'TOO_MANY_REQUESTS'
      : 'INTERNAL_SERVER_ERROR');

  const requestId = req.id || (req.headers['x-request-id'] as string) || undefined;

  // Log error using structured logger
  if (statusCode >= 500) {
    logger.error(`[API Error] ${req.method} ${req.originalUrl || req.url}`, {
      requestId,
      statusCode,
      errorCode,
      errorName: err.name,
      errorMessage: err.message,
      stack: isProd ? undefined : err.stack,
    });
  } else {
    logger.warn(`[API Client Warning] ${req.method} ${req.originalUrl || req.url}`, {
      requestId,
      statusCode,
      errorCode,
      errorMessage: err.message,
    });
  }

  res.status(statusCode).json({
    success: false,
    message,
    code: errorCode,
    ...(requestId ? { requestId } : {}),
    ...(err.errors ? { errors: err.errors } : {}),
  });
}

