import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { AppError, ErrorCode } from '../shared/errors.js';
import { logger } from '../shared/logger.js';

export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (error instanceof AppError) {
    res.status(error.status).json({
      code: error.code,
      message: error.message,
      details: error.details,
    });
    return;
  }

  if (error instanceof ZodError) {
    res.status(400).json({
      code: ErrorCode.VALIDATION_ERROR,
      message: 'The submitted data is invalid.',
      details: error.issues.map((issue) => ({
        field: issue.path.join('.') || undefined,
        message: issue.message,
      })),
    });
    return;
  }

  logger.error('Unhandled error', {
    name: error instanceof Error ? error.name : 'unknown',
  });

  res.status(500).json({
    code: ErrorCode.INTERNAL_ERROR,
    message: 'The request could not be completed.',
    details: [],
  });
}

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({
    code: 'NOT_FOUND',
    message: 'The requested resource was not found.',
    details: [],
  });
}
