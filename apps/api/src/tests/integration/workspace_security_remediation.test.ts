import crypto from 'crypto';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../../server.js';
import prisma from '../../prisma.js';
import { invitationService } from '../../services/invitation.service.js';
import { memberService } from '../../services/member.service.js';
import { calendarService } from '../../services/calendar.service.js';
import { projectService } from '../../services/project.service.js';
import { workspaceService } from '../../services/workspace.service.js';
import path from 'path';
import { pathToFileURL } from 'url';
import { ensurePersonalWorkspace } from '../../services/auth.service.js';
import { requireWorkspaceAdmin, requireWorkspaceOwner, WorkspaceRequest } from '../../middlewares/workspace.middleware.js';

describe('Multi-Workspace Security Remediation Test Suite', () => {
  const ts = Date.now();
  const dynamicUserIds: string[] = [];

  const ownerUser = {
    username: `remed_owner_${ts}`,
    email: `remed_owner_${ts}@example.com`,
    password: 'Password123!Secure',
    fullName: 'Remediation Owner',
  };

  const memberUser = {
    username: `remed_member_${ts}`,
    email: `remed_member_${ts}@example.com`,
    password: 'Password123!Secure',
    fullName: 'Remediation Member',
  };

  const outsiderUser = {
    username: `remed_outsider_${ts}`,
    email: `remed_outsider_${ts}@example.com`,
    password: 'Password123!Secure',
    fullName: 'Remediation Outsider',
  };

  let ownerId: string;
  let memberId: string;
  let outsiderId: string;

  let ownerCookie: string;
  let memberCookie: string;

  let ownerPersonalWsId: string;
  let teamWsId: string;
  let teamProject1Id: string;
  let teamProject2Id: string;

  beforeAll(async () => {
    // 1. Register Owner
    const regOwner = await request(app).post('/api/auth/register').send(ownerUser);
    expect(regOwner.status).toBe(201);
    ownerId = regOwner.body.data.user.id;
    await prisma.user.update({ where: { id: ownerId }, data: { isEmailVerified: true } });

    const loginOwner = await request(app).post('/api/auth/login').send({
      identifier: ownerUser.email,
      password: ownerUser.password,
    });
    const cOwner = loginOwner.headers['set-cookie'];
    ownerCookie = Array.isArray(cOwner) ? cOwner[0].split(';')[0] : cOwner.split(';')[0];

    const ownerWs = await ensurePersonalWorkspace(ownerId);
    ownerPersonalWsId = ownerWs.id;

    // 2. Register Member
    const regMember = await request(app).post('/api/auth/register').send(memberUser);
    expect(regMember.status).toBe(201);
    memberId = regMember.body.data.user.id;
    await prisma.user.update({ where: { id: memberId }, data: { isEmailVerified: true } });

    const loginMember = await request(app).post('/api/auth/login').send({
      identifier: memberUser.email,
      password: memberUser.password,
    });
    const cMember = loginMember.headers['set-cookie'];
    memberCookie = Array.isArray(cMember) ? cMember[0].split(';')[0] : cMember.split(';')[0];
    await ensurePersonalWorkspace(memberId);

    // 3. Register Outsider
    const regOutsider = await request(app).post('/api/auth/register').send(outsiderUser);
    expect(regOutsider.status).toBe(201);
    outsiderId = regOutsider.body.data.user.id;
    await prisma.user.update({ where: { id: outsiderId }, data: { isEmailVerified: true } });
    await ensurePersonalWorkspace(outsiderId);

    // 4. Create Team Workspace
    const teamWs = await workspaceService.createWorkspace(ownerId, {
      name: `Remediation Team WS ${ts}`,
    });
    teamWsId = teamWs.id;

    // 5. Create 2 Projects in Team Workspace
    const p1 = await projectService.createProject(ownerId, {
      name: `Team Project 1 ${ts}`,
      key: 'TP1',
      description: 'First team project',
      workspaceId: teamWsId,
    } as any);
    teamProject1Id = p1!.id;

    const p2 = await projectService.createProject(ownerId, {
      name: `Team Project 2 ${ts}`,
      key: 'TP2',
      description: 'Second team project',
      workspaceId: teamWsId,
    } as any);
    teamProject2Id = p2!.id;
  });

  afterAll(async () => {
    const userIds = [ownerId, memberId, outsiderId, ...dynamicUserIds].filter(Boolean);
    if (userIds.length > 0) {
      await prisma.calendarFeedToken.deleteMany({ where: { userId: { in: userIds } } }).catch(() => {});
      await prisma.projectMember.deleteMany({ where: { userId: { in: userIds } } }).catch(() => {});
      await prisma.project.deleteMany({ where: { createdById: { in: userIds } } }).catch(() => {});
      await prisma.workspaceMember.deleteMany({ where: { userId: { in: userIds } } }).catch(() => {});
      await prisma.workspace.deleteMany({ where: { ownerId: { in: userIds } } }).catch(() => {});
      await prisma.session.deleteMany({ where: { userId: { in: userIds } } }).catch(() => {});
      await prisma.user.deleteMany({ where: { id: { in: userIds } } }).catch(() => {});
    }
  });

  // =========================================================================
  // 1. Critical: Project Invitation Acceptance & Workspace Membership Prereq
  // =========================================================================
  describe('1. Project Invitation Acceptance Lifecycle & Prerequisite Checks', () => {
    it('rejects acceptance with 403 when recipient is not a workspace member and preserves PENDING status', async () => {
      // Invite outsider to Team Project 1 (outsider is NOT in teamWsId)
      const inv = await invitationService.createInvitation(teamProject1Id, ownerId, {
        email: outsiderUser.email,
        role: 'PROJECT_MEMBER',
      });

      await expect(invitationService.acceptInvitation(inv.id, outsiderId)).rejects.toThrow(
        /Workspace membership is required/
      );

      // Verify invitation was NOT marked accepted; remains PENDING
      const checkInv = await prisma.invitation.findUnique({ where: { id: inv.id } });
      expect(checkInv?.status).toBe('PENDING');

      // Cleanup invitation
      await prisma.invitation.delete({ where: { id: inv.id } });
    });

    it('successfully accepts invitation once workspace membership is established', async () => {
      // Invite memberUser to Team Project 1
      const inv = await invitationService.createInvitation(teamProject1Id, ownerId, {
        email: memberUser.email,
        role: 'PROJECT_MEMBER',
      });

      // Add memberUser to workspace
      await prisma.workspaceMember.create({
        data: {
          workspaceId: teamWsId,
          userId: memberId,
          role: 'WORKSPACE_MEMBER',
          origin: 'PROJECT_DERIVED',
        },
      });

      const res = await invitationService.acceptInvitation(inv.id, memberId);
      expect(res.success).toBe(true);

      const pm = await prisma.projectMember.findUnique({
        where: { projectId_userId: { projectId: teamProject1Id, userId: memberId } },
      });
      expect(pm).not.toBeNull();
      expect(pm?.role).toBe('PROJECT_MEMBER');
    });

    it('blocks expired invitations from acceptance', async () => {
      const inv = await prisma.invitation.create({
        data: {
          projectId: teamProject1Id,
          invitedEmail: memberUser.email.toLowerCase(),
          invitedUserId: memberId,
          invitedById: ownerId,
          role: 'PROJECT_MEMBER',
          status: 'PENDING',
          expiresAt: new Date(Date.now() - 10000), // Expired
        },
      });

      await expect(invitationService.acceptInvitation(inv.id, memberId)).rejects.toThrow(
        /expired/i
      );

      const check = await prisma.invitation.findUnique({ where: { id: inv.id } });
      expect(check?.status).toBe('EXPIRED');
    });

    it('safely handles duplicate and concurrent acceptance', async () => {
      // Invite memberUser to Team Project 2
      const inv = await invitationService.createInvitation(teamProject2Id, ownerId, {
        email: memberUser.email,
        role: 'PROJECT_MEMBER',
      });

      // Accept first time
      const res1 = await invitationService.acceptInvitation(inv.id, memberId);
      expect(res1.success).toBe(true);

      // Duplicate acceptance rejects because status is no longer PENDING
      await expect(invitationService.acceptInvitation(inv.id, memberId)).rejects.toThrow(
        /already been accepted/i
      );

      // Concurrency test: create fresh invitation and run concurrent accepts
      const invConcurrent = await prisma.invitation.create({
        data: {
          projectId: teamProject2Id,
          invitedEmail: 'concurrent_user@example.com',
          invitedById: ownerId,
          role: 'PROJECT_MEMBER',
          status: 'PENDING',
          expiresAt: new Date(Date.now() + 86400000),
        },
      });

      // Create concurrent user and join workspace
      const cUser = await prisma.user.create({
        data: {
          email: 'concurrent_user@example.com',
          username: `concurrent_${Date.now()}`,
          isEmailVerified: true,
        },
      });

      await prisma.workspaceMember.create({
        data: {
          workspaceId: teamWsId,
          userId: cUser.id,
          role: 'WORKSPACE_MEMBER',
          origin: 'PROJECT_DERIVED',
        },
      });

      // Fire concurrent acceptance calls
      const results = await Promise.allSettled([
        invitationService.acceptInvitation(invConcurrent.id, cUser.id),
        invitationService.acceptInvitation(invConcurrent.id, cUser.id),
      ]);

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      // Exactly one succeeds, the other is rejected
      expect(fulfilled.length).toBe(1);
      expect(rejected.length).toBe(1);

      // Verify only 1 ProjectMember record was created
      const pmCount = await prisma.projectMember.count({
        where: { projectId: teamProject2Id, userId: cUser.id },
      });
      expect(pmCount).toBe(1);

      // Cleanup
      await prisma.projectMember.deleteMany({ where: { userId: cUser.id } }).catch(() => {});
      await prisma.workspaceMember.deleteMany({ where: { userId: cUser.id } }).catch(() => {});
      await prisma.invitation.deleteMany({ where: { id: invConcurrent.id } }).catch(() => {});
      await prisma.user.delete({ where: { id: cUser.id } }).catch(() => {});
    });
  });

  // =========================================================================
  // 2. High: Workspace Membership Lifecycle
  // =========================================================================
  describe('2. Workspace Membership Lifecycle & Origin Tracking', () => {
    it('preserves WorkspaceMember when removed from project if another project remains', async () => {
      // memberId is in both Team Project 1 and Team Project 2
      const targetMember = await prisma.projectMember.findUnique({
        where: { projectId_userId: { projectId: teamProject1Id, userId: memberId } },
      });
      expect(targetMember).not.toBeNull();

      // Remove from Team Project 1
      await memberService.removeMember(teamProject1Id, targetMember!.id, ownerId);

      // Verify ProjectMember in TP1 is deleted
      const checkPm1 = await prisma.projectMember.findUnique({
        where: { projectId_userId: { projectId: teamProject1Id, userId: memberId } },
      });
      expect(checkPm1).toBeNull();

      // Verify WorkspaceMember is PRESERVED because member is still in Team Project 2
      const checkWs = await prisma.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId: teamWsId, userId: memberId } },
      });
      expect(checkWs).not.toBeNull();
    });

    it('safely revokes PROJECT_DERIVED WorkspaceMember when removed from the final project', async () => {
      // Remove from Team Project 2 (the final remaining project)
      const targetMember = await prisma.projectMember.findUnique({
        where: { projectId_userId: { projectId: teamProject2Id, userId: memberId } },
      });
      expect(targetMember).not.toBeNull();

      await memberService.removeMember(teamProject2Id, targetMember!.id, ownerId);

      // Since memberUser was PROJECT_DERIVED and has 0 remaining projects, WorkspaceMember is revoked
      const checkWs = await prisma.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId: teamWsId, userId: memberId } },
      });
      expect(checkWs).toBeNull();
    });

    it('preserves independently invited DIRECT WorkspaceMember even when project count hits zero', async () => {
      // Re-add memberUser to teamProject1, but with origin: 'DIRECT'
      await prisma.workspaceMember.create({
        data: {
          workspaceId: teamWsId,
          userId: memberId,
          role: 'WORKSPACE_MEMBER',
          origin: 'DIRECT',
        },
      });

      const pm = await prisma.projectMember.create({
        data: {
          projectId: teamProject1Id,
          userId: memberId,
          role: 'PROJECT_MEMBER',
        },
      });

      // Remove member from teamProject1 (their only project)
      await memberService.removeMember(teamProject1Id, pm.id, ownerId);

      // Verify WorkspaceMember is PRESERVED because origin is DIRECT
      const checkWs = await prisma.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId: teamWsId, userId: memberId } },
      });
      expect(checkWs).not.toBeNull();
      expect(checkWs?.origin).toBe('DIRECT');
    });

    it('demonstrates that a legacy project-only collaborator loses workspace access after final project removal, while an independently invited member retains access', async () => {
      // 1. Setup a legacy project-derived collaborator
      const userLegacy = await prisma.user.create({
        data: {
          username: `legacy_user_${Date.now()}`,
          email: `legacy_${Date.now()}@example.com`,
          passwordHash: 'hashed_pw',
        },
      });
      dynamicUserIds.push(userLegacy.id);

      await prisma.workspaceMember.create({
        data: {
          workspaceId: teamWsId,
          userId: userLegacy.id,
          role: 'WORKSPACE_MEMBER',
          origin: 'PROJECT_DERIVED',
        },
      });

      const pmLegacy = await prisma.projectMember.create({
        data: {
          projectId: teamProject1Id,
          userId: userLegacy.id,
          role: 'PROJECT_MEMBER',
        },
      });

      // User has workspace access prior to removal
      await expect(workspaceService.verifyWorkspaceAccess(teamWsId, userLegacy.id)).resolves.not.toThrow();

      // Remove legacy user from their sole project
      await memberService.removeMember(teamProject1Id, pmLegacy.id, ownerId);

      // Verify legacy collaborator has LOST workspace access completely
      await expect(workspaceService.verifyWorkspaceAccess(teamWsId, userLegacy.id)).rejects.toThrow(
        /You do not have access to this workspace/
      );

      // 2. Setup an independently invited member
      const userDirect = await prisma.user.create({
        data: {
          username: `direct_user_${Date.now()}`,
          email: `direct_${Date.now()}@example.com`,
          passwordHash: 'hashed_pw',
        },
      });
      dynamicUserIds.push(userDirect.id);

      await prisma.workspaceMember.create({
        data: {
          workspaceId: teamWsId,
          userId: userDirect.id,
          role: 'WORKSPACE_MEMBER',
          origin: 'DIRECT',
        },
      });

      const pmDirect = await prisma.projectMember.create({
        data: {
          projectId: teamProject1Id,
          userId: userDirect.id,
          role: 'PROJECT_MEMBER',
        },
      });

      // Remove independently invited user from their sole project
      await memberService.removeMember(teamProject1Id, pmDirect.id, ownerId);

      // Verify independently invited member RETAINS workspace access
      await expect(workspaceService.verifyWorkspaceAccess(teamWsId, userDirect.id)).resolves.not.toThrow();
      const wsMemberRecord = await prisma.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId: teamWsId, userId: userDirect.id } },
      });
      expect(wsMemberRecord).not.toBeNull();
      expect(wsMemberRecord?.origin).toBe('DIRECT');
    });

    it('personal workspace project-derived membership is revoked after removal from the user last project', async () => {
      // 1. Create a project in ownerPersonalWsId
      const personalProj = await projectService.createProject(ownerId, {
        name: `Personal Prune Test ${Date.now()}`,
        key: 'PPT',
        description: 'Testing personal ws revocation',
        workspaceId: ownerPersonalWsId,
      } as any);

      // Create a collaborator user
      const colUser = await prisma.user.create({
        data: {
          username: `col_${Date.now()}`,
          email: `col_${Date.now()}@example.com`,
          passwordHash: 'hashed_pw',
        },
      });
      dynamicUserIds.push(colUser.id);

      // Add collaborator to personal workspace as PROJECT_DERIVED
      await prisma.workspaceMember.create({
        data: {
          workspaceId: ownerPersonalWsId,
          userId: colUser.id,
          role: 'WORKSPACE_MEMBER',
          origin: 'PROJECT_DERIVED',
        },
      });

      // Add to personal project
      const pm = await prisma.projectMember.create({
        data: {
          projectId: personalProj!.id,
          userId: colUser.id,
          role: 'PROJECT_MEMBER',
        },
      });

      // Verify user has access to personal workspace
      await expect(workspaceService.verifyWorkspaceAccess(ownerPersonalWsId, colUser.id)).resolves.not.toThrow();

      // Remove from personal project
      await memberService.removeMember(personalProj!.id, pm.id, ownerId);

      // Verify workspace membership in personal workspace was safely revoked
      const wsMemberCheck = await prisma.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId: ownerPersonalWsId, userId: colUser.id } },
      });
      expect(wsMemberCheck).toBeNull();

      // Verify user no longer has access to the personal workspace
      await expect(workspaceService.verifyWorkspaceAccess(ownerPersonalWsId, colUser.id)).rejects.toThrow(
        /You do not have access to this workspace/
      );

      // Clean up project
      await prisma.project.delete({ where: { id: personalProj!.id } });
    });

    it('team workspace DIRECT membership survives project removal', async () => {
      const teamUser = await prisma.user.create({
        data: {
          username: `tw_direct_${Date.now()}`,
          email: `tw_direct_${Date.now()}@example.com`,
          passwordHash: 'hashed_pw',
        },
      });
      dynamicUserIds.push(teamUser.id);

      await prisma.workspaceMember.create({
        data: {
          workspaceId: teamWsId,
          userId: teamUser.id,
          role: 'WORKSPACE_MEMBER',
          origin: 'DIRECT',
        },
      });

      const pm = await prisma.projectMember.create({
        data: {
          projectId: teamProject1Id,
          userId: teamUser.id,
          role: 'PROJECT_MEMBER',
        },
      });

      // Remove user from project
      await memberService.removeMember(teamProject1Id, pm.id, ownerId);

      // Verify DIRECT membership in team workspace SURVIVES project removal
      const wsMember = await prisma.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId: teamWsId, userId: teamUser.id } },
      });
      expect(wsMember).not.toBeNull();
      expect(wsMember?.origin).toBe('DIRECT');
      await expect(workspaceService.verifyWorkspaceAccess(teamWsId, teamUser.id)).resolves.not.toThrow();
    });

    it('existing team workspace PROJECT_DERIVED records are corrected safely by corrective migration logic', async () => {
      // Simulate an incorrectly classified team workspace member
      const testUser = await prisma.user.create({
        data: {
          username: `reclassify_${Date.now()}`,
          email: `reclassify_${Date.now()}@example.com`,
          passwordHash: 'hashed_pw',
        },
      });
      dynamicUserIds.push(testUser.id);

      await prisma.workspaceMember.create({
        data: {
          workspaceId: teamWsId,
          userId: testUser.id,
          role: 'WORKSPACE_MEMBER',
          origin: 'PROJECT_DERIVED',
        },
      });

      // Execute corrective SQL
      await prisma.$executeRawUnsafe(`
        UPDATE "WorkspaceMember" wm
        SET "origin" = 'DIRECT'
        FROM "Workspace" w
        WHERE wm."workspaceId" = w."id"
          AND w."isPersonal" = false
          AND wm."role" = 'WORKSPACE_MEMBER'
          AND wm."origin" = 'PROJECT_DERIVED'
          AND wm."userId" = '${testUser.id}';
      `);

      // Verify origin is restored to DIRECT in team workspace
      const updated = await prisma.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId: teamWsId, userId: testUser.id } },
      });
      expect(updated?.origin).toBe('DIRECT');
    });

    it('rerunning the backfill does not downgrade DIRECT membership in team workspaces', async () => {
      const directUser = await prisma.user.create({
        data: {
          username: `backfill_guard_${Date.now()}`,
          email: `backfill_guard_${Date.now()}@example.com`,
          passwordHash: 'hashed_pw',
        },
      });
      dynamicUserIds.push(directUser.id);

      await prisma.workspaceMember.create({
        data: {
          workspaceId: teamWsId,
          userId: directUser.id,
          role: 'WORKSPACE_MEMBER',
          origin: 'DIRECT',
        },
      });

      // Rerun backfill via dynamic import to preserve rootDir boundaries
      const scriptLoc = path.resolve(process.cwd(), 'scripts/backfill-workspaces.ts');
      const { runWorkspacesBackfill } = (await import(pathToFileURL(scriptLoc).href)) as any;
      await runWorkspacesBackfill();

      // Verify origin remains DIRECT
      const checkMember = await prisma.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId: teamWsId, userId: directUser.id } },
      });
      expect(checkMember).not.toBeNull();
      expect(checkMember?.origin).toBe('DIRECT');
    }, 60000);
  });

  // =========================================================================
  // 3. High: External iCal Feed Isolation
  // =========================================================================
  describe('3. External iCal Feed Isolation & Scoping', () => {
    let feedTokenOwner: string;

    it('generates a feed token scoped to the active workspace', async () => {
      const res = await calendarService.createFeedToken(ownerId, null, teamWsId);
      expect(res.token).toBeDefined();
      feedTokenOwner = res.token;

      // Verify token in DB has workspaceId set
      const auth = await calendarService.authenticateFeedToken(feedTokenOwner);
      expect(auth.userId).toBe(ownerId);
      expect(auth.workspaceId).toBe(teamWsId);
    });

    it('scoped feed does NOT expose events from other workspaces', async () => {
      // Create a calendar event in Owner Personal Workspace
      const personalProject = await projectService.createProject(ownerId, {
        name: `Personal Secret Project ${ts}`,
        key: 'PSP',
        description: 'Personal secret',
      } as any);

      await calendarService.createCalendarEvent(personalProject!.id, ownerId, {
        title: 'Confidential Personal Tax Audit',
        startAt: new Date(Date.now() + 86400000).toISOString(),
        endAt: new Date(Date.now() + 90000000).toISOString(),
      });

      // Fetch team workspace feed using token
      const feedRes = await request(app)
        .get(`/api/calendar/feed.ics?token=${feedTokenOwner}`);

      expect(feedRes.status).toBe(200);
      expect(feedRes.text).toContain('BEGIN:VCALENDAR');
      // Confirms isolation: event in personal workspace is NOT in the team workspace feed
      expect(feedRes.text).not.toContain('Confidential Personal Tax Audit');
    });

    it('rejects revoked feed tokens with 401', async () => {
      await calendarService.revokeFeedToken(ownerId, null, teamWsId);

      const feedRes = await request(app)
        .get(`/api/calendar/feed.ics?token=${feedTokenOwner}`);

      expect(feedRes.status).toBe(401);
    });

    it('rejects invalid or tampered feed tokens with 401', async () => {
      const feedRes = await request(app)
        .get('/api/calendar/feed.ics?token=dbcal_invalid_tampered_token_12345');

      expect(feedRes.status).toBe(401);
    });

    it('legacy feed token with null workspaceId safely defaults to personal workspace and isolates from team workspaces', async () => {
      const rawLegacyToken = `dbcal_legacy_${crypto.randomBytes(32).toString('hex')}`;
      const tokenHash = crypto.createHash('sha256').update(rawLegacyToken).digest('hex');
      await prisma.calendarFeedToken.create({
        data: {
          tokenHash,
          userId: ownerId,
          projectId: null,
          workspaceId: null, // Legacy unscoped token
        },
      });

      // Authenticating legacy token resolves strictly to user's personal workspace
      const auth = await calendarService.authenticateFeedToken(rawLegacyToken);
      const personalWs = await ensurePersonalWorkspace(ownerId);
      expect(auth.workspaceId).toBe(personalWs.id);

      // Create an event in Team Workspace
      await calendarService.createCalendarEvent(teamProject1Id, ownerId, {
        title: 'Team Confidential Roadmap Sync',
        startAt: new Date(Date.now() + 86400000).toISOString(),
        endAt: new Date(Date.now() + 90000000).toISOString(),
      });

      // Fetch feed using the legacy token
      const feedRes = await request(app)
        .get(`/api/calendar/feed.ics?token=${rawLegacyToken}`);

      expect(feedRes.status).toBe(200);
      expect(feedRes.text).toContain('BEGIN:VCALENDAR');
      // Confirms isolation: event in team workspace is NOT disclosed by legacy token
      expect(feedRes.text).not.toContain('Team Confidential Roadmap Sync');
    });
  });

  // =========================================================================
  // 4. High: Project Creation Permissions
  // =========================================================================
  describe('4. Project Creation Authorization Enforcement', () => {
    it('allows personal workspace owner to create projects in their personal workspace', async () => {
      const project = await projectService.createProject(ownerId, {
        name: `Owner Personal Project ${ts}`,
        key: 'OPP',
        description: 'Allowed',
        workspaceId: ownerPersonalWsId,
      } as any);
      expect(project!.id).toBeDefined();
    });

    it('strictly denies a collaborator from creating projects in another user personal workspace', async () => {
      // Add memberUser as collaborator to owner's personal workspace
      await prisma.workspaceMember.upsert({
        where: { workspaceId_userId: { workspaceId: ownerPersonalWsId, userId: memberId } },
        create: {
          workspaceId: ownerPersonalWsId,
          userId: memberId,
          role: 'WORKSPACE_MEMBER',
          origin: 'PROJECT_DERIVED',
        },
        update: {},
      });

      await expect(
        projectService.createProject(memberId, {
          name: 'Unauthorized Intruding Project',
          key: 'UIP',
          description: 'Should fail',
          workspaceId: ownerPersonalWsId,
        } as any)
      ).rejects.toThrow(/Only the workspace owner can create projects in a personal workspace/);
    });

    it('strictly denies regular WORKSPACE_MEMBER from creating projects in team workspace', async () => {
      // memberId has role WORKSPACE_MEMBER in teamWsId
      await expect(
        projectService.createProject(memberId, {
          name: 'Unauthorized Team Project',
          key: 'UTP',
          description: 'Should fail',
          workspaceId: teamWsId,
        } as any)
      ).rejects.toThrow(/Workspace members cannot create projects/);
    });

    it('strictly denies unauthorized non-member from creating projects', async () => {
      await expect(
        projectService.createProject(outsiderId, {
          name: 'Outsider Project',
          key: 'OUT',
          description: 'Should fail',
          workspaceId: teamWsId,
        } as any)
      ).rejects.toThrow(/You do not have access to this workspace/);
    });
  });

  // =========================================================================
  // 5. Medium: Workspace Admin Authorization
  // =========================================================================
  describe('5. Workspace Admin Role Authorization and Boundaries', () => {
    it('requireWorkspaceOwner rejects non-owners with 403', () => {
      const mockReq: WorkspaceRequest = {
        isWorkspaceOwner: false,
        workspaceRole: 'WORKSPACE_ADMIN',
      } as any;
      let status = 0;
      let body: any = {};
      const mockRes: any = {
        status: (s: number) => { status = s; return mockRes; },
        json: (b: any) => { body = b; },
      };
      let nextCalled = false;
      const next = () => { nextCalled = true; };

      requireWorkspaceOwner(mockReq, mockRes, next);
      expect(status).toBe(403);
      expect(body.message).toMatch(/Only the workspace owner/);
      expect(nextCalled).toBe(false);
    });

    it('requireWorkspaceAdmin rejects regular WORKSPACE_MEMBER with 403', () => {
      const mockReq: WorkspaceRequest = {
        isWorkspaceOwner: false,
        workspaceRole: 'WORKSPACE_MEMBER',
      } as any;
      let status = 0;
      let body: any = {};
      const mockRes: any = {
        status: (s: number) => { status = s; return mockRes; },
        json: (b: any) => { body = b; },
      };
      let nextCalled = false;
      const next = () => { nextCalled = true; };

      requireWorkspaceAdmin(mockReq, mockRes, next);
      expect(status).toBe(403);
      expect(body.message).toMatch(/administrator privileges required/);
      expect(nextCalled).toBe(false);
    });

    it('requireWorkspaceAdmin permits WORKSPACE_ADMIN', () => {
      const mockReq: WorkspaceRequest = {
        isWorkspaceOwner: false,
        workspaceRole: 'WORKSPACE_ADMIN',
      } as any;
      let nextCalled = false;
      const next = () => { nextCalled = true; };

      requireWorkspaceAdmin(mockReq, {} as any, next);
      expect(nextCalled).toBe(true);
    });

    it('allows WORKSPACE_ADMIN to create projects in team workspace, but denies in personal workspace', async () => {
      const adminUser = await prisma.user.create({
        data: {
          username: `ws_admin_${Date.now()}`,
          email: `ws_admin_${Date.now()}@example.com`,
          passwordHash: 'hashed_pw',
        },
      });
      dynamicUserIds.push(adminUser.id);

      await prisma.workspaceMember.create({
        data: {
          workspaceId: teamWsId,
          userId: adminUser.id,
          role: 'WORKSPACE_ADMIN',
          origin: 'DIRECT',
        },
      });

      // Allowed in Team Workspace
      const teamProj = await projectService.createProject(adminUser.id, {
        name: `Admin Team Project ${Date.now()}`,
        key: 'ATP',
        description: 'Allowed by admin',
        workspaceId: teamWsId,
      } as any);
      expect(teamProj?.id).toBeDefined();

      // Add adminUser as collaborator to owner's personal workspace to verify collaborator restriction
      await prisma.workspaceMember.create({
        data: {
          workspaceId: ownerPersonalWsId,
          userId: adminUser.id,
          role: 'WORKSPACE_MEMBER',
          origin: 'DIRECT',
        },
      });

      // Denied in Owner Personal Workspace
      await expect(
        projectService.createProject(adminUser.id, {
          name: `Admin in Personal ${Date.now()}`,
          key: 'AIP',
          description: 'Blocked in personal',
          workspaceId: ownerPersonalWsId,
        } as any)
      ).rejects.toThrow(/Only the workspace owner can create projects in a personal workspace/);

      // Clean up teamProj to maintain count invariants
      await prisma.project.delete({ where: { id: teamProj!.id } });
    });
  });

  // =========================================================================
  // 6. Medium: Backfill Concurrency & Recovery
  // =========================================================================
  describe('6. Backfill Concurrency and Recovery Safety', () => {
    it('concurrent ensurePersonalWorkspace calls resolve safely to the same personal workspace without duplicates', async () => {
      const [res1, res2, res3] = await Promise.all([
        ensurePersonalWorkspace(ownerId),
        ensurePersonalWorkspace(ownerId),
        ensurePersonalWorkspace(ownerId),
      ]);

      expect(res1.id).toBe(res2.id);
      expect(res2.id).toBe(res3.id);

      const count = await prisma.workspace.count({
        where: { ownerId, isPersonal: true },
      });
      expect(count).toBe(1);
    });
  });

  // =========================================================================
  // 7. Low: Workspace Metadata Disclosure
  // =========================================================================
  describe('7. Workspace Metadata Disclosure Restrictions', () => {
    it('restricts project and member counts for non-privileged members to only what they are authorized to access', async () => {
      // In teamWsId, owner has 2 projects (TP1 and TP2)
      // Add memberUser ONLY to Team Project 1
      await prisma.projectMember.create({
        data: {
          projectId: teamProject1Id,
          userId: memberId,
          role: 'PROJECT_MEMBER',
        },
      });

      // Member queries workspace details
      const memberWsView = await workspaceService.getWorkspaceById(teamWsId, memberId);

      // Total projects in teamWsId is 2, but memberUser only has access to 1!
      expect(memberWsView.projectCount).toBe(1);

      // Owner queries workspace details
      const ownerWsView = await workspaceService.getWorkspaceById(teamWsId, ownerId);
      // Owner sees total project count (2)
      expect(ownerWsView.projectCount).toBe(2);
    });
  });
});
