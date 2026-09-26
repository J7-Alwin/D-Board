import { Request, Response } from 'express';
import prisma from '../prisma.js';
import { isRedisReady, getRedisClient } from '../redis/redis.client.js';
import { storageService } from '../storage/storage.service.js';
import { getEmailQueue, getDeadlineQueue, getCleanupQueue } from '../jobs/queues.js';
import { logger } from '../utils/logger.js';

export async function getLiveness(_req: Request, res: Response): Promise<void> {
  res.status(200).json({
    status: 'ok',
    service: 'd-board-api',
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
}

export async function getReadiness(_req: Request, res: Response): Promise<void> {
  const checks: Record<string, { status: 'healthy' | 'unhealthy'; latencyMs?: number; details?: string }> = {};
  let overallReady = true;

  // 1. Database Check (PostgreSQL)
  const dbStart = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = { status: 'healthy', latencyMs: Date.now() - dbStart };
  } catch (err: any) {
    overallReady = false;
    const errorCode = err?.code || 'UNKNOWN';
    const errorName = err?.name || 'DatabaseError';
    logger.warn(`[Health] Database probe query failed: [${errorCode}] ${errorName}`);
    checks.database = {
      status: 'unhealthy',
      latencyMs: Date.now() - dbStart,
      details: 'Failed to query database',
    };
  }

  // 2. Redis Check
  const redisStart = Date.now();
  try {
    const redis = getRedisClient();
    const redisAvailable = isRedisReady();
    if (redisAvailable && redis) {
      const pingResult = await redis.ping();
      if (pingResult === 'PONG') {
        checks.redis = { status: 'healthy', latencyMs: Date.now() - redisStart };
      } else {
        overallReady = false;
        checks.redis = { status: 'unhealthy', latencyMs: Date.now() - redisStart, details: 'Unexpected ping response' };
      }
    } else {
      // In development, Redis might be optional, but in production it's critical for rate limiting and queues
      const isProd = process.env.NODE_ENV === 'production';
      if (isProd) {
        overallReady = false;
        checks.redis = { status: 'unhealthy', latencyMs: Date.now() - redisStart, details: 'Redis not ready' };
      } else {
        checks.redis = { status: 'healthy', latencyMs: Date.now() - redisStart, details: 'Redis offline (tolerated in dev)' };
      }
    }
  } catch (err: any) {
    const isProd = process.env.NODE_ENV === 'production';
    if (isProd) overallReady = false;
    checks.redis = {
      status: isProd ? 'unhealthy' : 'healthy',
      latencyMs: Date.now() - redisStart,
      details: 'Redis ping failed',
    };
  }

  // 3. Storage Provider Check
  const storageStart = Date.now();
  try {
    const storageHealth = await storageService.checkHealth();
    checks.storage = {
      status: storageHealth.status === 'healthy' ? 'healthy' : 'unhealthy',
      latencyMs: Date.now() - storageStart,
      details: `driver: ${storageHealth.driver}`,
    };
    if (storageHealth.status !== 'healthy') {
      overallReady = false;
    }
  } catch (err: any) {
    overallReady = false;
    checks.storage = {
      status: 'unhealthy',
      latencyMs: Date.now() - storageStart,
      details: 'Storage check failed',
    };
  }

  // 4. Background Queues Check
  try {
    const emailQueue = getEmailQueue();
    const deadlineQueue = getDeadlineQueue();
    const cleanupQueue = getCleanupQueue();
    const queuesActive = !!(emailQueue && deadlineQueue && cleanupQueue);
    checks.queues = {
      status: queuesActive ? 'healthy' : 'unhealthy',
      details: queuesActive ? 'All 3 BullMQ queues initialized' : 'Queues unavailable',
    };
    if (!queuesActive && process.env.NODE_ENV === 'production') {
      overallReady = false;
    }
  } catch (err: any) {
    checks.queues = { status: 'unhealthy', details: 'Queue status error' };
    if (process.env.NODE_ENV === 'production') overallReady = false;
  }

  const httpStatus = overallReady ? 200 : 503;
  res.status(httpStatus).json({
    status: overallReady ? 'ready' : 'not_ready',
    service: 'd-board-api',
    checks,
    timestamp: new Date().toISOString(),
  });
}
