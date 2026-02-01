import { Request, Response, NextFunction } from 'express';
import * as crypto from 'crypto';
import { config } from '../config/env';
import { loggers } from '../config/logger';
import { createResponse } from '../types';

const API_KEY = config.apiKey;

/**
 * API Key authentication middleware using constant-time comparison
 * to prevent timing attacks.
 */
export const authenticateApiKey = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const apiKey = req.headers['x-api-key'] as string | undefined;
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const path = req.path;

  // Check if API key is provided
  if (!apiKey) {
    loggers.auth('Missing API key', { ip, path });
    res.status(401).json(
      createResponse(false, undefined, 'API key is required', 'AUTH_ERROR')
    );
    return;
  }

  try {
    // Use constant-time comparison to prevent timing attacks
    const keyBuffer = Buffer.from(apiKey);
    const expectedBuffer = Buffer.from(API_KEY);

    // Check lengths match (also in constant time via the comparison below)
    if (keyBuffer.length !== expectedBuffer.length) {
      throw new Error('Invalid key length');
    }

    const isValid = crypto.timingSafeEqual(keyBuffer, expectedBuffer);

    if (!isValid) {
      loggers.auth('Invalid API key', { ip, path });
      res.status(403).json(
        createResponse(false, undefined, 'Invalid API key', 'AUTH_ERROR')
      );
      return;
    }

    loggers.auth('Authentication successful', { ip, path });
    next();
  } catch {
    loggers.auth('Invalid API key (comparison failed)', { ip, path });
    res.status(403).json(
      createResponse(false, undefined, 'Invalid API key', 'AUTH_ERROR')
    );
  }
};

/**
 * Optional authentication - allows requests without API key but marks them
 * Used for health checks and public endpoints
 */
export const optionalAuth = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  const apiKey = req.headers['x-api-key'] as string | undefined;

  if (apiKey) {
    try {
      const keyBuffer = Buffer.from(apiKey);
      const expectedBuffer = Buffer.from(API_KEY);

      if (keyBuffer.length === expectedBuffer.length) {
        const isValid = crypto.timingSafeEqual(keyBuffer, expectedBuffer);
        (req as Request & { authenticated: boolean }).authenticated = isValid;
      }
    } catch {
      (req as Request & { authenticated: boolean }).authenticated = false;
    }
  } else {
    (req as Request & { authenticated: boolean }).authenticated = false;
  }

  next();
};
