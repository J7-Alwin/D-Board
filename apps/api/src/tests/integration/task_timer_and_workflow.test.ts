import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../../server.js';
import prisma from '../../prisma.js';

describe('Task Stage Workflow and Cumulative Timer Integration Tests', () => {
  const timestamp = Date.now();
  const userA = {
    username: `timertest_a_${timestamp}`,
    email: `timertest_a_${timestamp}@example.com`,
    password: 'Password123!Secure',
    fullName: 'Timer Test User A',
  };

  const userB = {
    username: `timertest_b_${timestamp}`,
    email: `timertest_b_${timestamp}@example.com`,
    password: 'Password123!Secure',
    fullName: 'Timer Test User B',
  };

  let userAId: string;
  let userBId: string;
  let userACookie: string;
  let userBCookie: string;
  let workspaceId: string;
  let projectId: string;
  let workItemId: string;

  beforeAll(async () => {
    // 1. Register User A
    const resA = await request(app).post('/api/auth/register').send(userA);
    userAId = resA.body.data.user.id;
    await prisma.user.update({ where: { id: userAId }, data: { isEmailVerified: true } });

    const loginA = await request(app).post('/api/auth/login').send({
      identifier: userA.email,
      password: userA.password,
    });
    const cookiesA = loginA.headers['set-cookie'];
    userACookie = Array.isArray(cookiesA) ? cookiesA[0].split(';')[0] : cookiesA.split(';')[0];

    // 2. Register User B
    const resB = await request(app).post('/api/auth/register').send(userB);
    userBId = resB.body.data.user.id;
    await prisma.user.update({ where: { id: userBId }, data: { isEmailVerified: true } });

    const loginB = await request(app).post('/api/auth/login').send({
      identifier: userB.email,
      password: userB.password,
    });
    const cookiesB = loginB.headers['set-cookie'];
    userBCookie = Array.isArray(cookiesB) ? cookiesB[0].split(';')[0] : cookiesB.split(';')[0];

    // 3. User A creates Workspace
    const wsRes = await request(app)
      .post('/api/workspaces')
      .set('Cookie', userACookie)
      .send({ name: `Timer WS ${timestamp}` });
    workspaceId = wsRes.body.data.workspace.id;

    // Add User B to Workspace
    await prisma.workspaceMember.create({
      data: {
        workspaceId,
        userId: userBId,
        role: 'WORKSPACE_MEMBER',
      },
    });

    // 4. User A creates Project
    const prjRes = await request(app)
      .post('/api/projects')
      .set('Cookie', userACookie)
      .set('x-workspace-id', workspaceId)
      .send({
        name: `Timer Prj ${timestamp}`,
        key: 'TPR',
        description: 'Testing timer and stage workflow in D-Board',
        workspaceId,
        technologyStack: ['React', 'Node'],
      });
    expect(prjRes.status).toBe(201);
    projectId = prjRes.body.data.project.id;

    // Add User B to Project
    await prisma.projectMember.create({
      data: {
        projectId,
        userId: userBId,
        role: 'PROJECT_MEMBER',
      },
    });
  });

  afterAll(async () => {
    if (workItemId) {
      await prisma.workItem.deleteMany({ where: { id: workItemId } }).catch(() => {});
    }
    if (projectId) {
      await prisma.project.deleteMany({ where: { id: projectId } }).catch(() => {});
    }
    if (workspaceId) {
      await prisma.workspace.deleteMany({ where: { id: workspaceId } }).catch(() => {});
    }
    await prisma.user.deleteMany({
      where: { id: { in: [userAId, userBId].filter(Boolean) } },
    }).catch(() => {});
  });

  it('1. Create task in TODO stage with multiple assignees', async () => {
    const today = new Date();
    const d1 = new Date(today.getTime() + 86400000 * 2).toISOString().split('T')[0];
    const d2 = new Date(today.getTime() + 86400000 * 4).toISOString().split('T')[0];
    const d3 = new Date(today.getTime() + 86400000 * 6).toISOString().split('T')[0];
    const d4 = new Date(today.getTime() + 86400000 * 8).toISOString().split('T')[0];

    const res = await request(app)
      .post(`/api/projects/${projectId}/work`)
      .set('Cookie', userACookie)
      .send({
        title: 'Collaborative Multi-User Feature Task',
        type: 'FEATURE',
        priority: 'HIGH',
        status: 'TODO',
        assigneeIds: [userAId, userBId],
        todoDueDate: d1,
        inProgressDueDate: d2,
        inReviewDueDate: d3,
        completedDueDate: d4,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    workItemId = res.body.data.workItem.id;
    expect(res.body.data.workItem.status).toBe('TODO');
    expect(res.body.data.workItem.assignees.length).toBe(2);
    expect(res.body.data.workItem.assignees.every((a: any) => !a.hasStarted)).toBe(true);
  });

  it('2. User A starts the task -> Task remains in TODO until all assignees start', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/work/${workItemId}/start`)
      .set('Cookie', userACookie);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const item = res.body.data.workItem;
    expect(item.status).toBe('TODO'); // Still TODO because User B hasn't started!

    const assigneeA = item.assignees.find((a: any) => a.userId === userAId);
    const assigneeB = item.assignees.find((a: any) => a.userId === userBId);
    expect(assigneeA.hasStarted).toBe(true);
    expect(assigneeB.hasStarted).toBe(false);
  });

  it('3. User B starts the task -> ALL started -> Task advances to IN_PROGRESS and timers sync', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/work/${workItemId}/start`)
      .set('Cookie', userBCookie);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const item = res.body.data.workItem;
    expect(item.status).toBe('IN_PROGRESS'); // Automatically advanced!

    const assigneeA = item.assignees.find((a: any) => a.userId === userAId);
    const assigneeB = item.assignees.find((a: any) => a.userId === userBId);
    expect(assigneeA.hasStarted).toBe(true);
    expect(assigneeB.hasStarted).toBe(true);
    expect(assigneeA.isPaused).toBe(false);
    expect(assigneeB.isPaused).toBe(false);
    expect(assigneeA.lastSessionStartedAt).toBeDefined();
    expect(assigneeB.lastSessionStartedAt).toBeDefined();
  });

  it('4. User A checks in within the 25-30 min cycle -> stacks duration and resets session', async () => {
    // Simulate 20 minutes (1200 seconds) elapsed since session started
    const twentyMinsAgo = new Date(Date.now() - 1200 * 1000);
    await prisma.workItemAssignee.updateMany({
      where: { workItemId, userId: userAId },
      data: { lastSessionStartedAt: twentyMinsAgo },
    });

    const res = await request(app)
      .post(`/api/projects/${projectId}/work/${workItemId}/check-in`)
      .set('Cookie', userACookie);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const assigneeA = res.body.data.workItem.assignees.find((a: any) => a.userId === userAId);
    expect(assigneeA.totalDurationSeconds).toBeGreaterThanOrEqual(1200);
    expect(assigneeA.isPaused).toBe(false);
    expect(assigneeA.lastCheckInCycle).toBeGreaterThanOrEqual(2);
  });

  it('5. User B misses check-in (>= 30 mins) -> Auto-reconciliation pauses timer at 1800s cap', async () => {
    // Simulate 45 minutes (2700 seconds) elapsed without check-in for User B
    const fortyFiveMinsAgo = new Date(Date.now() - 2700 * 1000);
    await prisma.workItemAssignee.updateMany({
      where: { workItemId, userId: userBId },
      data: { lastSessionStartedAt: fortyFiveMinsAgo, totalDurationSeconds: 0, isPaused: false },
    });

    // Loading the work item triggers auto-reconciliation
    const res = await request(app)
      .get(`/api/projects/${projectId}/work/${workItemId}`)
      .set('Cookie', userACookie);

    expect(res.status).toBe(200);
    const assigneeB = res.body.data.workItem.assignees.find((a: any) => a.userId === userBId);
    // Credited exactly 1800s (30 mins cap), not the full 45 mins!
    expect(assigneeB.totalDurationSeconds).toBe(1800);
    expect(assigneeB.isPaused).toBe(true);
    expect(assigneeB.lastSessionStartedAt).toBeNull();
  });

  it('6. User B resumes paused timer -> resumes stacking on top of 1800s', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/work/${workItemId}/resume-timer`)
      .set('Cookie', userBCookie);

    expect(res.status).toBe(200);
    const assigneeB = res.body.data.workItem.assignees.find((a: any) => a.userId === userBId);
    expect(assigneeB.totalDurationSeconds).toBe(1800);
    expect(assigneeB.isPaused).toBe(false);
    expect(assigneeB.lastSessionStartedAt).toBeDefined();
  });

  it('7. User A completes work -> Timer freezes for User A; task remains IN_PROGRESS until User B completes', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/work/${workItemId}/complete-work`)
      .set('Cookie', userACookie);

    expect(res.status).toBe(200);
    const item = res.body.data.workItem;
    expect(item.status).toBe('IN_PROGRESS'); // Still IN_PROGRESS because User B is not done

    const assigneeA = item.assignees.find((a: any) => a.userId === userAId);
    expect(assigneeA.hasCompleted).toBe(true);
    expect(assigneeA.isPaused).toBe(true);
    expect(assigneeA.completedAt).toBeDefined();
  });

  it('8. User B completes work -> ALL completed -> Task automatically advances to IN_REVIEW', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/work/${workItemId}/complete-work`)
      .set('Cookie', userBCookie);

    expect(res.status).toBe(200);
    const item = res.body.data.workItem;
    expect(item.status).toBe('IN_REVIEW'); // Automatically moved to IN_REVIEW!

    const assigneeB = item.assignees.find((a: any) => a.userId === userBId);
    expect(assigneeB.hasCompleted).toBe(true);
    expect(assigneeB.isPaused).toBe(true);
  });

  it('9. Rejection flow: Creator rejects task -> moves back to IN_PROGRESS, preserves duration, timers paused ready to resume', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/work/${workItemId}/review`)
      .set('Cookie', userACookie)
      .send({
        action: 'REJECT',
        reason: 'Please add unit tests for the button click handler.',
      });

    expect(res.status).toBe(200);
    const item = res.body.data.workItem;
    expect(item.status).toBe('IN_PROGRESS');
    expect(item.rejectionReason).toBe('Please add unit tests for the button click handler.');

    const assigneeA = item.assignees.find((a: any) => a.userId === userAId);
    const assigneeB = item.assignees.find((a: any) => a.userId === userBId);
    // Both assignees' durations are preserved and not reset to 0!
    expect(assigneeA.totalDurationSeconds).toBeGreaterThan(0);
    expect(assigneeB.totalDurationSeconds).toBeGreaterThanOrEqual(1800);
    expect(assigneeA.hasCompleted).toBe(false);
    expect(assigneeB.hasCompleted).toBe(false);
    expect(assigneeA.isPaused).toBe(true);
    expect(assigneeB.isPaused).toBe(true);
  });

  it('10. Approval flow: Creator approves task -> COMPLETED', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/work/${workItemId}/review`)
      .set('Cookie', userACookie)
      .send({
        action: 'APPROVE',
      });

    expect(res.status).toBe(200);
    const item = res.body.data.workItem;
    expect(item.status).toBe('COMPLETED');
    expect(item.approvedAt).toBeDefined();
    expect(item.approvedById).toBe(userAId);
  });
});
