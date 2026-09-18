import { Worker, type Job } from 'bullmq';
import { getRedisConfig } from '../../redis/redis.client.js';
import { QUEUE_NAMES, type DeadlineReminderJobData } from '../job.types.js';
import { prisma } from '../../prisma.js';
import { notificationService } from '../../services/notification.service.js';

export function createDeadlineWorker(): Worker<DeadlineReminderJobData> {
  const worker = new Worker<DeadlineReminderJobData>(
    QUEUE_NAMES.DEADLINES,
    async (job: Job<DeadlineReminderJobData>) => {
      const { data } = job;
      console.log(`[DeadlineWorker] Checking deadline for work item ${data.workItemId} (${data.reminderType})`);

      // 1. Fetch current status of the work item
      const workItem = await prisma.workItem.findUnique({
        where: { id: data.workItemId },
        include: {
          assignedTo: {
            select: { id: true, fullName: true, username: true },
          },
          project: {
            select: { id: true, name: true, key: true },
          },
        },
      });

      if (!workItem) {
        console.log(`[DeadlineWorker] Work item ${data.workItemId} no longer exists, skipping.`);
        return { skipped: true, reason: 'NOT_FOUND' };
      }

      // 2. If already completed, skip reminder
      if (workItem.status === 'COMPLETED') {
        console.log(`[DeadlineWorker] Work item ${data.workItemId} is already COMPLETED, skipping reminder.`);
        return { skipped: true, reason: 'ALREADY_COMPLETED' };
      }

      // 3. If no assignee or assignee changed, skip
      if (!workItem.assignedToId || workItem.assignedToId !== data.assignedToId) {
        console.log(`[DeadlineWorker] Assignee changed or unassigned for work item ${data.workItemId}, skipping.`);
        return { skipped: true, reason: 'ASSIGNEE_CHANGED' };
      }

      // 4. Determine title and message
      const isOverdue = data.reminderType === 'DEADLINE_OVERDUE';
      const notifType = isOverdue ? 'DEADLINE_OVERDUE' : 'DEADLINE_SOON';
      const notifTitle = isOverdue ? 'Work item is overdue' : 'Work item due soon';
      const notifMessage = isOverdue
        ? `"${workItem.title}" in ${workItem.project.name} was due on ${new Date(workItem.dueDate || data.dueDate).toLocaleDateString()}`
        : `"${workItem.title}" in ${workItem.project.name} is due soon on ${new Date(workItem.dueDate || data.dueDate).toLocaleDateString()}`;

      // 5. Create targeted notification
      const notification = await notificationService.createNotification({
        recipientId: workItem.assignedToId,
        projectId: workItem.projectId,
        workItemId: workItem.id,
        type: notifType,
        title: notifTitle,
        message: notifMessage,
        link: `/app/projects/${workItem.projectId}/board?item=${workItem.id}`,
      });

      console.log(`[DeadlineWorker] Dispatched ${notifType} notification for work item ${workItem.id}`);
      return { dispatched: true, notificationId: notification?.id };
    },
    {
      connection: getRedisConfig() as any,
      concurrency: 5,
    }
  );

  worker.on('completed', (job) => {
    console.log(`[DeadlineWorker] Completed job ${job?.id}`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[DeadlineWorker] Failed job ${job?.id}:`, err?.message || err);
  });

  return worker;
}
