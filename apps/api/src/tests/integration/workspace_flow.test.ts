import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../../server.js';
import prisma from '../../prisma.js';
import { ensurePersonalWorkspace } from '../../services/auth.service.js';

describe('Multi-Workspace Flow, Scoping, and Isolation Integration Tests', () => {
  const timestamp = Date.now();
  const userAData = {
    username: `ws_user_a_${timestamp}`,
    email: `ws_user_a_${timestamp}@example.com`,
    password: 'Password123!Secure',
    fullName: 'Workspace User A',
  };

  const userBData = {
    username: `ws_user_b_${timestamp}`,
    email: `ws_user_b_${timestamp}@example.com`,
    password: 'Password123!Secure',
    fullName: 'Workspace User B',
  };

  let userAId: string;
  let userBId: string;
  let userACookie: string;
  let userBCookie: string;

  let userAPersonalWsId: string;
  let userBPersonalWsId: string;
  let teamWsId: string;

  let projectInTeamWsId: string;
  let projectInPersonalWsId: string;

  beforeAll(async () => {
    // 1. Register User A
    const resA = await request(app).post('/api/auth/register').send(userAData);
    expect(resA.status).toBe(201);
    userAId = resA.body.data.user.id;

    await prisma.user.update({
      where: { id: userAId },
      data: { isEmailVerified: true },
    });

    const loginA = await request(app).post('/api/auth/login').send({
      identifier: userAData.email,
      password: userAData.password,
    });
    const cookiesA = loginA.headers['set-cookie'];
    userACookie = Array.isArray(cookiesA) ? cookiesA[0].split(';')[0] : cookiesA.split(';')[0];

    // 2. Register User B
    const resB = await request(app).post('/api/auth/register').send(userBData);
    expect(resB.status).toBe(201);
    userBId = resB.body.data.user.id;

    await prisma.user.update({
      where: { id: userBId },
      data: { isEmailVerified: true },
    });

    const loginB = await request(app).post('/api/auth/login').send({
      identifier: userBData.email,
      password: userBData.password,
    });
    const cookiesB = loginB.headers['set-cookie'];
    userBCookie = Array.isArray(cookiesB) ? cookiesB[0].split(';')[0] : cookiesB.split(';')[0];
  });

  afterAll(async () => {
    // Clean up all created test entities
    const testUserIds = [userAId, userBId].filter(Boolean);
    if (testUserIds.length > 0) {
      await prisma.projectMember.deleteMany({ where: { userId: { in: testUserIds } } }).catch(() => {});
      await prisma.project.deleteMany({ where: { createdById: { in: testUserIds } } }).catch(() => {});
      await prisma.workspaceMember.deleteMany({ where: { userId: { in: testUserIds } } }).catch(() => {});
      await prisma.workspace.deleteMany({ where: { ownerId: { in: testUserIds } } }).catch(() => {});
      await prisma.session.deleteMany({ where: { userId: { in: testUserIds } } }).catch(() => {});
      await prisma.user.deleteMany({ where: { id: { in: testUserIds } } }).catch(() => {});
    }
  });

  describe('1. Personal Workspace Auto-Provisioning & Idempotency', () => {
    it('provisions personal workspace on registration with OWNER membership', async () => {
      const wsA = await prisma.workspace.findFirst({
        where: { ownerId: userAId, isPersonal: true },
        include: { members: true },
      });

      expect(wsA).toBeDefined();
      expect(wsA?.isPersonal).toBe(true);
      expect(wsA?.ownerId).toBe(userAId);
      expect(wsA?.members.some((m) => m.userId === userAId && m.role === 'OWNER')).toBe(true);

      userAPersonalWsId = wsA!.id;
    });

    it('ensuring personal workspace repeatedly is idempotent and does not create duplicates', async () => {
      const secondCall = await ensurePersonalWorkspace({
        id: userAId,
        username: userAData.username,
        fullName: userAData.fullName,
      });

      expect(secondCall.id).toBe(userAPersonalWsId);

      const count = await prisma.workspace.count({
        where: { ownerId: userAId, isPersonal: true },
      });
      expect(count).toBe(1);
    });

    it('concurrent ensurePersonalWorkspace calls resolve safely to the same personal workspace', async () => {
      const results = await Promise.all([
        ensurePersonalWorkspace({ id: userBId, username: userBData.username }),
        ensurePersonalWorkspace({ id: userBId, username: userBData.username }),
        ensurePersonalWorkspace({ id: userBId, username: userBData.username }),
      ]);

      const wsB = await prisma.workspace.findFirst({
        where: { ownerId: userBId, isPersonal: true },
      });
      expect(wsB).toBeDefined();
      userBPersonalWsId = wsB!.id;

      expect(results[0].id).toBe(userBPersonalWsId);
      expect(results[1].id).toBe(userBPersonalWsId);
      expect(results[2].id).toBe(userBPersonalWsId);
    });
  });

  describe('2. Workspace Listing and Categorization (My vs Team)', () => {
    it('GET /api/workspaces returns personal workspace under owned', async () => {
      const res = await request(app)
        .get('/api/workspaces')
        .set('Cookie', userACookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.owned).toHaveLength(1);
      expect(res.body.data.owned[0].id).toBe(userAPersonalWsId);
      expect(res.body.data.owned[0].isPersonal).toBe(true);
      expect(res.body.data.owned[0].userRole).toBe('OWNER');
      expect(res.body.data.joined).toHaveLength(0);
    });

    it('POST /api/workspaces creates a new team workspace with caller as OWNER', async () => {
      const res = await request(app)
        .post('/api/workspaces')
        .set('Cookie', userACookie)
        .send({
          name: 'Acme Product Team',
          description: 'Team workspace for shared apps',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.workspace.name).toBe('Acme Product Team');
      expect(res.body.data.workspace.isPersonal).toBe(false);
      expect(res.body.data.workspace.ownerId).toBe(userAId);

      teamWsId = res.body.data.workspace.id;
    });

    it('categorizes team workspace under joined for added members', async () => {
      // Add User B as member to team workspace
      await prisma.workspaceMember.create({
        data: {
          workspaceId: teamWsId,
          userId: userBId,
          role: 'WORKSPACE_MEMBER',
        },
      });

      const res = await request(app)
        .get('/api/workspaces')
        .set('Cookie', userBCookie);

      expect(res.status).toBe(200);
      expect(res.body.data.owned).toHaveLength(1);
      expect(res.body.data.owned[0].id).toBe(userBPersonalWsId);

      expect(res.body.data.joined).toHaveLength(1);
      expect(res.body.data.joined[0].id).toBe(teamWsId);
      expect(res.body.data.joined[0].userRole).toBe('WORKSPACE_MEMBER');
      expect(res.body.data.joined[0].owner.username).toBe(userAData.username);
    });
  });

  describe('3. Cross-Workspace Data Scoping and Isolation', () => {
    beforeAll(async () => {
      // Create Project Alpha in Team Workspace
      const resP1 = await request(app)
        .post('/api/projects')
        .set('Cookie', userACookie)
        .set('X-Workspace-Id', teamWsId)
        .send({
          name: 'Project Alpha Team',
          key: 'ALP',
          description: 'Team project in team workspace',
        });
      expect(resP1.status).toBe(201);
      projectInTeamWsId = resP1.body.data.project.id;

      // Create Project Beta in Personal Workspace
      const resP2 = await request(app)
        .post('/api/projects')
        .set('Cookie', userACookie)
        .set('X-Workspace-Id', userAPersonalWsId)
        .send({
          name: 'Project Beta Personal',
          key: 'BET',
          description: 'Personal project in personal workspace',
        });
      expect(resP2.status).toBe(201);
      projectInPersonalWsId = resP2.body.data.project.id;
    });

    it('GET /api/projects scopes project list strictly to the active workspace', async () => {
      // Request scoped to team workspace
      const resTeam = await request(app)
        .get('/api/projects')
        .set('Cookie', userACookie)
        .set('X-Workspace-Id', teamWsId);

      expect(resTeam.status).toBe(200);
      const teamProjectIds = resTeam.body.data.owned.map((p: any) => p.id);
      expect(teamProjectIds).toContain(projectInTeamWsId);
      expect(teamProjectIds).not.toContain(projectInPersonalWsId);

      // Request scoped to personal workspace
      const resPersonal = await request(app)
        .get('/api/projects')
        .set('Cookie', userACookie)
        .set('X-Workspace-Id', userAPersonalWsId);

      expect(resPersonal.status).toBe(200);
      const personalProjectIds = resPersonal.body.data.owned.map((p: any) => p.id);
      expect(personalProjectIds).toContain(projectInPersonalWsId);
      expect(personalProjectIds).not.toContain(projectInTeamWsId);
    });

    it('GET /api/dashboard scopes dashboard counts strictly to the active workspace', async () => {
      const res = await request(app)
        .get('/api/dashboard')
        .set('Cookie', userACookie)
        .set('X-Workspace-Id', teamWsId);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.stats.myProjectsCount).toBe(1);
    });

    it('GET /api/work/my scopes work items strictly to the active workspace', async () => {
      const res = await request(app)
        .get('/api/work/my')
        .set('Cookie', userACookie)
        .set('X-Workspace-Id', teamWsId);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.workItems)).toBe(true);
    });

    it('GET /api/search scopes search results strictly to the active workspace', async () => {
      const resTeam = await request(app)
        .get('/api/search?q=Project')
        .set('Cookie', userACookie)
        .set('X-Workspace-Id', teamWsId);

      expect(resTeam.status).toBe(200);
      const projectNames = resTeam.body.data.projects.map((p: any) => p.name);
      expect(projectNames).toContain('Project Alpha Team');
      expect(projectNames).not.toContain('Project Beta Personal');
    });

    it('GET /api/files scopes files strictly to the active workspace', async () => {
      const res = await request(app)
        .get('/api/files')
        .set('Cookie', userACookie)
        .set('X-Workspace-Id', teamWsId);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.files)).toBe(true);
    });

    it('GET /api/notes scopes notes strictly to the active workspace', async () => {
      const res = await request(app)
        .get('/api/notes')
        .set('Cookie', userACookie)
        .set('X-Workspace-Id', teamWsId);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.notes)).toBe(true);
    });

    it('GET /api/calendar/events scopes calendar events strictly to the active workspace', async () => {
      const res = await request(app)
        .get('/api/calendar/events')
        .set('Cookie', userACookie)
        .set('X-Workspace-Id', teamWsId);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.items)).toBe(true);
    });

    it('GET /api/activities scopes activities strictly to the active workspace', async () => {
      const res = await request(app)
        .get('/api/activities')
        .set('Cookie', userACookie)
        .set('X-Workspace-Id', teamWsId);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.activities)).toBe(true);
    });
  });

  describe('4. Unauthorized Direct Access and Cross-Workspace Boundary Enforcement', () => {
    it('GET /api/workspaces/:id rejects unauthorized access to another user personal workspace', async () => {
      const res = await request(app)
        .get(`/api/workspaces/${userAPersonalWsId}`)
        .set('Cookie', userBCookie);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('GET /api/projects/:id returns 404 when project does not belong to active workspace', async () => {
      // User A tries to view Project Beta (in Personal WS) while active workspace is Team WS
      const res = await request(app)
        .get(`/api/projects/${projectInPersonalWsId}`)
        .set('Cookie', userACookie)
        .set('X-Workspace-Id', teamWsId);

      expect(res.status).toBe(404);
    });

    it('client-supplied invalid or unauthorized X-Workspace-Id is safely rejected with 403', async () => {
      // User B provides User A's personal workspace ID in header
      const res = await request(app)
        .get('/api/projects')
        .set('Cookie', userBCookie)
        .set('X-Workspace-Id', userAPersonalWsId);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });
});
