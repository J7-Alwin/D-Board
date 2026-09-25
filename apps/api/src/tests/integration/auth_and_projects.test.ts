import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../../server.js';
import prisma from '../../prisma.js';

describe('Auth, Project RBAC, and Calendar Feed Token Integration Tests', () => {
  const timestamp = Date.now();
  const testUser = {
    username: `test_user_${timestamp}`,
    email: `test_user_${timestamp}@example.com`,
    password: 'Password123!',
    fullName: 'Integration Test User',
  };

  let sessionCookie: string;
  let createdProjectId: string;

  afterAll(async () => {
    // Clean up created resources
    if (createdProjectId) {
      await prisma.project.deleteMany({ where: { id: createdProjectId } }).catch(() => {});
    }
    await prisma.user.deleteMany({ where: { email: testUser.email } }).catch(() => {});
  });

  it('1. POST /api/auth/register should register user and return 201', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send(testUser);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe(testUser.email);
    expect(res.headers['x-request-id']).toBeDefined();

    // Mark email verified for test execution
    await prisma.user.update({
      where: { email: testUser.email },
      data: { isEmailVerified: true },
    });
  });

  it('2. POST /api/auth/login should authenticate and return session cookie', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        identifier: testUser.email,
        password: testUser.password,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.headers['set-cookie']).toBeDefined();

    const cookies = res.headers['set-cookie'];
    sessionCookie = Array.isArray(cookies) ? cookies[0].split(';')[0] : cookies.split(';')[0];
    expect(sessionCookie).toContain('token=');
  });

  it('3. POST /api/projects should create a project for authenticated user', async () => {
    const res = await request(app)
      .post('/api/projects')
      .set('Cookie', sessionCookie)
      .send({
        name: `Integration Project ${timestamp}`,
        key: 'INTG',
        description: 'Testing project integration workflow',
        technologyStack: ['React', 'Node'],
        invitations: [],
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.project.id).toBeDefined();
    createdProjectId = res.body.data.project.id;
  });

  it('4. POST /api/projects/:id/archive should archive project', async () => {
    const res = await request(app)
      .post(`/api/projects/${createdProjectId}/archive`)
      .set('Cookie', sessionCookie);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.project.status).toBe('ARCHIVED');
  });

  it('5. POST /api/projects/:id/files should reject uploads to archived project with 400', async () => {
    const res = await request(app)
      .post(`/api/projects/${createdProjectId}/files`)
      .set('Cookie', sessionCookie)
      .attach('files', Buffer.from('test payload'), 'test.txt');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('archived');
  });

  it('6. POST /api/projects/:id/unarchive should restore project to ACTIVE status', async () => {
    const res = await request(app)
      .post(`/api/projects/${createdProjectId}/unarchive`)
      .set('Cookie', sessionCookie);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.project.status).toBe('ACTIVE');
  });

  it('7. POST /api/projects/:id/calendar/feed/token should generate revocable feed token', async () => {
    const res = await request(app)
      .post(`/api/projects/${createdProjectId}/calendar/feed/token`)
      .set('Cookie', sessionCookie);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.token).toMatch(/^dbcal_/);

    const token = res.body.data.token;

    // Verify token can fetch RFC 5545 iCalendar stream without session cookie
    const feedRes = await request(app)
      .get(`/api/projects/${createdProjectId}/calendar/feed.ics?token=${token}`);

    expect(feedRes.status).toBe(200);
    expect(feedRes.headers['content-type']).toMatch(/calendar/);
    expect(feedRes.text).toContain('BEGIN:VCALENDAR');

    // Revoke token
    const revokeRes = await request(app)
      .delete(`/api/projects/${createdProjectId}/calendar/feed/token`)
      .set('Cookie', sessionCookie);

    expect(revokeRes.status).toBe(200);

    // Subsequent access with revoked token must fail with 401
    const revokedFeedRes = await request(app)
      .get(`/api/projects/${createdProjectId}/calendar/feed.ics?token=${token}`);

    expect(revokedFeedRes.status).toBe(401);
  });

  it('8. POST /api/auth/logout should revoke active session', async () => {
    const res = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', sessionCookie);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Protected route should now be unauthorized
    const checkRes = await request(app)
      .get('/api/projects')
      .set('Cookie', sessionCookie);

    expect(checkRes.status).toBe(401);
  });
});
