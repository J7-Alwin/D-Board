import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../../server.js';
import prisma from '../../prisma.js';

describe('Multi-Workspace and Project Administration Enhancement Integration Tests', () => {
  const ts = Date.now();

  const ownerUser = {
    username: `enh_owner_${ts}`,
    email: `enh_owner_${ts}@example.com`,
    password: 'Password123!Secure',
    fullName: 'Enhancement Owner',
  };

  const admin1User = {
    username: `enh_admin1_${ts}`,
    email: `enh_admin1_${ts}@example.com`,
    password: 'Password123!Secure',
    fullName: 'Enhancement Admin One',
  };

  const admin2User = {
    username: `enh_admin2_${ts}`,
    email: `enh_admin2_${ts}@example.com`,
    password: 'Password123!Secure',
    fullName: 'Enhancement Admin Two',
  };

  const memberUser = {
    username: `enh_member_${ts}`,
    email: `enh_member_${ts}@example.com`,
    password: 'Password123!Secure',
    fullName: 'Enhancement Member',
  };

  const outsiderUser = {
    username: `enh_outsider_${ts}`,
    email: `enh_outsider_${ts}@example.com`,
    password: 'Password123!Secure',
    fullName: 'Enhancement Outsider',
  };

  let ownerId: string;
  let admin1Id: string;
  let admin2Id: string;
  let memberId: string;
  let outsiderId: string;

  let ownerCookie: string;
  let admin1Cookie: string;
  let admin2Cookie: string;
  let memberCookie: string;
  let outsiderCookie: string;

  let workspaceId: string;

  beforeAll(async () => {
    // 1. Register & login Owner
    const regOwner = await request(app).post('/api/auth/register').send(ownerUser);
    expect(regOwner.status).toBe(201);
    ownerId = regOwner.body.data.user.id;
    await prisma.user.update({ where: { id: ownerId }, data: { isEmailVerified: true } });
    const logOwner = await request(app).post('/api/auth/login').send({
      identifier: ownerUser.email,
      password: ownerUser.password,
    });
    const cOwner = logOwner.headers['set-cookie'];
    ownerCookie = Array.isArray(cOwner) ? cOwner[0].split(';')[0] : cOwner.split(';')[0];

    // 2. Register & login Admin 1
    const regAdmin1 = await request(app).post('/api/auth/register').send(admin1User);
    expect(regAdmin1.status).toBe(201);
    admin1Id = regAdmin1.body.data.user.id;
    await prisma.user.update({ where: { id: admin1Id }, data: { isEmailVerified: true } });
    const logAdmin1 = await request(app).post('/api/auth/login').send({
      identifier: admin1User.email,
      password: admin1User.password,
    });
    const cAdmin1 = logAdmin1.headers['set-cookie'];
    admin1Cookie = Array.isArray(cAdmin1) ? cAdmin1[0].split(';')[0] : cAdmin1.split(';')[0];

    // 3. Register & login Admin 2
    const regAdmin2 = await request(app).post('/api/auth/register').send(admin2User);
    expect(regAdmin2.status).toBe(201);
    admin2Id = regAdmin2.body.data.user.id;
    await prisma.user.update({ where: { id: admin2Id }, data: { isEmailVerified: true } });
    const logAdmin2 = await request(app).post('/api/auth/login').send({
      identifier: admin2User.email,
      password: admin2User.password,
    });
    const cAdmin2 = logAdmin2.headers['set-cookie'];
    admin2Cookie = Array.isArray(cAdmin2) ? cAdmin2[0].split(';')[0] : cAdmin2.split(';')[0];

    // 4. Register & login Member
    const regMember = await request(app).post('/api/auth/register').send(memberUser);
    expect(regMember.status).toBe(201);
    memberId = regMember.body.data.user.id;
    await prisma.user.update({ where: { id: memberId }, data: { isEmailVerified: true } });
    const logMember = await request(app).post('/api/auth/login').send({
      identifier: memberUser.email,
      password: memberUser.password,
    });
    const cMember = logMember.headers['set-cookie'];
    memberCookie = Array.isArray(cMember) ? cMember[0].split(';')[0] : cMember.split(';')[0];

    // 5. Register & login Outsider
    const regOutsider = await request(app).post('/api/auth/register').send(outsiderUser);
    expect(regOutsider.status).toBe(201);
    outsiderId = regOutsider.body.data.user.id;
    await prisma.user.update({ where: { id: outsiderId }, data: { isEmailVerified: true } });
    const logOutsider = await request(app).post('/api/auth/login').send({
      identifier: outsiderUser.email,
      password: outsiderUser.password,
    });
    const cOutsider = logOutsider.headers['set-cookie'];
    outsiderCookie = Array.isArray(cOutsider) ? cOutsider[0].split(';')[0] : cOutsider.split(';')[0];

    // 6. Create Team Workspace by Owner
    const wsRes = await request(app)
      .post('/api/workspaces')
      .set('Cookie', ownerCookie)
      .send({
        name: `Enhancement Workspace ${ts}`,
        description: 'Testing multi-workspace project administration',
      });
    expect(wsRes.status).toBe(201);
    workspaceId = wsRes.body.data.workspace.id;

    // Add Admin1, Admin2, and Member to Workspace
    await prisma.workspaceMember.createMany({
      data: [
        { workspaceId, userId: admin1Id, role: 'WORKSPACE_ADMIN' },
        { workspaceId, userId: admin2Id, role: 'WORKSPACE_ADMIN' },
        { workspaceId, userId: memberId, role: 'WORKSPACE_MEMBER' },
      ],
    });
  });

  describe('1. Roles and Owner-Controlled Settings', () => {
    it('allows Workspace Owner to configure autoIncludeAdminsInNewProjects setting', async () => {
      // Owner updates admin permissions with autoIncludeAdminsInNewProjects: false
      const res = await request(app)
        .patch(`/api/workspaces/${workspaceId}/admin-permissions`)
        .set('Cookie', ownerCookie)
        .send({
          autoIncludeAdminsInNewProjects: false,
          workspaceAdmin: {
            canCreateProjects: true,
            autoIncludeAdminsInNewProjects: false,
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const checkWs = await prisma.workspace.findUnique({ where: { id: workspaceId } });
      const perms = checkWs?.adminPermissions as any;
      expect(perms?.autoIncludeAdminsInNewProjects).toBe(false);
    });

    it('prevents Workspace Admin from altering Owner-only admin permissions', async () => {
      const res = await request(app)
        .patch(`/api/workspaces/${workspaceId}/admin-permissions`)
        .set('Cookie', admin1Cookie)
        .send({
          autoIncludeAdminsInNewProjects: true,
        });

      expect([400, 403]).toContain(res.status);
    });
  });

  describe('2. Project Creation & Member Inclusion Defaults', () => {
    it('creates project with autoIncludeAdmins=false: Owner and creator included, other admin not included', async () => {
      // Setting is currently false
      const createRes = await request(app)
        .post('/api/projects')
        .set('Cookie', admin1Cookie)
        .send({
          name: `Project Admin Exclusion Test ${ts}`,
          description: 'Testing exclusion of non-creating admins when setting is false',
          visibility: 'RESTRICTED',
          workspaceId,
        });

      expect(createRes.status).toBe(201);
      const projId = createRes.body.data.project.id;

      // Verify members
      const members = await prisma.projectMember.findMany({
        where: { projectId: projId },
      });

      const memberUserIds = members.map((m) => m.userId);
      // Owner must be included
      expect(memberUserIds).toContain(ownerId);
      // Creating admin must be included
      expect(memberUserIds).toContain(admin1Id);
      // Non-creating admin Admin2 must NOT be included as explicit project member
      expect(memberUserIds).not.toContain(admin2Id);
    });

    it('creates project with autoIncludeAdmins=true: includes other workspace admins as PROJECT_ADMIN', async () => {
      // Enable setting
      await request(app)
        .patch(`/api/workspaces/${workspaceId}/admin-permissions`)
        .set('Cookie', ownerCookie)
        .send({
          autoIncludeAdminsInNewProjects: true,
          workspaceAdmin: {
            canCreateProjects: true,
            autoIncludeAdminsInNewProjects: true,
          },
        });

      const createRes = await request(app)
        .post('/api/projects')
        .set('Cookie', admin1Cookie)
        .send({
          name: `Project Admin Inclusion Test ${ts}`,
          description: 'Testing inclusion of all admins when setting is true',
          visibility: 'RESTRICTED',
          workspaceId,
        });

      expect(createRes.status).toBe(201);
      const projId = createRes.body.data.project.id;

      const members = await prisma.projectMember.findMany({
        where: { projectId: projId },
      });

      const memberUserIds = members.map((m) => m.userId);
      expect(memberUserIds).toContain(ownerId);
      expect(memberUserIds).toContain(admin1Id);
      expect(memberUserIds).toContain(admin2Id);

      const admin2Member = members.find((m) => m.userId === admin2Id);
      expect(admin2Member?.role).toBe('PROJECT_ADMIN');
    });

    it('rejects cross-workspace project invitations for users not in the workspace', async () => {
      const createRes = await request(app)
        .post('/api/projects')
        .set('Cookie', ownerCookie)
        .send({
          name: `Cross Workspace Project ${ts}`,
          description: 'Testing cross-workspace invitation rejection',
          workspaceId,
          invitations: [
            { email: outsiderUser.email, role: 'PROJECT_MEMBER' },
          ],
        });

      // Should fail or reject cross-workspace invite
      expect([400, 403]).toContain(createRes.status);
    });
  });

  describe('3. Multiple Project Admins & Last-Admin Protection', () => {
    let testProjectId: string;
    let targetAdminMemberId: string;

    beforeAll(async () => {
      // Create a test project with member promoted to Project Admin
      const projRes = await request(app)
        .post('/api/projects')
        .set('Cookie', ownerCookie)
        .send({
          name: `Handover Test Project ${ts}`,
          description: 'Testing last admin and handover workflows',
          visibility: 'RESTRICTED',
          workspaceId,
        });
      testProjectId = projRes.body.data.project.id;

      // Add member as PROJECT_ADMIN
      const pm = await prisma.projectMember.create({
        data: {
          projectId: testProjectId,
          userId: memberId,
          role: 'PROJECT_ADMIN',
        },
      });
      targetAdminMemberId = pm.id;

      // Create incomplete tasks assigned to member
      await prisma.workItem.createMany({
        data: [
          {
            projectId: testProjectId,
            title: 'Critical Deployment Pipeline',
            status: 'IN_PROGRESS',
            priority: 'HIGH',
            assignedToId: memberId,
            createdById: ownerId,
          },
          {
            projectId: testProjectId,
            title: 'Database Security Audit',
            status: 'TODO',
            priority: 'URGENT',
            assignedToId: memberId,
            createdById: ownerId,
          },
          {
            projectId: testProjectId,
            title: 'Setup Architecture Documentation',
            status: 'COMPLETED',
            priority: 'MEDIUM',
            assignedToId: memberId,
            createdById: ownerId,
          },
        ],
      });
    });

    it('rejects demoting or removing the last project admin without a replacement', async () => {
      // First, remove all other members from project to leave targetAdmin as the only PROJECT_ADMIN
      await prisma.projectMember.deleteMany({
        where: {
          projectId: testProjectId,
          id: { not: targetAdminMemberId },
        },
      });

      const demoteRes = await request(app)
        .patch(`/api/projects/${testProjectId}/members/${targetAdminMemberId}`)
        .set('Cookie', ownerCookie)
        .send({ role: 'PROJECT_MEMBER' });

      expect(demoteRes.status).toBe(400);
      expect(demoteRes.body.message).toMatch(/(last|only designated) project administrator/i);

      const deleteRes = await request(app)
        .delete(`/api/projects/${testProjectId}/members/${targetAdminMemberId}`)
        .set('Cookie', ownerCookie);

      expect(deleteRes.status).toBe(400);
      expect(deleteRes.body.message).toMatch(/(last|only designated) project administrator/i);
    });

    it('provides handover summary with incomplete tasks, completed count, and eligible replacements', async () => {
      const summaryRes = await request(app)
        .get(`/api/projects/${testProjectId}/members/${targetAdminMemberId}/handover-summary`)
        .set('Cookie', ownerCookie);

      expect(summaryRes.status).toBe(200);
      expect(summaryRes.body.success).toBe(true);

      const summary = summaryRes.body.data;
      expect(summary.isLastAdmin).toBe(true);
      expect(summary.incompleteTasks.length).toBe(2);
      expect(summary.completedTasksCount).toBe(1);
      expect(summary.eligibleReplacements.length).toBeGreaterThan(0);
    });

    it('executes planned handover: appoints replacement admin and reassigns incomplete tasks transactionally', async () => {
      const handoverRes = await request(app)
        .post(`/api/projects/${testProjectId}/members/${targetAdminMemberId}/handover`)
        .set('Cookie', ownerCookie)
        .send({
          action: 'DEMOTE',
          replacementUserId: admin1Id,
          reassignTasksToUserId: admin1Id,
          note: 'Handover complete: transferring infrastructure duties',
        });

      expect(handoverRes.status).toBe(200);
      expect(handoverRes.body.success).toBe(true);

      // Verify replacement admin promoted to PROJECT_ADMIN
      const replacementMember = await prisma.projectMember.findFirst({
        where: { projectId: testProjectId, userId: admin1Id },
      });
      expect(replacementMember).toBeDefined();
      expect(replacementMember?.role).toBe('PROJECT_ADMIN');

      // Verify target member demoted to PROJECT_MEMBER
      const targetMember = await prisma.projectMember.findUnique({
        where: { id: targetAdminMemberId },
      });
      expect(targetMember?.role).toBe('PROJECT_MEMBER');

      // Verify incomplete tasks reassigned to replacement admin
      const reassignedTasks = await prisma.workItem.findMany({
        where: { projectId: testProjectId, assignedToId: admin1Id },
      });
      expect(reassignedTasks.length).toBe(2);

      // Verify completed tasks remained untouched with original attribution
      const completedTask = await prisma.workItem.findFirst({
        where: { projectId: testProjectId, status: 'COMPLETED' },
      });
      expect(completedTask?.assignedToId).toBe(memberId);
      expect(completedTask?.createdById).toBe(ownerId);
    });
  });

  describe('4. Role-Aware Project Listings', () => {
    let restrictedProjId: string;
    let workspaceVisibleProjId: string;

    beforeAll(async () => {
      // Ensure auto-include is false so Admin1 and Admin2 are not auto-added to restricted project
      await request(app)
        .patch(`/api/workspaces/${workspaceId}/admin-permissions`)
        .set('Cookie', ownerCookie)
        .send({
          autoIncludeAdminsInNewProjects: false,
          workspaceAdmin: {
            canCreateProjects: true,
            autoIncludeAdminsInNewProjects: false,
          },
        });

      // Create one RESTRICTED project where only Owner & Admin1 participate
      const res1 = await request(app)
        .post('/api/projects')
        .set('Cookie', ownerCookie)
        .send({
          name: `Restricted Portfolio Project ${ts}`,
          description: 'Restricted access project',
          visibility: 'RESTRICTED',
          workspaceId,
        });
      restrictedProjId = res1.body.data.project.id;

      // Add Admin1 only
      await prisma.projectMember.create({
        data: { projectId: restrictedProjId, userId: admin1Id, role: 'PROJECT_ADMIN' },
      });

      // Create one WORKSPACE visible project
      const res2 = await request(app)
        .post('/api/projects')
        .set('Cookie', ownerCookie)
        .send({
          name: `Public Workspace Project ${ts}`,
          description: 'Workspace visible project',
          visibility: 'WORKSPACE',
          workspaceId,
        });
      workspaceVisibleProjId = res2.body.data.project.id;
    });

    it('Workspace Owner sees all workspace projects in listing', async () => {
      const res = await request(app)
        .get(`/api/projects?workspaceId=${workspaceId}`)
        .set('Cookie', ownerCookie);

      expect(res.status).toBe(200);
      const allIds = (res.body.data.all || []).map((p: any) => p.id);
      expect(allIds).toContain(restrictedProjId);
      expect(allIds).toContain(workspaceVisibleProjId);
    });

    it('Workspace Admin listing follows the explicit-participant / workspace-visible rule', async () => {
      // Admin1 is explicit member of restrictedProjId -> should see both
      const resAdmin1 = await request(app)
        .get(`/api/projects?workspaceId=${workspaceId}`)
        .set('Cookie', admin1Cookie);

      expect(resAdmin1.status).toBe(200);
      const ids1 = (resAdmin1.body.data.all || []).map((p: any) => p.id);
      expect(ids1).toContain(restrictedProjId);
      expect(ids1).toContain(workspaceVisibleProjId);

      // Admin2 is NOT explicit member of restrictedProjId -> should ONLY see workspaceVisibleProjId
      const resAdmin2 = await request(app)
        .get(`/api/projects?workspaceId=${workspaceId}`)
        .set('Cookie', admin2Cookie);

      expect(resAdmin2.status).toBe(200);
      const ids2 = (resAdmin2.body.data.all || []).map((p: any) => p.id);
      expect(ids2).not.toContain(restrictedProjId);
      expect(ids2).toContain(workspaceVisibleProjId);
    });

    it('Project Member cannot see Restricted project in project listings', async () => {
      const res = await request(app)
        .get(`/api/projects?workspaceId=${workspaceId}`)
        .set('Cookie', memberCookie);

      expect(res.status).toBe(200);
      const ids = (res.body.data.all || []).map((p: any) => p.id);
      expect(ids).not.toContain(restrictedProjId);
      expect(ids).toContain(workspaceVisibleProjId);
    });
  });

  describe('5. Workspace Role vs Project Role Separation & Authority Boundaries', () => {
    let projId: string;
    let targetMemberRecordId: string;

    beforeAll(async () => {
      // Create a test project for role separation testing
      const res = await request(app)
        .post('/api/projects')
        .set('Cookie', ownerCookie)
        .send({
          name: `Role Separation Test Project ${ts}`,
          description: 'Testing workspace role vs project role independence',
          visibility: 'RESTRICTED',
          workspaceId,
        });
      projId = res.body.data.project.id;

      // Add member as PROJECT_MEMBER
      const pm = await prisma.projectMember.create({
        data: {
          projectId: projId,
          userId: memberId,
          role: 'PROJECT_MEMBER',
        },
      });
      targetMemberRecordId = pm.id;
    });

    it('assigning Project Admin to a Workspace Member updates project role to PROJECT_ADMIN while preserving workspace role as WORKSPACE_MEMBER', async () => {
      // Verify initial workspace role
      const initialWsMember = await prisma.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId, userId: memberId } },
      });
      expect(initialWsMember?.role).toBe('WORKSPACE_MEMBER');

      // Promote to Project Admin in this project
      const patchRes = await request(app)
        .patch(`/api/projects/${projId}/members/${targetMemberRecordId}`)
        .set('Cookie', ownerCookie)
        .send({ role: 'PROJECT_ADMIN' });

      expect(patchRes.status).toBe(200);
      expect(patchRes.body.data.member.role).toBe('PROJECT_ADMIN');

      // Verify ProjectMember is PROJECT_ADMIN
      const pm = await prisma.projectMember.findUnique({
        where: { id: targetMemberRecordId },
      });
      expect(pm?.role).toBe('PROJECT_ADMIN');

      // CRITICAL: Verify WorkspaceMember role is STILL WORKSPACE_MEMBER
      const finalWsMember = await prisma.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId, userId: memberId } },
      });
      expect(finalWsMember?.role).toBe('WORKSPACE_MEMBER');
    });

    it('assigning Project Member to a Workspace Member preserves workspace role as WORKSPACE_MEMBER', async () => {
      // Demote back to PROJECT_MEMBER (we also have Owner as PROJECT_ADMIN so not last admin)
      const patchRes = await request(app)
        .patch(`/api/projects/${projId}/members/${targetMemberRecordId}`)
        .set('Cookie', ownerCookie)
        .send({ role: 'PROJECT_MEMBER' });

      expect(patchRes.status).toBe(200);
      expect(patchRes.body.data.member.role).toBe('PROJECT_MEMBER');

      const finalWsMember = await prisma.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId, userId: memberId } },
      });
      expect(finalWsMember?.role).toBe('WORKSPACE_MEMBER');
    });

    it('prevents a Project Admin from promoting members to Workspace Admin or modifying workspace settings', async () => {
      // Re-promote member to PROJECT_ADMIN for this test
      await prisma.projectMember.update({
        where: { id: targetMemberRecordId },
        data: { role: 'PROJECT_ADMIN' },
      });

      // Member (who is PROJECT_ADMIN in project) attempts to promote outsider or self to WORKSPACE_ADMIN
      const wsMemberRec = await prisma.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId, userId: admin2Id } },
      });
      expect(wsMemberRec).toBeDefined();

      const promoteRes = await request(app)
        .patch(`/api/workspaces/${workspaceId}/members/${wsMemberRec!.id}`)
        .set('Cookie', memberCookie)
        .send({ role: 'WORKSPACE_ADMIN' });

      expect(promoteRes.status).toBe(403);

      // Attempt to modify admin-permissions
      const permRes = await request(app)
        .patch(`/api/workspaces/${workspaceId}/admin-permissions`)
        .set('Cookie', memberCookie)
        .send({ autoIncludeAdminsInNewProjects: true });

      expect(permRes.status).toBe(403);

      // Attempt to modify workspace settings / capacity
      const settingsRes = await request(app)
        .patch(`/api/workspaces/${workspaceId}`)
        .set('Cookie', memberCookie)
        .send({ maxMembers: 50 });

      expect(settingsRes.status).toBe(403);
    });

    it('Workspace Admin without workspace role-management permission cannot promote members to Workspace Admin, but can assign project roles', async () => {
      // Owner explicitly disables canManageRoles for Workspace Admins
      await request(app)
        .patch(`/api/workspaces/${workspaceId}/admin-permissions`)
        .set('Cookie', ownerCookie)
        .send({
          canManageRoles: false,
          workspaceAdmin: {
            canManageRoles: false,
            canCreateProjects: true,
            canInviteMembers: true,
          },
        });

      // Ensure Admin1 is a member of projId as PROJECT_ADMIN
      const admin1Pm = await prisma.projectMember.findFirst({
        where: { projectId: projId, userId: admin1Id },
      });
      if (!admin1Pm) {
        await prisma.projectMember.create({
          data: { projectId: projId, userId: admin1Id, role: 'PROJECT_ADMIN' },
        });
      }

      // Admin1 attempts to promote member to WORKSPACE_ADMIN -> should fail (403)
      const targetWsMember = await prisma.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId, userId: memberId } },
      });

      const wsPromoteRes = await request(app)
        .patch(`/api/workspaces/${workspaceId}/members/${targetWsMember!.id}`)
        .set('Cookie', admin1Cookie)
        .send({ role: 'WORKSPACE_ADMIN' });

      expect(wsPromoteRes.status).toBe(403);
      expect(wsPromoteRes.body.message).toMatch(/does not have permission to manage member roles/i);

      // BUT Admin1 CAN assign Project Admin role on projId -> succeeds (200)
      const projRoleRes = await request(app)
        .patch(`/api/projects/${projId}/members/${targetMemberRecordId}`)
        .set('Cookie', admin1Cookie)
        .send({ role: 'PROJECT_ADMIN' });

      expect(projRoleRes.status).toBe(200);
      expect(projRoleRes.body.data.member.role).toBe('PROJECT_ADMIN');

      // Verify workspace role remains WORKSPACE_MEMBER
      const finalWsMember = await prisma.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId, userId: memberId } },
      });
      expect(finalWsMember?.role).toBe('WORKSPACE_MEMBER');
    });
  });
});
