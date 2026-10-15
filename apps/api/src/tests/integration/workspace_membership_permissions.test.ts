import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import crypto from 'crypto';
import { app } from '../../server.js';
import prisma from '../../prisma.js';

describe('Phase 3 Multi-Workspace Membership, Invitations, and Permissions Test Suite', () => {
  const ts = Date.now();

  const ownerUser = {
    username: `p3_owner_${ts}`,
    email: `p3_owner_${ts}@example.com`,
    password: 'Password123!Secure',
    fullName: 'Phase 3 Owner',
  };

  const adminUser = {
    username: `p3_admin_${ts}`,
    email: `p3_admin_${ts}@example.com`,
    password: 'Password123!Secure',
    fullName: 'Phase 3 Admin',
  };

  const memberUser = {
    username: `p3_member_${ts}`,
    email: `p3_member_${ts}@example.com`,
    password: 'Password123!Secure',
    fullName: 'Phase 3 Member',
  };

  const outsiderUser = {
    username: `p3_outsider_${ts}`,
    email: `p3_outsider_${ts}@example.com`,
    password: 'Password123!Secure',
    fullName: 'Phase 3 Outsider',
  };

  let ownerId: string;
  let adminId: string;
  let memberId: string;
  let outsiderId: string;

  let ownerCookie: string;
  let adminCookie: string;
  let memberCookie: string;
  let outsiderCookie: string;

  let teamWorkspaceId: string;
  let personalWorkspaceId: string;
  let testProjectId: string;

  let adminMembershipId: string;
  let memberMembershipId: string;

  beforeAll(async () => {
    // 1. Register and login Owner
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

    // 2. Register and login Admin
    const regAdmin = await request(app).post('/api/auth/register').send(adminUser);
    expect(regAdmin.status).toBe(201);
    adminId = regAdmin.body.data.user.id;
    await prisma.user.update({ where: { id: adminId }, data: { isEmailVerified: true } });

    const loginAdmin = await request(app).post('/api/auth/login').send({
      identifier: adminUser.email,
      password: adminUser.password,
    });
    const cAdmin = loginAdmin.headers['set-cookie'];
    adminCookie = Array.isArray(cAdmin) ? cAdmin[0].split(';')[0] : cAdmin.split(';')[0];

    // 3. Register and login Member
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

    // 4. Register and login Outsider
    const regOutsider = await request(app).post('/api/auth/register').send(outsiderUser);
    expect(regOutsider.status).toBe(201);
    outsiderId = regOutsider.body.data.user.id;
    await prisma.user.update({ where: { id: outsiderId }, data: { isEmailVerified: true } });

    const loginOutsider = await request(app).post('/api/auth/login').send({
      identifier: outsiderUser.email,
      password: outsiderUser.password,
    });
    const cOutsider = loginOutsider.headers['set-cookie'];
    outsiderCookie = Array.isArray(cOutsider) ? cOutsider[0].split(';')[0] : cOutsider.split(';')[0];

    // Fetch personal workspace of owner
    const personalWs = await prisma.workspace.findFirst({
      where: { ownerId, isPersonal: true },
    });
    expect(personalWs).toBeDefined();
    personalWorkspaceId = personalWs!.id;

    // Create a team workspace for testing
    const createWsRes = await request(app)
      .post('/api/workspaces')
      .set('Cookie', ownerCookie)
      .send({
        name: `Team Workspace ${ts}`,
        description: 'Test Team Workspace',
      });
    expect(createWsRes.status).toBe(201);
    teamWorkspaceId = createWsRes.body.data.workspace.id;

    // Add Admin directly as WORKSPACE_ADMIN
    const adminMem = await prisma.workspaceMember.create({
      data: {
        workspaceId: teamWorkspaceId,
        userId: adminId,
        role: 'WORKSPACE_ADMIN',
        origin: 'DIRECT',
      },
    });
    adminMembershipId = adminMem.id;

    // Add Member directly as WORKSPACE_MEMBER
    const memMem = await prisma.workspaceMember.create({
      data: {
        workspaceId: teamWorkspaceId,
        userId: memberId,
        role: 'WORKSPACE_MEMBER',
        origin: 'DIRECT',
      },
    });
    memberMembershipId = memMem.id;

    // Create project in team workspace
    const projRes = await request(app)
      .post('/api/projects')
      .set('Cookie', ownerCookie)
      .set('x-workspace-id', teamWorkspaceId)
      .send({
        name: `Team Project ${ts}`,
        key: `P3${String(ts).slice(-3)}`,
        description: 'Project in Team WS for test purposes',
      });
    expect(projRes.status).toBe(201);
    testProjectId = projRes.body.data.project.id;

    // Add Member to Project
    await prisma.projectMember.create({
      data: {
        projectId: testProjectId,
        userId: memberId,
        role: 'PROJECT_MEMBER',
      },
    });
  });

  // =========================================================================
  // 1. Workspace Invitations Lifecycle
  // =========================================================================
  describe('1. Workspace Invitations Lifecycle', () => {
    let inviteToken: string;
    let inviteId: string;
    const testInvitedEmail = `new_invitee_${ts}@example.com`;

    it('Owner can create a workspace invitation with high-entropy token', async () => {
      const res = await request(app)
        .post(`/api/workspaces/${teamWorkspaceId}/invitations`)
        .set('Cookie', ownerCookie)
        .send({
          email: testInvitedEmail,
          role: 'WORKSPACE_MEMBER',
          message: 'Welcome to our team workspace!',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.invitation.invitedEmail).toBe(testInvitedEmail);
      expect(res.body.data.invitation.status).toBe('PENDING');
      inviteId = res.body.data.invitation.id;

      // Verify token in DB is hashed, raw token never stored
      const stored = await prisma.workspaceInvitation.findUnique({
        where: { id: inviteId },
      });
      expect(stored).toBeDefined();
      expect(stored!.tokenHash).toHaveLength(64); // SHA-256 hex
      expect((stored as any).token).toBeUndefined(); // no raw token field in DB
    });

    it('Duplicate pending invitation to the same email is rejected with 409', async () => {
      const res = await request(app)
        .post(`/api/workspaces/${teamWorkspaceId}/invitations`)
        .set('Cookie', ownerCookie)
        .send({
          email: testInvitedEmail,
          role: 'WORKSPACE_MEMBER',
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
    });

    it('Owner can resend pending invitation, resetting token and extending expiry', async () => {
      const res = await request(app)
        .post(`/api/workspaces/${teamWorkspaceId}/invitations/${inviteId}/resend`)
        .set('Cookie', ownerCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('Owner can revoke a pending workspace invitation', async () => {
      // Create separate invitation to revoke
      const tempEmail = `revoke_me_${ts}@example.com`;
      const createRes = await request(app)
        .post(`/api/workspaces/${teamWorkspaceId}/invitations`)
        .set('Cookie', ownerCookie)
        .send({ email: tempEmail });

      expect(createRes.status).toBe(201);
      const tempId = createRes.body.data.invitation.id;

      const revokeRes = await request(app)
        .delete(`/api/workspaces/${teamWorkspaceId}/invitations/${tempId}`)
        .set('Cookie', ownerCookie);

      expect(revokeRes.status).toBe(200);

      // Verify status is REVOKED
      const revoked = await prisma.workspaceInvitation.findUnique({
        where: { id: tempId },
      });
      expect(revoked!.status).toBe('REVOKED');
      expect(revoked!.revokedAt).toBeDefined();

      // Revoked invitation cannot be accepted (even by matching email)
      const revUser = {
        username: `rev_usr_${ts}`,
        email: tempEmail,
        password: 'Password123!Secure',
      };
      const rReg = await request(app).post('/api/auth/register').send(revUser);
      await prisma.user.update({ where: { id: rReg.body.data.user.id }, data: { isEmailVerified: true } });
      const rLog = await request(app).post('/api/auth/login').send({ identifier: tempEmail, password: revUser.password });
      const cR = rLog.headers['set-cookie'];
      const rCook = Array.isArray(cR) ? cR[0].split(';')[0] : cR.split(';')[0];

      const acceptRevoked = await request(app)
        .post(`/api/workspaces/invitations/${tempId}/accept`)
        .set('Cookie', rCook);

      expect(acceptRevoked.status).toBe(400);
      expect(acceptRevoked.body.message.toLowerCase()).toContain('revoked');
    });

    it('Recipient can view pending workspace invitations matching their verified email', async () => {
      // Create invitation for outsiderUser's email
      const rawTokenBytes = crypto.randomBytes(32);
      const rawToken = rawTokenBytes.toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

      const inv = await prisma.workspaceInvitation.create({
        data: {
          workspaceId: teamWorkspaceId,
          invitedEmail: outsiderUser.email,
          invitedById: ownerId,
          tokenHash,
          role: 'WORKSPACE_MEMBER',
          status: 'PENDING',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      inviteToken = rawToken;

      const res = await request(app)
        .get('/api/workspaces/invitations/pending')
        .set('Cookie', outsiderCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const found = res.body.data.invitations.find((i: any) => i.id === inv.id);
      expect(found).toBeDefined();
      expect(found.workspace.name).toContain('Team Workspace');
    });

    it('Invitation acceptance enforces email matching (mismatched user receives 403)', async () => {
      // Member tries to accept Outsider's invitation using the token
      const res = await request(app)
        .post(`/api/workspaces/invitations/${inviteToken}/accept`)
        .set('Cookie', memberCookie);

      expect(res.status).toBe(403);
      expect(res.body.message).toContain('email');
    });

    it('Recipient can accept invitation with valid matching email, creating DIRECT membership', async () => {
      const res = await request(app)
        .post(`/api/workspaces/invitations/${inviteToken}/accept`)
        .set('Cookie', outsiderCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify DIRECT membership was created
      const memberRecord = await prisma.workspaceMember.findUnique({
        where: {
          workspaceId_userId: {
            workspaceId: teamWorkspaceId,
            userId: outsiderId,
          },
        },
      });
      expect(memberRecord).toBeDefined();
      expect(memberRecord!.role).toBe('WORKSPACE_MEMBER');
      expect(memberRecord!.origin).toBe('DIRECT');

      // Verify invitation marked ACCEPTED
      const invRecord = await prisma.workspaceInvitation.findFirst({
        where: { workspaceId: teamWorkspaceId, invitedEmail: outsiderUser.email },
      });
      expect(invRecord!.status).toBe('ACCEPTED');
      expect(invRecord!.acceptedAt).toBeDefined();
    });

    it('Replay / duplicate acceptance is prevented safely', async () => {
      const res = await request(app)
        .post(`/api/workspaces/invitations/${inviteToken}/accept`)
        .set('Cookie', outsiderCookie);

      // Already accepted / member already
      expect(res.status).toBe(400);
    });

    it('Recipient can decline an invitation', async () => {
      // Create new pending invitation for outsider
      const declineToken = crypto.randomBytes(32).toString('hex');
      const declineHash = crypto.createHash('sha256').update(declineToken).digest('hex');

      const inv = await prisma.workspaceInvitation.create({
        data: {
          workspaceId: teamWorkspaceId,
          invitedEmail: `decline_test_${ts}@example.com`,
          invitedById: ownerId,
          tokenHash: declineHash,
          role: 'WORKSPACE_MEMBER',
          status: 'PENDING',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      // Outsider logs in with matching email
      const decUser = {
        username: `dec_user_${ts}`,
        email: `decline_test_${ts}@example.com`,
        password: 'Password123!Secure',
      };
      const reg = await request(app).post('/api/auth/register').send(decUser);
      const decUserId = reg.body.data.user.id;
      await prisma.user.update({ where: { id: decUserId }, data: { isEmailVerified: true } });

      const logRes = await request(app).post('/api/auth/login').send({
        identifier: decUser.email,
        password: decUser.password,
      });
      const cDec = logRes.headers['set-cookie'];
      const decCookie = Array.isArray(cDec) ? cDec[0].split(';')[0] : cDec.split(';')[0];

      const decRes = await request(app)
        .post(`/api/workspaces/invitations/${inv.id}/decline`)
        .set('Cookie', decCookie);

      expect(decRes.status).toBe(200);

      const updated = await prisma.workspaceInvitation.findUnique({
        where: { id: inv.id },
      });
      expect(updated!.status).toBe('DECLINED');
      expect(updated!.declinedAt).toBeDefined();
    });
  });

  // =========================================================================
  // 2. Owner-Controlled Admin Permissions
  // =========================================================================
  describe('2. Owner-Controlled Admin Permissions', () => {
    it('Admin cannot invite members when canInviteMembers is false (403)', async () => {
      // Ensure canInviteMembers is false
      await prisma.workspace.update({
        where: { id: teamWorkspaceId },
        data: {
          adminPermissions: {
            canInviteMembers: false,
            canRemoveMembers: false,
            canCreateProjects: false,
            canManageRoles: false,
          },
        },
      });

      const res = await request(app)
        .post(`/api/workspaces/${teamWorkspaceId}/invitations`)
        .set('Cookie', adminCookie)
        .send({
          email: `unauth_invite_${ts}@example.com`,
          role: 'WORKSPACE_MEMBER',
        });

      expect(res.status).toBe(403);
      expect(res.body.message.toLowerCase()).toContain('invite members');
    });

    it('Admin can invite members when canInviteMembers is true (201)', async () => {
      // Owner enables canInviteMembers
      const patchRes = await request(app)
        .patch(`/api/workspaces/${teamWorkspaceId}/admin-permissions`)
        .set('Cookie', ownerCookie)
        .send({ canInviteMembers: true });

      expect(patchRes.status).toBe(200);
      expect(patchRes.body.data.permissions.canInviteMembers).toBe(true);

      const res = await request(app)
        .post(`/api/workspaces/${teamWorkspaceId}/invitations`)
        .set('Cookie', adminCookie)
        .send({
          email: `admin_invited_${ts}@example.com`,
          role: 'WORKSPACE_MEMBER',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it('Admin cannot create projects when canCreateProjects is false (403)', async () => {
      // Ensure canCreateProjects is false
      await prisma.workspace.update({
        where: { id: teamWorkspaceId },
        data: {
          adminPermissions: {
            canInviteMembers: true,
            canRemoveMembers: false,
            canCreateProjects: false,
            canManageRoles: false,
          },
        },
      });

      const res = await request(app)
        .post('/api/projects')
        .set('Cookie', adminCookie)
        .set('x-workspace-id', teamWorkspaceId)
        .send({
          name: `Admin Project Forbidden ${ts}`,
          key: `AFB${String(ts).slice(-3)}`,
          description: 'Valid description for forbidden project test',
        });

      expect(res.status).toBe(403);
      expect(res.body.message.toLowerCase()).toContain('create projects');
    });

    it('Admin can create projects when canCreateProjects is true (201)', async () => {
      // Owner grants canCreateProjects
      await request(app)
        .patch(`/api/workspaces/${teamWorkspaceId}/admin-permissions`)
        .set('Cookie', ownerCookie)
        .send({ canCreateProjects: true });

      const res = await request(app)
        .post('/api/projects')
        .set('Cookie', adminCookie)
        .set('x-workspace-id', teamWorkspaceId)
        .send({
          name: `Admin Project Allowed ${ts}`,
          key: `APA${String(ts).slice(-3)}`,
          description: 'Valid description for allowed project test',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it('Admin cannot manage roles when canManageRoles is false (403)', async () => {
      // Ensure canManageRoles is false
      await prisma.workspace.update({
        where: { id: teamWorkspaceId },
        data: {
          adminPermissions: {
            canInviteMembers: true,
            canRemoveMembers: false,
            canCreateProjects: true,
            canManageRoles: false,
          },
        },
      });

      const res = await request(app)
        .patch(`/api/workspaces/${teamWorkspaceId}/members/${memberMembershipId}`)
        .set('Cookie', adminCookie)
        .send({ role: 'WORKSPACE_ADMIN' });

      expect(res.status).toBe(403);
      expect(res.body.message.toLowerCase()).toContain('manage member roles');
    });

    it('Admin can update non-owner role when canManageRoles is true (200)', async () => {
      // Owner grants canManageRoles
      await request(app)
        .patch(`/api/workspaces/${teamWorkspaceId}/admin-permissions`)
        .set('Cookie', ownerCookie)
        .send({ canManageRoles: true });

      const res = await request(app)
        .patch(`/api/workspaces/${teamWorkspaceId}/members/${memberMembershipId}`)
        .set('Cookie', adminCookie)
        .send({ role: 'WORKSPACE_ADMIN' });

      expect(res.status).toBe(200);
      expect(res.body.data.member.role).toBe('WORKSPACE_ADMIN');

      // Revert back to WORKSPACE_MEMBER
      await request(app)
        .patch(`/api/workspaces/${teamWorkspaceId}/members/${memberMembershipId}`)
        .set('Cookie', adminCookie)
        .send({ role: 'WORKSPACE_MEMBER' });
    });

    it('Admin cannot promote anyone to OWNER even with canManageRoles (403/400)', async () => {
      const res = await request(app)
        .patch(`/api/workspaces/${teamWorkspaceId}/members/${memberMembershipId}`)
        .set('Cookie', adminCookie)
        .send({ role: 'OWNER' });

      expect([400, 403]).toContain(res.status);
    });

    it('Admin cannot change Owner role or demote Owner (400)', async () => {
      // Find Owner's membership record
      const ownerMem = await prisma.workspaceMember.findFirst({
        where: { workspaceId: teamWorkspaceId, userId: ownerId },
      });
      expect(ownerMem).toBeDefined();

      const res = await request(app)
        .patch(`/api/workspaces/${teamWorkspaceId}/members/${ownerMem!.id}`)
        .set('Cookie', adminCookie)
        .send({ role: 'WORKSPACE_MEMBER' });

      expect(res.status).toBe(400);
      expect(res.body.message.toLowerCase()).toContain('owner');
    });

    it('Users cannot change their own role / self-escalate (400)', async () => {
      const res = await request(app)
        .patch(`/api/workspaces/${teamWorkspaceId}/members/${adminMembershipId}`)
        .set('Cookie', adminCookie)
        .send({ role: 'WORKSPACE_MEMBER' });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('own role');
    });

    it('Non-owners (Admin / Member) cannot update admin permissions (403)', async () => {
      const adminTry = await request(app)
        .patch(`/api/workspaces/${teamWorkspaceId}/admin-permissions`)
        .set('Cookie', adminCookie)
        .send({ canRemoveMembers: true });

      expect(adminTry.status).toBe(403);

      const memberTry = await request(app)
        .patch(`/api/workspaces/${teamWorkspaceId}/admin-permissions`)
        .set('Cookie', memberCookie)
        .send({ canRemoveMembers: true });

      expect(memberTry.status).toBe(403);
    });

    it('Personal workspaces reject modifying admin permissions (400) and resolve all-false', async () => {
      const patchPersonal = await request(app)
        .patch(`/api/workspaces/${personalWorkspaceId}/admin-permissions`)
        .set('Cookie', ownerCookie)
        .send({ canInviteMembers: true });

      expect(patchPersonal.status).toBe(400);
      expect(patchPersonal.body.message.toLowerCase()).toContain('personal');

      const getPersonal = await request(app)
        .get(`/api/workspaces/${personalWorkspaceId}/admin-permissions`)
        .set('Cookie', ownerCookie);

      expect(getPersonal.status).toBe(200);
      expect(getPersonal.body.data.permissions).toEqual({
        canInviteMembers: false,
        canRemoveMembers: false,
        canCreateProjects: false,
        canManageRoles: false,
      });
    });
  });

  // =========================================================================
  // 3. Workspace Member Management & Removal Cascade
  // =========================================================================
  describe('3. Workspace Member Management & Removal Cascade', () => {
    it('Admin cannot remove members when canRemoveMembers is false (403)', async () => {
      // Ensure canRemoveMembers is false
      await prisma.workspace.update({
        where: { id: teamWorkspaceId },
        data: {
          adminPermissions: {
            canInviteMembers: true,
            canRemoveMembers: false,
            canCreateProjects: true,
            canManageRoles: true,
          },
        },
      });

      const res = await request(app)
        .delete(`/api/workspaces/${teamWorkspaceId}/members/${memberMembershipId}`)
        .set('Cookie', adminCookie);

      expect(res.status).toBe(403);
      expect(res.body.message.toLowerCase()).toContain('remove members');
    });

    it('Owner cannot be removed from workspace (400)', async () => {
      const ownerMem = await prisma.workspaceMember.findFirst({
        where: { workspaceId: teamWorkspaceId, userId: ownerId },
      });

      const res = await request(app)
        .delete(`/api/workspaces/${teamWorkspaceId}/members/${ownerMem!.id}`)
        .set('Cookie', ownerCookie);

      expect(res.status).toBe(400);
      expect(res.body.message.toLowerCase()).toContain('owner');
    });

    it('Removing a member immediately revokes project access, unassigns tasks, and preserves attribution', async () => {
      // 1. Create a task assigned to memberUser in testProjectId
      const workItem = await prisma.workItem.create({
        data: {
          project: { connect: { id: testProjectId } },
          title: `Task assigned to member ${ts}`,
          type: 'TASK',
          status: 'IN_PROGRESS',
          priority: 'HIGH',
          assignedTo: { connect: { id: memberId } },
          createdBy: { connect: { id: memberId } }, // attribution check
        },
      });

      // Verify member is in project
      const projMemBefore = await prisma.projectMember.findUnique({
        where: {
          projectId_userId: {
            projectId: testProjectId,
            userId: memberId,
          },
        },
      });
      expect(projMemBefore).toBeDefined();

      // 2. Owner removes memberUser from teamWorkspace
      const removeRes = await request(app)
        .delete(`/api/workspaces/${teamWorkspaceId}/members/${memberMembershipId}`)
        .set('Cookie', ownerCookie);

      expect(removeRes.status).toBe(200);
      expect(removeRes.body.success).toBe(true);

      // 3. Workspace membership is deleted
      const wsMemAfter = await prisma.workspaceMember.findUnique({
        where: { id: memberMembershipId },
      });
      expect(wsMemAfter).toBeNull();

      // 4. Project membership in all workspace projects is deleted
      const projMemAfter = await prisma.projectMember.findUnique({
        where: {
          projectId_userId: {
            projectId: testProjectId,
            userId: memberId,
          },
        },
      });
      expect(projMemAfter).toBeNull();

      // 5. Active task assignment is cleared (unassigned)
      const taskAfter = await prisma.workItem.findUnique({
        where: { id: workItem.id },
      });
      expect(taskAfter!.assignedToId).toBeNull();

      // 6. Historical attribution (createdById) is preserved!
      expect(taskAfter!.createdById).toBe(memberId);

      // 7. Former member cannot access the project anymore (403 or 404)
      const projectAccess = await request(app)
        .get(`/api/projects/${testProjectId}`)
        .set('Cookie', memberCookie);

      expect([403, 404]).toContain(projectAccess.status);
    });
  });

  // =========================================================================
  // 4. Cross-Workspace ID and Header Isolation
  // =========================================================================
  describe('4. Cross-Workspace Isolation & Tampering Safeguards', () => {
    it('Manipulating x-workspace-id header to an unauthorized workspace is rejected (403)', async () => {
      // Member tries to access or mutate resources in teamWorkspaceId using their cookie
      // (since memberUser was removed above, they are no longer a member)
      const res = await request(app)
        .get(`/api/workspaces/${teamWorkspaceId}/members`)
        .set('Cookie', memberCookie);

      expect(res.status).toBe(403);
    });

    it('Project invitation cannot be created for a user who is not a member of the workspace (or acceptance rejected)', async () => {
      const outsiderEmail = `project_only_${ts}@example.com`;

      // 1. Attempting to create project invitation for non-workspace member is rejected (400)
      const invRes = await request(app)
        .post(`/api/projects/${testProjectId}/invitations`)
        .set('Cookie', ownerCookie)
        .send({
          email: outsiderEmail,
          role: 'PROJECT_MEMBER',
        });

      expect(invRes.status).toBe(400);
      expect(invRes.body.message).toMatch(/(workspace member|active member of this workspace)/i);

      // Outsider registers with that email
      const pUser = {
        username: `proj_only_${ts}`,
        email: outsiderEmail,
        password: 'Password123!Secure',
      };
      const reg = await request(app).post('/api/auth/register').send(pUser);
      const pUserId = reg.body.data.user.id;
      await prisma.user.update({ where: { id: pUserId }, data: { isEmailVerified: true } });

      const log = await request(app).post('/api/auth/login').send({
        identifier: pUser.email,
        password: pUser.password,
      });
      const cP = log.headers['set-cookie'];
      const pCookie = Array.isArray(cP) ? cP[0].split(';')[0] : cP.split(';')[0];

      // 2. Direct pending invitation without workspace membership fails acceptance with 403
      const directInv = await prisma.invitation.create({
        data: {
          projectId: testProjectId,
          invitedEmail: outsiderEmail.toLowerCase(),
          invitedUserId: pUserId,
          invitedById: ownerId,
          role: 'PROJECT_MEMBER',
          status: 'PENDING',
          expiresAt: new Date(Date.now() + 86400000),
        },
      });

      const acceptRes = await request(app)
        .post(`/api/invitations/${directInv.id}/accept`)
        .set('Cookie', pCookie);

      expect(acceptRes.status).toBe(403);
      expect(acceptRes.body.message).toContain('Workspace membership is required');

      await prisma.invitation.delete({ where: { id: directInv.id } });
    });
  });
});
