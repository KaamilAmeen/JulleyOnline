import type { NextFunction, Request, Response } from 'express';
import type { ZodType } from 'zod';
import { ApiError } from '../utils/errors.js';

interface ValidationSchemas {
  body?: ZodType;
  query?: ZodType;
  params?: ZodType;
}

/** Validates and replaces request input with the parsed (and coerced) values. */
export function validate(schemas: ValidationSchemas) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      if (schemas.params) {
        const result = schemas.params.safeParse(req.params);
        if (!result.success) throw validationError(result.error.issues);
        req.params = result.data as Request['params'];
      }
      if (schemas.query) {
        const result = schemas.query.safeParse(req.query);
        if (!result.success) throw validationError(result.error.issues);
        // Express 5 exposes req.query as a getter, so it cannot be assigned.
        // Define an own property that shadows the prototype accessor instead.
        Object.defineProperty(req, 'query', {
          value: result.data,
          writable: true,
          configurable: true,
          enumerable: true,
        });
      }
      if (schemas.body) {
        const result = schemas.body.safeParse(req.body);
        if (!result.success) throw validationError(result.error.issues);
        req.body = result.data;
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}

function validationError(issues: { path: PropertyKey[]; message: string }[]): ApiError {
  return new ApiError(
    400,
    'VALIDATION_ERROR',
    'Validation failed',
    issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
  );
}
