import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import { app } from '../../server.js';
import prisma from '../../prisma.js';
import { invitationService } from '../../services/invitation.service.js';
import { projectService } from '../../services/project.service.js';
import { workspaceMemberService } from '../../services/workspaceMember.service.js';
import * as queues from '../../jobs/queues.js';
import { notificationService } from '../../services/notification.service.js';

describe('Fix 5 — Enforce Workspace Membership for Project Invitations Test Suite', () => {
  const ts = Date.now();
  const dynamicUserIds: string[] = [];
  const dynamicWsIds: string[] = [];
  const dynamicProjectIds: string[] = [];

  const ownerUser = {
    username: `f5_owner_${ts}`,
    email: `f5_owner_${ts}@example.com`,
    password: 'Password123!Secure',
    fullName: 'Fix5 Owner',
  };

  const ws2OwnerUser = {
    username: `f5_ws2owner_${ts}`,
    email: `f5_ws2owner_${ts}@example.com`,
    password: 'Password123!Secure',
    fullName: 'Fix5 WS2 Owner',
  };

  const memberUser = {
    username: `f5_member_${ts}`,
    email: `f5_member_${ts}@example.com`,
    password: 'Password123!Secure',
    fullName: 'Fix5 Member',
  };

  const adminUser = {
    username: `f5_admin_${ts}`,
    email: `f5_admin_${ts}@example.com`,
    password: 'Password123!Secure',
    fullName: 'Fix5 Admin',
  };

  const outsiderUser = {
    username: `f5_outsider_${ts}`,
    email: `f5_outsider_${ts}@example.com`,
    password: 'Password123!Secure',
    fullName: 'Fix5 Outsider',
  };

  const deactivatedUser = {
    username: `f5_deact_${ts}`,
    email: `f5_deact_${ts}@example.com`,
    password: 'Password123!Secure',
    fullName: 'Fix5 Deactivated',
  };

  let ownerId: string;
  let ws2OwnerId: string;
  let memberId: string;
  let adminId: string;
  let outsiderId: string;
  let deactivatedId: string;

  let ownerCookie: string;
  let memberCookie: string;
  let adminCookie: string;
  let outsiderCookie: string;

  let teamWs1Id: string;
  let teamWs2Id: string;
  let project1Id: string;
  let project2Id: string;

  // Spies for email and notification tracking
  let emailSpy: any;
  let notifSpy: any;

  beforeAll(async () => {
    emailSpy = vi.spyOn(queues, 'enqueueEmailJob');
    notifSpy = vi.spyOn(notificationService, 'createNotification');

    const registerAndLogin = async (userData: any) => {
      const reg = await request(app).post('/api/auth/register').send(userData);
      expect(reg.status).toBe(201);
      const uid = reg.body.data.user.id;
      dynamicUserIds.push(uid);

      await prisma.user.update({ where: { id: uid }, data: { isEmailVerified: true } });

      const login = await request(app).post('/api/auth/login').send({
        identifier: userData.email,
        password: userData.password,
      });
      const cookie = (login.headers['set-cookie'] as any)[0].split(';')[0];
      return { id: uid, cookie };
    };

    const ownerRes = await registerAndLogin(ownerUser);
    ownerId = ownerRes.id;
    ownerCookie = ownerRes.cookie;

    const ws2Res = await registerAndLogin(ws2OwnerUser);
    ws2OwnerId = ws2Res.id;

    const memberRes = await registerAndLogin(memberUser);
    memberId = memberRes.id;
    memberCookie = memberRes.cookie;

    const adminRes = await registerAndLogin(adminUser);
    adminId = adminRes.id;
    adminCookie = adminRes.cookie;

    const outsiderRes = await registerAndLogin(outsiderUser);
    outsiderId = outsiderRes.id;
    outsiderCookie = outsiderRes.cookie;

    const deactRes = await registerAndLogin(deactivatedUser);
    deactivatedId = deactRes.id;
    await prisma.user.update({ where: { id: deactivatedId }, data: { isDeactivated: true } });

    // Create Team Workspace 1
    const ws1Res = await request(app)
      .post('/api/workspaces')
      .set('Cookie', ownerCookie)
      .send({ name: `Fix5 Workspace 1 ${ts}`, slug: `f5-ws1-${ts}` });
    expect(ws1Res.status).toBe(201);
    teamWs1Id = ws1Res.body.data.workspace.id;
    dynamicWsIds.push(teamWs1Id);

    // Create Team Workspace 2 (owned by ws2OwnerId)
    const ws2Res2 = await prisma.workspace.create({
      data: {
        name: `Fix5 Workspace 2 ${ts}`,
        slug: `f5-ws2-${ts}`,
        ownerId: ws2OwnerId,
        isPersonal: false,
      },
    });
    teamWs2Id = ws2Res2.id;
    dynamicWsIds.push(teamWs2Id);

    // Add memberUser and adminUser to Team Workspace 1
    await prisma.workspaceMember.createMany({
      data: [
        {
          workspaceId: teamWs1Id,
          userId: memberId,
          role: 'WORKSPACE_MEMBER',
          origin: 'DIRECT',
        },
        {
          workspaceId: teamWs1Id,
          userId: adminId,
          role: 'WORKSPACE_MEMBER',
          origin: 'DIRECT',
        },
      ],
    });

    // Create Project 1 in Workspace 1
    const p1Res = await request(app)
      .post('/api/projects')
      .set('Cookie', ownerCookie)
      .set('X-Workspace-Id', teamWs1Id)
      .send({
        name: 'Project Alpha',
        key: 'PAL',
        description: 'First test project',
        visibility: 'WORKSPACE',
      });
    expect(p1Res.status).toBe(201);
    project1Id = p1Res.body.data.project.id;
    dynamicProjectIds.push(project1Id);

    // Add adminUser as PROJECT_ADMIN in Project 1
    await prisma.projectMember.create({
      data: {
        projectId: project1Id,
        userId: adminId,
        role: 'PROJECT_ADMIN',
      },
    });

    // Create Project 2 in Workspace 2
    const p2Res = await prisma.project.create({
      data: {
        name: 'Project Beta',
        key: 'PBE',
        workspaceId: teamWs2Id,
        createdById: ws2OwnerId,
        visibility: 'WORKSPACE',
        description: 'Second test project',
      },
    });
    project2Id = p2Res.id;
    dynamicProjectIds.push(project2Id);
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    try {
      if (dynamicProjectIds.length > 0) {
        await prisma.invitation.deleteMany({ where: { projectId: { in: dynamicProjectIds } } });
        await prisma.projectMember.deleteMany({ where: { projectId: { in: dynamicProjectIds } } });
        await prisma.project.deleteMany({ where: { id: { in: dynamicProjectIds } } });
      }
      if (dynamicWsIds.length > 0) {
        await prisma.workspaceMember.deleteMany({ where: { workspaceId: { in: dynamicWsIds } } });
        await prisma.workspace.deleteMany({ where: { id: { in: dynamicWsIds } } });
      }
      if (dynamicUserIds.length > 0) {
        await prisma.user.deleteMany({ where: { id: { in: dynamicUserIds } } });
      }
    } catch {}
  });

  describe('1. Project Invitation Creation Validation', () => {
    it('succeeds when inviting an active workspace member', async () => {
      emailSpy.mockClear();
      notifSpy.mockClear();

      const res = await request(app)
        .post(`/api/projects/${project1Id}/invitations`)
        .set('Cookie', ownerCookie)
        .send({
          email: memberUser.email,
          role: 'PROJECT_MEMBER',
          message: 'Welcome to Project Alpha',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.invitation.status).toBe('PENDING');
      expect(res.body.data.invitation.invitedUserId).toBe(memberId);

      // Verify email was queued and in-app notification was dispatched
      expect(emailSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'PROJECT_INVITATION',
          toEmail: memberUser.email.toLowerCase(),
          projectName: 'Project Alpha',
        })
      );
      expect(notifSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientId: memberId,
          type: 'PROJECT_INVITED',
        })
      );

      // Cleanup
      await prisma.invitation.delete({ where: { id: res.body.data.invitation.id } });
    });

    it('rejects invitation creation for an outsider user who is not a workspace member (400)', async () => {
      emailSpy.mockClear();
      notifSpy.mockClear();

      const res = await request(app)
        .post(`/api/projects/${project1Id}/invitations`)
        .set('Cookie', ownerCookie)
        .send({
          email: outsiderUser.email,
          role: 'PROJECT_MEMBER',
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/(workspace member|active member of this workspace)/i);

      // Ensure no email or notification was sent
      expect(emailSpy).not.toHaveBeenCalled();
      expect(notifSpy).not.toHaveBeenCalled();
    });

    it('rejects invitation creation for an unregistered external email address (400)', async () => {
      emailSpy.mockClear();
      notifSpy.mockClear();

      const res = await request(app)
        .post(`/api/projects/${project1Id}/invitations`)
        .set('Cookie', ownerCookie)
        .send({
          email: `unregistered_${ts}@example.com`,
          role: 'PROJECT_MEMBER',
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/(workspace member|active member of this workspace)/i);

      expect(emailSpy).not.toHaveBeenCalled();
      expect(notifSpy).not.toHaveBeenCalled();
    });

    it('rejects invitation creation for a deactivated user (400)', async () => {
      // Add deactivated user to workspace
      await prisma.workspaceMember.create({
        data: {
          workspaceId: teamWs1Id,
          userId: deactivatedId,
          role: 'WORKSPACE_MEMBER',
          origin: 'DIRECT',
        },
      });

      emailSpy.mockClear();
      notifSpy.mockClear();

      const res = await request(app)
        .post(`/api/projects/${project1Id}/invitations`)
        .set('Cookie', ownerCookie)
        .send({
          email: deactivatedUser.email,
          role: 'PROJECT_MEMBER',
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/(workspace member|active member of this workspace)/i);

      expect(emailSpy).not.toHaveBeenCalled();
      expect(notifSpy).not.toHaveBeenCalled();

      await prisma.workspaceMember.deleteMany({
        where: { workspaceId: teamWs1Id, userId: deactivatedId },
      });
    });

    it('rejects self-invitation (400)', async () => {
      const res = await request(app)
        .post(`/api/projects/${project1Id}/invitations`)
        .set('Cookie', ownerCookie)
        .send({
          email: ownerUser.email,
          role: 'PROJECT_MEMBER',
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/cannot invite yourself/i);
    });

    it('rejects inviting a user who is already a member of the project (400)', async () => {
      const res = await request(app)
        .post(`/api/projects/${project1Id}/invitations`)
        .set('Cookie', ownerCookie)
        .send({
          email: adminUser.email,
          role: 'PROJECT_MEMBER',
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/already a member of this project/i);
    });

    it('rejects duplicate pending invitations to the same user (400)', async () => {
      const first = await request(app)
        .post(`/api/projects/${project1Id}/invitations`)
        .set('Cookie', ownerCookie)
        .send({
          email: memberUser.email,
          role: 'PROJECT_MEMBER',
        });
      expect(first.status).toBe(201);
      const invId = first.body.data.invitation.id;

      const second = await request(app)
        .post(`/api/projects/${project1Id}/invitations`)
        .set('Cookie', ownerCookie)
        .send({
          email: memberUser.email,
          role: 'PROJECT_ADMIN',
        });
      expect(second.status).toBe(400);
      expect(second.body.message).toMatch(/pending invitation has already been sent/i);

      await prisma.invitation.delete({ where: { id: invId } });
    });
  });

  describe('2. Project Creation Initial Invitations Validation', () => {
    it('projectService.createProject rejects initial invitations with non-workspace members', async () => {
      await expect(
        projectService.createProject(
          ownerId,
          {
            name: 'Invalid Initial Project',
            description: 'Testing invalid initial invitations',
            invitations: [
              { email: memberUser.email, role: 'PROJECT_MEMBER' },
              { email: outsiderUser.email, role: 'PROJECT_MEMBER' },
            ],
          },
          teamWs1Id
        )
      ).rejects.toThrow(/must be an active member of this workspace/i);
    });

    it('projectService.createProject succeeds when all initial invited users belong to the workspace', async () => {
      const newProj = await projectService.createProject(
        ownerId,
        {
          name: 'Valid Initial Project',
          description: 'Testing valid initial invitations',
          invitations: [{ email: memberUser.email, role: 'PROJECT_MEMBER' }],
        },
        teamWs1Id
      );
      expect(newProj).toBeTruthy();
      expect(newProj!.id).toBeDefined();
      dynamicProjectIds.push(newProj!.id);

      const pending = await prisma.invitation.findFirst({
        where: { projectId: newProj!.id, invitedEmail: memberUser.email.toLowerCase() },
      });
      expect(pending).not.toBeNull();
      expect(pending?.status).toBe('PENDING');

      // Cleanup
      await prisma.invitation.deleteMany({ where: { projectId: newProj!.id } });
      await prisma.projectMember.deleteMany({ where: { projectId: newProj!.id } });
      await prisma.project.delete({ where: { id: newProj!.id } });
    });
  });

  describe('3. Resend Invitation Validation', () => {
    it('rejects resend if recipient was removed from the workspace (400)', async () => {
      // Create valid invitation for memberUser
      const invRes = await request(app)
        .post(`/api/projects/${project1Id}/invitations`)
        .set('Cookie', ownerCookie)
        .send({
          email: memberUser.email,
          role: 'PROJECT_MEMBER',
        });
      expect(invRes.status).toBe(201);
      const invId = invRes.body.data.invitation.id;

      // Bypass rate limit cooldown for testing
      await prisma.invitation.update({
        where: { id: invId },
        data: { updatedAt: new Date(Date.now() - 70000) },
      });

      // Remove memberUser from workspace
      await prisma.workspaceMember.deleteMany({
        where: { workspaceId: teamWs1Id, userId: memberId },
      });

      emailSpy.mockClear();

      // Attempt to resend
      const resendRes = await request(app)
        .post(`/api/projects/${project1Id}/invitations/${invId}/resend`)
        .set('Cookie', ownerCookie);

      expect(resendRes.status).toBe(400);
      expect(resendRes.body.message).toMatch(/not an active member of this workspace/i);
      expect(emailSpy).not.toHaveBeenCalled();

      // Restore workspace membership for memberUser
      await prisma.workspaceMember.create({
        data: {
          workspaceId: teamWs1Id,
          userId: memberId,
          role: 'WORKSPACE_MEMBER',
          origin: 'DIRECT',
        },
      });

      // Resend should now succeed
      const resendSuccess = await request(app)
        .post(`/api/projects/${project1Id}/invitations/${invId}/resend`)
        .set('Cookie', ownerCookie);

      expect(resendSuccess.status).toBe(200);
      expect(emailSpy).toHaveBeenCalled();

      await prisma.invitation.delete({ where: { id: invId } });
    });

    it('rejects resend if recipient already joined the project (400)', async () => {
      const inv = await prisma.invitation.create({
        data: {
          projectId: project1Id,
          invitedEmail: memberUser.email.toLowerCase(),
          invitedUserId: memberId,
          invitedById: ownerId,
          role: 'PROJECT_MEMBER',
          status: 'PENDING',
          expiresAt: new Date(Date.now() + 86400000),
          updatedAt: new Date(Date.now() - 70000),
        },
      });

      // User joins project
      await prisma.projectMember.create({
        data: {
          projectId: project1Id,
          userId: memberId,
          role: 'PROJECT_MEMBER',
        },
      });

      const resendRes = await request(app)
        .post(`/api/projects/${project1Id}/invitations/${inv.id}/resend`)
        .set('Cookie', ownerCookie);

      expect(resendRes.status).toBe(400);
      expect(resendRes.body.message).toMatch(/already a member of this project/i);

      // Cleanup
      await prisma.projectMember.deleteMany({
        where: { projectId: project1Id, userId: memberId },
      });
      await prisma.invitation.delete({ where: { id: inv.id } });
    });
  });

  describe('4. Workspace Removal & Acceptance Invalidation', () => {
    it('workspaceMemberService.removeMember automatically cancels pending project invitations', async () => {
      // Create pending project invitation for memberUser
      const inv = await prisma.invitation.create({
        data: {
          projectId: project1Id,
          invitedEmail: memberUser.email.toLowerCase(),
          invitedUserId: memberId,
          invitedById: ownerId,
          role: 'PROJECT_MEMBER',
          status: 'PENDING',
          expiresAt: new Date(Date.now() + 86400000),
        },
      });

      const wm = await prisma.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId: teamWs1Id, userId: memberId } },
      });
      expect(wm).not.toBeNull();

      // Remove member from workspace via workspaceMemberService
      await workspaceMemberService.removeMember(teamWs1Id, wm!.id, ownerId);

      // Check invitation status was cancelled
      const updatedInv = await prisma.invitation.findUnique({ where: { id: inv.id } });
      expect(updatedInv?.status).toBe('CANCELLED');

      // Attempting to accept cancelled invitation fails with 400
      const acceptRes = await request(app)
        .post(`/api/invitations/${inv.id}/accept`)
        .set('Cookie', memberCookie);
      expect(acceptRes.status).toBe(400);
      expect(acceptRes.body.message).toMatch(/already been cancelled/i);

      // Restore workspace membership for memberUser
      await prisma.workspaceMember.create({
        data: {
          workspaceId: teamWs1Id,
          userId: memberId,
          role: 'WORKSPACE_MEMBER',
          origin: 'DIRECT',
        },
      });
      await prisma.invitation.delete({ where: { id: inv.id } });
    });

    it('rejects acceptance with 403 inside transaction if user is not in the workspace', async () => {
      // Pending invitation for outsiderUser who is not in teamWs1Id
      const inv = await prisma.invitation.create({
        data: {
          projectId: project1Id,
          invitedEmail: outsiderUser.email.toLowerCase(),
          invitedUserId: outsiderId,
          invitedById: ownerId,
          role: 'PROJECT_MEMBER',
          status: 'PENDING',
          expiresAt: new Date(Date.now() + 86400000),
        },
      });

      const acceptRes = await request(app)
        .post(`/api/invitations/${inv.id}/accept`)
        .set('Cookie', outsiderCookie);

      expect(acceptRes.status).toBe(403);
      expect(acceptRes.body.message).toContain('Workspace membership is required before joining this project');

      // Ensure no ProjectMember record was created
      const pm = await prisma.projectMember.findUnique({
        where: { projectId_userId: { projectId: project1Id, userId: outsiderId } },
      });
      expect(pm).toBeNull();

      // Verify invitation status remains PENDING
      const check = await prisma.invitation.findUnique({ where: { id: inv.id } });
      expect(check?.status).toBe('PENDING');

      await prisma.invitation.delete({ where: { id: inv.id } });
    });

    it('rejects acceptance if workspace containing the project has been deleted (404)', async () => {
      // Soft-delete teamWs1Id temporarily
      await prisma.workspace.update({
        where: { id: teamWs1Id },
        data: { deletedAt: new Date() },
      });

      const inv = await prisma.invitation.create({
        data: {
          projectId: project1Id,
          invitedEmail: memberUser.email.toLowerCase(),
          invitedUserId: memberId,
          invitedById: ownerId,
          role: 'PROJECT_MEMBER',
          status: 'PENDING',
          expiresAt: new Date(Date.now() + 86400000),
        },
      });

      const acceptRes = await request(app)
        .post(`/api/invitations/${inv.id}/accept`)
        .set('Cookie', memberCookie);

      expect(acceptRes.status).toBe(404);
      expect(acceptRes.body.message).toMatch(/workspace containing this project has been deleted/i);

      // Restore workspace
      await prisma.workspace.update({
        where: { id: teamWs1Id },
        data: { deletedAt: null },
      });

      await prisma.invitation.delete({ where: { id: inv.id } });
    });
  });

  describe('5. Acceptance Expiry, Idempotency, and Concurrency', () => {
    it('blocks expired invitations from acceptance (400)', async () => {
      const inv = await prisma.invitation.create({
        data: {
          projectId: project1Id,
          invitedEmail: memberUser.email.toLowerCase(),
          invitedUserId: memberId,
          invitedById: ownerId,
          role: 'PROJECT_MEMBER',
          status: 'PENDING',
          expiresAt: new Date(Date.now() - 10000), // Expired
        },
      });

      const acceptRes = await request(app)
        .post(`/api/invitations/${inv.id}/accept`)
        .set('Cookie', memberCookie);

      expect(acceptRes.status).toBe(400);
      expect(acceptRes.body.message).toMatch(/invitation has expired/i);

      await prisma.invitation.delete({ where: { id: inv.id } });
    });

    it('concurrent acceptance requests serialize safely without duplicate project members', async () => {
      const inv = await prisma.invitation.create({
        data: {
          projectId: project1Id,
          invitedEmail: memberUser.email.toLowerCase(),
          invitedUserId: memberId,
          invitedById: ownerId,
          role: 'PROJECT_MEMBER',
          status: 'PENDING',
          expiresAt: new Date(Date.now() + 86400000),
        },
      });

      try {
        // Fire 2 concurrent accept requests
        const [res1, res2] = await Promise.all([
          request(app).post(`/api/invitations/${inv.id}/accept`).set('Cookie', memberCookie),
          request(app).post(`/api/invitations/${inv.id}/accept`).set('Cookie', memberCookie),
        ]);

        const statuses = [res1.status, res2.status];
        // One request must succeed with 200, the other either succeeds idempotently (200) or rejects cleanly (400)
        expect(statuses).toContain(200);
        for (const s of statuses) {
          expect([200, 400]).toContain(s);
        }

        // Exactly 1 ProjectMember record must exist in DB
        const pms = await prisma.projectMember.findMany({
          where: { projectId: project1Id, userId: memberId },
        });
        expect(pms).toHaveLength(1);

        // Verify invitation status is ACCEPTED
        const updatedInv = await prisma.invitation.findUnique({ where: { id: inv.id } });
        expect(updatedInv?.status).toBe('ACCEPTED');
      } finally {
        // Cleanup
        await prisma.projectMember.deleteMany({
          where: { projectId: project1Id, userId: memberId },
        });
        await prisma.invitation.delete({ where: { id: inv.id } }).catch(() => {});
      }
    });
  });

  describe('6. Workspace Role vs Project Role Separation', () => {
    it('Project Admin can invite workspace members to the project, but cannot invite users to the workspace (403)', async () => {
      // adminUser is PROJECT_ADMIN in Project 1, but WORKSPACE_MEMBER in Workspace 1
      // 1. Inviting memberUser to Project 1 succeeds
      const projInvRes = await request(app)
        .post(`/api/projects/${project1Id}/invitations`)
        .set('Cookie', adminCookie)
        .send({
          email: memberUser.email,
          role: 'PROJECT_MEMBER',
        });
      expect(projInvRes.status).toBe(201);
      const invId = projInvRes.body.data.invitation.id;

      // 2. Inviting users to Workspace 1 fails with 403
      const wsInvRes = await request(app)
        .post(`/api/workspaces/${teamWs1Id}/invitations`)
        .set('Cookie', adminCookie)
        .send({
          email: `new_user_${ts}@example.com`,
          role: 'WORKSPACE_MEMBER',
        });
      expect(wsInvRes.status).toBe(403);

      // 3. Trying to remove a workspace member fails with 403
      const wsRemoveRes = await request(app)
        .delete(`/api/workspaces/${teamWs1Id}/members/${memberId}`)
        .set('Cookie', adminCookie);
      expect(wsRemoveRes.status).toBe(403);

      // Cleanup
      await prisma.invitation.delete({ where: { id: invId } });
    });
  });
});
