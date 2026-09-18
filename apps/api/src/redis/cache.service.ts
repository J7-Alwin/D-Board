import { getRedisClient, isRedisReady } from './redis.client.js';

const CACHE_PREFIX = 'dboard:cache:';
const DEFAULT_TTL_SECONDS = 300; // 5 minutes

// In-memory fallback cache when Redis is offline
const memoryCache = new Map<string, { value: string; expiresAt: number }>();

function cleanMemoryCache() {
  const now = Date.now();
  for (const [k, v] of memoryCache.entries()) {
    if (v.expiresAt <= now) {
      memoryCache.delete(k);
    }
  }
}

export class CacheService {
  /**
   * Format namespaced key
   */
  private formatKey(key: string): string {
    return key.startsWith(CACHE_PREFIX) ? key : `${CACHE_PREFIX}${key}`;
  }

  /**
   * Get cached item
   */
  async get<T>(key: string): Promise<T | null> {
    const formattedKey = this.formatKey(key);

    if (isRedisReady()) {
      try {
        const client = getRedisClient();
        const raw = await client.get(formattedKey);
        if (raw) {
          return JSON.parse(raw) as T;
        }
        return null;
      } catch (err) {
        console.warn(`[Cache] Redis get error on ${formattedKey}, using fallback:`, err);
      }
    }

    // In-memory fallback
    cleanMemoryCache();
    const entry = memoryCache.get(formattedKey);
    if (entry && entry.expiresAt > Date.now()) {
      try {
        return JSON.parse(entry.value) as T;
      } catch {
        return null;
      }
    }

    return null;
  }

  /**
   * Set cached item with TTL (in seconds)
   */
  async set(key: string, value: any, ttlSeconds: number = DEFAULT_TTL_SECONDS): Promise<void> {
    const formattedKey = this.formatKey(key);
    const serialized = JSON.stringify(value);

    if (isRedisReady()) {
      try {
        const client = getRedisClient();
        await client.set(formattedKey, serialized, 'EX', ttlSeconds);
        return;
      } catch (err) {
        console.warn(`[Cache] Redis set error on ${formattedKey}:`, err);
      }
    }

    // In-memory fallback
    memoryCache.set(formattedKey, {
      value: serialized,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  /**
   * Delete a cached key
   */
  async del(key: string): Promise<void> {
    const formattedKey = this.formatKey(key);

    if (isRedisReady()) {
      try {
        const client = getRedisClient();
        await client.del(formattedKey);
      } catch (err) {
        console.warn(`[Cache] Redis del error on ${formattedKey}:`, err);
      }
    }

    memoryCache.delete(formattedKey);
  }

  /**
   * Delete all keys matching a pattern
   */
  async delPattern(pattern: string): Promise<void> {
    const formattedPattern = this.formatKey(pattern);

    if (isRedisReady()) {
      try {
        const client = getRedisClient();
        const keys = await client.keys(formattedPattern);
        if (keys.length > 0) {
          await client.del(...keys);
        }
      } catch (err) {
        console.warn(`[Cache] Redis delPattern error on ${formattedPattern}:`, err);
      }
    }

    // Memory cache pattern deletion
    const regexPattern = new RegExp('^' + formattedPattern.replace(/\*/g, '.*') + '$');
    for (const k of memoryCache.keys()) {
      if (regexPattern.test(k)) {
        memoryCache.delete(k);
      }
    }
  }

  /**
   * Cache-aside wrapper: return cached value or compute, store, and return
   */
  async wrap<T>(key: string, fetchFn: () => Promise<T>, ttlSeconds: number = DEFAULT_TTL_SECONDS): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null && cached !== undefined) {
      return cached;
    }

    const fresh = await fetchFn();
    if (fresh !== null && fresh !== undefined) {
      await this.set(key, fresh, ttlSeconds);
    }
    return fresh;
  }

  // Helper Key Builders for Scoped Cache Isolation
  keys = {
    userDashboard: (userId: string) => `user:${userId}:dashboard`,
    userUnreadNotifications: (userId: string) => `user:${userId}:notifications:unread`,
    userMyWork: (userId: string) => `user:${userId}:mywork`,
    userProjects: (userId: string) => `user:${userId}:projects`,
    projectSummary: (projectId: string) => `project:${projectId}:summary`,
    projectMembers: (projectId: string) => `project:${projectId}:members`,
  };

  /**
   * Invalidate all cached data for a specific user
   */
  async invalidateUser(userId: string): Promise<void> {
    await this.delPattern(`user:${userId}:*`);
  }

  /**
   * Invalidate all cached data for a specific project
   */
  async invalidateProject(projectId: string): Promise<void> {
    await this.delPattern(`project:${projectId}:*`);
  }
}

export const cacheService = new CacheService();
