import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../../server.js';
import prisma from '../../prisma.js';
import { hashPassword, hashToken } from '../../utils/security.js';

describe('D-Board Authentication Hardening Integration Tests', () => {
  const ts = Date.now();
  const createdUserIds: string[] = [];

  afterAll(async () => {
    if (createdUserIds.length > 0) {
      await prisma.session.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
  });

  describe('1. Registration Password & Payload Validation', () => {
    it('should reject registration when required fields are missing', async () => {
      const res = await request(app).post('/api/auth/register').send({});
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.errors).toBeDefined();
    });

    it('should reject invalid and malformed email input', async () => {
      const res = await request(app).post('/api/auth/register').send({
        username: `user_${ts}_malformed`,
        email: 'not-an-email',
        password: 'ValidPassphrase123!',
      });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject password containing 6 spaces only', async () => {
      const res = await request(app).post('/api/auth/register').send({
        username: `user_${ts}_spaces6`,
        email: `spaces6_${ts}@example.com`,
        password: '      ',
      });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(JSON.stringify(res.body)).toContain('whitespace');
    });

    it('should reject password containing 8 spaces only', async () => {
      const res = await request(app).post('/api/auth/register').send({
        username: `user_${ts}_spaces8`,
        email: `spaces8_${ts}@example.com`,
        password: '        ',
      });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(JSON.stringify(res.body)).toContain('whitespace');
    });

    it('should reject password containing 15 spaces only', async () => {
      const res = await request(app).post('/api/auth/register').send({
        username: `user_${ts}_spaces15`,
        email: `spaces15_${ts}@example.com`,
        password: '               ',
      });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(JSON.stringify(res.body)).toContain('whitespace');
    });

    it('should reject mixed tabs and newlines whitespace password', async () => {
      const res = await request(app).post('/api/auth/register').send({
        username: `user_${ts}_mixedws`,
        email: `mixedws_${ts}@example.com`,
        password: '\t\t\t\n\n\n   \r\r   ',
      });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(JSON.stringify(res.body)).toContain('whitespace');
    });

    it('should reject password below minimum 15 characters (e.g. 14 chars)', async () => {
      const res = await request(app).post('/api/auth/register').send({
        username: `user_${ts}_short`,
        email: `short_${ts}@example.com`,
        password: 'ShortPasswd123',
      });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(JSON.stringify(res.body)).toContain('at least 15 characters');
    });

    it('should reject password exceeding 64 characters (65 chars)', async () => {
      const res = await request(app).post('/api/auth/register').send({
        username: `user_${ts}_long`,
        email: `long_${ts}@example.com`,
        password: 'A'.repeat(32) + 'b'.repeat(33),
      });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(JSON.stringify(res.body)).toContain('must not exceed 64 characters');
    });

    it('should reject password exceeding 72 bytes UTF-8', async () => {
      const res = await request(app).post('/api/auth/register').send({
        username: `user_${ts}_bytes`,
        email: `bytes_${ts}@example.com`,
        password: '🚀'.repeat(19), // 76 bytes
      });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(JSON.stringify(res.body)).toContain('72 bytes');
    });

    it('should reject common/compromised password from blocklist', async () => {
      const res = await request(app).post('/api/auth/register').send({
        username: `user_${ts}_common`,
        email: `common_${ts}@example.com`,
        password: 'password1234567',
      });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(JSON.stringify(res.body)).toContain('too common or easily guessed');
    });

    it('should reject single repeated character password', async () => {
      const res = await request(app).post('/api/auth/register').send({
        username: `user_${ts}_repeat`,
        email: `repeat_${ts}@example.com`,
        password: 'aaaaaaaaaaaaaaa',
      });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(JSON.stringify(res.body)).toContain('single repeated character');
    });

    it('should register successfully with a 15-character password containing spaces alongside characters', async () => {
      const username = `user_${ts}_spacesok`;
      const email = `spacesok_${ts}@example.com`;
      const password = 'pass with spaces 15';

      const res = await request(app).post('/api/auth/register').send({
        username,
        email,
        password,
        fullName: 'Valid Spaces User',
      });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user).toBeDefined();
      expect(res.body.data.user.password).toBeUndefined();
      expect(res.body.data.user.passwordHash).toBeUndefined();
      createdUserIds.push(res.body.data.user.id);

      // Verify user can login with exact password including spaces
      const loginRes = await request(app).post('/api/auth/login').send({
        identifier: email,
        password,
      });
      expect(loginRes.status).toBe(200);
      expect(loginRes.body.success).toBe(true);
    });

    it('should register successfully with leading and trailing spaces and preserve them exactly', async () => {
      const username = `user_${ts}_leadspt`;
      const email = `leadspt_${ts}@example.com`;
      const password = '  leading and trailing 15  ';

      const res = await request(app).post('/api/auth/register').send({
        username,
        email,
        password,
      });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      createdUserIds.push(res.body.data.user.id);

      // Login with exact password including leading/trailing spaces must SUCCEED
      const exactLogin = await request(app).post('/api/auth/login').send({
        identifier: username,
        password,
      });
      expect(exactLogin.status).toBe(200);

      // Login with trimmed password must FAIL (verifies spaces were not silently trimmed!)
      const trimmedLogin = await request(app).post('/api/auth/login').send({
        identifier: username,
        password: password.trim(),
      });
      expect(trimmedLogin.status).toBe(401);
    });

    it('should reject duplicate username (case-insensitive) with 409', async () => {
      const username = `user_${ts}_dupuser`;
      const email1 = `dupuser1_${ts}@example.com`;
      const email2 = `dupuser2_${ts}@example.com`;
      const password = 'ValidPassphrase123!';

      const res1 = await request(app).post('/api/auth/register').send({
        username,
        email: email1,
        password,
      });
      expect(res1.status).toBe(201);
      createdUserIds.push(res1.body.data.user.id);

      const res2 = await request(app).post('/api/auth/register').send({
        username: username.toUpperCase(),
        email: email2,
        password,
      });
      expect(res2.status).toBe(409);
      expect(res2.body.message).toContain('Username is already taken');
    });

    it('should reject duplicate email (case-insensitive) with 409', async () => {
      const email = `dupemail_${ts}@example.com`;
      const password = 'ValidPassphrase123!';

      const res1 = await request(app).post('/api/auth/register').send({
        username: `dupemail_1_${ts}`,
        email,
        password,
      });
      expect(res1.status).toBe(201);
      createdUserIds.push(res1.body.data.user.id);

      const res2 = await request(app).post('/api/auth/register').send({
        username: `dupemail_2_${ts}`,
        email: email.toUpperCase(),
        password,
      });
      expect(res2.status).toBe(409);
      expect(res2.body.message).toContain('Email address is already registered');
    });

    it('should handle concurrent duplicate registrations gracefully', async () => {
      const email = `concurrent_${ts}@example.com`;
      const username = `concurrent_${ts}`;
      const password = 'ValidPassphrase123!';

      const [res1, res2] = await Promise.all([
        request(app).post('/api/auth/register').send({ username: `${username}_a`, email, password }),
        request(app).post('/api/auth/register').send({ username: `${username}_b`, email, password }),
      ]);

      const statuses = [res1.status, res2.status].sort();
      expect(statuses).toEqual([201, 409]);
      if (res1.status === 201) createdUserIds.push(res1.body.data.user.id);
      if (res2.status === 201) createdUserIds.push(res2.body.data.user.id);
    });
  });

  describe('2. Login Security, Legacy Accounts & Edge Cases', () => {
    let testUserEmail: string;
    let testUserUsername: string;
    const testUserPassword = 'ValidPassphrase123!';

    beforeAll(async () => {
      testUserUsername = `login_user_${ts}`;
      testUserEmail = `${testUserUsername}@example.com`;
      const reg = await request(app).post('/api/auth/register').send({
        username: testUserUsername,
        email: testUserEmail,
        password: testUserPassword,
      });
      if (reg.body?.data?.user?.id) {
        createdUserIds.push(reg.body.data.user.id);
      }
    });

    it('should authenticate valid credentials and return httpOnly cookie', async () => {
      const res = await request(app).post('/api/auth/login').send({
        identifier: testUserEmail,
        password: testUserPassword,
      });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.headers['set-cookie']).toBeDefined();
      const cookieHeader = res.headers['set-cookie'][0];
      expect(cookieHeader).toContain('token=');
      expect(cookieHeader.toLowerCase()).toContain('httponly');
    });

    it('should return identical 401 error for non-existent user and incorrect password (anti-enumeration)', async () => {
      const nonExistentRes = await request(app).post('/api/auth/login').send({
        identifier: `nobody_${ts}@example.com`,
        password: 'ValidPassphrase123!',
      });
      expect(nonExistentRes.status).toBe(401);

      const wrongPasswordRes = await request(app).post('/api/auth/login').send({
        identifier: testUserEmail,
        password: 'WrongPassword123!',
      });
      expect(wrongPasswordRes.status).toBe(401);

      // Both error messages must be identical
      expect(nonExistentRes.body.message).toBe(wrongPasswordRes.body.message);
      expect(nonExistentRes.body.message).toBe('Invalid username/email or password');
    });

    it('should reject empty password on login with 400', async () => {
      const res = await request(app).post('/api/auth/login').send({
        identifier: testUserEmail,
        password: '',
      });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject whitespace-only password on login with 400', async () => {
      const res = await request(app).post('/api/auth/login').send({
        identifier: testUserEmail,
        password: '        ',
      });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should enforce case-sensitivity for passwords on login', async () => {
      // Lowercase version of password must fail
      const lowerRes = await request(app).post('/api/auth/login').send({
        identifier: testUserEmail,
        password: testUserPassword.toLowerCase(),
      });
      expect(lowerRes.status).toBe(401);
    });

    it('should allow existing legacy accounts with shorter passwords to log in without lockout', async () => {
      // Simulate an existing account created before the 15-char policy (e.g. 8-char password)
      const legacyUsername = `legacy_${ts}`;
      const legacyEmail = `legacy_${ts}@example.com`;
      const legacyShortPassword = 'Short8!';
      const passwordHash = await hashPassword(legacyShortPassword);

      const legacyUser = await prisma.user.create({
        data: {
          username: legacyUsername,
          email: legacyEmail,
          passwordHash,
          isEmailVerified: true,
          passwordResetAttempts: 0,
        },
      });
      createdUserIds.push(legacyUser.id);

      // Verify the legacy user CAN log in with their existing 8-character password!
      const loginRes = await request(app).post('/api/auth/login').send({
        identifier: legacyEmail,
        password: legacyShortPassword,
      });
      expect(loginRes.status).toBe(200);
      expect(loginRes.body.success).toBe(true);
      expect(loginRes.body.data.user.username).toBe(legacyUsername);
    });

    it('should reject invalid or expired session token on /api/auth/me', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid.token.payload');
      expect(res.status).toBe(401);
    });
  });

  describe('3. Password Reset & Verification Security', () => {
    let resetUserEmail: string;
    let resetUserId: string;

    beforeAll(async () => {
      const username = `reset_user_${ts}`;
      resetUserEmail = `${username}@example.com`;
      const reg = await request(app).post('/api/auth/register').send({
        username,
        email: resetUserEmail,
        password: 'InitialPassword123!',
      });
      resetUserId = reg.body.data.user.id;
      createdUserIds.push(resetUserId);
    });

    it('should request OTP without revealing if user exists', async () => {
      const resExisting = await request(app).post('/api/auth/forgot-password').send({
        email: resetUserEmail,
      });
      expect(resExisting.status).toBe(200);
      expect(resExisting.body.success).toBe(true);

      const resNonExisting = await request(app).post('/api/auth/forgot-password').send({
        email: `doesnotexist_${ts}@example.com`,
      });
      expect(resNonExisting.status).toBe(200);
      expect(resNonExisting.body.success).toBe(true);
      expect(resExisting.body.message).toBe(resNonExisting.body.message);
    });

    it('should reject password reset with whitespace-only new password', async () => {
      const res = await request(app).post('/api/auth/reset-password').send({
        email: resetUserEmail,
        otp: '123456',
        newPassword: '        ',
      });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(JSON.stringify(res.body)).toContain('whitespace');
    });

    it('should reject password reset with < 15 character new password', async () => {
      const res = await request(app).post('/api/auth/reset-password').send({
        email: resetUserEmail,
        otp: '123456',
        newPassword: 'ShortPasswd123',
      });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(JSON.stringify(res.body)).toContain('at least 15 characters');
    });

    it('should reject password reset with common/compromised password', async () => {
      const res = await request(app).post('/api/auth/reset-password').send({
        email: resetUserEmail,
        otp: '123456',
        newPassword: 'password1234567',
      });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(JSON.stringify(res.body)).toContain('too common or easily guessed');
    });

    it('should reject invalid or incorrect OTP', async () => {
      const res = await request(app).post('/api/auth/verify-otp').send({
        email: resetUserEmail,
        otp: '000000',
      });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should complete password reset, allow login with new password, and reject old password', async () => {
      // Set a valid OTP directly in test database
      const testOtp = '654321';
      const hashedOtp = hashToken(testOtp);
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

      await prisma.user.update({
        where: { id: resetUserId },
        data: {
          passwordResetTokenHash: hashedOtp,
          passwordResetExpiresAt: expiresAt,
          passwordResetAttempts: 0,
        },
      });

      const newPassword = 'BrandNewPassword15Chars!';
      const resetRes = await request(app).post('/api/auth/reset-password').send({
        email: resetUserEmail,
        otp: testOtp,
        newPassword,
      });
      expect(resetRes.status).toBe(200);
      expect(resetRes.body.success).toBe(true);

      // Verify OTP is invalidated immediately (cannot be reused)
      const reusedReset = await request(app).post('/api/auth/reset-password').send({
        email: resetUserEmail,
        otp: testOtp,
        newPassword: 'AnotherPassword15Chars!',
      });
      expect(reusedReset.status).toBe(400);

      // Old password must FAIL
      const oldLogin = await request(app).post('/api/auth/login').send({
        identifier: resetUserEmail,
        password: 'InitialPassword123!',
      });
      expect(oldLogin.status).toBe(401);

      // New password must SUCCEED
      const newLogin = await request(app).post('/api/auth/login').send({
        identifier: resetUserEmail,
        password: newPassword,
      });
      expect(newLogin.status).toBe(200);
    });
  });

  describe('4. Rate Limiting and Security Headers', () => {
    it('should include rate limiting headers on authentication endpoints', async () => {
      const res = await request(app).get('/api/auth/check-username?username=randomtest');
      expect(res.headers['x-ratelimit-limit']).toBeDefined();
      expect(res.headers['x-ratelimit-remaining']).toBeDefined();
    });

    it('should never expose raw password in response body', async () => {
      const username = `security_leak_${ts}`;
      const email = `security_leak_${ts}@example.com`;
      const password = 'SuperSecretPassword15Chars!';

      const res = await request(app).post('/api/auth/register').send({
        username,
        email,
        password,
      });
      expect(res.status).toBe(201);
      createdUserIds.push(res.body.data.user.id);

      const jsonStr = JSON.stringify(res.body);
      expect(jsonStr).not.toContain(password);
      expect(res.body.data.user.password).toBeUndefined();
      expect(res.body.data.user.passwordHash).toBeUndefined();
    });
  });
});
