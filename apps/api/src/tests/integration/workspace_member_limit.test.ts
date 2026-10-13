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

  const extraWorkspaceIds: string[] = [];
  const extraUserIds: string[] = [];

  async function createVerifiedUser(prefix: string) {
    const uData = {
      username: `${prefix}_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
      email: `${prefix}_${Date.now()}_${Math.floor(Math.random() * 10000)}@example.com`,
      password: 'Password123!Secure',
      fullName: `User ${prefix}`,
    };
    const reg = await request(app).post('/api/auth/register').send(uData);
    expect(reg.status).toBe(201);
    const uid = reg.body.data.user.id;
    extraUserIds.push(uid);
    await prisma.user.update({ where: { id: uid }, data: { isEmailVerified: true } });

    const loginRes = await request(app).post('/api/auth/login').send({
      identifier: uData.email,
      password: uData.password,
    });
    const c = loginRes.headers['set-cookie'];
    const cookie = Array.isArray(c) ? c[0].split(';')[0] : c.split(';')[0];
    return { id: uid, email: uData.email, cookie };
  }

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
    const allWsIds = [teamWsId, ...extraWorkspaceIds].filter(Boolean);
    if (allWsIds.length > 0) {
      await prisma.workspaceAuditLog.deleteMany({ where: { workspaceId: { in: allWsIds } } });
      await prisma.workspaceInvitation.deleteMany({ where: { workspaceId: { in: allWsIds } } });
      await prisma.workspaceMember.deleteMany({ where: { workspaceId: { in: allWsIds } } });
      await prisma.workspace.deleteMany({ where: { id: { in: allWsIds } } });
    }
    const userIds = [ownerId, adminId, candidateId, ...extraUserIds].filter(Boolean);
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

  // =========================================================================
  // Concurrency & Capacity Race-Condition Regression Tests
  // =========================================================================

  it('Concurrency: competing invitation requests for the last available seat do not exceed limit', async () => {
    // Create new workspace with maxMembers = 3
    const wsRes = await request(app)
      .post('/api/workspaces')
      .set('Cookie', ownerCookie)
      .send({ name: `Concurrent Invites WS ${Date.now()}` });
    expect(wsRes.status).toBe(201);
    const cWsId = wsRes.body.data.workspace.id;
    extraWorkspaceIds.push(cWsId);

    // Add admin as second active member (active = 2)
    await prisma.workspaceMember.create({
      data: {
        workspaceId: cWsId,
        userId: adminId,
        role: 'WORKSPACE_ADMIN',
        origin: 'DIRECT',
      },
    });

    // Set maxMembers = 3 (available seats = 1)
    const setLimRes = await request(app)
      .patch(`/api/workspaces/${cWsId}`)
      .set('Cookie', ownerCookie)
      .send({ maxMembers: 3 });
    expect(setLimRes.status).toBe(200);

    // Launch 3 concurrent invitation requests competing for the single available seat
    const emails = [
      `compete_cand_1_${Date.now()}@example.com`,
      `compete_cand_2_${Date.now()}@example.com`,
      `compete_cand_3_${Date.now()}@example.com`,
    ];

    const results = await Promise.all(
      emails.map((email) =>
        request(app)
          .post(`/api/workspaces/${cWsId}/invitations`)
          .set('Cookie', ownerCookie)
          .send({ email, role: 'WORKSPACE_MEMBER' })
      )
    );

    const successResponses = results.filter((r) => r.status === 201);
    const rejectedResponses = results.filter((r) => r.status === 400);

    // Exactly 1 request must succeed; 2 must be rejected
    expect(successResponses).toHaveLength(1);
    expect(rejectedResponses).toHaveLength(2);

    for (const r of rejectedResponses) {
      expect(r.body.message).toMatch(/workspace member limit reached.*limited to 3 members/i);
    }

    // Verify DB state: activeMembers (2) + pendingInvitations (1) = exactly 3
    const activeCount = await prisma.workspaceMember.count({ where: { workspaceId: cWsId } });
    const pendingCount = await prisma.workspaceInvitation.count({
      where: { workspaceId: cWsId, status: 'PENDING', expiresAt: { gt: new Date() } },
    });
    expect(activeCount).toBe(2);
    expect(pendingCount).toBe(1);
    expect(activeCount + pendingCount).toBe(3);
  });

  it('Concurrency: competing acceptance requests for the last available seat do not exceed active limit', async () => {
    // Create new workspace with maxMembers = 3
    const wsRes = await request(app)
      .post('/api/workspaces')
      .set('Cookie', ownerCookie)
      .send({ name: `Concurrent Accept WS ${Date.now()}` });
    expect(wsRes.status).toBe(201);
    const cWsId = wsRes.body.data.workspace.id;
    extraWorkspaceIds.push(cWsId);

    // Add admin as second active member (active = 2)
    await prisma.workspaceMember.create({
      data: {
        workspaceId: cWsId,
        userId: adminId,
        role: 'WORKSPACE_ADMIN',
        origin: 'DIRECT',
      },
    });

    // Set maxMembers = 3 (exactly 1 seat available for active members)
    await request(app)
      .patch(`/api/workspaces/${cWsId}`)
      .set('Cookie', ownerCookie)
      .send({ maxMembers: 3 });

    // Register User E and User F
    const userE = await createVerifiedUser('user_e');
    const userF = await createVerifiedUser('user_f');

    // Create 2 pending invitations in DB (e.g. issued when limit was higher or pre-existing)
    const invE = await prisma.workspaceInvitation.create({
      data: {
        workspaceId: cWsId,
        invitedEmail: userE.email,
        invitedUserId: userE.id,
        invitedById: ownerId,
        role: 'WORKSPACE_MEMBER',
        tokenHash: `tok_hash_e_${Date.now()}`,
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 86400000),
      },
    });

    const invF = await prisma.workspaceInvitation.create({
      data: {
        workspaceId: cWsId,
        invitedEmail: userF.email,
        invitedUserId: userF.id,
        invitedById: ownerId,
        role: 'WORKSPACE_MEMBER',
        tokenHash: `tok_hash_f_${Date.now()}`,
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 86400000),
      },
    });

    // Concurrently attempt acceptance of both invitations for the last available seat
    const [resE, resF] = await Promise.all([
      request(app).post(`/api/workspaces/invitations/${invE.id}/accept`).set('Cookie', userE.cookie),
      request(app).post(`/api/workspaces/invitations/${invF.id}/accept`).set('Cookie', userF.cookie),
    ]);

    const accepted = [resE, resF].filter((r) => r.status === 200);
    const rejected = [resE, resF].filter((r) => r.status === 400);

    expect(accepted).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    expect(accepted[0].body.message).toMatch(/workspace joined successfully/i);
    expect(rejected[0].body.message).toMatch(/workspace member limit reached.*limit of 3 active members/i);

    // Verify DB state: activeMembers count must NEVER exceed 3
    const finalActiveCount = await prisma.workspaceMember.count({ where: { workspaceId: cWsId } });
    expect(finalActiveCount).toBe(3);

    // Exactly one invitation accepted, one remains pending
    const acceptedInvCount = await prisma.workspaceInvitation.count({
      where: { workspaceId: cWsId, status: 'ACCEPTED' },
    });
    const pendingInvCount = await prisma.workspaceInvitation.count({
      where: { workspaceId: cWsId, status: 'PENDING' },
    });
    expect(acceptedInvCount).toBe(1);
    expect(pendingInvCount).toBe(1);
  });

  it('Concurrency: competing resends of expired invitations do not exceed capacity', async () => {
    // Create new workspace with maxMembers = 3
    const wsRes = await request(app)
      .post('/api/workspaces')
      .set('Cookie', ownerCookie)
      .send({ name: `Concurrent Resend WS ${Date.now()}` });
    expect(wsRes.status).toBe(201);
    const cWsId = wsRes.body.data.workspace.id;
    extraWorkspaceIds.push(cWsId);

    // Active members = 2 (owner + admin), maxMembers = 3 => capacity for 1 more
    await prisma.workspaceMember.create({
      data: {
        workspaceId: cWsId,
        userId: adminId,
        role: 'WORKSPACE_ADMIN',
        origin: 'DIRECT',
      },
    });
    await request(app)
      .patch(`/api/workspaces/${cWsId}`)
      .set('Cookie', ownerCookie)
      .send({ maxMembers: 3 });

    // Create 2 expired invitations
    const exp1 = await prisma.workspaceInvitation.create({
      data: {
        workspaceId: cWsId,
        invitedEmail: `expired_1_${Date.now()}@example.com`,
        invitedById: ownerId,
        role: 'WORKSPACE_MEMBER',
        tokenHash: `hash_exp_1_${Date.now()}`,
        status: 'EXPIRED',
        expiresAt: new Date(Date.now() - 3600000),
      },
    });

    const exp2 = await prisma.workspaceInvitation.create({
      data: {
        workspaceId: cWsId,
        invitedEmail: `expired_2_${Date.now()}@example.com`,
        invitedById: ownerId,
        role: 'WORKSPACE_MEMBER',
        tokenHash: `hash_exp_2_${Date.now()}`,
        status: 'EXPIRED',
        expiresAt: new Date(Date.now() - 3600000),
      },
    });

    // Concurrently resend both expired invitations
    const [resend1, resend2] = await Promise.all([
      request(app).post(`/api/workspaces/${cWsId}/invitations/${exp1.id}/resend`).set('Cookie', ownerCookie),
      request(app).post(`/api/workspaces/${cWsId}/invitations/${exp2.id}/resend`).set('Cookie', ownerCookie),
    ]);

    const resendSuccess = [resend1, resend2].filter((r) => r.status === 200);
    const resendRejected = [resend1, resend2].filter((r) => r.status === 400);

    expect(resendSuccess).toHaveLength(1);
    expect(resendRejected).toHaveLength(1);
    expect(resendRejected[0].body.message).toMatch(/workspace member limit reached/i);

    // Verify DB state: active + pending = exactly 3
    const activeCount = await prisma.workspaceMember.count({ where: { workspaceId: cWsId } });
    const pendingCount = await prisma.workspaceInvitation.count({
      where: { workspaceId: cWsId, status: 'PENDING', expiresAt: { gt: new Date() } },
    });
    expect(activeCount).toBe(2);
    expect(pendingCount).toBe(1);
    expect(activeCount + pendingCount).toBe(3);
  });

  it('Concurrency: competing limit reduction and invitation acceptance serialize safely', async () => {
    // Create new workspace with maxMembers = 3, active = 2, pending = 1
    const wsRes = await request(app)
      .post('/api/workspaces')
      .set('Cookie', ownerCookie)
      .send({ name: `Concurrent Limit/Accept WS ${Date.now()}` });
    expect(wsRes.status).toBe(201);
    const cWsId = wsRes.body.data.workspace.id;
    extraWorkspaceIds.push(cWsId);

    await prisma.workspaceMember.create({
      data: {
        workspaceId: cWsId,
        userId: adminId,
        role: 'WORKSPACE_ADMIN',
        origin: 'DIRECT',
      },
    });
    await request(app)
      .patch(`/api/workspaces/${cWsId}`)
      .set('Cookie', ownerCookie)
      .send({ maxMembers: 3 });

    const userG = await createVerifiedUser('user_g');
    const invG = await prisma.workspaceInvitation.create({
      data: {
        workspaceId: cWsId,
        invitedEmail: userG.email,
        invitedUserId: userG.id,
        invitedById: ownerId,
        role: 'WORKSPACE_MEMBER',
        tokenHash: `tok_hash_g_${Date.now()}`,
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 86400000),
      },
    });

    // Concurrently:
    // 1. Owner tries to reduce limit to 2 (current active members)
    // 2. User G tries to accept the invitation
    const [limitRes, acceptRes] = await Promise.all([
      request(app).patch(`/api/workspaces/${cWsId}`).set('Cookie', ownerCookie).send({ maxMembers: 2 }),
      request(app).post(`/api/workspaces/invitations/${invG.id}/accept`).set('Cookie', userG.cookie),
    ]);

    // Check consistency:
    // If accept succeeded (200), active became 3, so owner reduction to 2 must have failed (400)
    // If owner reduction to 2 succeeded (200), limit became 2, so accept must have failed (400)
    if (acceptRes.status === 200) {
      expect(limitRes.status).toBe(400);
      expect(limitRes.body.message).toMatch(/cannot set member limit to 2/i);
    } else {
      expect(acceptRes.status).toBe(400);
      expect(limitRes.status).toBe(200);
      expect(acceptRes.body.message).toMatch(/workspace member limit reached/i);
    }

    // Active members in DB must NEVER exceed configured maxMembers
    const wsInDb = await prisma.workspace.findUnique({ where: { id: cWsId } });
    const activeInDb = await prisma.workspaceMember.count({ where: { workspaceId: cWsId } });
    expect(activeInDb).toBeLessThanOrEqual(wsInDb!.maxMembers!);
  });

  it('Safe retry: duplicate concurrent acceptance for the same user is handled idempotently without duplicate membership', async () => {
    // Create new workspace with maxMembers = 5
    const wsRes = await request(app)
      .post('/api/workspaces')
      .set('Cookie', ownerCookie)
      .send({ name: `Duplicate Accept WS ${Date.now()}` });
    expect(wsRes.status).toBe(201);
    const cWsId = wsRes.body.data.workspace.id;
    extraWorkspaceIds.push(cWsId);

    const userH = await createVerifiedUser('user_h');
    const invH = await prisma.workspaceInvitation.create({
      data: {
        workspaceId: cWsId,
        invitedEmail: userH.email,
        invitedUserId: userH.id,
        invitedById: ownerId,
        role: 'WORKSPACE_MEMBER',
        tokenHash: `tok_hash_h_${Date.now()}`,
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 86400000),
      },
    });

    // Fire 2 concurrent accept calls for the same invitation with the same user cookie
    const [res1, res2] = await Promise.all([
      request(app).post(`/api/workspaces/invitations/${invH.id}/accept`).set('Cookie', userH.cookie),
      request(app).post(`/api/workspaces/invitations/${invH.id}/accept`).set('Cookie', userH.cookie),
    ]);

    // One succeeds with 200. The duplicate either returns 400 (already accepted) or 200 (already a member).
    const statuses = [res1.status, res2.status];
    expect(statuses).toContain(200);

    // Verify DB: User H has exactly ONE membership record
    const userHMemberships = await prisma.workspaceMember.findMany({
      where: { workspaceId: cWsId, userId: userH.id },
    });
    expect(userHMemberships).toHaveLength(1);
    expect(userHMemberships[0].role).toBe('WORKSPACE_MEMBER');
  });
});
