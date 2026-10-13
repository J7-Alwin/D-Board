import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../server.js';
import prisma from '../../prisma.js';

describe('Project Visibility Model and Cross-Workspace Invitations Integration Tests', () => {
  const ts = Date.now();
  const ownerUser = {
    email: `vis_owner_${ts}@example.com`,
    password: 'Password123!Secure',
    fullName: 'Workspace Owner',
    username: `vis_owner_${ts}`,
  };

  const adminUser = {
    email: `vis_admin_${ts}@example.com`,
    password: 'Password123!Secure',
    fullName: 'Workspace Admin',
    username: `vis_admin_${ts}`,
  };

  const memberUser = {
    email: `vis_member_${ts}@example.com`,
    password: 'Password123!Secure',
    fullName: 'Workspace Member',
    username: `vis_member_${ts}`,
  };

  let ownerUserId: string;
  let adminUserId: string;
  let memberUserId: string;

  let ownerCookie: string;
  let adminCookie: string;
  let memberCookie: string;

  let teamWsId: string;
  let otherWsId: string;

  let publicProjectId: string;
  let restrictedProjectId: string;
  let otherWsProjectId: string;

  let invitationToTeamProjId: string;
  let invitationToOtherProjId: string;

  beforeAll(async () => {
    // 1. Register Owner
    const regOwner = await request(app).post('/api/auth/register').send(ownerUser);
    expect(regOwner.status).toBe(201);
    ownerUserId = regOwner.body.data.user.id;

    // Mark email verified
    await prisma.user.update({
      where: { id: ownerUserId },
      data: { isEmailVerified: true },
    });

    const loginOwner = await request(app).post('/api/auth/login').send({
      identifier: ownerUser.email,
      password: ownerUser.password,
    });
    expect(loginOwner.status).toBe(200);
    const cookiesOwner = loginOwner.headers['set-cookie'];
    ownerCookie = Array.isArray(cookiesOwner) ? cookiesOwner[0].split(';')[0] : cookiesOwner.split(';')[0];

    // 2. Register Admin
    const regAdmin = await request(app).post('/api/auth/register').send(adminUser);
    expect(regAdmin.status).toBe(201);
    adminUserId = regAdmin.body.data.user.id;

    await prisma.user.update({
      where: { id: adminUserId },
      data: { isEmailVerified: true },
    });

    const loginAdmin = await request(app).post('/api/auth/login').send({
      identifier: adminUser.email,
      password: adminUser.password,
    });
    expect(loginAdmin.status).toBe(200);
    const cookiesAdmin = loginAdmin.headers['set-cookie'];
    adminCookie = Array.isArray(cookiesAdmin) ? cookiesAdmin[0].split(';')[0] : cookiesAdmin.split(';')[0];

    // 3. Register Member
    const regMember = await request(app).post('/api/auth/register').send(memberUser);
    expect(regMember.status).toBe(201);
    memberUserId = regMember.body.data.user.id;

    await prisma.user.update({
      where: { id: memberUserId },
      data: { isEmailVerified: true },
    });

    const loginMember = await request(app).post('/api/auth/login').send({
      identifier: memberUser.email,
      password: memberUser.password,
    });
    expect(loginMember.status).toBe(200);
    const cookiesMember = loginMember.headers['set-cookie'];
    memberCookie = Array.isArray(cookiesMember) ? cookiesMember[0].split(';')[0] : cookiesMember.split(';')[0];

    // 4. Create Team Workspace owned by Owner
    const resWs = await request(app)
      .post('/api/workspaces')
      .set('Cookie', ownerCookie)
      .send({ name: `Visibility Team WS ${ts}`, slug: `vis-ws-${ts}` });
    expect(resWs.status).toBe(201);
    teamWsId = resWs.body.data.workspace.id;

    // Add Admin as WORKSPACE_ADMIN
    await prisma.workspaceMember.create({
      data: {
        workspaceId: teamWsId,
        userId: adminUserId,
        role: 'WORKSPACE_ADMIN',
      },
    });

    // Add Member as WORKSPACE_MEMBER
    await prisma.workspaceMember.create({
      data: {
        workspaceId: teamWsId,
        userId: memberUserId,
        role: 'WORKSPACE_MEMBER',
      },
    });

    // 5. Create Second Team Workspace (for cross-workspace invitation tests)
    const resOtherWs = await request(app)
      .post('/api/workspaces')
      .set('Cookie', ownerCookie)
      .send({ name: `Other WS ${ts}`, slug: `other-ws-${ts}` });
    expect(resOtherWs.status).toBe(201);
    otherWsId = resOtherWs.body.data.workspace.id;

    // 6. Create WORKSPACE-visible project in Team Workspace
    const resP1 = await request(app)
      .post('/api/projects')
      .set('Cookie', ownerCookie)
      .set('X-Workspace-Id', teamWsId)
      .send({
        name: 'Open Engineering Hub',
        key: 'OEH',
        description: 'Workspace-visible project for all members',
        visibility: 'WORKSPACE',
      });
    expect(resP1.status).toBe(201);
    publicProjectId = resP1.body.data.project.id;
    expect(resP1.body.data.project.visibility).toBe('Workspace');

    // 7. Create RESTRICTED project in Team Workspace
    const resP2 = await request(app)
      .post('/api/projects')
      .set('Cookie', ownerCookie)
      .set('X-Workspace-Id', teamWsId)
      .send({
        name: 'Classified Core Engine',
        key: 'CCE',
        description: 'Restricted project only for assigned members',
        visibility: 'RESTRICTED',
      });
    expect(resP2.status).toBe(201);
    restrictedProjectId = resP2.body.data.project.id;
    expect(resP2.body.data.project.visibility).toBe('Restricted');

    // 8. Create project in Other Workspace
    const resP3 = await request(app)
      .post('/api/projects')
      .set('Cookie', ownerCookie)
      .set('X-Workspace-Id', otherWsId)
      .send({
        name: 'Other Workspace Project',
        key: 'OWP',
        description: 'Project in second workspace',
        visibility: 'WORKSPACE',
      });
    expect(resP3.status).toBe(201);
    otherWsProjectId = resP3.body.data.project.id;
  });

  afterAll(async () => {
    try {
      await prisma.invitation.deleteMany({
        where: { projectId: { in: [publicProjectId, restrictedProjectId, otherWsProjectId] } },
      });
      await prisma.projectMember.deleteMany({
        where: { projectId: { in: [publicProjectId, restrictedProjectId, otherWsProjectId] } },
      });
      await prisma.project.deleteMany({
        where: { id: { in: [publicProjectId, restrictedProjectId, otherWsProjectId] } },
      });
      await prisma.workspaceMember.deleteMany({
        where: { workspaceId: { in: [teamWsId, otherWsId] } },
      });
      await prisma.workspace.deleteMany({
        where: { id: { in: [teamWsId, otherWsId] } },
      });
      await prisma.user.deleteMany({
        where: { id: { in: [ownerUserId, adminUserId, memberUserId] } },
      });
    } catch {}
  });

  describe('Fix 1 — Project Visibility Contract and Enforcement', () => {
    it('1. Owner sees both projects with their exact, stable visibility labels', async () => {
      const res = await request(app)
        .get('/api/projects')
        .set('Cookie', ownerCookie)
        .set('X-Workspace-Id', teamWsId);

      expect(res.status).toBe(200);
      const openProj = res.body.data.all.find((p: any) => p.id === publicProjectId);
      const restrictedProj = res.body.data.all.find((p: any) => p.id === restrictedProjectId);

      expect(openProj).toBeDefined();
      expect(openProj.visibility).toBe('Workspace');

      expect(restrictedProj).toBeDefined();
      expect(restrictedProj.visibility).toBe('Restricted');
    });

    it('2. Workspace Admin sees both projects with identical visibility labels as Owner', async () => {
      const res = await request(app)
        .get('/api/projects')
        .set('Cookie', adminCookie)
        .set('X-Workspace-Id', teamWsId);

      expect(res.status).toBe(200);
      const openProj = res.body.data.all.find((p: any) => p.id === publicProjectId);
      const restrictedProj = res.body.data.all.find((p: any) => p.id === restrictedProjectId);

      expect(openProj).toBeDefined();
      expect(openProj.visibility).toBe('Workspace');

      expect(restrictedProj).toBeDefined();
      expect(restrictedProj.visibility).toBe('Restricted');
    });

    it('3. Workspace Member can see Workspace-visible project without explicit ProjectMember assignment', async () => {
      const res = await request(app)
        .get('/api/projects')
        .set('Cookie', memberCookie)
        .set('X-Workspace-Id', teamWsId);

      expect(res.status).toBe(200);
      const memberProjIds = res.body.data.all.map((p: any) => p.id);

      // Can see open project
      expect(memberProjIds).toContain(publicProjectId);
      const openProj = res.body.data.all.find((p: any) => p.id === publicProjectId);
      // Visibility is consistently reported as 'Workspace' (not flipped to 'Restricted')
      expect(openProj.visibility).toBe('Workspace');

      // CANNOT see Restricted project because not explicitly assigned
      expect(memberProjIds).not.toContain(restrictedProjectId);
    });

    it('4. Workspace Member is denied direct access to Restricted project (403)', async () => {
      const res = await request(app)
        .get(`/api/projects/${restrictedProjectId}`)
        .set('Cookie', memberCookie)
        .set('X-Workspace-Id', teamWsId);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('5. Explicitly assigned Member to Restricted project gains access and sees consistent Restricted badge', async () => {
      // Owner adds Member to Restricted project
      await prisma.projectMember.create({
        data: {
          projectId: restrictedProjectId,
          userId: memberUserId,
          role: 'PROJECT_MEMBER',
        },
      });

      // Member now fetches project list
      const res = await request(app)
        .get('/api/projects')
        .set('Cookie', memberCookie)
        .set('X-Workspace-Id', teamWsId);

      expect(res.status).toBe(200);
      const restrictedProj = res.body.data.all.find((p: any) => p.id === restrictedProjectId);
      expect(restrictedProj).toBeDefined();
      // Crucial: reports 'Restricted' identically to what Owner sees
      expect(restrictedProj.visibility).toBe('Restricted');
      expect(restrictedProj.userRole).toBe('PROJECT_MEMBER');

      // Member can now get project details
      const resDetail = await request(app)
        .get(`/api/projects/${restrictedProjectId}`)
        .set('Cookie', memberCookie)
        .set('X-Workspace-Id', teamWsId);

      expect(resDetail.status).toBe(200);
      expect(resDetail.body.data.project.visibility).toBe('Restricted');
    });

    it('6. Project Admin permissions on Restricted project do not grant Workspace Admin rights', async () => {
      // Member is only PROJECT_MEMBER, try to update project description -> 403
      const resUpdateMember = await request(app)
        .patch(`/api/projects/${restrictedProjectId}`)
        .set('Cookie', memberCookie)
        .set('X-Workspace-Id', teamWsId)
        .send({ description: 'Hacked description' });
      expect(resUpdateMember.status).toBe(403);

      // Workspace Admin can update project details even without explicit ProjectMember
      const resUpdateAdmin = await request(app)
        .patch(`/api/projects/${restrictedProjectId}`)
        .set('Cookie', adminCookie)
        .set('X-Workspace-Id', teamWsId)
        .send({ description: 'Authorized admin update' });
      expect(resUpdateAdmin.status).toBe(200);
      expect(resUpdateAdmin.body.data.project.description).toBe('Authorized admin update');
    });
  });

  describe('Fix 3 — Invitation Scoping and Aggregation', () => {
    it('1. Creates pending invitations to projects in both team workspaces', async () => {
      // Invite an external test email to Team Project
      const inviteEmail = `invitee_${ts}@example.com`;
      const resInv1 = await request(app)
        .post(`/api/projects/${publicProjectId}/invitations`)
        .set('Cookie', ownerCookie)
        .set('X-Workspace-Id', teamWsId)
        .send({ email: memberUser.email, role: 'PROJECT_MEMBER' });

      // Note: Member is already in workspace, so this project invitation is valid
      expect(resInv1.status).toBe(201);
      invitationToTeamProjId = resInv1.body.data.invitation.id;

      // Also invite Member to project in Other Workspace (where Member is NOT yet a workspace member)
      const resInv2 = await request(app)
        .post(`/api/projects/${otherWsProjectId}/invitations`)
        .set('Cookie', ownerCookie)
        .set('X-Workspace-Id', otherWsId)
        .send({ email: memberUser.email, role: 'PROJECT_MEMBER' });

      expect(resInv2.status).toBe(201);
      invitationToOtherProjId = resInv2.body.data.invitation.id;
    });

    it('2. GET /api/invitations without workspace header aggregates across all workspaces', async () => {
      const res = await request(app)
        .get('/api/invitations')
        .set('Cookie', memberCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const inviteIds = res.body.data.invitations.map((inv: any) => inv.id);

      // Both invitations are returned without being masked by personal workspace
      expect(inviteIds).toContain(invitationToTeamProjId);
      expect(inviteIds).toContain(invitationToOtherProjId);

      // Check project workspace attribution is included
      const teamInv = res.body.data.invitations.find((i: any) => i.id === invitationToTeamProjId);
      expect(teamInv.project.workspaceId).toBe(teamWsId);
      expect(teamInv.project.workspace?.name).toBeDefined();
    });

    it('3. GET /api/invitations/count without workspace header aggregates count across all workspaces', async () => {
      const res = await request(app)
        .get('/api/invitations/count')
        .set('Cookie', memberCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.count).toBeGreaterThanOrEqual(2);
    });

    it('4. GET /api/invitations scoped to specific workspace only returns invitations for that workspace', async () => {
      const res = await request(app)
        .get('/api/invitations')
        .set('Cookie', memberCookie)
        .set('X-Workspace-Id', teamWsId);

      expect(res.status).toBe(200);
      const inviteIds = res.body.data.invitations.map((inv: any) => inv.id);
      expect(inviteIds).toContain(invitationToTeamProjId);
      expect(inviteIds).not.toContain(invitationToOtherProjId);
    });

    it('5. GET /api/invitations rejects unauthorized workspace ID with 403', async () => {
      // Member tries to pass otherWsId (where Member is NOT a member)
      const res = await request(app)
        .get('/api/invitations')
        .set('Cookie', memberCookie)
        .set('X-Workspace-Id', otherWsId);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('6. Accepting project invitation enforces workspace membership requirement (403)', async () => {
      // Member tries to accept invitation to otherWsProjectId where Member is NOT a workspace member
      const res = await request(app)
        .post(`/api/invitations/${invitationToOtherProjId}/accept`)
        .set('Cookie', memberCookie);

      expect(res.status).toBe(403);
      expect(res.body.message).toContain('Workspace membership is required before joining this project');
    });

    it('7. Cannot accept or decline invitation belonging to a different user (403)', async () => {
      // Admin tries to accept Member's invitation
      const res = await request(app)
        .post(`/api/invitations/${invitationToTeamProjId}/accept`)
        .set('Cookie', adminCookie);

      expect(res.status).toBe(403);
      expect(res.body.message).toContain('different email address');
    });
  });
});
