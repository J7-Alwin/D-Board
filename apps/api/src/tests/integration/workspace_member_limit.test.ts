import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../../server.js';
import prisma from '../../prisma.js';

describe('Phase 3: Workspace Member Limit & Capacity Reservation Integration Tests', () => {
  const timestamp = Date.now();
  const ownerData = {
    username: `limit_owner_${timestamp}`,
    email: `limit_owner_${timestamp}@example.com`,
    password: 'Password123!Secure',
    fullName: 'Limit Owner',
  };

  const adminData = {
    username: `limit_admin_${timestamp}`,
    email: `limit_admin_${timestamp}@example.com`,
    password: 'Password123!Secure',
    fullName: 'Limit Admin',
  };

  const memberData = {
    username: `limit_member_${timestamp}`,
    email: `limit_member_${timestamp}@example.com`,
    password: 'Password123!Secure',
    fullName: 'Limit Member',
  };

  const candidateData = {
    username: `limit_cand_${timestamp}`,
    email: `limit_cand_${timestamp}@example.com`,
    password: 'Password123!Secure',
    fullName: 'Limit Candidate',
  };

  let ownerId: string;
  let adminId: string;
  let candidateId: string;

  let ownerCookie: string;
  let adminCookie: string;
  let candidateCookie: string;

  let personalWsId: string;
  let teamWsId: string;

  beforeAll(async () => {
    // 1. Register and login owner
    const resOwner = await request(app).post('/api/auth/register').send(ownerData);
    expect(resOwner.status).toBe(201);
    ownerId = resOwner.body.data.user.id;
    await prisma.user.update({ where: { id: ownerId }, data: { isEmailVerified: true } });

    const loginOwner = await request(app).post('/api/auth/login').send({
      identifier: ownerData.email,
      password: ownerData.password,
    });
    const cOwner = loginOwner.headers['set-cookie'];
    ownerCookie = Array.isArray(cOwner) ? cOwner[0].split(';')[0] : cOwner.split(';')[0];

    // Get personal workspace
    const personalWs = await prisma.workspace.findFirst({
      where: { ownerId, isPersonal: true },
    });
    expect(personalWs).toBeDefined();
    personalWsId = personalWs!.id;

    // 2. Register admin
    const resAdmin = await request(app).post('/api/auth/register').send(adminData);
    expect(resAdmin.status).toBe(201);
    adminId = resAdmin.body.data.user.id;
    await prisma.user.update({ where: { id: adminId }, data: { isEmailVerified: true } });

    const loginAdmin = await request(app).post('/api/auth/login').send({
      identifier: adminData.email,
      password: adminData.password,
    });
    const cAdmin = loginAdmin.headers['set-cookie'];
    adminCookie = Array.isArray(cAdmin) ? cAdmin[0].split(';')[0] : cAdmin.split(';')[0];

    // 3. Register candidate
    const resCand = await request(app).post('/api/auth/register').send(candidateData);
    expect(resCand.status).toBe(201);
    candidateId = resCand.body.data.user.id;
    await prisma.user.update({ where: { id: candidateId }, data: { isEmailVerified: true } });

    const loginCand = await request(app).post('/api/auth/login').send({
      identifier: candidateData.email,
      password: candidateData.password,
    });
    const cCand = loginCand.headers['set-cookie'];
    candidateCookie = Array.isArray(cCand) ? cCand[0].split(';')[0] : cCand.split(';')[0];

    // 4. Create a team workspace owned by owner
    const wsRes = await request(app)
      .post('/api/workspaces')
      .set('Cookie', ownerCookie)
      .send({ name: `Limit Team WS ${timestamp}` });
    expect(wsRes.status).toBe(201);
    teamWsId = wsRes.body.data.workspace.id;

    // Add admin to team workspace
    await prisma.workspaceMember.create({
      data: {
        workspaceId: teamWsId,
        userId: adminId,
        role: 'WORKSPACE_ADMIN',
        origin: 'DIRECT',
      },
    });
  });

  afterAll(async () => {
    if (teamWsId) {
      await prisma.workspaceAuditLog.deleteMany({ where: { workspaceId: teamWsId } });
      await prisma.workspaceInvitation.deleteMany({ where: { workspaceId: teamWsId } });
      await prisma.workspaceMember.deleteMany({ where: { workspaceId: teamWsId } });
      await prisma.workspace.deleteMany({ where: { id: teamWsId } });
    }
    const userIds = [ownerId, adminId, candidateId].filter(Boolean);
    if (userIds.length > 0) {
      await prisma.workspaceMember.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.workspace.deleteMany({ where: { ownerId: { in: userIds } } });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }
  });

  it('Owner cannot set member limit on personal workspace', async () => {
    const res = await request(app)
      .patch(`/api/workspaces/${personalWsId}`)
      .set('Cookie', ownerCookie)
      .send({ maxMembers: 5 });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/personal workspaces do not support member limits/i);
  });

  it('Workspace Admin cannot modify workspace settings or member limit', async () => {
    const res = await request(app)
      .patch(`/api/workspaces/${teamWsId}`)
      .set('Cookie', adminCookie)
      .send({ maxMembers: 5 });

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/only the workspace owner can modify workspace settings/i);
  });

  it('Cannot set member limit lower than current active member count', async () => {
    // Current active members = 2 (owner + admin)
    const res = await request(app)
      .patch(`/api/workspaces/${teamWsId}`)
      .set('Cookie', ownerCookie)
      .send({ maxMembers: 1 });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/cannot set member limit to 1/i);
  });

  it('Owner sets member limit to 2 (exactly at current active member count)', async () => {
    const res = await request(app)
      .patch(`/api/workspaces/${teamWsId}`)
      .set('Cookie', ownerCookie)
      .send({ maxMembers: 2 });

    expect(res.status).toBe(200);
    expect(res.body.data.workspace.maxMembers).toBe(2);

    // Attempting to send an invitation when active members = 2 and limit = 2 must fail
    const inviteRes = await request(app)
      .post(`/api/workspaces/${teamWsId}/invitations`)
      .set('Cookie', ownerCookie)
      .send({ email: candidateData.email, role: 'WORKSPACE_MEMBER' });

    expect(inviteRes.status).toBe(400);
    expect(inviteRes.body.message).toMatch(/workspace member limit reached.*limited to 2 members/i);
  });

  it('Increasing limit to 3 allows 1 invitation, which reserves the last spot', async () => {
    // Increase limit to 3 (active = 2, room for 1)
    const updateRes = await request(app)
      .patch(`/api/workspaces/${teamWsId}`)
      .set('Cookie', ownerCookie)
      .send({ maxMembers: 3 });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.workspace.maxMembers).toBe(3);

    // Send first invitation (active: 2, pending: 1 => total capacity: 3/3)
    const inviteRes = await request(app)
      .post(`/api/workspaces/${teamWsId}/invitations`)
      .set('Cookie', ownerCookie)
      .send({ email: candidateData.email, role: 'WORKSPACE_MEMBER' });

    expect(inviteRes.status).toBe(201);
    const inviteId = inviteRes.body.data.invitation.id;

    // Attempting to send a second invitation should be rejected because pending reserves capacity
    const secondInviteRes = await request(app)
      .post(`/api/workspaces/${teamWsId}/invitations`)
      .set('Cookie', ownerCookie)
      .send({ email: 'another_user@example.com', role: 'WORKSPACE_MEMBER' });

    expect(secondInviteRes.status).toBe(400);
    expect(secondInviteRes.body.message).toMatch(/workspace member limit reached.*limited to 3 members/i);

    // Revoking the first invitation releases reserved capacity
    const revokeRes = await request(app)
      .delete(`/api/workspaces/${teamWsId}/invitations/${inviteId}`)
      .set('Cookie', ownerCookie);
    expect(revokeRes.status).toBe(200);

    // Now another invitation can be sent
    const newInviteRes = await request(app)
      .post(`/api/workspaces/${teamWsId}/invitations`)
      .set('Cookie', ownerCookie)
      .send({ email: candidateData.email, role: 'WORKSPACE_MEMBER' });

    expect(newInviteRes.status).toBe(201);
    const newInviteId = newInviteRes.body.data.invitation.id;

    // Candidate accepts invitation: succeeds and active members becomes 3
    const acceptRes = await request(app)
      .post(`/api/workspaces/invitations/${newInviteId}/accept`)
      .set('Cookie', candidateCookie);

    expect(acceptRes.status).toBe(200);
    expect(acceptRes.body.workspace.id).toBe(teamWsId);

    // Verify candidate is now in workspaceMember
    const checkMember = await prisma.workspaceMember.findFirst({
      where: { workspaceId: teamWsId, userId: candidateId },
    });
    expect(checkMember).toBeDefined();
    expect(checkMember?.role).toBe('WORKSPACE_MEMBER');
  });

  it('Atomic acceptance enforcement: rejecting acceptance if limit reached', async () => {
    // Current active members in teamWsId = 3, maxMembers = 3.
    // Register User D
    const userDData = {
      username: `limit_user_d_${Date.now()}`,
      email: `limit_user_d_${Date.now()}@example.com`,
      password: 'Password123!Secure',
      fullName: 'Limit User D',
    };
    const regD = await request(app).post('/api/auth/register').send(userDData);
    expect(regD.status).toBe(201);
    const userDId = regD.body.data.user.id;
    await prisma.user.update({ where: { id: userDId }, data: { isEmailVerified: true } });

    const loginD = await request(app).post('/api/auth/login').send({
      identifier: userDData.email,
      password: userDData.password,
    });
    const cD = loginD.headers['set-cookie'];
    const cookieD = Array.isArray(cD) ? cD[0].split(';')[0] : cD.split(';')[0];

    // Create an invite for User D directly
    const invite = await prisma.workspaceInvitation.create({
      data: {
        workspaceId: teamWsId,
        invitedEmail: userDData.email.toLowerCase(),
        invitedById: ownerId,
        role: 'WORKSPACE_MEMBER',
        tokenHash: `mock_tok_hash_${Date.now()}`,
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 86400000),
      },
    });

    // Attempt to accept invite: activeMembersCount (3) >= maxMembers (3)
    const acceptRes = await request(app)
      .post(`/api/workspaces/invitations/${invite.id}/accept`)
      .set('Cookie', cookieD);

    expect(acceptRes.status).toBe(400);
    expect(acceptRes.body.message).toMatch(/workspace member limit reached.*limit of 3 active members/i);
  });

  it('Owner can clear member limit to allow unlimited membership', async () => {
    const res = await request(app)
      .patch(`/api/workspaces/${teamWsId}`)
      .set('Cookie', ownerCookie)
      .send({ maxMembers: null });

    expect(res.status).toBe(200);
    expect(res.body.data.workspace.maxMembers).toBeNull();

    // Now invitation can be sent without limit error
    const inviteRes = await request(app)
      .post(`/api/workspaces/${teamWsId}/invitations`)
      .set('Cookie', ownerCookie)
      .send({ email: 'extra_person@example.com', role: 'WORKSPACE_MEMBER' });

    expect(inviteRes.status).toBe(201);
  });
});
