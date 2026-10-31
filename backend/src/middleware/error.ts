import { Prisma } from '@prisma/client';
import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { env } from '../config/env.js';
import { ApiError } from '../utils/errors.js';

export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
  next(new ApiError(404, 'NOT_FOUND', `Route ${req.method} ${req.originalUrl} not found`));
}

export function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (res.headersSent) return;

  if (error instanceof ApiError) {
    res.status(error.status).json({
      error: { code: error.code, message: error.message, details: error.details },
    });
    return;
  }

  if (error instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
      },
    });
    return;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      res.status(409).json({ error: { code: 'DUPLICATE', message: 'A record with these values already exists' } });
      return;
    }
    if (error.code === 'P2025') {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Resource not found' } });
      return;
    }
    if (error.code === 'P2003') {
      res.status(400).json({ error: { code: 'INVALID_REFERENCE', message: 'A related record does not exist' } });
      return;
    }
  }

  // eslint-disable-next-line no-console
  console.error('[unhandled error]', error);
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Something went wrong on our side',
      details: env.isProduction ? undefined : String(error),
    },
  });
}
