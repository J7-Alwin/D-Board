import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../server.js';
import prisma from '../../prisma.js';
import { projectTransferService } from '../../services/projectTransfer.service.js';
import { searchService } from '../../services/search.service.js';

describe('Fix 3 — Historical Project Visibility Backfill and Authorization Policy', () => {
  const ts = Date.now();

  const wsOwner = {
    email: `backfill_owner_${ts}@example.com`,
    password: 'Password123!Secure',
    fullName: 'Backfill Owner',
    username: `bf_owner_${ts}`,
  };

  const wsAdmin = {
    email: `backfill_admin_${ts}@example.com`,
    password: 'Password123!Secure',
    fullName: 'Backfill Admin',
    username: `bf_admin_${ts}`,
  };

  const wsMember = {
    email: `backfill_member_${ts}@example.com`,
    password: 'Password123!Secure',
    fullName: 'Backfill Member',
    username: `bf_member_${ts}`,
  };

  const externalUser = {
    email: `backfill_ext_${ts}@example.com`,
    password: 'Password123!Secure',
    fullName: 'External User',
    username: `bf_ext_${ts}`,
  };

  let ownerId: string;
  let adminId: string;
  let memberId: string;
  let externalId: string;

  let ownerCookie: string;
  let adminCookie: string;
  let memberCookie: string;
  let externalCookie: string;

  let teamWsId: string;
  let secondTeamWsId: string;
  let ownerPersonalWsId: string;

  let historicalProjectId: string;
  let modernOpenProjectId: string;
  let modernRestrictedProjectId: string;
  let personalProj1Id: string;
  let personalProj2Id: string;

  beforeAll(async () => {
    // 1. Register users
    const regOwner = await request(app).post('/api/auth/register').send(wsOwner);
    ownerId = regOwner.body.data.user.id;
    await prisma.user.update({ where: { id: ownerId }, data: { isEmailVerified: true } });

    const loginOwner = await request(app).post('/api/auth/login').send({
      identifier: wsOwner.email,
      password: wsOwner.password,
    });
    ownerCookie = (loginOwner.headers['set-cookie'] as any)[0].split(';')[0];

    const regAdmin = await request(app).post('/api/auth/register').send(wsAdmin);
    adminId = regAdmin.body.data.user.id;
    await prisma.user.update({ where: { id: adminId }, data: { isEmailVerified: true } });

    const loginAdmin = await request(app).post('/api/auth/login').send({
      identifier: wsAdmin.email,
      password: wsAdmin.password,
    });
    adminCookie = (loginAdmin.headers['set-cookie'] as any)[0].split(';')[0];

    const regMember = await request(app).post('/api/auth/register').send(wsMember);
    memberId = regMember.body.data.user.id;
    await prisma.user.update({ where: { id: memberId }, data: { isEmailVerified: true } });

    const loginMember = await request(app).post('/api/auth/login').send({
      identifier: wsMember.email,
      password: wsMember.password,
    });
    memberCookie = (loginMember.headers['set-cookie'] as any)[0].split(';')[0];

    const regExt = await request(app).post('/api/auth/register').send(externalUser);
    externalId = regExt.body.data.user.id;
    await prisma.user.update({ where: { id: externalId }, data: { isEmailVerified: true } });

    const loginExt = await request(app).post('/api/auth/login').send({
      identifier: externalUser.email,
      password: externalUser.password,
    });
    externalCookie = (loginExt.headers['set-cookie'] as any)[0].split(';')[0];

    // 2. Fetch owner's personal workspace
    const personalWs = await prisma.workspace.findFirst({
      where: { ownerId, isPersonal: true },
    });
    ownerPersonalWsId = personalWs!.id;

    // 3. Create Team Workspace
    const resWs = await request(app)
      .post('/api/workspaces')
      .set('Cookie', ownerCookie)
      .send({ name: `Backfill Team WS ${ts}`, slug: `bf-ws-${ts}` });
    teamWsId = resWs.body.data.workspace.id;

    // Add Admin as WORKSPACE_ADMIN
    await prisma.workspaceMember.create({
      data: { workspaceId: teamWsId, userId: adminId, role: 'WORKSPACE_ADMIN', origin: 'DIRECT' },
    });

    // Add Member as WORKSPACE_MEMBER
    await prisma.workspaceMember.create({
      data: { workspaceId: teamWsId, userId: memberId, role: 'WORKSPACE_MEMBER', origin: 'DIRECT' },
    });

    // 4. Create Second Team Workspace (for transfers)
    const resWs2 = await request(app)
      .post('/api/workspaces')
      .set('Cookie', ownerCookie)
      .send({ name: `Second Team WS ${ts}`, slug: `bf-ws2-${ts}` });
    secondTeamWsId = resWs2.body.data.workspace.id;

    await prisma.workspaceMember.create({
      data: { workspaceId: secondTeamWsId, userId: memberId, role: 'WORKSPACE_MEMBER', origin: 'DIRECT' },
    });

    // 5. Create Historical Project directly in DB simulating pre-migration project
    // (created before 2026-10-13 14:00:00 UTC with RESTRICTED visibility backfill)
    const hist = await prisma.project.create({
      data: {
        name: 'Legacy Pre-Migration Project',
        key: 'LEG',
        description: 'Project created before visibility model was introduced',
        createdById: ownerId,
        workspaceId: teamWsId,
        createdAt: new Date('2026-09-01T10:00:00.000Z'),
        visibility: 'RESTRICTED',
      },
    });
    historicalProjectId = hist.id;

    await prisma.projectMember.create({
      data: {
        projectId: historicalProjectId,
        userId: ownerId,
        role: 'PROJECT_ADMIN',
      },
    });

    // 6. Create post-migration WORKSPACE project
    const pOpen = await request(app)
      .post('/api/projects')
      .set('Cookie', ownerCookie)
      .set('X-Workspace-Id', teamWsId)
      .send({
        name: 'Modern Open Team Project',
        key: 'MOP',
        description: 'New project with workspace visibility',
        visibility: 'WORKSPACE',
      });
    modernOpenProjectId = pOpen.body.data.project.id;

    // 7. Create post-migration RESTRICTED project
    const pRestricted = await request(app)
      .post('/api/projects')
      .set('Cookie', ownerCookie)
      .set('X-Workspace-Id', teamWsId)
      .send({
        name: 'Modern Restricted Project',
        key: 'MRP',
        description: 'New project with restricted visibility',
        visibility: 'RESTRICTED',
      });
    modernRestrictedProjectId = pRestricted.body.data.project.id;

    // 8. Create projects in Personal Workspace
    const pPers1 = await request(app)
      .post('/api/projects')
      .set('Cookie', ownerCookie)
      .set('X-Workspace-Id', ownerPersonalWsId)
      .send({
        name: 'Owner Private Taxes',
        key: 'TAX',
        description: 'Private personal project',
      });
    personalProj1Id = pPers1.body.data.project.id;

    const pPers2 = await request(app)
      .post('/api/projects')
      .set('Cookie', ownerCookie)
      .set('X-Workspace-Id', ownerPersonalWsId)
      .send({
        name: 'Owner Shared Personal Project',
        key: 'SHR',
        description: 'Personal project where member will be invited',
      });
    personalProj2Id = pPers2.body.data.project.id;
  });

  afterAll(async () => {
    try {
      await prisma.projectMember.deleteMany({
        where: { projectId: { in: [historicalProjectId, modernOpenProjectId, modernRestrictedProjectId, personalProj1Id, personalProj2Id] } },
      });
      await prisma.project.deleteMany({
        where: { id: { in: [historicalProjectId, modernOpenProjectId, modernRestrictedProjectId, personalProj1Id, personalProj2Id] } },
      });
      await prisma.workspaceMember.deleteMany({
        where: { workspaceId: { in: [teamWsId, secondTeamWsId] } },
      });
      await prisma.workspace.deleteMany({
        where: { id: { in: [teamWsId, secondTeamWsId] } },
      });
      await prisma.user.deleteMany({
        where: { id: { in: [ownerId, adminId, memberId, externalId] } },
      });
    } catch {}
  });

  describe('1. Historical Project Backfill & Access Verification', () => {
    it('historical project in DB has RESTRICTED visibility', async () => {
      const proj = await prisma.project.findUnique({
        where: { id: historicalProjectId },
        select: { visibility: true, createdAt: true },
      });
      expect(proj?.visibility).toBe('RESTRICTED');
      expect(proj?.createdAt.getTime()).toBeLessThan(new Date('2026-10-13T14:00:00.000Z').getTime());
    });

    it('Workspace Member cannot see historical project without explicit ProjectMember assignment', async () => {
      const res = await request(app)
        .get('/api/projects')
        .set('Cookie', memberCookie)
        .set('X-Workspace-Id', teamWsId);

      expect(res.status).toBe(200);
      const projectIds = res.body.data.all.map((p: any) => p.id);
      expect(projectIds).not.toContain(historicalProjectId);
    });

    it('Workspace Member is denied direct access (403) to historical project', async () => {
      const res = await request(app)
        .get(`/api/projects/${historicalProjectId}`)
        .set('Cookie', memberCookie)
        .set('X-Workspace-Id', teamWsId);

      expect(res.status).toBe(403);
    });

    it('Workspace Owner and Workspace Admin can view historical project', async () => {
      const resOwner = await request(app)
        .get(`/api/projects/${historicalProjectId}`)
        .set('Cookie', ownerCookie)
        .set('X-Workspace-Id', teamWsId);
      expect(resOwner.status).toBe(200);
      expect(resOwner.body.data.project.visibility).toBe('Restricted');

      const resAdmin = await request(app)
        .get(`/api/projects/${historicalProjectId}`)
        .set('Cookie', adminCookie)
        .set('X-Workspace-Id', teamWsId);
      expect(resAdmin.status).toBe(200);
      expect(resAdmin.body.data.project.visibility).toBe('Restricted');
    });

    it('explicitly assigned ProjectMember can access historical project and sees Restricted visibility', async () => {
      await prisma.projectMember.create({
        data: {
          projectId: historicalProjectId,
          userId: memberId,
          role: 'PROJECT_MEMBER',
        },
      });

      const res = await request(app)
        .get(`/api/projects/${historicalProjectId}`)
        .set('Cookie', memberCookie)
        .set('X-Workspace-Id', teamWsId);

      expect(res.status).toBe(200);
      expect(res.body.data.project.visibility).toBe('Restricted');

      // Cleanup membership
      await prisma.projectMember.delete({
        where: { projectId_userId: { projectId: historicalProjectId, userId: memberId } },
      });
    });
  });

  describe('2. Post-Migration Workspace-Visible and Restricted Projects', () => {
    it('Workspace Member can access WORKSPACE-visible project without explicit ProjectMember row', async () => {
      const res = await request(app)
        .get(`/api/projects/${modernOpenProjectId}`)
        .set('Cookie', memberCookie)
        .set('X-Workspace-Id', teamWsId);

      expect(res.status).toBe(200);
      expect(res.body.data.project.visibility).toBe('Workspace');
      expect(res.body.data.project.userRole).toBe('PROJECT_MEMBER');
    });

    it('Workspace Member is denied access to RESTRICTED project without explicit assignment', async () => {
      const res = await request(app)
        .get(`/api/projects/${modernRestrictedProjectId}`)
        .set('Cookie', memberCookie)
        .set('X-Workspace-Id', teamWsId);

      expect(res.status).toBe(403);
    });

    it('all authorized viewers see the exact same visibility label', async () => {
      const resOwner = await request(app)
        .get(`/api/projects/${modernOpenProjectId}`)
        .set('Cookie', ownerCookie)
        .set('X-Workspace-Id', teamWsId);

      const resAdmin = await request(app)
        .get(`/api/projects/${modernOpenProjectId}`)
        .set('Cookie', adminCookie)
        .set('X-Workspace-Id', teamWsId);

      const resMember = await request(app)
        .get(`/api/projects/${modernOpenProjectId}`)
        .set('Cookie', memberCookie)
        .set('X-Workspace-Id', teamWsId);

      expect(resOwner.body.data.project.visibility).toBe('Workspace');
      expect(resAdmin.body.data.project.visibility).toBe('Workspace');
      expect(resMember.body.data.project.visibility).toBe('Workspace');
    });
  });

  describe('3. Personal Workspace Boundary and Isolation', () => {
    it('projects created in personal workspace are normalized to RESTRICTED', async () => {
      const p1 = await prisma.project.findUnique({
        where: { id: personalProj1Id },
        select: { visibility: true },
      });
      expect(p1?.visibility).toBe('RESTRICTED');

      const p2 = await prisma.project.findUnique({
        where: { id: personalProj2Id },
        select: { visibility: true },
      });
      expect(p2?.visibility).toBe('RESTRICTED');
    });

    it('updating project in personal workspace to WORKSPACE is rejected with 400', async () => {
      const res = await request(app)
        .patch(`/api/projects/${personalProj1Id}`)
        .set('Cookie', ownerCookie)
        .send({ visibility: 'WORKSPACE' });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('personal workspace');
    });

    it('collaborator invited to project in personal workspace cannot see other personal projects', async () => {
      // Add member to personalProj2 and derive workspace membership
      await prisma.projectMember.create({
        data: {
          projectId: personalProj2Id,
          userId: memberId,
          role: 'PROJECT_MEMBER',
        },
      });

      await prisma.workspaceMember.create({
        data: {
          workspaceId: ownerPersonalWsId,
          userId: memberId,
          role: 'WORKSPACE_MEMBER',
          origin: 'PROJECT_DERIVED',
        },
      });

      // Member can view personalProj2
      const res2 = await request(app)
        .get(`/api/projects/${personalProj2Id}`)
        .set('Cookie', memberCookie);
      expect(res2.status).toBe(200);

      // Member CANNOT view personalProj1 (taxes)
      const res1 = await request(app)
        .get(`/api/projects/${personalProj1Id}`)
        .set('Cookie', memberCookie);
      expect(res1.status).toBe(403);

      // In project listing for personal workspace, member ONLY sees personalProj2
      const listRes = await request(app)
        .get('/api/projects')
        .set('Cookie', memberCookie)
        .set('X-Workspace-Id', ownerPersonalWsId);
      expect(listRes.status).toBe(200);
      const ids = listRes.body.data.all.map((p: any) => p.id);
      expect(ids).toContain(personalProj2Id);
      expect(ids).not.toContain(personalProj1Id);
    });
  });

  describe('4. Cross-Workspace Project Transfer and Visibility Stability', () => {
    it('transferring a project preserves its visibility value', async () => {
      // Transfer modernOpenProjectId (WORKSPACE) from teamWsId to secondTeamWsId
      const resTransfer = await projectTransferService.requestTransfer(
        modernOpenProjectId,
        ownerId,
        { destinationWorkspaceId: secondTeamWsId }
      );
      expect(resTransfer.success).toBe(true);

      const transferredProj = await prisma.project.findUnique({
        where: { id: modernOpenProjectId },
        select: { workspaceId: true, visibility: true },
      });
      expect(transferredProj?.workspaceId).toBe(secondTeamWsId);
      expect(transferredProj?.visibility).toBe('WORKSPACE');

      // In secondTeamWsId, Member can access it immediately
      const resMember = await request(app)
        .get(`/api/projects/${modernOpenProjectId}`)
        .set('Cookie', memberCookie)
        .set('X-Workspace-Id', secondTeamWsId);
      expect(resMember.status).toBe(200);
      expect(resMember.body.data.project.visibility).toBe('Workspace');
    });

    it('transferring a RESTRICTED project keeps it RESTRICTED in destination workspace', async () => {
      const resTransfer = await projectTransferService.requestTransfer(
        modernRestrictedProjectId,
        ownerId,
        { destinationWorkspaceId: secondTeamWsId }
      );
      expect(resTransfer.success).toBe(true);

      const transferred = await prisma.project.findUnique({
        where: { id: modernRestrictedProjectId },
        select: { workspaceId: true, visibility: true },
      });
      expect(transferred?.workspaceId).toBe(secondTeamWsId);
      expect(transferred?.visibility).toBe('RESTRICTED');

      // Member is in secondTeamWsId but NOT assigned to restricted project -> 403
      const resMember = await request(app)
        .get(`/api/projects/${modernRestrictedProjectId}`)
        .set('Cookie', memberCookie)
        .set('X-Workspace-Id', secondTeamWsId);
      expect(resMember.status).toBe(403);
    });
  });

  describe('5. Unauthenticated / External Cross-Workspace Isolation', () => {
    it('GET /api/projects without X-Workspace-Id does NOT leak WORKSPACE projects to non-members', async () => {
      const res = await request(app)
        .get('/api/projects')
        .set('Cookie', externalCookie);

      expect(res.status).toBe(200);
      const allIds = res.body.data.all.map((p: any) => p.id);
      expect(allIds).not.toContain(modernOpenProjectId);
      expect(allIds).not.toContain(historicalProjectId);
    });

    it('Global search does not leak WORKSPACE projects or items to non-members', async () => {
      const results = await searchService.searchGlobal(externalId, 'Modern Open Team Project');
      expect(results.projects.length).toBe(0);
    });
  });
});
