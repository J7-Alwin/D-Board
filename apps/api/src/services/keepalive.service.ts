import crypto from 'crypto';
import prisma from '../prisma.js';
import { logger } from '../utils/logger.js';
import env from '../config/env.js';

export interface KeepaliveResult {
  success: boolean;
  status: 'healthy' | 'unhealthy';
  service: string;
  timestamp: string;
  latencyMs?: number;
}

let keepaliveTimer: NodeJS.Timeout | null = null;
let initialTimeout: NodeJS.Timeout | null = null;

/**
 * Executes a round-trip database retrieval query to keep the PostgreSQL/Supabase
 * instance active and prevent idle project pausing.
 *
 * Hardened to return zero sensitive schema or user information.
 */
export async function pingDatabase(): Promise<KeepaliveResult> {
  const start = Date.now();
  const timestamp = new Date().toISOString();

  try {
    // Round-trip query to PostgreSQL / Supabase
    await prisma.$queryRaw`SELECT CURRENT_TIMESTAMP AS server_time`;
    const latencyMs = Date.now() - start;

    logger.info(`[KeepAlive] Supabase database pinged successfully (${latencyMs}ms)`, {
      latencyMs,
      timestamp,
    });

    return {
      success: true,
      status: 'healthy',
      service: 'd-board-db-keepalive',
      timestamp,
      latencyMs,
    };
  } catch (err: any) {
    const latencyMs = Date.now() - start;
    const errorCode = err?.code || 'UNKNOWN';

    logger.error(`[KeepAlive] Database ping query failed [${errorCode}]`, {
      latencyMs,
      timestamp,
      errorCode,
    });

    // Explicitly sanitize output: never leak database credentials, connection strings, or stack traces
    return {
      success: false,
      status: 'unhealthy',
      service: 'd-board-db-keepalive',
      timestamp,
      latencyMs,
    };
  }
}

/**
 * Validates the cron secret header using constant-time comparison to prevent timing attacks.
 * Supports:
 *  - Header: `x-cron-key: <secret>`
 *  - Header: `Authorization: Bearer <secret>`
 */
export function verifyCronSecret(authHeader?: string, cronKeyHeader?: string): boolean {
  const configuredSecret = env.CRON_SECRET || process.env.CRON_SECRET;

  // If no secret is configured in the environment (e.g. dev mode without env secret),
  // request is permitted under rate-limiting controls.
  if (!configuredSecret) {
    return true;
  }

  let providedSecret = '';
  if (cronKeyHeader && typeof cronKeyHeader === 'string') {
    providedSecret = cronKeyHeader.trim();
  } else if (authHeader && typeof authHeader === 'string') {
    if (authHeader.startsWith('Bearer ')) {
      providedSecret = authHeader.slice(7).trim();
    } else {
      providedSecret = authHeader.trim();
    }
  }

  if (!providedSecret) {
    return false;
  }

  const configBuffer = Buffer.from(configuredSecret, 'utf8');
  const providedBuffer = Buffer.from(providedSecret, 'utf8');

  if (configBuffer.length !== providedBuffer.length) {
    return false;
  }

  try {
    return crypto.timingSafeEqual(configBuffer, providedBuffer);
  } catch {
    return false;
  }
}

/**
 * Initializes the automated in-app cron job to ping the database twice a day (every 12 hours).
 */
export function startKeepaliveCron(): void {
  if (keepaliveTimer || initialTimeout) {
    return;
  }

  const intervalHours = env.KEEPALIVE_INTERVAL_HOURS || 12;
  const intervalMs = Math.max(1, intervalHours) * 60 * 60 * 1000;

  logger.info(`[KeepAlive] Automated database keepalive scheduler initialized (runs every ${intervalHours} hours)`);

  // Run initial ping after 20 seconds to allow the connection pool to stabilize
  initialTimeout = setTimeout(async () => {
    initialTimeout = null;
    logger.info('[KeepAlive] Running initial startup database keepalive ping...');
    await pingDatabase();
  }, 20_000);

  // Periodic timer for twice-daily keepalive execution
  keepaliveTimer = setInterval(async () => {
    logger.info('[KeepAlive] Running scheduled database keepalive ping...');
    await pingDatabase();
  }, intervalMs);

  // Unref timer so it does not block node process exit in CLI or tests
  if (typeof keepaliveTimer.unref === 'function') {
    keepaliveTimer.unref();
  }
  if (initialTimeout && typeof initialTimeout.unref === 'function') {
    initialTimeout.unref();
  }
}

/**
 * Gracefully stops the automated keepalive timers.
 */
export function stopKeepaliveCron(): void {
  if (initialTimeout) {
    clearTimeout(initialTimeout);
    initialTimeout = null;
  }
  if (keepaliveTimer) {
    clearInterval(keepaliveTimer);
    keepaliveTimer = null;
  }
  logger.info('[KeepAlive] Automated database keepalive scheduler stopped');
}

