import prisma from '../prisma.js';
import { generateSecureToken, hashToken } from '../utils/security.js';
import { getRedisClient, isRedisReady } from '../redis/redis.client.js';

export interface CreateSessionOptions {
  userAgent?: string;
  ipAddress?: string;
  rememberMe?: boolean;
}

const SESSION_CACHE_PREFIX = 'dboard:session:';
const SESSION_CACHE_TTL_SECONDS = 300; // 5 minute read cache

interface CachedSessionEntry {
  userId: string;
  expiresAt: Date;
  revoked: boolean;
  cachedAt: number;
}

// Ultra-fast in-memory session cache (serves parallel requests in 0ms even when Redis is offline)
const memorySessionCache = new Map<string, CachedSessionEntry>();
const lastTouchedMap = new Map<string, number>();

export class SessionService {
  /**
   * Create a durable PostgreSQL session
   */
  static async createSession(userId: string, options: CreateSessionOptions = {}) {
    const rawSessionToken = generateSecureToken(32);
    const sessionTokenHash = hashToken(rawSessionToken);

    const lifetimeMs = options.rememberMe !== false
      ? 7 * 24 * 60 * 60 * 1000  // 7 days
      : 24 * 60 * 60 * 1000;      // 24 hours

    const expiresAt = new Date(Date.now() + lifetimeMs);

    const session = await prisma.session.create({
      data: {
        userId,
        sessionTokenHash,
        userAgent: options.userAgent ? options.userAgent.slice(0, 500) : null,
        ipAddress: options.ipAddress ? options.ipAddress.slice(0, 100) : null,
        expiresAt,
      },
    });

    // Populate in-memory cache immediately
    memorySessionCache.set(session.id, {
      userId,
      expiresAt,
      revoked: false,
      cachedAt: Date.now(),
    });

    return {
      session,
      rawSessionToken,
      expiresAt,
    };
  }

  /**
   * Validate session state in PostgreSQL (authoritative) with Redis short-lived read cache
   * and in-memory fast path
   */
  static async validateSession(sessionId: string): Promise<{ valid: boolean; userId?: string }> {
    if (!sessionId) return { valid: false };

    // 1. Check ultra-fast in-memory cache first (0ms)
    const memEntry = memorySessionCache.get(sessionId);
    if (memEntry) {
      if (Date.now() - memEntry.cachedAt < SESSION_CACHE_TTL_SECONDS * 1000) {
        if (memEntry.revoked || memEntry.expiresAt <= new Date()) {
          return { valid: false };
        }
        return { valid: true, userId: memEntry.userId };
      } else {
        memorySessionCache.delete(sessionId);
      }
    }

    // 2. Check Redis cache if available
    const cacheKey = `${SESSION_CACHE_PREFIX}${sessionId}`;
    if (isRedisReady()) {
      try {
        const client = getRedisClient();
        const cached = await client.get(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          const expDate = new Date(parsed.expiresAt);
          const isRev = !!parsed.revoked;
          memorySessionCache.set(sessionId, {
            userId: parsed.userId,
            expiresAt: expDate,
            revoked: isRev,
            cachedAt: Date.now(),
          });
          if (isRev || expDate <= new Date()) {
            return { valid: false };
          }
          return { valid: true, userId: parsed.userId };
        }
      } catch {
        // Fallback to PostgreSQL
      }
    }

    // 3. Authoritative PostgreSQL lookup
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        userId: true,
        expiresAt: true,
        revokedAt: true,
        user: { select: { isDeactivated: true } },
      },
    });

    if (!session) {
      return { valid: false };
    }

    const isInvalid = session.revokedAt !== null || session.expiresAt <= new Date() || !!session.user?.isDeactivated;
    if (isInvalid) {
      memorySessionCache.set(sessionId, {
        userId: session.userId,
        expiresAt: session.expiresAt,
        revoked: true,
        cachedAt: Date.now(),
      });
      if (isRedisReady()) {
        try {
          const client = getRedisClient();
          await client.set(cacheKey, JSON.stringify({ revoked: true, expiresAt: session.expiresAt }), 'EX', 60);
        } catch {
          // ignore
        }
      }
      return { valid: false };
    }

    // Cache valid session state in memory and Redis
    memorySessionCache.set(sessionId, {
      userId: session.userId,
      expiresAt: session.expiresAt,
      revoked: false,
      cachedAt: Date.now(),
    });

    if (isRedisReady()) {
      try {
        const client = getRedisClient();
        await client.set(
          cacheKey,
          JSON.stringify({ userId: session.userId, expiresAt: session.expiresAt.toISOString(), revoked: false }),
          'EX',
          SESSION_CACHE_TTL_SECONDS
        );
      } catch {
        // ignore
      }
    }

    return { valid: true, userId: session.userId };
  }

  /**
   * Revoke a specific session (e.g. user logout)
   */
  static async revokeSession(sessionId: string): Promise<void> {
    if (!sessionId) return;

    // Invalidate local in-memory cache immediately
    memorySessionCache.delete(sessionId);
    lastTouchedMap.delete(sessionId);

    await prisma.session.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    // Invalidate Redis cache
    if (isRedisReady()) {
      try {
        const client = getRedisClient();
        await client.del(`${SESSION_CACHE_PREFIX}${sessionId}`);
      } catch {
        // ignore
      }
    }
  }

  /**
   * Revoke all active sessions for a user (e.g. password reset, password change, account deactivation)
   */
  static async revokeAllUserSessions(userId: string): Promise<void> {
    if (!userId) return;

    // Invalidate all in-memory entries for this user
    for (const [id, entry] of memorySessionCache.entries()) {
      if (entry.userId === userId) {
        memorySessionCache.delete(id);
        lastTouchedMap.delete(id);
      }
    }

    const activeSessions = await prisma.session.findMany({
      where: { userId, revokedAt: null },
      select: { id: true },
    });

    await prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    // Invalidate Redis caches
    if (isRedisReady() && activeSessions.length > 0) {
      try {
        const client = getRedisClient();
        const keys = activeSessions.map((s) => `${SESSION_CACHE_PREFIX}${s.id}`);
        await client.del(...keys);
      } catch {
        // ignore
      }
    }
  }

  /**
   * Update last used timestamp for session with 5-minute throttling
   * (Prevents generating redundant write queries to DB on every single parallel API request)
   */
  static async touchSession(sessionId: string): Promise<void> {
    if (!sessionId) return;
    const now = Date.now();
    const lastTouched = lastTouchedMap.get(sessionId) || 0;
    // Throttle to at most once every 5 minutes (300,000 ms)
    if (now - lastTouched < 5 * 60 * 1000) {
      return;
    }
    lastTouchedMap.set(sessionId, now);

    try {
      await prisma.session.update({
        where: { id: sessionId },
        data: { lastUsedAt: new Date() },
      });
    } catch {
      // Non-critical, ignore
    }
  }
}

export const sessionService = SessionService;
