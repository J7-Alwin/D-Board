import type { Request, Response, NextFunction } from 'express';
import { getRedisClient, isRedisReady } from '../redis/redis.client.js';

interface RateLimitOptions {
  windowSeconds: number;
  maxRequests: number;
  prefix?: string;
  message?: string;
}

// In-memory sliding-window fallback timestamps when Redis is offline
const memoryTimestamps = new Map<string, number[]>();

function cleanOldMemoryEntries(key: string, windowStartMs: number): number[] {
  const times = memoryTimestamps.get(key) || [];
  const valid = times.filter((t) => t > windowStartMs);
  memoryTimestamps.set(key, valid);
  return valid;
}

/**
 * True sliding-window rate limiter powered by Redis Sorted Sets (ZADD/ZREMRANGEBYSCORE/ZCARD)
 * with robust in-memory sliding-window fallback.
 */
export function createRateLimiter(options: RateLimitOptions) {
  const {
    windowSeconds,
    maxRequests,
    prefix = 'global',
    message = 'Too many requests, please try again later.',
  } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    const authUser = (req as any).user?.userId;
    const clientIp = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const identifier = authUser ? `user:${authUser}` : `ip:${clientIp}`;
    const key = `dboard:rate:zset:${prefix}:${identifier}`;

    const nowMs = Date.now();
    const windowStartMs = nowMs - windowSeconds * 1000;
    const resetTimeSeconds = Math.ceil(nowMs / 1000) + windowSeconds;

    let currentCount = 0;

    if (isRedisReady()) {
      try {
        const client = getRedisClient();
        // Atomic sliding window pipeline
        const multi = client.multi();
        multi.zremrangebyscore(key, 0, windowStartMs);
        multi.zcard(key);
        const results = await multi.exec();

        currentCount = (results && results[1] && typeof results[1][1] === 'number') ? results[1][1] : 0;

        if (currentCount < maxRequests) {
          const insertMulti = client.multi();
          insertMulti.zadd(key, nowMs, `${nowMs}:${Math.random().toString(36).slice(2, 8)}`);
          insertMulti.expire(key, windowSeconds + 2);
          await insertMulti.exec();
          currentCount += 1;
        } else {
          currentCount += 1; // exceeded
        }
      } catch (err) {
        console.warn(`[RateLimit:Redis] Error on ${key}, falling back to memory sliding-window:`, err);
        currentCount = checkMemorySlidingWindow(key, nowMs, windowStartMs, maxRequests);
      }
    } else {
      currentCount = checkMemorySlidingWindow(key, nowMs, windowStartMs, maxRequests);
    }

    const remaining = Math.max(0, maxRequests - currentCount);

    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', resetTimeSeconds);

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

function checkMemorySlidingWindow(key: string, nowMs: number, windowStartMs: number, maxRequests: number): number {
  const activeTimestamps = cleanOldMemoryEntries(key, windowStartMs);
  const count = activeTimestamps.length;

  if (count < maxRequests) {
    activeTimestamps.push(nowMs);
    memoryTimestamps.set(key, activeTimestamps);
    return count + 1;
  }

  return count + 1;
}

const isProd = process.env.NODE_ENV === 'production';

// Auth rate limiter protecting registration, login, token verification
export const authRateLimiter = createRateLimiter({
  prefix: 'auth',
  windowSeconds: 15 * 60,
  maxRequests: isProd ? 30 : 200,
  message: 'Too many authentication attempts. Please try again in 15 minutes.',
});

// Password reset limiter with strict lockout protection
export const passwordResetRateLimiter = createRateLimiter({
  prefix: 'pwd_reset',
  windowSeconds: 15 * 60,
  maxRequests: isProd ? 10 : 100,
  message: 'Too many password reset requests. Please wait 15 minutes before trying again.',
});

// Invitation rate limiter
export const invitationRateLimiter = createRateLimiter({
  prefix: 'invitation',
  windowSeconds: 15 * 60,
  maxRequests: isProd ? 40 : 300,
  message: 'Too many invitation requests. Please wait a few minutes before trying again.',
});

// File upload rate limiter
export const uploadRateLimiter = createRateLimiter({
  prefix: 'upload',
  windowSeconds: 15 * 60,
  maxRequests: isProd ? 60 : 500,
  message: 'Too many file uploads. Please throttle your uploads.',
});

// General API rate limiter
export const apiRateLimiter = createRateLimiter({
  prefix: 'api',
  windowSeconds: 15 * 60,
  maxRequests: isProd ? 3000 : 10000,
  message: 'API rate limit exceeded. Please throttle your requests.',
});
