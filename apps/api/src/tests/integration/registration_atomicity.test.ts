import { describe, it, expect, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { app } from '../../server.js';
import prisma from '../../prisma.js';
import { sessionService } from '../../services/session.service.js';
import { invitationService } from '../../services/invitation.service.js';
import * as queues from '../../jobs/queues.js';

describe('Registration Atomicity, Rollback & Secondary Resilience Integration Tests', () => {
  const ts = Date.now();
  const testEmailsToCleanup: string[] = [];
  let shouldFailWorkspaceProvisioning = false;

  const realTransaction = prisma.$transaction.bind(prisma);

  beforeEach(() => {
    vi.restoreAllMocks();
    shouldFailWorkspaceProvisioning = false;

    // Spy on $transaction to allow injecting failures into the transaction client
    vi.spyOn(prisma, '$transaction').mockImplementation(async (arg1: any, arg2?: any) => {
      if (typeof arg1 === 'function') {
        return realTransaction(async (tx: any) => {
          const originalWorkspaceCreate = tx.workspace.create.bind(tx.workspace);
          tx.workspace.create = async (...args: any[]) => {
            if (shouldFailWorkspaceProvisioning) {
              throw new Error('Simulated workspace provisioning database error');
            }
            return originalWorkspaceCreate(...args);
          };
          return arg1(tx);
        }, arg2);
      }
      return realTransaction(arg1, arg2);
    });
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    if (testEmailsToCleanup.length > 0) {
      const users = await prisma.user.findMany({
        where: { email: { in: testEmailsToCleanup } },
        select: { id: true },
      });
      const userIds = users.map((u) => u.id);
      if (userIds.length > 0) {
        await prisma.session.deleteMany({ where: { userId: { in: userIds } } }).catch(() => {});
        await prisma.workspaceMember.deleteMany({ where: { userId: { in: userIds } } }).catch(() => {});
        await prisma.workspace.deleteMany({ where: { ownerId: { in: userIds } } }).catch(() => {});
        await prisma.user.deleteMany({ where: { id: { in: userIds } } }).catch(() => {});
      }
    }
  });

  it('1. Successful registration creates exactly one User, personal Workspace, Owner membership and initial session', async () => {
    const email = `atomic_success_${ts}_1@example.com`;
    const username = `atom_succ_${ts}_1`;
    testEmailsToCleanup.push(email);

    const res = await request(app).post('/api/auth/register').send({
      fullName: 'Atomic User One',
      username,
      email,
      password: 'Password123!Secure',
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe(email);
    expect(res.headers['set-cookie']).toBeDefined();

    const createdUser = await prisma.user.findUnique({
      where: { email },
    });
    expect(createdUser).not.toBeNull();

    // Verify personal workspace exists and is unique
    const workspaces = await prisma.workspace.findMany({
      where: { ownerId: createdUser!.id, isPersonal: true },
    });
    expect(workspaces).toHaveLength(1);
    expect(workspaces[0].name).toBe("Atomic User One's Workspace");

    // Verify Owner membership exists
    const membership = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: workspaces[0].id,
          userId: createdUser!.id,
        },
      },
    });
    expect(membership).not.toBeNull();
    expect(membership?.role).toBe('OWNER');

    // Verify initial session exists
    const sessions = await prisma.session.findMany({
      where: { userId: createdUser!.id },
    });
    expect(sessions).toHaveLength(1);
  });

  it('2. Workspace provisioning failure rolls back User and session creation', async () => {
    const email = `atomic_ws_fail_${ts}_2@example.com`;
    const username = `atom_wsfail_${ts}_2`;
    testEmailsToCleanup.push(email);

    // Trigger failure during workspace creation inside transaction
    shouldFailWorkspaceProvisioning = true;

    const res = await request(app).post('/api/auth/register').send({
      fullName: 'Workspace Failure User',
      username,
      email,
      password: 'Password123!Secure',
    });

    // Should return 500 error because core transaction failed
    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);

    // Verify database: NO partial User, Workspace or Session should remain
    const dbUser = await prisma.user.findUnique({ where: { email } });
    expect(dbUser).toBeNull();

    const dbWorkspace = await prisma.workspace.findFirst({
      where: { slug: { startsWith: username } },
    });
    expect(dbWorkspace).toBeNull();
  });

  it('3. Session creation failure rolls back User, Workspace and membership creation', async () => {
    const email = `atomic_sess_fail_${ts}_3@example.com`;
    const username = `atom_sessfail_${ts}_3`;
    testEmailsToCleanup.push(email);

    // Spy on sessionService.createSession to throw inside the transaction
    vi.spyOn(sessionService, 'createSession').mockRejectedValueOnce(
      new Error('Simulated session persistence connection drop')
    );

    const res = await request(app).post('/api/auth/register').send({
      fullName: 'Session Failure User',
      username,
      email,
      password: 'Password123!Secure',
    });

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);

    // Verify database: NO partial User, Workspace or Membership exists
    const dbUser = await prisma.user.findUnique({ where: { email } });
    expect(dbUser).toBeNull();

    const dbWorkspace = await prisma.workspace.findFirst({
      where: { slug: { startsWith: username } },
    });
    expect(dbWorkspace).toBeNull();
  });

  it('4. Invitation-linking failure does not incorrectly report that a committed registration failed', async () => {
    const email = `atomic_invite_fail_${ts}_4@example.com`;
    const username = `atom_invfail_${ts}_4`;
    testEmailsToCleanup.push(email);

    // Make invitation linking fail
    vi.spyOn(invitationService, 'linkPendingInvitationsForUser').mockRejectedValueOnce(
      new Error('Simulated invitation linking query timeout')
    );

    const res = await request(app).post('/api/auth/register').send({
      fullName: 'Invite Fail User',
      username,
      email,
      password: 'Password123!Secure',
    });

    // Registration must succeed with 201 because core transaction already committed
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe(email);
    expect(res.headers['set-cookie']).toBeDefined();

    // Verify user, workspace, and session were successfully committed
    const dbUser = await prisma.user.findUnique({ where: { email } });
    expect(dbUser).not.toBeNull();

    const dbWs = await prisma.workspace.findFirst({ where: { ownerId: dbUser!.id } });
    expect(dbWs).not.toBeNull();

    const dbSession = await prisma.session.findFirst({ where: { userId: dbUser!.id } });
    expect(dbSession).not.toBeNull();
  });

  it('5. Email queue or delivery failure does not leave the frontend in a false registration-failed state', async () => {
    const email = `atomic_email_fail_${ts}_5@example.com`;
    const username = `atom_emailfail_${ts}_5`;
    testEmailsToCleanup.push(email);

    // Simulate BullMQ/Redis offline or direct delivery failure
    vi.spyOn(queues, 'enqueueEmailJob').mockRejectedValueOnce(
      new Error('Simulated Redis/BullMQ connection refused')
    );

    const res = await request(app).post('/api/auth/register').send({
      fullName: 'Email Failure User',
      username,
      email,
      password: 'Password123!Secure',
    });

    // Registration succeeds with 201!
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe(email);
    expect(res.body.data.emailDeliveryStatus).toBe('failed');
    expect(res.body.message).toContain('could not deliver the verification email');

    // Records exist durably in DB
    const dbUser = await prisma.user.findUnique({ where: { email } });
    expect(dbUser).not.toBeNull();
  });

  it('6. Duplicate email and username return appropriate errors without partial records', async () => {
    const email = `atomic_dup_${ts}_6@example.com`;
    const username = `atom_dup_${ts}_6`;
    testEmailsToCleanup.push(email);

    // Initial valid registration
    const firstRes = await request(app).post('/api/auth/register').send({
      fullName: 'Original User',
      username,
      email,
      password: 'Password123!Secure',
    });
    expect(firstRes.status).toBe(201);

    // Attempt registration with same email but different username
    const dupEmailRes = await request(app).post('/api/auth/register').send({
      fullName: 'Another User',
      username: `${username}_diff`,
      email,
      password: 'Password123!Secure',
    });
    expect(dupEmailRes.status).toBe(409);
    expect(dupEmailRes.body.success).toBe(false);
    expect(dupEmailRes.body.errors?.email).toBeDefined();

    // Attempt registration with same username (different case) but different email
    const dupUserRes = await request(app).post('/api/auth/register').send({
      fullName: 'Another User 2',
      username: username.toUpperCase(),
      email: `${email}.diff.com`,
      password: 'Password123!Secure',
    });
    expect(dupUserRes.status).toBe(409);
    expect(dupUserRes.body.success).toBe(false);
    expect(dupUserRes.body.errors?.username).toBeDefined();

    // Verify no stray workspace or partial user created for rejected attempts
    const diffUser = await prisma.user.findUnique({ where: { email: `${email}.diff.com` } });
    expect(diffUser).toBeNull();
  });

  it('7. Concurrent duplicate registration attempts preserve uniqueness and return controlled errors', async () => {
    const email = `atomic_concurrent_${ts}_7@example.com`;
    const username = `atom_conc_${ts}_7`;
    testEmailsToCleanup.push(email);

    // Run 5 simultaneous registration requests
    const attempts = await Promise.all(
      Array.from({ length: 5 }).map((_, i) =>
        request(app).post('/api/auth/register').send({
          fullName: `Concurrent User ${i}`,
          username,
          email,
          password: 'Password123!Secure',
        })
      )
    );

    const successResponses = attempts.filter((r) => r.status === 201);
    const conflictResponses = attempts.filter((r) => r.status === 409);

    // Exactly one must succeed
    expect(successResponses).toHaveLength(1);
    // The other 4 must fail with 409 Conflict
    expect(conflictResponses).toHaveLength(4);

    for (const conf of conflictResponses) {
      expect(conf.body.success).toBe(false);
      expect(conf.body.message).toMatch(/already registered|already taken|already in use/i);
    }

    // Verify exactly one User exists in DB
    const users = await prisma.user.findMany({ where: { email } });
    expect(users).toHaveLength(1);

    // Verify exactly one personal Workspace exists
    const workspaces = await prisma.workspace.findMany({
      where: { ownerId: users[0].id, isPersonal: true },
    });
    expect(workspaces).toHaveLength(1);

    // Verify exactly one initial session exists
    const sessions = await prisma.session.findMany({ where: { userId: users[0].id } });
    expect(sessions).toHaveLength(1);
  });
});
