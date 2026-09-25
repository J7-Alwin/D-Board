import { Redis, type RedisOptions } from 'ioredis';

let redisClient: Redis | null = null;
let isReady = false;

/**
 * Common connection configuration for Redis and BullMQ
 */
export function getRedisConfig(): RedisOptions {
  const url = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
  let host = '127.0.0.1';
  let port = 6379;
  let username: string | undefined;
  let password: string | undefined;
  let db: number | undefined;
  let tls: any = undefined;

  try {
    const parsed = new URL(url);
    host = parsed.hostname || '127.0.0.1';
    port = parsed.port ? parseInt(parsed.port, 10) : 6379;
    if (parsed.username) {
      username = decodeURIComponent(parsed.username);
    }
    if (parsed.password) {
      password = decodeURIComponent(parsed.password);
    }
    if (parsed.pathname && parsed.pathname.length > 1) {
      const dbNum = parseInt(parsed.pathname.slice(1), 10);
      if (!isNaN(dbNum)) db = dbNum;
    }
    const isTls = parsed.protocol === 'rediss:' || process.env.REDIS_TLS === 'true';
    if (isTls) {
      tls = {
        rejectUnauthorized: process.env.REDIS_TLS_REJECT_UNAUTHORIZED === 'true',
      };
    }
  } catch {
    // If not a valid URL format, fallback to default host/port
  }

  return {
    host,
    port,
    username,
    password,
    db,
    tls,
    maxRetriesPerRequest: null, // Required by BullMQ
    enableOfflineQueue: false,  // Fail fast when Redis is down
    connectTimeout: 10000,
    retryStrategy(times) {
      if (process.env.NODE_ENV === 'test') {
        return null;
      }
      if (times > 5) {
        // Stop reconnecting aggressively if server is absent
        return null;
      }
      return Math.min(times * 200, 2000);
    },
    lazyConnect: true,
  };
}

/**
 * Get or initialize the centralized Redis client singleton
 */
export function getRedisClient(): Redis {
  if (!redisClient) {
    const url = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
    redisClient = new Redis(url, getRedisConfig());

    redisClient.on('connect', () => {
      // Connected
    });

    redisClient.on('ready', () => {
      isReady = true;
      console.log('[Redis] Connection established and ready');
    });

    redisClient.on('error', (err: any) => {
      isReady = false;
      // Log cleanly without crashing the API
      if (process.env.NODE_ENV !== 'test') {
        console.warn('[Redis] Connection error or server offline:', err?.message || err);
      }
    });

    redisClient.on('close', () => {
      isReady = false;
    });

    // Initiate connection asynchronously
    redisClient.connect().catch((err) => {
      isReady = false;
      if (process.env.NODE_ENV !== 'test') {
        console.warn('[Redis] Initial connect failed (running in offline/fallback mode):', err?.message || err);
      }
    });
  }

  return redisClient;
}

/**
 * Returns whether Redis is actively connected and ready for commands
 */
export function isRedisReady(): boolean {
  return isReady && redisClient !== null && redisClient.status === 'ready';
}

/**
 * Gracefully close Redis client during application shutdown
 */
export async function closeRedis(): Promise<void> {
  if (redisClient) {
    isReady = false;
    try {
      if (redisClient.status === 'ready' || redisClient.status === 'connecting') {
        await redisClient.quit();
      } else {
        redisClient.disconnect();
      }
    } catch {
      redisClient.disconnect();
    } finally {
      redisClient = null;
    }
  }
}
