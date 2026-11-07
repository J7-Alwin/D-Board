import { describe, it, expect, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../../server.js';
import prisma from '../../prisma.js';

describe('Pre-Registration Email Verification & Account Creation Flow', () => {
  const timestamp = Date.now();
  const testEmail = `prereg_${timestamp}@example.com`;
  const testUsername = `prereg_${timestamp}`;
  const testPassword = 'MySecretPassphrase123!';

  let receivedOtp: string;
  let verificationToken: string;

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: testEmail } }).catch(() => {});
  });

  it('1. POST /api/auth/send-registration-otp should generate and send 6-digit OTP', async () => {
    const res = await request(app)
      .post('/api/auth/send-registration-otp')
      .send({ email: testEmail });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toContain('Verification code sent');
    expect(res.body.otp).toBeDefined(); // Exposed in test/dev
    expect(res.body.otp.length).toBe(6);
    receivedOtp = res.body.otp;
  });

  it('2. POST /api/auth/register should reject unverified email with 400 when verificationToken has not been verified', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        fullName: 'Unverified Test',
        username: `${testUsername}_unver`,
        email: `unverified_${timestamp}@example.com`,
        password: testPassword,
        verificationToken: 'invalid.dummy.token',
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('Email verification is required');

    // Confirm user did NOT enter database
    const dbUser = await prisma.user.findUnique({
      where: { email: `unverified_${timestamp}@example.com` },
    });
    expect(dbUser).toBeNull();
  });

  it('3. POST /api/auth/verify-registration-otp should reject incorrect OTP with 400', async () => {
    const res = await request(app)
      .post('/api/auth/verify-registration-otp')
      .send({
        email: testEmail,
        otp: '000000',
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('Invalid verification code');
  });

  it('4. POST /api/auth/verify-registration-otp should verify correct OTP and return verificationToken', async () => {
    const res = await request(app)
      .post('/api/auth/verify-registration-otp')
      .send({
        email: testEmail,
        otp: receivedOtp,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.verificationToken).toBeDefined();
    verificationToken = res.body.verificationToken;
  });

  it('5. POST /api/auth/register should create account with isEmailVerified: true and set session cookie', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        fullName: 'Verified Pre-Reg User',
        username: testUsername,
        email: testEmail,
        password: testPassword,
        verificationToken,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe(testEmail);
    expect(res.body.data.user.isEmailVerified).toBe(true);
    expect(res.headers['set-cookie']).toBeDefined();

    // Confirm user in PostgreSQL database has isEmailVerified = true
    const dbUser = await prisma.user.findUnique({
      where: { email: testEmail },
    });
    expect(dbUser).not.toBeNull();
    expect(dbUser?.isEmailVerified).toBe(true);
  });
});

