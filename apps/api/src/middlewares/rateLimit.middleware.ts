import type { Request, Response, NextFunction } from 'express';
import { getRedisClient, isRedisReady } from '../redis/redis.client.js';

interface RateLimitOptions {
  windowSeconds: number;
  maxRequests: number;
  prefix?: string;
  message?: string;
}

// In-memory fallback counters when Redis is unavailable
const memoryRateLimits = new Map<string, { count: number; resetAt: number }>();

function cleanMemoryLimits() {
  const now = Date.now();
  for (const [k, v] of memoryRateLimits.entries()) {
    if (v.resetAt <= now) {
      memoryRateLimits.delete(k);
    }
  }
}

export function createRateLimiter(options: RateLimitOptions) {
  const {
    windowSeconds,
    maxRequests,
    prefix = 'global',
    message = 'Too many requests, please try again later.',
  } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    // Determine unique client identifier
    const authUser = (req as any).user?.userId;
    const clientIp = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const identifier = authUser ? `user:${authUser}` : `ip:${clientIp}`;
    const key = `dboard:rate:${prefix}:${identifier}`;

    const nowSeconds = Math.floor(Date.now() / 1000);
    const resetTime = nowSeconds + windowSeconds;

    let currentCount = 1;
    let remaining = maxRequests;

    if (isRedisReady()) {
      try {
        const client = getRedisClient();
        const count = await client.incr(key);
        if (count === 1) {
          await client.expire(key, windowSeconds);
        }
        currentCount = count;
      } catch (err) {
        console.warn(`[RateLimit] Redis error on ${key}, falling back to memory:`, err);
        currentCount = getMemoryCount(key, windowSeconds);
      }
    } else {
      currentCount = getMemoryCount(key, windowSeconds);
    }

    remaining = Math.max(0, maxRequests - currentCount);

    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', resetTime);

    if (currentCount > maxRequests) {
      res.setHeader('Retry-After', windowSeconds);
      return res.status(429).json({
        success: false,
        error: message,
        retryAfterSeconds: windowSeconds,
      });
    }

    next();
  };
}

function getMemoryCount(key: string, windowSeconds: number): number {
  cleanMemoryLimits();
  const now = Date.now();
  const entry = memoryRateLimits.get(key);

  if (!entry || entry.resetAt <= now) {
    memoryRateLimits.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
    return 1;
  }

  entry.count += 1;
  return entry.count;
}

// Configured standard rate limiters (Auth & API rate limiters set to generous/passthrough in development for smooth testing)
export const authRateLimiter = (_req: Request, _res: Response, next: NextFunction) => {
  // Passthrough for development - removes login attempt blocks and lockout
  next();
};

export const invitationRateLimiter = process.env.NODE_ENV === 'production'
  ? createRateLimiter({
      prefix: 'invitation',
      windowSeconds: 15 * 60,
      maxRequests: 40,
      message: 'Too many invitation requests. Please wait a few minutes before trying again.',
    })
  : (_req: Request, _res: Response, next: NextFunction) => next();

export const apiRateLimiter = process.env.NODE_ENV === 'production'
  ? createRateLimiter({
      prefix: 'api',
      windowSeconds: 15 * 60,
      maxRequests: 5000,
      message: 'API rate limit exceeded. Please throttle your requests.',
    })
  : (_req: Request, _res: Response, next: NextFunction) => next();

