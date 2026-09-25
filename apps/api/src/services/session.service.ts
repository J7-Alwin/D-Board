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

    return {
      session,
      rawSessionToken,
      expiresAt,
    };
  }

  /**
   * Validate session state in PostgreSQL (authoritative) with Redis short-lived read cache
   */
  static async validateSession(sessionId: string): Promise<{ valid: boolean; userId?: string }> {
    if (!sessionId) return { valid: false };

    // 1. Check Redis cache first if available
    const cacheKey = `${SESSION_CACHE_PREFIX}${sessionId}`;
    if (isRedisReady()) {
      try {
        const client = getRedisClient();
        const cached = await client.get(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed.revoked || new Date(parsed.expiresAt) <= new Date()) {
            return { valid: false };
          }
          return { valid: true, userId: parsed.userId };
        }
      } catch {
        // Fallback to PostgreSQL
      }
    }

    // 2. Authoritative PostgreSQL lookup
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

    if (session.revokedAt !== null || session.expiresAt <= new Date() || session.user?.isDeactivated) {
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

    // Cache valid session state in Redis
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
   * Update last used timestamp for session
   */
  static async touchSession(sessionId: string): Promise<void> {
    if (!sessionId) return;
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
