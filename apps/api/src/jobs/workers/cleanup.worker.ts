import { Worker, type Job } from 'bullmq';
import { getRedisConfig } from '../../redis/redis.client.js';
import { QUEUE_NAMES, type CleanupJobData } from '../job.types.js';
import { prisma } from '../../prisma.js';

export function createCleanupWorker(): Worker<CleanupJobData> {
  const worker = new Worker<CleanupJobData>(
    QUEUE_NAMES.CLEANUP,
    async (job: Job<CleanupJobData>) => {
      const { data } = job;
      const now = new Date();
      console.log(`[CleanupWorker] Running cleanup job ${job.id} (${data.type})`);

      if (data.type === 'EXPIRED_INVITATIONS') {
        const res = await prisma.invitation.updateMany({
          where: {
            status: 'PENDING',
            expiresAt: { lt: now },
          },
          data: {
            status: 'EXPIRED',
          },
        });
        console.log(`[CleanupWorker] Marked ${res.count} expired invitations as EXPIRED.`);
        return { cleaned: res.count, type: data.type };
      } else if (data.type === 'EXPIRED_RESET_TOKENS') {
        const res = await prisma.user.updateMany({
          where: {
            passwordResetExpiresAt: { lt: now },
          },
          data: {
            passwordResetTokenHash: null,
            passwordResetExpiresAt: null,
          },
        });
        console.log(`[CleanupWorker] Cleared ${res.count} expired password reset tokens.`);
        return { cleaned: res.count, type: data.type };
      } else if (data.type === 'EXPIRED_NOTIFICATIONS') {
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const res = await prisma.notification.deleteMany({
          where: {
            createdAt: { lt: sevenDaysAgo },
          },
        });
        console.log(`[CleanupWorker] Purged ${res.count} notifications older than 7 days.`);
        return { cleaned: res.count, type: data.type };
      }

      return { cleaned: 0 };
    },
    {
      connection: getRedisConfig() as any,
      concurrency: 2,
    }
  );

  worker.on('completed', (job) => {
    console.log(`[CleanupWorker] Completed job ${job?.id}`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[CleanupWorker] Failed job ${job?.id}:`, err?.message || err);
  });

  return worker;
}
