import { Request, Response, NextFunction } from 'express';
import * as crypto from 'crypto';
import { db } from '../config/firebase';

// Extend Express Request to include API client info
declare global {
  namespace Express {
    interface Request {
      apiClient?: {
        id: string;
        name: string;
        rateLimit: number;
      };
    }
  }
}

// In-memory rate limit tracking (resets on function cold start)
const rateLimitStore: Map<string, { count: number; resetAt: number }> = new Map();

// Rate limit window in milliseconds (1 minute)
const RATE_LIMIT_WINDOW = 60 * 1000;

// Default rate limit (requests per minute)
const DEFAULT_RATE_LIMIT = 60;

/**
 * Hash an API key for secure storage comparison
 */
export function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

/**
 * Generate a new API key
 */
export function generateApiKey(): string {
  const prefix = 'cc_';
  const randomPart = crypto.randomBytes(24).toString('base64url');
  return `${prefix}${randomPart}`;
}

/**
 * Middleware to verify API key from header
 * Expects: X-API-Key: <api_key>
 */
export async function requireApiKey(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const apiKey = req.headers['x-api-key'] as string;

  if (!apiKey) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing X-API-Key header',
    });
    return;
  }

  try {
    // Hash the provided key and look it up
    const hashedKey = hashApiKey(apiKey);
    const keyDoc = await db.collection('api_keys').doc(hashedKey).get();

    if (!keyDoc.exists) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid API key',
      });
      return;
    }

    const keyData = keyDoc.data();

    if (!keyData?.active) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'API key has been revoked',
      });
      return;
    }

    // Attach client info to request
    req.apiClient = {
      id: keyDoc.id,
      name: keyData.name || 'Unknown',
      rateLimit: keyData.rateLimit || DEFAULT_RATE_LIMIT,
    };

    // Update last used timestamp (fire and forget)
    db.collection('api_keys').doc(hashedKey).update({
      lastUsedAt: new Date(),
      usageCount: (keyData.usageCount || 0) + 1,
    }).catch(err => console.warn('Failed to update API key usage:', err));

    next();
  } catch (error) {
    console.error('Error verifying API key:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to verify API key',
    });
  }
}

/**
 * Rate limiting middleware
 * Must be used after requireApiKey to use client-specific limits
 */
export function rateLimit(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const clientId = req.apiClient?.id || req.ip || 'anonymous';
  const limit = req.apiClient?.rateLimit || DEFAULT_RATE_LIMIT;
  const now = Date.now();

  // Get or initialize rate limit entry
  let entry = rateLimitStore.get(clientId);

  if (!entry || now > entry.resetAt) {
    // New window
    entry = { count: 0, resetAt: now + RATE_LIMIT_WINDOW };
    rateLimitStore.set(clientId, entry);
  }

  entry.count++;

  // Set rate limit headers
  const remaining = Math.max(0, limit - entry.count);
  const resetSeconds = Math.ceil((entry.resetAt - now) / 1000);

  res.setHeader('X-RateLimit-Limit', limit);
  res.setHeader('X-RateLimit-Remaining', remaining);
  res.setHeader('X-RateLimit-Reset', resetSeconds);

  if (entry.count > limit) {
    res.status(429).json({
      error: 'Too Many Requests',
      message: `Rate limit exceeded. Try again in ${resetSeconds} seconds.`,
      retryAfter: resetSeconds,
    });
    return;
  }

  next();
}

/**
 * Combined middleware: API key + rate limiting
 */
export async function requireApiKeyWithRateLimit(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  await requireApiKey(req, res, () => {
    rateLimit(req, res, next);
  });
}
