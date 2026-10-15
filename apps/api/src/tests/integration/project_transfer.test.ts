import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../../server.js';
import prisma from '../../prisma.js';

describe('Phase 4 — Workspace Project Transfer Integration & Security Tests', () => {
  const timestamp = Date.now();

  const userAData = {
    username: `pt_user_a_${timestamp}`,
    email: `pt_user_a_${timestamp}@example.com`,
    password: 'Password123!Secure',
    fullName: 'Owner A',
  };

  const userBData = {
    username: `pt_user_b_${timestamp}`,
    email: `pt_user_b_${timestamp}@example.com`,
    password: 'Password123!Secure',
    fullName: 'Owner B',
  };

  const userCData = {
    username: `pt_user_c_${timestamp}`,
    email: `pt_user_c_${timestamp}@example.com`,
    password: 'Password123!Secure',
    fullName: 'Member C',
  };

  const userEData = {
    username: `pt_user_e_${timestamp}`,
    email: `pt_user_e_${timestamp}@example.com`,
    password: 'Password123!Secure',
    fullName: 'External E',
  };

  let userAId: string;
  let userBId: string;
  let userCId: string;
  let userEId: string;

  let userACookie: string;
  let userBCookie: string;
  let userCCookie: string;
  let userECookie: string;

  let wsA1Id: string;
  let wsA2Id: string;
  let wsB1Id: string;
  let wsAPersonalId: string;
  let wsBPersonalId: string;

  let projectId1: string;
  let projectId2: string;
  let workItemId1: string;

  beforeAll(async () => {
    // 1. Register & login User A
    const resA = await request(app).post('/api/auth/register').send(userAData);
    expect(resA.status).toBe(201);
    userAId = resA.body.data.user.id;
    await prisma.user.update({ where: { id: userAId }, data: { isEmailVerified: true } });

    const loginA = await request(app).post('/api/auth/login').send({
      identifier: userAData.email,
      password: userAData.password,
    });
    userACookie = (loginA.headers['set-cookie'] as any)[0].split(';')[0];

    // 2. Register & login User B
    const resB = await request(app).post('/api/auth/register').send(userBData);
    expect(resB.status).toBe(201);
    userBId = resB.body.data.user.id;
    await prisma.user.update({ where: { id: userBId }, data: { isEmailVerified: true } });

    const loginB = await request(app).post('/api/auth/login').send({
      identifier: userBData.email,
      password: userBData.password,
    });
    userBCookie = (loginB.headers['set-cookie'] as any)[0].split(';')[0];

    // 3. Register & login User C (Project collaborator)
    const resC = await request(app).post('/api/auth/register').send(userCData);
    expect(resC.status).toBe(201);
    userCId = resC.body.data.user.id;
    await prisma.user.update({ where: { id: userCId }, data: { isEmailVerified: true } });

    const loginC = await request(app).post('/api/auth/login').send({
      identifier: userCData.email,
      password: userCData.password,
    });
    userCCookie = (loginC.headers['set-cookie'] as any)[0].split(';')[0];

    // 4. Register & login User E (Unrelated third party)
    const resE = await request(app).post('/api/auth/register').send(userEData);
    expect(resE.status).toBe(201);
    userEId = resE.body.data.user.id;
    await prisma.user.update({ where: { id: userEId }, data: { isEmailVerified: true } });

    const loginE = await request(app).post('/api/auth/login').send({
      identifier: userEData.email,
      password: userEData.password,
    });
    userECookie = (loginE.headers['set-cookie'] as any)[0].split(';')[0];

    // 5. Discover personal workspaces
    const pWsA = await prisma.workspace.findFirst({ where: { ownerId: userAId, isPersonal: true } });
    wsAPersonalId = pWsA!.id;
    const pWsB = await prisma.workspace.findFirst({ where: { ownerId: userBId, isPersonal: true } });
    wsBPersonalId = pWsB!.id;

    // 6. Create Team Workspace A1 and Team Workspace A2 (both owned by User A)
    const createWsA1 = await request(app)
      .post('/api/workspaces')
      .set('Cookie', userACookie)
      .send({ name: `Team A1 ${timestamp}` });
    expect(createWsA1.status).toBe(201);
    wsA1Id = createWsA1.body.data.workspace.id;

    const createWsA2 = await request(app)
      .post('/api/workspaces')
      .set('Cookie', userACookie)
      .send({ name: `Team A2 ${timestamp}` });
    expect(createWsA2.status).toBe(201);
    wsA2Id = createWsA2.body.data.workspace.id;

    // 7. Create Team Workspace B1 (owned by User B)
    const createWsB1 = await request(app)
      .post('/api/workspaces')
      .set('Cookie', userBCookie)
      .send({ name: `Team B1 ${timestamp}` });
    expect(createWsB1.status).toBe(201);
    wsB1Id = createWsB1.body.data.workspace.id;

    // 8. Add User C as Workspace Member in Workspace A1 (DIRECT)
    await prisma.workspaceMember.create({
      data: {
        workspaceId: wsA1Id,
        userId: userCId,
        role: 'WORKSPACE_MEMBER',
        origin: 'DIRECT',
      },
    });

    // 9. Create Project 1 in Workspace A1
    const createP1 = await request(app)
      .post('/api/projects')
      .set('Cookie', userACookie)
      .set('X-Workspace-Id', wsA1Id)
      .send({
        name: `Project One ${timestamp}`,
        description: 'First project for testing transfer',
      });
    expect(createP1.status).toBe(201);
    projectId1 = createP1.body.data.project.id;

    // Add User C to Project 1 as member
    await prisma.projectMember.create({
      data: {
        projectId: projectId1,
        userId: userCId,
        role: 'PROJECT_MEMBER',
      },
    });

    // Create a WorkItem in Project 1 assigned to User C
    const wi = await prisma.workItem.create({
      data: {
        projectId: projectId1,
        title: 'Task assigned to User C',
        type: 'TASK',
        status: 'IN_PROGRESS',
        assignedToId: userCId,
        createdById: userAId,
      },
    });
    workItemId1 = wi.id;

    // Create Note in Project 1
    await prisma.note.create({
      data: {
        projectId: projectId1,
        title: 'Project 1 Architecture Note',
        content: 'Preserved documentation',
        createdById: userAId,
      },
    });

    // Create CalendarEvent in Project 1
    await prisma.calendarEvent.create({
      data: {
        projectId: projectId1,
        title: 'Sprint Planning',
        startAt: new Date(),
        endAt: new Date(Date.now() + 3600000),
        createdById: userAId,
      },
    });

    // 10. Create Project 2 in Workspace A1 for cross-owner testing
    const createP2 = await request(app)
      .post('/api/projects')
      .set('Cookie', userACookie)
      .set('X-Workspace-Id', wsA1Id)
      .send({
        name: `Project Two ${timestamp}`,
        description: 'Second project for cross-owner transfer testing',
      });
    expect(createP2.status).toBe(201);
    projectId2 = createP2.body.data.project.id;
  });

  afterAll(async () => {
    const testUserIds = [userAId, userBId, userCId, userEId].filter(Boolean);
    if (testUserIds.length > 0) {
      await prisma.projectTransfer.deleteMany({
        where: { OR: [{ initiatedById: { in: testUserIds } }, { reviewedById: { in: testUserIds } }] },
      }).catch(() => {});
      await prisma.calendarEvent.deleteMany({ where: { createdById: { in: testUserIds } } }).catch(() => {});
      await prisma.note.deleteMany({ where: { createdById: { in: testUserIds } } }).catch(() => {});
      await prisma.workItem.deleteMany({ where: { createdById: { in: testUserIds } } }).catch(() => {});
      await prisma.projectMember.deleteMany({ where: { userId: { in: testUserIds } } }).catch(() => {});
      await prisma.project.deleteMany({ where: { createdById: { in: testUserIds } } }).catch(() => {});
      await prisma.workspaceMember.deleteMany({ where: { userId: { in: testUserIds } } }).catch(() => {});
      await prisma.workspace.deleteMany({ where: { ownerId: { in: testUserIds } } }).catch(() => {});
      await prisma.session.deleteMany({ where: { userId: { in: testUserIds } } }).catch(() => {});
      await prisma.user.deleteMany({ where: { id: { in: testUserIds } } }).catch(() => {});
    }
  });

  describe('1. Transfer Eligibility & Policy Enforcement', () => {
    it('returns candidate destination workspaces for workspace owner', async () => {
      const res = await request(app)
        .get(`/api/projects/${projectId1}/transfer-eligibility`)
        .set('Cookie', userACookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isEligible).toBe(true);
      expect(res.body.data.sourceWorkspace.id).toBe(wsA1Id);

      // Candidate destinations should contain Workspace A2, but NOT current workspace A1 and NOT personal workspace
      const destIds = res.body.data.eligibleDestinations.map((d: any) => d.id);
      expect(destIds).toContain(wsA2Id);
      expect(destIds).not.toContain(wsA1Id);
      expect(destIds).not.toContain(wsAPersonalId);
    });

    it('rejects eligibility check by regular project member without workspace admin rights (403)', async () => {
      const res = await request(app)
        .get(`/api/projects/${projectId1}/transfer-eligibility`)
        .set('Cookie', userCCookie);

      expect(res.status).toBe(403);
    });

    it('rejects eligibility check by unauthenticated caller (401)', async () => {
      const res = await request(app).get(`/api/projects/${projectId1}/transfer-eligibility`);
      expect(res.status).toBe(401);
    });

    it('rejects transfer into personal workspaces with 400', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId1}/transfer`)
        .set('Cookie', userACookie)
        .send({ destinationWorkspaceId: wsAPersonalId });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/personal workspace/i);
    });

    it('rejects transfer to the current workspace with 400', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId1}/transfer`)
        .set('Cookie', userACookie)
        .send({ destinationWorkspaceId: wsA1Id });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/already belongs/i);
    });
  });

  describe('2. Same-Owner Transfer (Immediate Atomic Execution)', () => {
    it('executes transfer immediately when both workspaces are owned by the same user', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId1}/transfer`)
        .set('Cookie', userACookie)
        .send({ destinationWorkspaceId: wsA2Id });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.executedImmediately).toBe(true);
      expect(res.body.transfer.status).toBe('COMPLETED');

      // Verify Project workspace moved in DB
      const updatedProject = await prisma.project.findUnique({
        where: { id: projectId1 },
      });
      expect(updatedProject?.workspaceId).toBe(wsA2Id);
    });

    it('preserves all project tasks, notes, calendar events, and creator attribution', async () => {
      const [workItems, notes, calendarEvents] = await Promise.all([
        prisma.workItem.findMany({ where: { projectId: projectId1 } }),
        prisma.note.findMany({ where: { projectId: projectId1 } }),
        prisma.calendarEvent.findMany({ where: { projectId: projectId1 } }),
      ]);

      expect(workItems.length).toBeGreaterThan(0);
      expect(notes.length).toBeGreaterThan(0);
      expect(calendarEvents.length).toBeGreaterThan(0);

      // Author attribution preserved
      expect(workItems[0].createdById).toBe(userAId);
      expect(notes[0].createdById).toBe(userAId);
      expect(calendarEvents[0].createdById).toBe(userAId);
    });

    it('evicts project members not belonging to destination workspace and unassigns active work items', async () => {
      // User C was NOT a member of Workspace A2
      const memberInProject = await prisma.projectMember.findFirst({
        where: { projectId: projectId1, userId: userCId },
      });
      expect(memberInProject).toBeNull(); // Evicted!

      // User C's assigned work item was safely unassigned
      const updatedWorkItem = await prisma.workItem.findUnique({
        where: { id: workItemId1 },
      });
      expect(updatedWorkItem?.assignedToId).toBeNull();

      // Original creator/history intact
      expect(updatedWorkItem?.createdById).toBe(userAId);
    });

    it('records transfer completion history with member snapshot', async () => {
      const historyRes = await request(app)
        .get(`/api/projects/${projectId1}/transfers`)
        .set('Cookie', userACookie);

      expect(historyRes.status).toBe(200);
      expect(historyRes.body.data.transfers.length).toBe(1);

      const record = historyRes.body.data.transfers[0];
      expect(record.status).toBe('COMPLETED');
      expect(record.sourceWorkspaceId).toBe(wsA1Id);
      expect(record.destinationWorkspaceId).toBe(wsA2Id);
      expect(record.memberSnapshot).toBeDefined();
    });
  });

  describe('3. Cross-Owner Transfer Request, Rejection, and Approval Workflow', () => {
    let crossOwnerTransferId: string;

    it('creates pending transfer request when destination is owned by a different user', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId2}/transfer`)
        .set('Cookie', userACookie)
        .send({ destinationWorkspaceId: wsB1Id });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.executedImmediately).toBe(false);
      expect(res.body.transfer.status).toBe('PENDING');

      crossOwnerTransferId = res.body.transfer.id;

      // Project remains in Workspace A1 while request is pending
      const p2 = await prisma.project.findUnique({ where: { id: projectId2 } });
      expect(p2?.workspaceId).toBe(wsA1Id);
    });

    it('prevents duplicate pending transfer requests for the same project (409 Conflict)', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId2}/transfer`)
        .set('Cookie', userACookie)
        .send({ destinationWorkspaceId: wsB1Id });

      expect(res.status).toBe(409);
      expect(res.body.message).toMatch(/pending transfer request already exists/i);
    });

    it('prevents self-approval on cross-owner transfers (403 Forbidden)', async () => {
      const res = await request(app)
        .post(`/api/transfers/${crossOwnerTransferId}/approve`)
        .set('Cookie', userACookie); // Initiator User A trying to approve

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/privileges.*required/i);
    });

    it('allows destination owner to view pending incoming transfer requests', async () => {
      const res = await request(app)
        .get(`/api/workspaces/${wsB1Id}/transfers/pending`)
        .set('Cookie', userBCookie);

      expect(res.status).toBe(200);
      expect(res.body.data.incoming.length).toBe(1);
      expect(res.body.data.incoming[0].id).toBe(crossOwnerTransferId);
    });

    it('allows initiator to view outgoing pending transfer requests', async () => {
      const res = await request(app)
        .get(`/api/workspaces/${wsA1Id}/transfers/pending`)
        .set('Cookie', userACookie);

      expect(res.status).toBe(200);
      expect(res.body.data.outgoing.length).toBe(1);
      expect(res.body.data.outgoing[0].id).toBe(crossOwnerTransferId);
    });

    it('allows destination owner to reject transfer request with reason', async () => {
      const res = await request(app)
        .post(`/api/transfers/${crossOwnerTransferId}/reject`)
        .set('Cookie', userBCookie)
        .send({ rejectionReason: 'Not suitable for Workspace B1' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.transfer.status).toBe('REJECTED');

      // Project still in original workspace
      const p2 = await prisma.project.findUnique({ where: { id: projectId2 } });
      expect(p2?.workspaceId).toBe(wsA1Id);
    });

    it('rejects attempt to approve an already-rejected transfer request (409 Conflict)', async () => {
      const res = await request(app)
        .post(`/api/transfers/${crossOwnerTransferId}/approve`)
        .set('Cookie', userBCookie);

      expect(res.status).toBe(409);
      expect(res.body.message).toMatch(/not in pending status/i);
    });

    it('allows creating a new request and approving it to complete cross-owner transfer', async () => {
      // Create new transfer request
      const createRes = await request(app)
        .post(`/api/projects/${projectId2}/transfer`)
        .set('Cookie', userACookie)
        .send({ destinationWorkspaceId: wsB1Id });

      expect(createRes.status).toBe(201);
      const newTransferId = createRes.body.transfer.id;

      // User B approves
      const approveRes = await request(app)
        .post(`/api/transfers/${newTransferId}/approve`)
        .set('Cookie', userBCookie);

      expect(approveRes.status).toBe(200);
      expect(approveRes.body.success).toBe(true);
      expect(approveRes.body.transfer.status).toBe('COMPLETED');

      // Verify Project 2 is now in Workspace B1
      const p2 = await prisma.project.findUnique({ where: { id: projectId2 } });
      expect(p2?.workspaceId).toBe(wsB1Id);
    });
  });

  describe('4. Transfer Cancellation & Boundary Security', () => {
    let cancelTransferId: string;

    beforeAll(async () => {
      // Move Project 2 back or create a request to cancel
      // Create another project for cancellation testing
      const createP3 = await request(app)
        .post('/api/projects')
        .set('Cookie', userBCookie)
        .set('X-Workspace-Id', wsB1Id)
        .send({
          name: `Project Three ${timestamp}`,
          description: 'Testing transfer cancellation',
        });

      expect(createP3.status).toBe(201);
      const p3Id = createP3.body.data.project.id;

      const reqRes = await request(app)
        .post(`/api/projects/${p3Id}/transfer`)
        .set('Cookie', userBCookie)
        .send({ destinationWorkspaceId: wsA1Id });

      cancelTransferId = reqRes.body.transfer.id;
    });

    it('allows initiator to cancel eligible pending transfer request', async () => {
      const res = await request(app)
        .post(`/api/transfers/${cancelTransferId}/cancel`)
        .set('Cookie', userBCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.transfer.status).toBe('CANCELLED');
    });

    it('blocks unauthorized actors from viewing transfer details (403 Forbidden)', async () => {
      // User E has no membership in source or destination workspace
      const res = await request(app)
        .get(`/api/transfers/${cancelTransferId}`)
        .set('Cookie', userECookie);

      expect(res.status).toBe(403);
    });

    it('allows authorized workspace members to view transfer details within workspace boundary', async () => {
      const res = await request(app)
        .get(`/api/transfers/${cancelTransferId}`)
        .set('Cookie', userBCookie);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(cancelTransferId);
    });
  });

  describe('5. Phase 4 Remediation Security & Concurrency Tests', () => {
    let remCreatorId: string;
    let remCreatorCookie: string;
    let remAdminId: string;
    let remAdminCookie: string;
    let remDestWsId: string;
    let remSourceWsId: string;
    let remProjectId: string;
    let remWorkItemId: string;
    let remNoteId: string;
    let remFolderId: string;
    let remCalendarEventId: string;
    let remTransferId: string;

    beforeAll(async () => {
      const remTs = Date.now() + 2000;
      // 1. Register & verify creator
      const creatorReg = await request(app).post('/api/auth/register').send({
        username: `rem_creator_${remTs}`,
        email: `rem_creator_${remTs}@example.com`,
        password: 'Password123!Secure',
        fullName: 'Remediation Creator',
      });
      remCreatorId = creatorReg.body.data.user.id;
      await prisma.user.update({ where: { id: remCreatorId }, data: { isEmailVerified: true } });

      const creatorLogin = await request(app).post('/api/auth/login').send({
        identifier: `rem_creator_${remTs}@example.com`,
        password: 'Password123!Secure',
      });
      remCreatorCookie = (creatorLogin.headers['set-cookie'] as any)[0].split(';')[0];

      // 2. Register & verify destination Admin
      const adminReg = await request(app).post('/api/auth/register').send({
        username: `rem_admin_${remTs}`,
        email: `rem_admin_${remTs}@example.com`,
        password: 'Password123!Secure',
        fullName: 'Remediation Admin',
      });
      remAdminId = adminReg.body.data.user.id;
      await prisma.user.update({ where: { id: remAdminId }, data: { isEmailVerified: true } });

      const adminLogin = await request(app).post('/api/auth/login').send({
        identifier: `rem_admin_${remTs}@example.com`,
        password: 'Password123!Secure',
      });
      remAdminCookie = (adminLogin.headers['set-cookie'] as any)[0].split(';')[0];

      // 3. Create Source Workspace (owned by remCreator)
      const srcWs = await request(app)
        .post('/api/workspaces')
        .set('Cookie', remCreatorCookie)
        .send({ name: `Rem Source Workspace ${remTs}` });
      expect(srcWs.status).toBe(201);
      remSourceWsId = srcWs.body.data.workspace.id;

      // 4. Create Destination Workspace (owned by User B)
      const dstWs = await request(app)
        .post('/api/workspaces')
        .set('Cookie', userBCookie)
        .send({ name: `Rem Dest Workspace ${remTs}` });
      expect(dstWs.status).toBe(201);
      remDestWsId = dstWs.body.data.workspace.id;

      // Add remAdmin as WORKSPACE_ADMIN in remDestWs
      await prisma.workspaceMember.create({
        data: {
          workspaceId: remDestWsId,
          userId: remAdminId,
          role: 'WORKSPACE_ADMIN',
          origin: 'DIRECT',
        },
      });

      // 5. Creator creates Project in Source Workspace
      const projRes = await request(app)
        .post('/api/projects')
        .set('Cookie', remCreatorCookie)
        .set('X-Workspace-Id', remSourceWsId)
        .send({
          name: `Rem Project ${remTs}`,
          description: 'Project to test creator eviction and remediation',
        });
      expect(projRes.status).toBe(201);
      remProjectId = projRes.body.data.project.id;

      // Add User C to this project as PROJECT_ADMIN
      await prisma.workspaceMember.create({
        data: {
          workspaceId: remSourceWsId,
          userId: userCId,
          role: 'WORKSPACE_MEMBER',
          origin: 'DIRECT',
        },
      });
      await prisma.projectMember.create({
        data: {
          projectId: remProjectId,
          userId: userCId,
          role: 'PROJECT_ADMIN',
        },
      });

      // Creator creates Work Item, Note, Folder, Calendar Event
      const wi = await prisma.workItem.create({
        data: {
          projectId: remProjectId,
          title: 'Rem Work Item',
          type: 'TASK',
          status: 'TODO',
          createdById: remCreatorId,
          assignedToId: remCreatorId,
        },
      });
      remWorkItemId = wi.id;

      const note = await prisma.note.create({
        data: {
          projectId: remProjectId,
          title: 'Rem Confidential Architecture Note',
          content: 'Confidential project note',
          visibility: 'TEAM',
          createdById: remCreatorId,
        },
      });
      remNoteId = note.id;

      const folder = await prisma.fileFolder.create({
        data: {
          projectId: remProjectId,
          name: 'Rem Project Folder',
          createdById: remCreatorId,
        },
      });
      remFolderId = folder.id;

      const event = await prisma.calendarEvent.create({
        data: {
          projectId: remProjectId,
          title: 'Rem Secret Planning Event',
          startAt: new Date(),
          endAt: new Date(Date.now() + 3600000),
          createdById: remCreatorId,
        },
      });
      remCalendarEventId = event.id;
    });

    afterAll(async () => {
      const uids = [remCreatorId, remAdminId].filter(Boolean);
      if (uids.length > 0) {
        await prisma.projectTransfer.deleteMany({
          where: { OR: [{ initiatedById: { in: uids } }, { reviewedById: { in: uids } }] },
        }).catch(() => {});
        await prisma.calendarEvent.deleteMany({ where: { createdById: { in: uids } } }).catch(() => {});
        await prisma.note.deleteMany({ where: { createdById: { in: uids } } }).catch(() => {});
        await prisma.workItem.deleteMany({ where: { createdById: { in: uids } } }).catch(() => {});
        await prisma.projectMember.deleteMany({ where: { userId: { in: uids } } }).catch(() => {});
        await prisma.project.deleteMany({ where: { createdById: { in: uids } } }).catch(() => {});
        await prisma.workspaceMember.deleteMany({ where: { userId: { in: uids } } }).catch(() => {});
        await prisma.workspace.deleteMany({ where: { ownerId: { in: uids } } }).catch(() => {});
        await prisma.session.deleteMany({ where: { userId: { in: uids } } }).catch(() => {});
        await prisma.user.deleteMany({ where: { id: { in: uids } } }).catch(() => {});
      }
    });

    it('denies destination Admin approval when canCreateProjects is disabled (403)', async () => {
      // Ensure destination workspace has canCreateProjects = false
      await prisma.workspace.update({
        where: { id: remDestWsId },
        data: {
          adminPermissions: {
            canCreateProjects: false,
            canInviteMembers: true,
            canRemoveMembers: false,
            canManageRoles: false,
          },
        },
      });

      // Request transfer from remSourceWsId to remDestWsId
      const reqRes = await request(app)
        .post(`/api/projects/${remProjectId}/transfer`)
        .set('Cookie', remCreatorCookie)
        .send({ destinationWorkspaceId: remDestWsId });

      expect(reqRes.status).toBe(201);
      remTransferId = reqRes.body.transfer.id;

      // remAdmin attempts to approve -> 403 Forbidden
      const approveRes = await request(app)
        .post(`/api/transfers/${remTransferId}/approve`)
        .set('Cookie', remAdminCookie);

      expect(approveRes.status).toBe(403);
      expect(approveRes.body.message).toContain('canCreateProjects');
    });

    it('allows destination Admin approval once canCreateProjects is enabled (200)', async () => {
      // Owner enables canCreateProjects on destination workspace
      await prisma.workspace.update({
        where: { id: remDestWsId },
        data: {
          adminPermissions: {
            canCreateProjects: true,
            canInviteMembers: true,
            canRemoveMembers: false,
            canManageRoles: false,
          },
        },
      });

      // remAdmin approves now -> 200 OK
      const approveRes = await request(app)
        .post(`/api/transfers/${remTransferId}/approve`)
        .set('Cookie', remAdminCookie);

      expect(approveRes.status).toBe(200);
      expect(approveRes.body.success).toBe(true);
      expect(approveRes.body.transfer.status).toBe('COMPLETED');

      // Verify project is now in remDestWsId
      const proj = await prisma.project.findUnique({ where: { id: remProjectId } });
      expect(proj?.workspaceId).toBe(remDestWsId);
    });

    it('evicts creator from project membership while preserving historical attribution', async () => {
      // Creator is no longer a project member
      const member = await prisma.projectMember.findUnique({
        where: {
          projectId_userId: {
            projectId: remProjectId,
            userId: remCreatorId,
          },
        },
      });
      expect(member).toBeNull();

      // Historical attribution preserved on project, workItem, note, and calendarEvent
      const proj = await prisma.project.findUnique({ where: { id: remProjectId } });
      expect(proj?.createdById).toBe(remCreatorId);

      const wi = await prisma.workItem.findUnique({ where: { id: remWorkItemId } });
      expect(wi?.createdById).toBe(remCreatorId);
      expect(wi?.assignedToId).toBeNull(); // Unassigned on eviction

      const n = await prisma.note.findUnique({ where: { id: remNoteId } });
      expect(n?.createdById).toBe(remCreatorId);

      const ev = await prisma.calendarEvent.findUnique({ where: { id: remCalendarEventId } });
      expect(ev?.createdById).toBe(remCreatorId);
    });

    it('denies evicted creator access to work items, notes, folders, calendar events, search, and members (404/403)', async () => {
      // 1. Project details
      const pRes = await request(app)
        .get(`/api/projects/${remProjectId}`)
        .set('Cookie', remCreatorCookie);
      expect([403, 404]).toContain(pRes.status);

      // 2. Work items
      const wRes = await request(app)
        .get(`/api/projects/${remProjectId}/work`)
        .set('Cookie', remCreatorCookie);
      expect([403, 404]).toContain(wRes.status);

      // 3. Notes
      const nRes = await request(app)
        .get(`/api/projects/${remProjectId}/notes`)
        .set('Cookie', remCreatorCookie);
      expect([403, 404]).toContain(nRes.status);

      // 4. Folders
      const fRes = await request(app)
        .get(`/api/projects/${remProjectId}/folders`)
        .set('Cookie', remCreatorCookie);
      expect([403, 404]).toContain(fRes.status);

      // 5. Calendar events
      const cRes = await request(app)
        .get(`/api/projects/${remProjectId}/calendar/events`)
        .set('Cookie', remCreatorCookie);
      expect([403, 404]).toContain(cRes.status);

      // 6. Members
      const mRes = await request(app)
        .get(`/api/projects/${remProjectId}/members`)
        .set('Cookie', remCreatorCookie);
      expect([403, 404]).toContain(mRes.status);

      // 7. Global search does not return transferred project to evicted creator
      const sRes = await request(app)
        .get('/api/search?q=Confidential')
        .set('Cookie', remCreatorCookie);
      expect(sRes.status).toBe(200);
      const returnedNotes = sRes.body.data.notes || [];
      expect(returnedNotes.find((note: any) => note.id === remNoteId)).toBeUndefined();
    });

    it('allows destination workspace Owner and Admin full access without explicit ProjectMember record', async () => {
      // Destination Owner (User B)
      const pRes = await request(app)
        .get(`/api/projects/${remProjectId}`)
        .set('Cookie', userBCookie)
        .set('X-Workspace-Id', remDestWsId);
      expect(pRes.status).toBe(200);
      expect(pRes.body.data.project.id).toBe(remProjectId);

      const wRes = await request(app)
        .get(`/api/projects/${remProjectId}/work`)
        .set('Cookie', userBCookie)
        .set('X-Workspace-Id', remDestWsId);
      expect(wRes.status).toBe(200);

      // Destination Admin (remAdmin)
      const adminProjRes = await request(app)
        .get(`/api/projects/${remProjectId}`)
        .set('Cookie', remAdminCookie)
        .set('X-Workspace-Id', remDestWsId);
      expect(adminProjRes.status).toBe(200);
    });

    it('cancels pending project invitations upon transfer and prevents subsequent acceptance (400)', async () => {
      // 1. Create a project in remDestWsId
      const pRes = await request(app)
        .post('/api/projects')
        .set('Cookie', userBCookie)
        .set('X-Workspace-Id', remDestWsId)
        .send({ name: 'Project With Pending Invite', description: 'Testing invite cancellation' });
      const pId = pRes.body.data.project.id;

      // Ensure userA is a member of remDestWsId so project invitation is valid
      await prisma.workspaceMember.create({
        data: {
          workspaceId: remDestWsId,
          userId: userAId,
          role: 'WORKSPACE_MEMBER',
          origin: 'DIRECT',
        },
      });

      // 2. Create pending invitation for this project
      const invRes = await request(app)
        .post(`/api/projects/${pId}/invitations`)
        .set('Cookie', userBCookie)
        .send({ email: userAData.email, role: 'PROJECT_MEMBER' });
      expect(invRes.status).toBe(201);
      const invId = invRes.body.data.invitation.id;

      // 3. Transfer the project to wsA1Id (owned by User A)
      const trRes = await request(app)
        .post(`/api/projects/${pId}/transfer`)
        .set('Cookie', userBCookie)
        .send({ destinationWorkspaceId: wsA1Id });
      expect(trRes.status).toBe(201);
      const tId = trRes.body.transfer.id;

      // User A approves transfer
      await request(app)
        .post(`/api/transfers/${tId}/approve`)
        .set('Cookie', userACookie);

      // 4. Verify invitation in database is now CANCELLED
      const invInDb = await prisma.invitation.findUnique({ where: { id: invId } });
      expect(invInDb?.status).toBe('CANCELLED');
      expect(invInDb?.cancelledAt).toBeDefined();

      // 5. Attempting to accept cancelled invitation is rejected with 400
      const acceptRes = await request(app)
        .post(`/api/invitations/${invId}/accept`)
        .set('Cookie', userACookie);
      expect(acceptRes.status).toBe(400);
      expect(acceptRes.body.message).toContain('cancelled');
    });

    it('enforces database partial unique index on concurrent pending-transfer creation (409 Conflict)', async () => {
      // Create project in wsA1Id
      const pRes = await request(app)
        .post('/api/projects')
        .set('Cookie', userACookie)
        .set('X-Workspace-Id', wsA1Id)
        .send({ name: `Concurrent Pending Proj ${Date.now()}`, description: 'Testing partial unique index' });
      const pId = pRes.body.data.project.id;

      // Concurrently create two pending transfer requests targeting different destinations
      const [res1, res2] = await Promise.all([
        request(app)
          .post(`/api/projects/${pId}/transfer`)
          .set('Cookie', userACookie)
          .send({ destinationWorkspaceId: remDestWsId }),
        request(app)
          .post(`/api/projects/${pId}/transfer`)
          .set('Cookie', userACookie)
          .send({ destinationWorkspaceId: remSourceWsId }),
      ]);

      const statuses = [res1.status, res2.status].sort();
      // Exactly one succeeds (201), and the other fails with 409 Conflict
      expect(statuses).toEqual([201, 409]);

      // Database check: exactly 1 PENDING transfer exists for this project
      const count = await prisma.projectTransfer.count({
        where: { projectId: pId, status: 'PENDING' },
      });
      expect(count).toBe(1);
    });

    it('ensures concurrency-safe approval preventing duplicate project transfer (409 Conflict)', async () => {
      // Create project in wsA1Id
      const pRes = await request(app)
        .post('/api/projects')
        .set('Cookie', userACookie)
        .set('X-Workspace-Id', wsA1Id)
        .send({ name: `Concurrent Approval Proj ${Date.now()}`, description: 'Testing concurrent approval lock' });
      const pId = pRes.body.data.project.id;

      // Initiate transfer to remDestWsId
      const trRes = await request(app)
        .post(`/api/projects/${pId}/transfer`)
        .set('Cookie', userACookie)
        .send({ destinationWorkspaceId: remDestWsId });
      expect(trRes.status).toBe(201);
      const tId = trRes.body.transfer.id;

      // Concurrent approval calls for the same transfer request
      const [app1, app2] = await Promise.all([
        request(app)
          .post(`/api/transfers/${tId}/approve`)
          .set('Cookie', userBCookie),
        request(app)
          .post(`/api/transfers/${tId}/approve`)
          .set('Cookie', userBCookie),
      ]);

      const statuses = [app1.status, app2.status].sort();
      expect(statuses).toEqual([200, 409]);

      // Project belongs to remDestWsId and transfer is COMPLETED
      const proj = await prisma.project.findUnique({ where: { id: pId } });
      expect(proj?.workspaceId).toBe(remDestWsId);

      const transfer = await prisma.projectTransfer.findUnique({ where: { id: tId } });
      expect(transfer?.status).toBe('COMPLETED');
    });

    it('restores historical project roles when evicted member accepts workspace invitation', async () => {
      // In remProjectId, User C was a PROJECT_ADMIN and was evicted during the transfer into remDestWsId
      const memberBefore = await prisma.projectMember.findUnique({
        where: {
          projectId_userId: {
            projectId: remProjectId,
            userId: userCId,
          },
        },
      });
      expect(memberBefore).toBeNull(); // Evicted

      // User B (Owner of remDestWsId) invites User C to remDestWsId
      const invRes = await request(app)
        .post(`/api/workspaces/${remDestWsId}/invitations`)
        .set('Cookie', userBCookie)
        .send({ email: userCData.email, role: 'WORKSPACE_MEMBER' });
      expect(invRes.status).toBe(201);
      const invitationId = invRes.body.data.invitation.id;

      // User C accepts the workspace invitation
      const acceptRes = await request(app)
        .post(`/api/workspaces/invitations/${invitationId}/accept`)
        .set('Cookie', userCCookie);
      expect(acceptRes.status).toBe(200);

      // Verify User C's project role in remProjectId is automatically restored as PROJECT_ADMIN!
      const memberAfter = await prisma.projectMember.findUnique({
        where: {
          projectId_userId: {
            projectId: remProjectId,
            userId: userCId,
          },
        },
      });
      expect(memberAfter).not.toBeNull();
      expect(memberAfter?.role).toBe('PROJECT_ADMIN');

      // Verify transfer snapshot has restoredAt recorded
      const transfer = await prisma.projectTransfer.findUnique({ where: { id: remTransferId } });
      const snapshot = transfer?.memberSnapshot as any[];
      const userCEntry = snapshot.find((m) => m.userId === userCId);
      expect(userCEntry.restoredAt).toBeDefined();
    });

    it('prevents stale role restoration after an explicit subsequent removal', async () => {
      // 1. Project Admin removes User C from remProjectId
      const member = await prisma.projectMember.findUnique({
        where: {
          projectId_userId: {
            projectId: remProjectId,
            userId: userCId,
          },
        },
      });
      expect(member).not.toBeNull();

      const delRes = await request(app)
        .delete(`/api/projects/${remProjectId}/members/${member!.id}`)
        .set('Cookie', userBCookie);
      expect(delRes.status).toBe(200);

      // 2. User C leaves workspace remDestWsId
      const wsMember = await prisma.workspaceMember.findUnique({
        where: {
          workspaceId_userId: {
            workspaceId: remDestWsId,
            userId: userCId,
          },
        },
      });
      await prisma.workspaceMember.delete({ where: { id: wsMember!.id } });

      // 3. User C is re-invited and re-joins remDestWsId
      const reInvRes = await request(app)
        .post(`/api/workspaces/${remDestWsId}/invitations`)
        .set('Cookie', userBCookie)
        .send({ email: userCData.email, role: 'WORKSPACE_MEMBER' });
      expect(reInvRes.status).toBe(201);
      const reInvId = reInvRes.body.data.invitation.id;

      const reAcceptRes = await request(app)
        .post(`/api/workspaces/invitations/${reInvId}/accept`)
        .set('Cookie', userCCookie);
      expect(reAcceptRes.status).toBe(200);

      // 4. Verify User C is NOT restored to remProjectId because restoredAt was already recorded!
      const memberFinal = await prisma.projectMember.findUnique({
        where: {
          projectId_userId: {
            projectId: remProjectId,
            userId: userCId,
          },
        },
      });
      expect(memberFinal).toBeNull();
    });
  });
});
