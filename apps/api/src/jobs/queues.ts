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
 * Remove any pending deadline reminder jobs for a work item (e.g. on complete, date change, or unassign)
 */
export async function cancelDeadlineJobs(workItemId: string): Promise<void> {
  if (isRedisReady()) {
    try {
      const q = getDeadlineQueue();
      const jobTypes = ['DEADLINE_SOON', 'DEADLINE_OVERDUE'];
      for (const type of jobTypes) {
        const jobId = `deadline_${workItemId}_${type}`;
        const job = await q.getJob(jobId);
        if (job) {
          await job.remove();
        }
      }
    } catch (err) {
      console.warn('[Queue:Deadlines] Failed to remove deadline jobs:', err);
    }
  }
}

/**
 * Schedule deadline reminders with exact delays and deterministic job IDs
 */
export async function scheduleWorkItemDeadlines(item: {
  id: string;
  projectId: string;
  title: string;
  dueDate: Date | string | null;
  assignedToId: string | null;
  status: string;
}): Promise<void> {
  // Always cancel any existing jobs first to prevent duplicates
  await cancelDeadlineJobs(item.id);

  // If completed, or missing due date or assignee, no reminders are scheduled
  if (!item.dueDate || !item.assignedToId || item.status === 'COMPLETED') {
    return;
  }

  const dueDateObj = new Date(item.dueDate);
  const dueMs = dueDateObj.getTime();
  const nowMs = Date.now();
  const dueDateIso = dueDateObj.toISOString();

  if (dueMs <= nowMs) {
    // Already overdue: trigger overdue notification immediately (delay: 0)
    await enqueueDeadlineJob(
      {
        workItemId: item.id,
        projectId: item.projectId,
        title: item.title,
        dueDate: dueDateIso,
        assignedToId: item.assignedToId,
        reminderType: 'DEADLINE_OVERDUE',
      },
      `deadline_${item.id}_DEADLINE_OVERDUE`,
      0
    );
    return;
  }

  // Future due date:
  // 1) DEADLINE_SOON
  const twentyFourHoursMs = 24 * 60 * 60 * 1000;
  let soonDelayMs: number | null = null;
  if (dueMs - nowMs > twentyFourHoursMs) {
    // Due > 24 hours away: trigger reminder 24h before due date
    soonDelayMs = (dueMs - twentyFourHoursMs) - nowMs;
  } else if (dueMs - nowMs > 60 * 60 * 1000) {
    // Due between 1h and 24h away: trigger reminder halfway
    soonDelayMs = Math.floor((dueMs - nowMs) / 2);
  } else {
    // Due in <= 1 hour: trigger reminder in half of remaining time
    soonDelayMs = Math.max(0, Math.floor((dueMs - nowMs) / 2));
  }

  if (soonDelayMs !== null && soonDelayMs >= 0) {
    await enqueueDeadlineJob(
      {
        workItemId: item.id,
        projectId: item.projectId,
        title: item.title,
        dueDate: dueDateIso,
        assignedToId: item.assignedToId,
        reminderType: 'DEADLINE_SOON',
      },
      `deadline_${item.id}_DEADLINE_SOON`,
      soonDelayMs
    );
  }

  // 2) DEADLINE_OVERDUE: trigger exactly at dueDate
  const overdueDelayMs = dueMs - nowMs;
  await enqueueDeadlineJob(
    {
      workItemId: item.id,
      projectId: item.projectId,
      title: item.title,
      dueDate: dueDateIso,
      assignedToId: item.assignedToId,
      reminderType: 'DEADLINE_OVERDUE',
    },
    `deadline_${item.id}_DEADLINE_OVERDUE`,
    overdueDelayMs
  );
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
