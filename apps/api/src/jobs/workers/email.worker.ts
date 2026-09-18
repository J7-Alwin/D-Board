import { Worker, type Job } from 'bullmq';
import { getRedisConfig } from '../../redis/redis.client.js';
import { QUEUE_NAMES, type EmailJobData } from '../job.types.js';
import { sendPasswordResetEmail, sendInvitationEmail } from '../../services/email.service.js';

export function createEmailWorker(): Worker<EmailJobData> {
  const worker = new Worker<EmailJobData>(
    QUEUE_NAMES.EMAIL,
    async (job: Job<EmailJobData>) => {
      const { data } = job;
      console.log(`[EmailWorker] Processing job ${job.id} (${data.type}) for ${data.toEmail}`);

      if (data.type === 'PASSWORD_RESET') {
        const success = await sendPasswordResetEmail({
          toEmail: data.toEmail,
          username: data.username,
          resetToken: data.resetToken,
        });

        if (!success) {
          throw new Error(`Failed to deliver password reset email to ${data.toEmail}`);
        }
      } else if (data.type === 'PROJECT_INVITATION') {
        const success = await sendInvitationEmail({
          toEmail: data.toEmail,
          inviterName: data.inviterName,
          projectName: data.projectName,
          projectKey: data.projectKey,
          role: data.role,
          message: data.message,
          expiresAt: new Date(data.expiresAt),
        });

        if (!success) {
          throw new Error(`Failed to deliver invitation email to ${data.toEmail}`);
        }
      } else {
        throw new Error(`Unknown email job type: ${(data as any).type}`);
      }

      return { delivered: true, recipient: data.toEmail };
    },
    {
      connection: getRedisConfig() as any,
      concurrency: 5,
    }
  );

  worker.on('completed', (job) => {
    console.log(`[EmailWorker] Completed job ${job?.id} (${job?.data?.type})`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[EmailWorker] Failed job ${job?.id} (${job?.data?.type}):`, err?.message || err);
  });

  return worker;
}
