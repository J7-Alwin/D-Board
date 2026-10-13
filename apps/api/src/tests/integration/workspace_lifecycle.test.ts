import crypto from 'crypto';
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import { app } from '../../server.js';
import prisma from '../../prisma.js';
import { ensurePersonalWorkspace } from '../../services/auth.service.js';
import { workspaceService } from '../../services/workspace.service.js';
import { workspaceOwnershipTransferService } from '../../services/workspaceOwnershipTransfer.service.js';
import { workspaceAuditService } from '../../services/workspaceAudit.service.js';
import { CacheService, cacheService } from '../../redis/cache.service.js';
import * as realtimeService from '../../realtime/realtime.service.js';

describe('Phase 5 — Complete Workspace Lifecycle Integration Tests', () => {
  const ts = Date.now();

  const userA = {
    username: `p5_owner_${ts}`,
    email: `p5_owner_${ts}@example.com`,
    password: 'Password123!Secure',
    fullName: 'Phase 5 Owner',
  };

  const userB = {
    username: `p5_recipient_${ts}`,
    email: `p5_recipient_${ts}@example.com`,
    password: 'Password123!Secure',
    fullName: 'Phase 5 Recipient',
  };

  const userC = {
    username: `p5_outsider_${ts}`,
    email: `p5_outsider_${ts}@example.com`,
    password: 'Password123!Secure',
    fullName: 'Phase 5 Outsider',
  };

  let userAId: string;
  let userBId: string;
  let userCId: string;

  let cookieA: string;
  let cookieB: string;
  let cookieC: string;

  let personalWsAId: string;
  let teamWsId: string;
  let projectId: string;

  beforeAll(async () => {
    // 1. Register and verify User A (initial owner)
    const resA = await request(app).post('/api/auth/register').send(userA);
    expect(resA.status).toBe(201);
    userAId = resA.body.data.user.id;
    await prisma.user.update({ where: { id: userAId }, data: { isEmailVerified: true } });

    const loginA = await request(app).post('/api/auth/login').send({
      identifier: userA.email,
      password: userA.password,
    });
    const cA = loginA.headers['set-cookie'];
    cookieA = Array.isArray(cA) ? cA[0].split(';')[0] : cA.split(';')[0];

    const wsA = await ensurePersonalWorkspace(userAId);
    personalWsAId = wsA.id;

    // 2. Register and verify User B (recipient)
    const resB = await request(app).post('/api/auth/register').send(userB);
    expect(resB.status).toBe(201);
    userBId = resB.body.data.user.id;
    await prisma.user.update({ where: { id: userBId }, data: { isEmailVerified: true } });

    const loginB = await request(app).post('/api/auth/login').send({
      identifier: userB.email,
      password: userB.password,
    });
    const cB = loginB.headers['set-cookie'];
    cookieB = Array.isArray(cB) ? cB[0].split(';')[0] : cB.split(';')[0];

    await ensurePersonalWorkspace(userBId);

    // 3. Register and verify User C (outsider / unauthorized)
    const resC = await request(app).post('/api/auth/register').send(userC);
    expect(resC.status).toBe(201);
    userCId = resC.body.data.user.id;
    await prisma.user.update({ where: { id: userCId }, data: { isEmailVerified: true } });

    const loginC = await request(app).post('/api/auth/login').send({
      identifier: userC.email,
      password: userC.password,
    });
    const cC = loginC.headers['set-cookie'];
    cookieC = Array.isArray(cC) ? cC[0].split(';')[0] : cC.split(';')[0];

    // 4. Create a team workspace owned by User A
    const wsRes = await request(app)
      .post('/api/workspaces')
      .set('Cookie', cookieA)
      .send({ name: `Lifecycle Team Workspace ${ts}` });
    expect(wsRes.status).toBe(201);
    teamWsId = wsRes.body.data.workspace.id;

    // 5. Add User B as a member in team workspace
    await prisma.workspaceMember.create({
      data: {
        workspaceId: teamWsId,
        userId: userBId,
        role: 'WORKSPACE_MEMBER',
        origin: 'DIRECT',
      },
    });

    // 6. Create a project in the team workspace
    const projRes = await request(app)
      .post('/api/projects')
      .set('Cookie', cookieA)
      .set('x-workspace-id', teamWsId)
      .send({
        name: `Lifecycle Project ${ts}`,
        key: 'LCP',
        description: 'Lifecycle project for testing',
      });
    expect(projRes.status).toBe(201);
    projectId = projRes.body.data.project.id;
  });

  afterAll(async () => {
    const userIds = [userAId, userBId, userCId].filter(Boolean);
    if (userIds.length > 0) {
      await prisma.workspaceOwnershipTransfer.deleteMany({ where: { workspaceId: teamWsId } }).catch(() => {});
      await prisma.workspaceAuditLog.deleteMany({ where: { workspaceId: teamWsId } }).catch(() => {});
      await prisma.projectMember.deleteMany({ where: { userId: { in: userIds } } }).catch(() => {});
      await prisma.project.deleteMany({ where: { createdById: { in: userIds } } }).catch(() => {});
      await prisma.workspaceMember.deleteMany({ where: { userId: { in: userIds } } }).catch(() => {});
      await prisma.workspace.deleteMany({ where: { ownerId: { in: userIds } } }).catch(() => {});
      await prisma.session.deleteMany({ where: { userId: { in: userIds } } }).catch(() => {});
      await prisma.user.deleteMany({ where: { id: { in: userIds } } }).catch(() => {});
    }
  });

  // =========================================================================
  // Phase 5A: Workspace Ownership Transfer Tests
  // =========================================================================
  describe('Phase 5A: Workspace Ownership Transfer', () => {
    it('prevents transferring personal workspaces', async () => {
      const res = await request(app)
        .post(`/api/workspaces/${personalWsAId}/ownership-transfer/request`)
        .set('Cookie', cookieA)
        .send({
          targetUserId: userBId,
          targetRole: 'WORKSPACE_ADMIN',
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/personal workspaces cannot be transferred/i);
    });

    it('rejects ownership transfer request by non-owner member', async () => {
      const res = await request(app)
        .post(`/api/workspaces/${teamWsId}/ownership-transfer/request`)
        .set('Cookie', cookieB)
        .send({
          targetUserId: userCId,
          targetRole: 'WORKSPACE_ADMIN',
        });

      expect(res.status).toBe(403);
    });

    it('allows owner to initiate transfer to verified user', async () => {
      const res = await request(app)
        .post(`/api/workspaces/${teamWsId}/ownership-transfer/request`)
        .set('Cookie', cookieA)
        .send({
          targetUserId: userBId,
          targetRole: 'WORKSPACE_ADMIN',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.transfer).toBeDefined();
      expect(res.body.data.transfer.status).toBe('PENDING');
      expect(res.body.data.transfer.targetUserId).toBe(userBId);
      expect(res.body.data.transfer.sourceOwnerId).toBe(userAId);
    });

    it('prevents multiple concurrent pending transfer requests on the same workspace', async () => {
      const res = await request(app)
        .post(`/api/workspaces/${teamWsId}/ownership-transfer/request`)
        .set('Cookie', cookieA)
        .send({
          targetEmail: userC.email,
          targetRole: 'WORKSPACE_MEMBER',
        });

      expect(res.status).toBe(409);
      expect(res.body.message).toMatch(/ownership transfer is already pending/i);
    });

    it('allows owner to view pending transfer request', async () => {
      const res = await request(app)
        .get(`/api/workspaces/${teamWsId}/ownership-transfer`)
        .set('Cookie', cookieA);

      expect(res.status).toBe(200);
      expect(res.body.data.transfer).not.toBeNull();
      expect(res.body.data.transfer.status).toBe('PENDING');
    });

    it('prevents unauthorized outsider from accepting transfer', async () => {
      const res = await request(app)
        .post(`/api/workspaces/${teamWsId}/ownership-transfer/accept`)
        .set('Cookie', cookieC)
        .send({});

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/not the designated recipient/i);
    });

    it('allows owner to cancel pending transfer request', async () => {
      const cancelRes = await request(app)
        .post(`/api/workspaces/${teamWsId}/ownership-transfer/cancel`)
        .set('Cookie', cookieA)
        .send({});

      expect(cancelRes.status).toBe(200);
      expect(cancelRes.body.success).toBe(true);

      const checkRes = await request(app)
        .get(`/api/workspaces/${teamWsId}/ownership-transfer`)
        .set('Cookie', cookieA);

      expect(checkRes.status).toBe(200);
      expect(checkRes.body.data.transfer).toBeNull();
    });

    it('rejects accept on cancelled request', async () => {
      const res = await request(app)
        .post(`/api/workspaces/${teamWsId}/ownership-transfer/accept`)
        .set('Cookie', cookieB)
        .send({});

      expect(res.status).toBe(404);
      expect(res.body.message).toMatch(/no pending ownership transfer/i);
    });

    it('completes atomic ownership transfer when accepted by recipient', async () => {
      // Re-initiate transfer: User A -> User B, resultingRole: WORKSPACE_ADMIN
      const initRes = await request(app)
        .post(`/api/workspaces/${teamWsId}/ownership-transfer/request`)
        .set('Cookie', cookieA)
        .send({
          targetUserId: userBId,
          targetRole: 'WORKSPACE_ADMIN',
        });
      expect(initRes.status).toBe(201);

      // User B accepts
      const acceptRes = await request(app)
        .post(`/api/workspaces/${teamWsId}/ownership-transfer/accept`)
        .set('Cookie', cookieB)
        .send({});

      expect(acceptRes.status).toBe(200);
      expect(acceptRes.body.success).toBe(true);

      // Verify workspace state in database
      const ws = await prisma.workspace.findUnique({
        where: { id: teamWsId },
        include: { members: true },
      });

      expect(ws).toBeDefined();
      expect(ws?.ownerId).toBe(userBId);

      // Check User B membership is OWNER
      const memberB = ws?.members.find((m) => m.userId === userBId);
      expect(memberB?.role).toBe('OWNER');

      // Check former owner User A was demoted to chosen role WORKSPACE_ADMIN
      const memberA = ws?.members.find((m) => m.userId === userAId);
      expect(memberA?.role).toBe('WORKSPACE_ADMIN');

      // Verify projects remain intact under the same workspace
      const proj = await prisma.project.findUnique({ where: { id: projectId } });
      expect(proj).toBeDefined();
      expect(proj?.workspaceId).toBe(teamWsId);
    });

    it('prevent replay of already-accepted transfer request', async () => {
      const replayRes = await request(app)
        .post(`/api/workspaces/${teamWsId}/ownership-transfer/accept`)
        .set('Cookie', cookieB)
        .send({});

      expect(replayRes.status).toBe(404);
    });
  });

  // =========================================================================
  // Phase 5B: Workspace Soft Deletion and 30-Day Recovery Tests
  // =========================================================================
  describe('Phase 5B: Workspace Soft Deletion and 30-Day Recovery', () => {
    it('prevents soft-deleting personal workspace', async () => {
      const res = await request(app)
        .post(`/api/workspaces/${personalWsAId}/delete`)
        .set('Cookie', cookieA)
        .send({ confirmationName: userA.username });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/personal workspaces cannot be deleted/i);
    });

    it('requires exact workspace name confirmation to delete', async () => {
      // User B is now the owner of teamWsId
      const res = await request(app)
        .post(`/api/workspaces/${teamWsId}/delete`)
        .set('Cookie', cookieB)
        .send({ confirmationName: 'Incorrect Name' });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/confirmation name does not match/i);
    });

    it('rejects deletion attempt by non-owner member', async () => {
      // User A is now WORKSPACE_ADMIN, not OWNER
      const ws = await prisma.workspace.findUnique({ where: { id: teamWsId } });
      const res = await request(app)
        .post(`/api/workspaces/${teamWsId}/delete`)
        .set('Cookie', cookieA)
        .send({ confirmationName: ws!.name });

      expect(res.status).toBe(403);
    });

    it('allows owner to soft-delete team workspace', async () => {
      const ws = await prisma.workspace.findUnique({ where: { id: teamWsId } });
      const res = await request(app)
        .post(`/api/workspaces/${teamWsId}/delete`)
        .set('Cookie', cookieB)
        .send({ confirmationName: ws!.name });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.deletionScheduledAt).toBeDefined();

      const updatedWs = await prisma.workspace.findUnique({ where: { id: teamWsId } });
      expect(updatedWs?.deletedAt).not.toBeNull();
      expect(updatedWs?.deletedById).toBe(userBId);
      expect(updatedWs?.deletionScheduledAt).not.toBeNull();
    });

    it('hides deleted workspace from normal user workspace listings', async () => {
      const res = await request(app).get('/api/workspaces').set('Cookie', cookieB);
      expect(res.status).toBe(200);
      const owned = res.body.data.owned as Array<{ id: string }>;
      const joined = res.body.data.joined as Array<{ id: string }>;
      const allIds = [...owned.map((w) => w.id), ...joined.map((w) => w.id)];

      expect(allIds.includes(teamWsId)).toBe(false);
    });

    it('denies access to deleted workspace via direct API routes', async () => {
      const res = await request(app).get(`/api/workspaces/${teamWsId}`).set('Cookie', cookieB);
      expect(res.status).toBe(404);
      expect(res.body.message).toMatch(/workspace not found/i);
    });

    it('denies access to project inside soft-deleted workspace', async () => {
      const res = await request(app)
        .get(`/api/projects/${projectId}`)
        .set('Cookie', cookieB)
        .set('x-workspace-id', teamWsId);

      expect(res.status).toBe(404);
    });

    it('displays deleted workspace in /api/workspaces/deleted for authorized owner with daysRemaining', async () => {
      const res = await request(app).get('/api/workspaces/deleted').set('Cookie', cookieB);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const deletedWs = res.body.data.workspaces.find((w: any) => w.id === teamWsId);

      expect(deletedWs).toBeDefined();
      expect(deletedWs.daysRemaining).toBeGreaterThanOrEqual(29);
      expect(deletedWs.daysRemaining).toBeLessThanOrEqual(30);
    });

    it('rejects recovery attempt by non-owner user', async () => {
      const res = await request(app)
        .post(`/api/workspaces/${teamWsId}/recover`)
        .set('Cookie', cookieA)
        .send({});

      expect(res.status).toBe(403);
    });

    it('enforces 30-day recovery deadline on server: rejects recovery past deadline', async () => {
      // Temporarily set deletedAt and deletionScheduledAt to 35 days in the past
      const pastDate = new Date(Date.now() - 35 * 24 * 60 * 60 * 1000);
      await prisma.workspace.update({
        where: { id: teamWsId },
        data: {
          deletedAt: pastDate,
          deletionScheduledAt: new Date(pastDate.getTime() + 30 * 24 * 60 * 60 * 1000),
        },
      });

      const res = await request(app)
        .post(`/api/workspaces/${teamWsId}/recover`)
        .set('Cookie', cookieB)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/recovery window.*expired/i);

      // Restore deletedAt to now for recovery test
      await prisma.workspace.update({
        where: { id: teamWsId },
        data: {
          deletedAt: new Date(),
          deletionScheduledAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });
    });

    it('allows owner to recover soft-deleted workspace within 30-day window', async () => {
      const res = await request(app)
        .post(`/api/workspaces/${teamWsId}/recover`)
        .set('Cookie', cookieB)
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const recoveredWs = await prisma.workspace.findUnique({ where: { id: teamWsId } });
      expect(recoveredWs?.deletedAt).toBeNull();
      expect(recoveredWs?.deletedById).toBeNull();
      expect(recoveredWs?.deletionScheduledAt).toBeNull();
    });

    it('restores normal workspace and project access after recovery', async () => {
      const wsRes = await request(app).get(`/api/workspaces/${teamWsId}`).set('Cookie', cookieB);
      expect(wsRes.status).toBe(200);
      expect(wsRes.body.data.workspace.id).toBe(teamWsId);

      const projRes = await request(app)
        .get(`/api/projects/${projectId}`)
        .set('Cookie', cookieB)
        .set('x-workspace-id', teamWsId);

      expect(projRes.status).toBe(200);
    });

    it('recovery is safe and idempotent', async () => {
      const res = await request(app)
        .post(`/api/workspaces/${teamWsId}/recover`)
        .set('Cookie', cookieB)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/workspace is not deleted/i);
    });
  });

  // =========================================================================
  // Phase 5C: Administration Audit Trail Tests
  // =========================================================================
  describe('Phase 5C: Administration Audit Trail', () => {
    it('records audit events for ownership transfers, deletion, and recovery', async () => {
      const auditRes = await request(app)
        .get(`/api/workspaces/${teamWsId}/audit-logs`)
        .set('Cookie', cookieB);

      expect(auditRes.status).toBe(200);
      expect(auditRes.body.success).toBe(true);
      const logs = auditRes.body.data.logs as Array<{ action: string; metadata: any }>;

      const actions = logs.map((l) => l.action);
      expect(actions.includes('OWNERSHIP_TRANSFER_REQUESTED')).toBe(true);
      expect(actions.includes('OWNERSHIP_TRANSFERRED')).toBe(true);
      expect(actions.includes('WORKSPACE_DELETION_SCHEDULED')).toBe(true);
      expect(actions.includes('WORKSPACE_RESTORED')).toBe(true);
    });

    it('sanitizes metadata: never stores tokens, passwords, cookies, or secrets', async () => {
      const logs = await prisma.workspaceAuditLog.findMany({
        where: { workspaceId: teamWsId },
      });

      for (const log of logs) {
        if (log.metadata) {
          const serialized = JSON.stringify(log.metadata).toLowerCase();
          expect(serialized).not.toContain('token');
          expect(serialized).not.toContain('password');
          expect(serialized).not.toContain('secret');
          expect(serialized).not.toContain('cookie');
        }
      }
    });

    it('denies audit logs access to unauthorized outsiders and regular members without admin role', async () => {
      // 1. Outsider C denied (403)
      const resC = await request(app)
        .get(`/api/workspaces/${teamWsId}/audit-logs`)
        .set('Cookie', cookieC);
      expect(resC.status).toBe(403);

      // 2. Add an ordinary member to team workspace
      const tempUser = {
        username: `p5_regular_${ts}`,
        email: `p5_regular_${ts}@example.com`,
        password: 'Password123!Secure',
        fullName: 'Phase 5 Regular Member',
      };
      const reg = await request(app).post('/api/auth/register').send(tempUser);
      const tempId = reg.body.data.user.id;
      await prisma.user.update({ where: { id: tempId }, data: { isEmailVerified: true } });
      const login = await request(app).post('/api/auth/login').send({
        identifier: tempUser.email,
        password: tempUser.password,
      });
      const c = login.headers['set-cookie'];
      const tempCookie = Array.isArray(c) ? c[0].split(';')[0] : c.split(';')[0];

      await prisma.workspaceMember.create({
        data: {
          workspaceId: teamWsId,
          userId: tempId,
          role: 'WORKSPACE_MEMBER',
          origin: 'DIRECT',
        },
      });

      // Regular member attempts to view audit logs -> 403 Forbidden
      const resMember = await request(app)
        .get(`/api/workspaces/${teamWsId}/audit-logs`)
        .set('Cookie', tempCookie);
      expect(resMember.status).toBe(403);
      expect(resMember.body.message).toMatch(/only workspace owners and administrators/i);

      // Clean up temp user
      await prisma.workspaceMember.deleteMany({ where: { userId: tempId } }).catch(() => {});
      await prisma.session.deleteMany({ where: { userId: tempId } }).catch(() => {});
      await prisma.user.deleteMany({ where: { id: tempId } }).catch(() => {});
    });

    it('enforces strict workspace isolation: Workspace A users cannot inspect Workspace B audit logs', async () => {
      // User C attempts to view Team Workspace audit logs
      const res = await request(app)
        .get(`/api/workspaces/${teamWsId}/audit-logs`)
        .set('Cookie', cookieC);

      expect(res.status).toBe(403);
    });

    it('supports action filtering on audit logs API', async () => {
      const res = await request(app)
        .get(`/api/workspaces/${teamWsId}/audit-logs?action=WORKSPACE_RESTORED`)
        .set('Cookie', cookieB);

      expect(res.status).toBe(200);
      const logs = res.body.data.logs;
      expect(logs.length).toBeGreaterThan(0);
      expect(logs.every((l: any) => l.action === 'WORKSPACE_RESTORED')).toBe(true);
    });
  });

  // =========================================================================
  // Phase 5 Concurrency & Transition Safety
  // =========================================================================
  describe('Phase 5 Concurrency & Transition Safety', () => {
    it('concurrent acceptances produce exactly one success and one failure', async () => {
      // User B is currently owner; transfer back to User A
      const initRes = await request(app)
        .post(`/api/workspaces/${teamWsId}/ownership-transfer/request`)
        .set('Cookie', cookieB)
        .send({
          targetUserId: userAId,
          targetRole: 'WORKSPACE_MEMBER',
        });
      expect(initRes.status).toBe(201);

      // Race 2 concurrent accept requests from User A
      const [res1, res2] = await Promise.all([
        request(app).post(`/api/workspaces/${teamWsId}/ownership-transfer/accept`).set('Cookie', cookieA).send({}),
        request(app).post(`/api/workspaces/${teamWsId}/ownership-transfer/accept`).set('Cookie', cookieA).send({}),
      ]);

      const statuses = [res1.status, res2.status].sort((a, b) => a - b);
      expect(statuses[0]).toBe(200);
      expect([400, 404, 409]).toContain(statuses[1]);

      // Workspace owner is User A
      const ws = await prisma.workspace.findUnique({ where: { id: teamWsId } });
      expect(ws?.ownerId).toBe(userAId);
    });

    it('concurrent deletion requests produce exactly one success', async () => {
      const ws = await prisma.workspace.findUnique({ where: { id: teamWsId } });
      const [res1, res2] = await Promise.all([
        request(app).post(`/api/workspaces/${teamWsId}/delete`).set('Cookie', cookieA).send({ confirmationName: ws!.name }),
        request(app).post(`/api/workspaces/${teamWsId}/delete`).set('Cookie', cookieA).send({ confirmationName: ws!.name }),
      ]);

      const statuses = [res1.status, res2.status].sort((a, b) => a - b);
      expect(statuses[0]).toBe(200);
      expect([400, 409]).toContain(statuses[1]);

      // Recover for final cleanup
      await request(app).post(`/api/workspaces/${teamWsId}/recover`).set('Cookie', cookieA).send({});
    });
  });

  // =========================================================================
  // Phase 5 Final Hardening: Destination Deletion & Cache Invalidation
  // =========================================================================
  describe('Phase 5 Final Hardening: Destination Deletion & Cache Invalidation', () => {
    let secondTeamWsId: string;
    let bTeamWsId: string;

    beforeAll(async () => {
      // Create a second team workspace owned by User A for same-owner transfer test
      const resA = await request(app)
        .post('/api/workspaces')
        .set('Cookie', cookieA)
        .send({ name: `Dest Hardening WS A ${ts}` });
      secondTeamWsId = resA.body.data.workspace.id;

      // Create a team workspace owned by User B for cross-owner transfer test
      const resB = await request(app)
        .post('/api/workspaces')
        .set('Cookie', cookieB)
        .send({ name: `Dest Hardening WS B ${ts}` });
      bTeamWsId = resB.body.data.workspace.id;
    });

    afterAll(async () => {
      if (secondTeamWsId) {
        await prisma.workspace.deleteMany({ where: { id: secondTeamWsId } }).catch(() => {});
      }
      if (bTeamWsId) {
        await prisma.workspace.deleteMany({ where: { id: bTeamWsId } }).catch(() => {});
      }
    });

    it('rejects initiating project transfer to a soft-deleted destination workspace (400)', async () => {
      // Soft-delete secondTeamWsId
      const ws = await prisma.workspace.findUnique({ where: { id: secondTeamWsId } });
      await request(app)
        .post(`/api/workspaces/${secondTeamWsId}/delete`)
        .set('Cookie', cookieA)
        .send({ confirmationName: ws!.name });

      // Try transferring project into soft-deleted destination workspace
      const res = await request(app)
        .post(`/api/projects/${projectId}/transfer`)
        .set('Cookie', cookieA)
        .send({ destinationWorkspaceId: secondTeamWsId });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/scheduled for deletion/i);

      // Restore secondTeamWsId
      await request(app)
        .post(`/api/workspaces/${secondTeamWsId}/recover`)
        .set('Cookie', cookieA)
        .send({});
    });

    it('rejects cross-owner approval if destination workspace was deleted after request initiation (400)', async () => {
      // 1. User A initiates cross-owner transfer into User B's workspace
      const initRes = await request(app)
        .post(`/api/projects/${projectId}/transfer`)
        .set('Cookie', cookieA)
        .send({ destinationWorkspaceId: bTeamWsId });

      expect(initRes.status).toBe(201);
      expect(initRes.body.executedImmediately).toBe(false);
      const transferId = initRes.body.transfer.id;

      // 2. Destination workspace deleted right before approval (simulating concurrent deletion race)
      await prisma.workspace.update({
        where: { id: bTeamWsId },
        data: { deletedAt: new Date() },
      });

      // 3. User B attempts to approve the transfer
      const approveRes = await request(app)
        .post(`/api/transfers/${transferId}/approve`)
        .set('Cookie', cookieB)
        .send({});

      expect(approveRes.status).toBe(400);
      expect(approveRes.body.message).toMatch(/scheduled for deletion/i);

      // Clean up: restore bTeamWsId and cancel the pending transfer
      await prisma.workspace.update({
        where: { id: bTeamWsId },
        data: { deletedAt: null },
      });
      await prisma.projectTransfer.update({
        where: { id: transferId },
        data: { status: 'CANCELLED' },
      });
    });

    it('confirms project transfer to active workspace succeeds', async () => {
      // Project is currently in teamWsId. Transfer it to active secondTeamWsId (same owner User A)
      const transferRes = await request(app)
        .post(`/api/projects/${projectId}/transfer`)
        .set('Cookie', cookieA)
        .send({ destinationWorkspaceId: secondTeamWsId });

      expect(transferRes.status).toBe(200);
      expect(transferRes.body.executedImmediately).toBe(true);

      const proj = await prisma.project.findUnique({ where: { id: projectId } });
      expect(proj?.workspaceId).toBe(secondTeamWsId);

      // Transfer back to teamWsId
      const returnRes = await request(app)
        .post(`/api/projects/${projectId}/transfer`)
        .set('Cookie', cookieA)
        .send({ destinationWorkspaceId: teamWsId });
      expect(returnRes.status).toBe(200);
    });

    it('invalidates workspace cache and notifies affected users on ownership transfer', async () => {
      const delPatternSpy = vi.spyOn(CacheService.prototype, 'delPattern');
      const publishSpy = vi.spyOn(realtimeService, 'publishToUser');

      // User A requests transfer to User B
      const initRes = await request(app)
        .post(`/api/workspaces/${teamWsId}/ownership-transfer/request`)
        .set('Cookie', cookieA)
        .send({ targetUserId: userBId, targetRole: 'WORKSPACE_MEMBER' });
      expect(initRes.status).toBe(201);

      // User B accepts
      const acceptRes = await request(app)
        .post(`/api/workspaces/${teamWsId}/ownership-transfer/accept`)
        .set('Cookie', cookieB)
        .send({});
      expect(acceptRes.status).toBe(200);

      // Verify cache invalidation occurred
      expect(delPatternSpy).toHaveBeenCalledWith(`*ws:${teamWsId}:*`);

      // Verify realtime notifications published
      expect(publishSpy).toHaveBeenCalledWith(userAId, 'WORKSPACE_ROLE_UPDATED', expect.any(Object));
      expect(publishSpy).toHaveBeenCalledWith(userBId, 'WORKSPACE_ROLE_UPDATED', expect.any(Object));

      delPatternSpy.mockRestore();
      publishSpy.mockRestore();

      // Return ownership to User A
      const returnInit = await request(app)
        .post(`/api/workspaces/${teamWsId}/ownership-transfer/request`)
        .set('Cookie', cookieB)
        .send({ targetUserId: userAId, targetRole: 'WORKSPACE_ADMIN' });
      expect(returnInit.status).toBe(201);

      const returnAccept = await request(app)
        .post(`/api/workspaces/${teamWsId}/ownership-transfer/accept`)
        .set('Cookie', cookieA)
        .send({});
      expect(returnAccept.status).toBe(200);
    });

    it('never invalidates cache if ownership transfer transaction fails', async () => {
      const delPatternSpy = vi.spyOn(CacheService.prototype, 'delPattern');

      // Unauthorized outsider User C attempts to accept a non-existent/unauthorized transfer
      const failRes = await request(app)
        .post(`/api/workspaces/${teamWsId}/ownership-transfer/accept`)
        .set('Cookie', cookieC)
        .send({});

      expect([403, 404]).toContain(failRes.status);
      expect(delPatternSpy).not.toHaveBeenCalled();

      delPatternSpy.mockRestore();
    });
  });
});
