import { Queue, type JobsOptions } from 'bullmq';
import { getRedisConfig, isRedisReady } from '../redis/redis.client.js';
import {
  QUEUE_NAMES,
  type EmailJobData,
  type DeadlineReminderJobData,
  type CleanupJobData,
} from './job.types.js';
import { sendPasswordResetEmail, sendInvitationEmail } from '../services/email.service.js';

const defaultJobOptions: JobsOptions = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 2000,
  },
  removeOnComplete: {
    count: 100,
  },
  removeOnFail: {
    count: 500,
  },
};

let emailQueue: Queue<any> | null = null;
let deadlineQueue: Queue<any> | null = null;
let cleanupQueue: Queue<any> | null = null;

function getRedisConnection() {
  return getRedisConfig() as any;
}

export function getEmailQueue(): Queue<any> {
  if (!emailQueue) {
    emailQueue = new Queue(QUEUE_NAMES.EMAIL, {
      connection: getRedisConnection(),
      defaultJobOptions,
    });
  }
  return emailQueue;
}

export function getDeadlineQueue(): Queue<any> {
  if (!deadlineQueue) {
    deadlineQueue = new Queue(QUEUE_NAMES.DEADLINES, {
      connection: getRedisConnection(),
      defaultJobOptions,
    });
  }
  return deadlineQueue;
}

export function getCleanupQueue(): Queue<any> {
  if (!cleanupQueue) {
    cleanupQueue = new Queue(QUEUE_NAMES.CLEANUP, {
      connection: getRedisConnection(),
      defaultJobOptions,
    });
  }
  return cleanupQueue;
}

/**
 * Enqueue an Email Job (Password Reset or Project Invitation)
 */
export async function enqueueEmailJob(data: EmailJobData, customJobId?: string): Promise<{ queued: boolean; jobId?: string }> {
  const jobId = customJobId || `email_${data.type.toLowerCase()}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

  if (isRedisReady()) {
    try {
      const q = getEmailQueue();
      const job = await q.add(data.type, data, { jobId });
      return { queued: true, jobId: job.id };
    } catch (err) {
      console.warn('[Queue:Email] Failed to enqueue to BullMQ, falling back to direct transport:', err);
    }
  }

  // Fallback: Direct synchronous/asynchronous execution if Redis is unavailable
  try {
    if (data.type === 'PASSWORD_RESET') {
      await sendPasswordResetEmail({
        toEmail: data.toEmail,
        username: data.username,
        resetToken: data.resetToken,
      });
    } else if (data.type === 'PROJECT_INVITATION') {
      await sendInvitationEmail({
        toEmail: data.toEmail,
        inviterName: data.inviterName,
        projectName: data.projectName,
        projectKey: data.projectKey,
        role: data.role,
        message: data.message,
        expiresAt: new Date(data.expiresAt),
      });
    }
    return { queued: false, jobId };
  } catch (directErr) {
    console.error('[Email Dispatch Fallback Error]:', directErr);
    throw directErr;
  }
}

/**
 * Enqueue a Deadline Reminder Job
 */
export async function enqueueDeadlineJob(
  data: DeadlineReminderJobData,
  customJobId?: string,
  delayMs?: number
): Promise<{ queued: boolean; jobId?: string }> {
  const jobId = customJobId || `deadline_${data.workItemId}_${data.reminderType}`;

  if (isRedisReady()) {
    try {
      const q = getDeadlineQueue();
      const job = await q.add(data.reminderType, data, {
        jobId,
        delay: delayMs && delayMs > 0 ? delayMs : undefined,
      });
      return { queued: true, jobId: job.id };
    } catch (err) {
      console.warn('[Queue:Deadlines] Failed to enqueue to BullMQ:', err);
    }
  }

  return { queued: false, jobId };
}

/**
 * Enqueue a Cleanup Job
 */
export async function enqueueCleanupJob(data: CleanupJobData, customJobId?: string): Promise<{ queued: boolean; jobId?: string }> {
  const jobId = customJobId || `cleanup_${data.type.toLowerCase()}_${Date.now()}`;

  if (isRedisReady()) {
    try {
      const q = getCleanupQueue();
      const job = await q.add(data.type, data, { jobId });
      return { queued: true, jobId: job.id };
    } catch (err) {
      console.warn('[Queue:Cleanup] Failed to enqueue to BullMQ:', err);
    }
  }

  return { queued: false, jobId };
}

/**
 * Close all queues during application shutdown
 */
export async function closeQueues(): Promise<void> {
  const closePromises: Promise<any>[] = [];
  if (emailQueue) {
    closePromises.push(emailQueue.close());
    emailQueue = null;
  }
  if (deadlineQueue) {
    closePromises.push(deadlineQueue.close());
    deadlineQueue = null;
  }
  if (cleanupQueue) {
    closePromises.push(cleanupQueue.close());
    cleanupQueue = null;
  }
  await Promise.allSettled(closePromises);
}
