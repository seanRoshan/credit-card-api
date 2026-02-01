import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { loggers } from '../config/logger';
import { createResponse } from '../types';

interface ValidationTarget {
  body?: unknown;
  query?: unknown;
  params?: unknown;
}

/**
 * Zod validation middleware factory
 * Validates request body, query, and params against a schema
 */
export const validate = (schema: ZodSchema<ValidationTarget>) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      schema.parse({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const formattedErrors = err.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        }));

        loggers.validation('Request validation failed', { errors: formattedErrors });

        res.status(400).json(
          createResponse(
            false,
            { errors: formattedErrors },
            'Validation failed',
            'VALIDATION_ERROR'
          )
        );
        return;
      }

      // Re-throw non-Zod errors
      throw err;
    }
  };
};

/**
 * Validation error formatter for consistent error responses
 */
export const formatValidationError = (error: ZodError): object => ({
  success: false,
  error: 'Validation failed',
  code: 'VALIDATION_ERROR',
  details: error.issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message,
  })),
  timestamp: new Date().toISOString(),
});
