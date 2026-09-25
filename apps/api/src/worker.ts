import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config();
if (!process.env.DATABASE_URL) {
  dotenv.config({ path: path.resolve(__dirname, '../.env') });
}

import { initWorkers, closeWorkers } from './jobs/index.js';
import { getRedisClient, closeRedis } from './redis/redis.client.js';
import prisma from './prisma.js';
import { logger } from './utils/logger.js';

logger.info('[Worker Process] Initializing D-Board asynchronous background worker...');
getRedisClient();
initWorkers();

const shutdown = async (signal: string) => {
  logger.info(`[Worker Process] Received ${signal}. Gracefully stopping workers and connections...`);
  try {
    await closeWorkers();
    await closeRedis();
    await prisma.$disconnect();
    logger.info('[Worker Process] Graceful shutdown completed cleanly.');
    process.exit(0);
  } catch (err) {
    logger.error('[Worker Process] Error during worker shutdown', err as Error);
    process.exit(1);
  }
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
