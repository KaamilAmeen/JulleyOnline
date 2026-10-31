import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env.js';
import { ApiError } from '../utils/errors.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Lightweight CSRF defence: browsers always send Origin on cross-site
 * state-changing requests, so reject unknown origins. Non-browser clients
 * (Postman, tests) do not send Origin and are unaffected.
 */
export function originGuard(req: Request, _res: Response, next: NextFunction): void {
  if (SAFE_METHODS.has(req.method)) return next();

  const origin = req.header('origin');
  if (!origin) return next();
  if (env.corsOrigins.includes(origin)) return next();

  next(ApiError.forbidden(`Origin ${origin} is not allowed`));
}
