import { Worker } from 'bullmq';
import { isRedisReady } from '../redis/redis.client.js';
import { createEmailWorker } from './workers/email.worker.js';
import { createDeadlineWorker } from './workers/deadline.worker.js';
import { createCleanupWorker } from './workers/cleanup.worker.js';
import { closeQueues } from './queues.js';

let emailWorker: Worker | null = null;
let deadlineWorker: Worker | null = null;
let cleanupWorker: Worker | null = null;

/**
 * Initialize all BullMQ workers if Redis is available
 */
export function initWorkers(): void {
  try {
    if (!emailWorker) {
      emailWorker = createEmailWorker();
    }
    if (!deadlineWorker) {
      deadlineWorker = createDeadlineWorker();
    }
    if (!cleanupWorker) {
      cleanupWorker = createCleanupWorker();
    }
    console.log('[Workers] BullMQ workers initialized (Email, Deadlines, Cleanup)');
  } catch (err) {
    console.warn('[Workers] Worker initialization deferred/failed:', err);
  }
}

/**
 * Gracefully close all BullMQ workers and queues
 */
export async function closeWorkers(): Promise<void> {
  const closePromises: Promise<any>[] = [];

  if (emailWorker) {
    closePromises.push(emailWorker.close());
    emailWorker = null;
  }
  if (deadlineWorker) {
    closePromises.push(deadlineWorker.close());
    deadlineWorker = null;
  }
  if (cleanupWorker) {
    closePromises.push(cleanupWorker.close());
    cleanupWorker = null;
  }

  closePromises.push(closeQueues());

  await Promise.allSettled(closePromises);
  console.log('[Workers] All BullMQ workers and queues closed cleanly');
}

export * from './job.types.js';
export * from './queues.js';
