import { Redis, type RedisOptions } from 'ioredis';

let redisClient: Redis | null = null;
let isReady = false;

const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

/**
 * Common connection configuration for Redis and BullMQ
 */
export function getRedisConfig(): RedisOptions {
  return {
    maxRetriesPerRequest: null, // Required by BullMQ
    enableOfflineQueue: false,  // Fail fast when Redis is down
    connectTimeout: 5000,
    retryStrategy(times) {
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
    redisClient = new Redis(REDIS_URL, getRedisConfig());

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
