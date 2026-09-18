import { io as Client, Socket } from 'socket.io-client';
import http from 'http';
import express from 'express';
import { prisma } from './prisma.js';
import { generateJwt } from './utils/security.js';
import { initRealtime } from './realtime/realtime.service.js';
import { workService } from './services/work.service.js';
import { commentService } from './services/comment.service.js';
import { notificationService } from './services/notification.service.js';
import bcrypt from 'bcryptjs';

async function runTests() {
  console.log('🚀 Starting Real-Time Socket.IO Integration Tests...\n');

  // 1. Create a dedicated test server instance
  const app = express();
  const server = http.createServer(app);
  initRealtime(server);

  await new Promise<void>((resolve) => {
    server.listen(5099, () => resolve());
  });

  const SERVER_URL = 'http://localhost:5099';
  const testSuffix = Date.now().toString();
  const passwordHash = await bcrypt.hash('Password123!', 10);

  // 2. Setup Test Users: Owner (User A), Member (User B), Non-Member (User C)
  const userA = await prisma.user.create({
    data: {
      email: `rt_usera_${testSuffix}@example.com`,
      username: `rt_usera_${testSuffix}`,
      passwordHash,
      fullName: 'Realtime User A',
    },
  });

  const userB = await prisma.user.create({
    data: {
      email: `rt_userb_${testSuffix}@example.com`,
      username: `rt_userb_${testSuffix}`,
      passwordHash,
      fullName: 'Realtime User B',
    },
  });

  const userC = await prisma.user.create({
    data: {
      email: `rt_userc_${testSuffix}@example.com`,
      username: `rt_userc_${testSuffix}`,
      passwordHash,
      fullName: 'Realtime User C',
    },
  });

  const tokenA = generateJwt({ userId: userA.id, email: userA.email, username: userA.username });
  const tokenB = generateJwt({ userId: userB.id, email: userB.email, username: userB.username });
  const tokenC = generateJwt({ userId: userC.id, email: userC.email, username: userC.username });

  // 3. Setup Project
  const project = await prisma.project.create({
    data: {
      name: `Realtime Test Project ${testSuffix}`,
      key: `RT${testSuffix.slice(-3)}`,
      description: 'Project for testing real-time events',
      createdById: userA.id,
      members: {
        create: [
          { userId: userA.id, role: 'PROJECT_ADMIN' },
          { userId: userB.id, role: 'PROJECT_MEMBER' },
        ],
      },
    },
  });

  let clientA: Socket | null = null;
  let clientB: Socket | null = null;
  let clientC: Socket | null = null;

  try {
    // TEST 1: Reject unauthenticated connection
    console.log('Test 1: Connection with invalid token is rejected');
    await new Promise<void>((resolve, reject) => {
      const invalidClient = Client(SERVER_URL, {
        auth: { token: 'invalid_token_12345' },
        transports: ['websocket'],
        reconnection: false,
      });

      invalidClient.on('connect_error', (err) => {
        if (err.message.includes('Authentication error')) {
          console.log('  ✓ Connection successfully rejected with Authentication error');
          invalidClient.close();
          resolve();
        } else {
          invalidClient.close();
          reject(new Error(`Unexpected connect_error message: ${err.message}`));
        }
      });

      invalidClient.on('connect', () => {
        invalidClient.close();
        reject(new Error('Invalid token connection was unexpectedly allowed'));
      });
    });

    // TEST 2: Successful connection with valid JWT
    console.log('\nTest 2: Authenticated clients connect and auto-join private user room');
    clientA = await new Promise<Socket>((resolve, reject) => {
      const socket = Client(SERVER_URL, {
        auth: { token: tokenA },
        transports: ['websocket'],
      });
      socket.on('connect', () => resolve(socket));
      socket.on('connect_error', reject);
    });

    clientB = await new Promise<Socket>((resolve, reject) => {
      const socket = Client(SERVER_URL, {
        auth: { token: tokenB },
        transports: ['websocket'],
      });
      socket.on('connect', () => resolve(socket));
      socket.on('connect_error', reject);
    });

    clientC = await new Promise<Socket>((resolve, reject) => {
      const socket = Client(SERVER_URL, {
        auth: { token: tokenC },
        transports: ['websocket'],
      });
      socket.on('connect', () => resolve(socket));
      socket.on('connect_error', reject);
    });
    console.log('  ✓ Clients A, B, and C connected successfully');

    // TEST 3: Authorized Project Room Join vs Unauthorized Rejection
    console.log('\nTest 3: Project room join authorization');
    await new Promise<void>((resolve, reject) => {
      clientB!.emit('join:project', { projectId: project.id }, (res: any) => {
        if (res && res.success && res.room === `project:${project.id}`) {
          console.log('  ✓ Member (Client B) authorized to join project room');
          resolve();
        } else {
          reject(new Error(`Client B failed to join project room: ${JSON.stringify(res)}`));
        }
      });
    });

    await new Promise<void>((resolve, reject) => {
      clientC!.emit('join:project', { projectId: project.id }, (res: any) => {
        if (res && !res.success && res.error.includes('Unauthorized')) {
          console.log('  ✓ Non-member (Client C) rejected from joining project room');
          resolve();
        } else {
          reject(new Error(`Client C was unexpectedly permitted to join project: ${JSON.stringify(res)}`));
        }
      });
    });

    // TEST 4: Work Item Creation broadcast to project room
    console.log('\nTest 4: Work item creation broadcasts WORK_CREATED to project room');
    const workCreatedPromise = new Promise<any>((resolve) => {
      clientB!.once('WORK_CREATED', (payload) => {
        resolve(payload);
      });
    });

    const workItem = await workService.createWorkItem(project.id, userA.id, {
      title: 'Realtime Task #1',
      description: 'Testing live push',
      type: 'TASK',
      status: 'TODO',
      priority: 'HIGH',
      assignedToId: userB.id,
    });

    const workPayload = await workCreatedPromise;
    if (workPayload.workItemId === workItem.id && workPayload.title === 'Realtime Task #1') {
      console.log('  ✓ Client B received live WORK_CREATED event with valid payload');
    } else {
      throw new Error(`Unexpected WORK_CREATED payload: ${JSON.stringify(workPayload)}`);
    }

    // TEST 5: Work Item Status Change broadcast
    console.log('\nTest 5: Status update broadcasts WORK_STATUS_CHANGED');
    const statusChangedPromise = new Promise<any>((resolve) => {
      clientB!.once('WORK_STATUS_CHANGED', (payload) => {
        resolve(payload);
      });
    });

    await workService.updateWorkItem(project.id, workItem.id, userA.id, {
      status: 'IN_PROGRESS',
    });

    const statusPayload = await statusChangedPromise;
    if (statusPayload.workItemId === workItem.id && statusPayload.toStatus === 'IN_PROGRESS') {
      console.log('  ✓ Client B received live WORK_STATUS_CHANGED (TODO -> IN_PROGRESS)');
    } else {
      throw new Error(`Unexpected WORK_STATUS_CHANGED payload: ${JSON.stringify(statusPayload)}`);
    }

    // TEST 6: Comment Creation broadcast
    console.log('\nTest 6: Comment creation broadcasts COMMENT_CREATED');
    const commentCreatedPromise = new Promise<any>((resolve) => {
      clientB!.once('COMMENT_CREATED', (payload) => {
        resolve(payload);
      });
    });

    const comment = await commentService.createComment(userA.id, project.id, workItem.id, {
      content: 'Hello via Real-Time Socket.IO!',
    });

    const commentPayload = await commentCreatedPromise;
    if (commentPayload.commentId === comment.id && commentPayload.preview.includes('Hello via Real-Time')) {
      console.log('  ✓ Client B received live COMMENT_CREATED event');
    } else {
      throw new Error(`Unexpected COMMENT_CREATED payload: ${JSON.stringify(commentPayload)}`);
    }

    // TEST 7: Targeted Notification delivery to private user room
    console.log('\nTest 7: Targeted Notification sent directly to user room');
    const notifReceivedPromise = new Promise<any>((resolve) => {
      clientB!.once('NOTIFICATION_CREATED', (payload) => {
        resolve(payload);
      });
    });

    await notificationService.createNotification({
      recipientId: userB.id,
      actorId: userA.id,
      projectId: project.id,
      type: 'WORK_ASSIGNED',
      title: 'You were assigned a task',
      message: 'User A assigned you to Realtime Task #1',
      link: `/app/projects/${project.id}/board?item=${workItem.id}`,
    });

    const notifPayload = await notifReceivedPromise;
    if (notifPayload.recipientId === userB.id && notifPayload.title === 'You were assigned a task') {
      console.log('  ✓ Client B received live NOTIFICATION_CREATED in user:userB room');
    } else {
      throw new Error(`Unexpected NOTIFICATION_CREATED payload: ${JSON.stringify(notifPayload)}`);
    }

    console.log('\n🎉 ALL REAL-TIME SUITE TESTS PASSED SUCCESSFULLY!\n');
  } finally {
    if (clientA) clientA.close();
    if (clientB) clientB.close();
    if (clientC) clientC.close();

    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });

    // Cleanup DB records
    await prisma.comment.deleteMany({ where: { workItem: { projectId: project.id } } });
    await prisma.activity.deleteMany({ where: { projectId: project.id } });
    await prisma.notification.deleteMany({ where: { projectId: project.id } });
    await prisma.workItem.deleteMany({ where: { projectId: project.id } });
    await prisma.projectMember.deleteMany({ where: { projectId: project.id } });
    await prisma.project.delete({ where: { id: project.id } });
    await prisma.user.deleteMany({
      where: { id: { in: [userA.id, userB.id, userC.id] } },
    });
  }
}

runTests().catch((err) => {
  console.error('❌ Real-Time Tests Failed:', err);
  process.exit(1);
});
