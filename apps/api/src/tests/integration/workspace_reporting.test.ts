import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../../server.js';
import prisma from '../../prisma.js';
import { dashboardService } from '../../services/dashboard.service.js';
import { workService } from '../../services/work.service.js';

describe('Phase 4: Workspace Reporting, Follow-up, and Metrics Isolation Integration Tests', () => {
  const timestamp = Date.now();
  const userData = {
    username: `rep_user_${timestamp}`,
    email: `rep_user_${timestamp}@example.com`,
    password: 'Password123!Secure',
    fullName: 'Reporting User',
  };

  const otherUserData = {
    username: `rep_other_${timestamp}`,
    email: `rep_other_${timestamp}@example.com`,
    password: 'Password123!Secure',
    fullName: 'Other User',
  };

  let userId: string;
  let otherUserId: string;
  let userCookie: string;
  let otherUserCookie: string;

  let ws1Id: string;
  let ws2Id: string;

  let p1Id: string;
  let p2Id: string;
  let p3Ws2Id: string;

  let taskCompletedId: string;
  let taskInProgressId: string;
  let taskOverdueId: string;
  let taskBlockedId: string;
  let taskWs2Id: string;

  beforeAll(async () => {
    // 1. Register main user
    const resUser = await request(app).post('/api/auth/register').send(userData);
    expect(resUser.status).toBe(201);
    userId = resUser.body.data.user.id;
    await prisma.user.update({ where: { id: userId }, data: { isEmailVerified: true } });

    const loginRes = await request(app).post('/api/auth/login').send({
      identifier: userData.email,
      password: userData.password,
    });
    const c = loginRes.headers['set-cookie'];
    userCookie = Array.isArray(c) ? c[0].split(';')[0] : c.split(';')[0];

    // 2. Register other user
    const resOther = await request(app).post('/api/auth/register').send(otherUserData);
    expect(resOther.status).toBe(201);
    otherUserId = resOther.body.data.user.id;
    await prisma.user.update({ where: { id: otherUserId }, data: { isEmailVerified: true } });

    const loginOther = await request(app).post('/api/auth/login').send({
      identifier: otherUserData.email,
      password: otherUserData.password,
    });
    const cOther = loginOther.headers['set-cookie'];
    otherUserCookie = Array.isArray(cOther) ? cOther[0].split(';')[0] : cOther.split(';')[0];

    // 3. Create Workspace 1 (WS1)
    const ws1Res = await request(app)
      .post('/api/workspaces')
      .set('Cookie', userCookie)
      .send({ name: `Reporting WS 1 ${timestamp}` });
    expect(ws1Res.status).toBe(201);
    ws1Id = ws1Res.body.data.workspace.id;

    // 4. Create Workspace 2 (WS2)
    const ws2Res = await request(app)
      .post('/api/workspaces')
      .set('Cookie', userCookie)
      .send({ name: `Reporting WS 2 ${timestamp}` });
    expect(ws2Res.status).toBe(201);
    ws2Id = ws2Res.body.data.workspace.id;

    // 5. Create Projects in WS1
    const p1 = await prisma.project.create({
      data: {
        name: `WS1 Project Alpha ${timestamp}`,
        description: 'Alpha project',
        workspaceId: ws1Id,
        createdById: userId,
        visibility: 'WORKSPACE',
        members: {
          create: { userId, role: 'PROJECT_ADMIN' },
        },
      },
    });
    p1Id = p1.id;

    const p2 = await prisma.project.create({
      data: {
        name: `WS1 Project Beta ${timestamp}`,
        description: 'Beta project',
        workspaceId: ws1Id,
        createdById: userId,
        visibility: 'WORKSPACE',
        members: {
          create: { userId, role: 'PROJECT_ADMIN' },
        },
      },
    });
    p2Id = p2.id;

    // 6. Create Project in WS2
    const p3 = await prisma.project.create({
      data: {
        name: `WS2 Project Gamma ${timestamp}`,
        description: 'Gamma project in WS2',
        workspaceId: ws2Id,
        createdById: userId,
        visibility: 'WORKSPACE',
        members: {
          create: { userId, role: 'PROJECT_ADMIN' },
        },
      },
    });
    p3Ws2Id = p3.id;

    // 7. Create Work Items in WS1:
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 3);

    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 3);

    // P1: Item 1 - COMPLETED
    const itemCompleted = await prisma.workItem.create({
      data: {
        projectId: p1Id,
        title: 'Completed Task',
        status: 'COMPLETED',
        createdById: userId,
        assignedToId: userId,
        completedAt: new Date(),
      },
    });
    taskCompletedId = itemCompleted.id;

    // P1: Item 2 - IN_PROGRESS (Due in 3 days)
    const itemInProgress = await prisma.workItem.create({
      data: {
        projectId: p1Id,
        title: 'In Progress Task',
        status: 'IN_PROGRESS',
        createdById: userId,
        assignedToId: userId,
        dueDate: futureDate,
      },
    });
    taskInProgressId = itemInProgress.id;

    // P2: Item 3 - OVERDUE (DueDate 3 days ago, TODO)
    const itemOverdue = await prisma.workItem.create({
      data: {
        projectId: p2Id,
        title: 'Overdue Task',
        status: 'TODO',
        createdById: userId,
        assignedToId: userId,
        dueDate: pastDate,
      },
    });
    taskOverdueId = itemOverdue.id;

    // P2: Item 4 - BLOCKED
    const itemBlocked = await prisma.workItem.create({
      data: {
        projectId: p2Id,
        title: 'Blocked Task',
        status: 'BLOCKED',
        createdById: userId,
        assignedToId: userId,
      },
    });
    taskBlockedId = itemBlocked.id;

    // Work item in WS2:
    const itemWs2 = await prisma.workItem.create({
      data: {
        projectId: p3Ws2Id,
        title: 'WS2 Task',
        status: 'TODO',
        createdById: userId,
        assignedToId: userId,
      },
    });
    taskWs2Id = itemWs2.id;
  });

  afterAll(async () => {
    const wsIds = [ws1Id, ws2Id].filter(Boolean);
    if (wsIds.length > 0) {
      await prisma.workItem.deleteMany({ where: { project: { workspaceId: { in: wsIds } } } });
      await prisma.projectMember.deleteMany({ where: { project: { workspaceId: { in: wsIds } } } });
      await prisma.project.deleteMany({ where: { workspaceId: { in: wsIds } } });
      await prisma.workspaceMember.deleteMany({ where: { workspaceId: { in: wsIds } } });
      await prisma.workspace.deleteMany({ where: { id: { in: wsIds } } });
    }
    const userIds = [userId, otherUserId].filter(Boolean);
    if (userIds.length > 0) {
      await prisma.workspaceMember.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.workspace.deleteMany({ where: { ownerId: { in: userIds } } });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }
  });

  it('DashboardService reports accurate workspace-scoped summary metrics for WS1', async () => {
    const summary = await dashboardService.getDashboardSummary(userId, ws1Id);

    // Total tasks in WS1 = 4 (Completed: 1, InProgress: 1, Overdue: 1, Blocked: 1)
    expect(summary.stats.totalWorkCount).toBe(4);
    expect(summary.stats.completedWorkCount).toBe(1);
    expect(summary.stats.overdueWorkCount).toBe(1);
    expect(summary.stats.blockedWorkCount).toBe(1);
    expect(summary.stats.myOpenWorkCount).toBe(3); // 4 total - 1 completed = 3 open
    expect(summary.stats.completionRate).toBe(25); // 1 / 4 = 25%

    // Verified projects in WS1
    expect(summary.stats.myProjectsCount).toBe(2);
    expect(summary.recentProjects.length).toBe(2);
  });

  it('DashboardService isolates metrics strictly per workspace (WS2 vs WS1)', async () => {
    const summaryWs2 = await dashboardService.getDashboardSummary(userId, ws2Id);

    // WS2 has 1 project and 1 work item (TODO)
    expect(summaryWs2.stats.myProjectsCount).toBe(1);
    expect(summaryWs2.stats.totalWorkCount).toBe(1);
    expect(summaryWs2.stats.completedWorkCount).toBe(0);
    expect(summaryWs2.stats.overdueWorkCount).toBe(0);
    expect(summaryWs2.stats.blockedWorkCount).toBe(0);
    expect(summaryWs2.stats.myOpenWorkCount).toBe(1);
    expect(summaryWs2.stats.completionRate).toBe(0);
  });

  it('WorkService.getMyWorkItems provides accurate drilldowns for tabs', async () => {
    // 1. Overdue drilldown
    const overdueRes = await workService.getMyWorkItems(userId, { tab: 'overdue' }, ws1Id);
    expect(overdueRes.workItems.length).toBe(1);
    expect(overdueRes.workItems[0].id).toBe(taskOverdueId);

    // 2. Blocked drilldown
    const blockedRes = await workService.getMyWorkItems(userId, { tab: 'blocked' }, ws1Id);
    expect(blockedRes.workItems.length).toBe(1);
    expect(blockedRes.workItems[0].id).toBe(taskBlockedId);

    // 3. Completed drilldown
    const completedRes = await workService.getMyWorkItems(userId, { tab: 'completed' }, ws1Id);
    expect(completedRes.workItems.length).toBe(1);
    expect(completedRes.workItems[0].id).toBe(taskCompletedId);

    // 4. Due Soon drilldown
    const dueSoonRes = await workService.getMyWorkItems(userId, { tab: 'due-soon' }, ws1Id);
    expect(dueSoonRes.workItems.length).toBe(1);
    expect(dueSoonRes.workItems[0].id).toBe(taskInProgressId);

    // 5. Summary metrics
    expect(overdueRes.summary.total).toBe(4);
    expect(overdueRes.summary.completed).toBe(1);
    expect(overdueRes.summary.overdue).toBe(1);
    expect(overdueRes.summary.blocked).toBe(1);
    expect(overdueRes.summary.dueSoon).toBe(1);
  });

  it('HTTP API /api/dashboard returns Phase 4 reporting metrics with X-Workspace-Id', async () => {
    const res = await request(app)
      .get('/api/dashboard')
      .set('Cookie', userCookie)
      .set('X-Workspace-Id', ws1Id);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.stats).toHaveProperty('overdueWorkCount', 1);
    expect(res.body.data.stats).toHaveProperty('blockedWorkCount', 1);
    expect(res.body.data.stats).toHaveProperty('completedWorkCount', 1);
    expect(res.body.data.stats).toHaveProperty('totalWorkCount', 4);
    expect(res.body.data.stats).toHaveProperty('completionRate', 25);
  });

  it('HTTP API /api/work/my supports drilldown tabs with X-Workspace-Id', async () => {
    const res = await request(app)
      .get('/api/work/my?tab=blocked')
      .set('Cookie', userCookie)
      .set('X-Workspace-Id', ws1Id);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.workItems.length).toBe(1);
    expect(res.body.data.workItems[0].id).toBe(taskBlockedId);
    expect(res.body.data.summary.blocked).toBe(1);
  });
});
