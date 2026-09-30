import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import prisma from '../../prisma.js';
import * as authService from '../../services/auth.service.js';
import * as queues from '../../jobs/queues.js';
import * as emailService from '../../services/email.service.js';
import { sessionService } from '../../services/session.service.js';
import { invitationService } from '../../services/invitation.service.js';
import { hashToken } from '../../utils/security.js';

describe('Email Verification System Unit Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Registration and Token Generation Security', () => {
    it('registration creates unverified account, hashes token, and queues BullMQ email job', async () => {
      let createdUserData: any = null;

      vi.spyOn(prisma.user, 'findFirst').mockResolvedValue(null as any);
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(null as any);
      (vi.spyOn(prisma.user, 'create') as any).mockImplementation(async ({ data }: any) => {
        createdUserData = data;
        return {
          id: 'mock-user-id-123',
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      });

      vi.spyOn(sessionService, 'createSession').mockResolvedValue({
        session: { id: 'mock-session-123', userId: 'mock-user-id-123' },
      } as any);

      vi.spyOn(invitationService, 'linkPendingInvitationsForUser').mockResolvedValue(undefined as any);
      vi.spyOn(emailService, 'sendWelcomeEmail').mockResolvedValue(true as any);

      const enqueueSpy = vi.spyOn(queues, 'enqueueEmailJob').mockResolvedValue({
        queued: true,
        jobId: 'email_verification_job_1',
      });

      const result = await authService.register({
        username: 'verifyuser',
        email: 'verifyuser@example.com',
        password: 'Password123!',
        termsAccepted: true,
      });

      // 1. Account is created with isEmailVerified = false
      expect(result.user.isEmailVerified).toBe(false);
      expect(createdUserData.isEmailVerified).toBe(false);

      // 2. Token hash is stored in database, raw token is never persisted
      expect(createdUserData.emailVerificationTokenHash).toBeDefined();
      expect(createdUserData.emailVerificationTokenHash).toHaveLength(64); // SHA-256 hex string
      expect(createdUserData.emailVerificationExpiresAt).toBeDefined();

      // 3. Raw token is NOT returned in public result
      expect((result as any).verificationToken).toBeUndefined();

      // 4. BullMQ email job was queued with the verification token
      expect(enqueueSpy).toHaveBeenCalledTimes(1);
      const enqueuedData: any = enqueueSpy.mock.calls[0][0];
      expect(enqueuedData.type).toBe('EMAIL_VERIFICATION');
      expect(enqueuedData.toEmail).toBe('verifyuser@example.com');
      expect(enqueuedData.username).toBe('verifyuser');
      expect(enqueuedData.token).toBeDefined();

      // 5. The hash in the DB matches the SHA-256 of the queued token
      expect(hashToken(enqueuedData.token)).toBe(createdUserData.emailVerificationTokenHash);
    });
  });

  describe('2. Email Verification Token Validation', () => {
    it('valid token verifies account and clears verification token hash and expiry', async () => {
      const rawToken = 'valid-secure-verification-token-32b';
      const tokenHash = hashToken(rawToken);

      vi.spyOn(prisma.user, 'findFirst').mockResolvedValue({
        id: 'user-123',
        username: 'validuser',
        email: 'validuser@example.com',
        isEmailVerified: false,
        emailVerificationTokenHash: tokenHash,
        emailVerificationExpiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000), // 12 hours remaining
      } as any);

      const updateSpy = vi.spyOn(prisma.user, 'update').mockResolvedValue({} as any);

      const verified = await authService.verifyEmail(rawToken);

      expect(verified).toBe(true);
      expect(updateSpy).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: {
          isEmailVerified: true,
          emailVerificationTokenHash: null,
          emailVerificationExpiresAt: null,
        },
      });
    });

    it('expired token is rejected with TOKEN_EXPIRED error code', async () => {
      const rawToken = 'expired-token-123';
      const tokenHash = hashToken(rawToken);

      vi.spyOn(prisma.user, 'findFirst').mockResolvedValue({
        id: 'user-expired',
        username: 'expireduser',
        email: 'expired@example.com',
        isEmailVerified: false,
        emailVerificationTokenHash: tokenHash,
        emailVerificationExpiresAt: new Date(Date.now() - 60 * 1000), // Expired 1 minute ago
      } as any);

      await expect(authService.verifyEmail(rawToken)).rejects.toMatchObject({
        statusCode: 400,
        code: 'TOKEN_EXPIRED',
      });
    });

    it('invalid or already-used token is rejected with TOKEN_INVALID error code', async () => {
      vi.spyOn(prisma.user, 'findFirst').mockResolvedValue(null);

      await expect(authService.verifyEmail('non-existent-or-used-token')).rejects.toMatchObject({
        statusCode: 400,
        code: 'TOKEN_INVALID',
      });
    });
  });

  describe('3. Resend Verification Email', () => {
    it('resend generates a new token hash, sets new expiration, and queues email job', async () => {
      let updatedUserData: any = null;

      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue({
        id: 'resend-user-id',
        email: 'resend@example.com',
        username: 'resenduser',
        isEmailVerified: false,
        isDeactivated: false,
      } as any);

      (vi.spyOn(prisma.user, 'update') as any).mockImplementation(async ({ data }: any) => {
        updatedUserData = data;
        return {} as any;
      });

      const enqueueSpy = vi.spyOn(queues, 'enqueueEmailJob').mockResolvedValue({
        queued: true,
        jobId: 'resend_email_job_1',
      });

      const result = await authService.resendVerificationEmail('resend@example.com');

      expect(result).toBe(true);
      expect(updatedUserData).toBeDefined();
      expect(updatedUserData.emailVerificationTokenHash).toHaveLength(64);
      expect(updatedUserData.emailVerificationExpiresAt.getTime()).toBeGreaterThan(Date.now());

      expect(enqueueSpy).toHaveBeenCalledTimes(1);
      const enqueued: any = enqueueSpy.mock.calls[0][0];
      expect(enqueued.type).toBe('EMAIL_VERIFICATION');
      expect(enqueued.toEmail).toBe('resend@example.com');
      expect(hashToken(enqueued.token)).toBe(updatedUserData.emailVerificationTokenHash);
    });

    it('resend preserves anti-enumeration when email is not found or already verified', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(null);
      const updateSpy = vi.spyOn(prisma.user, 'update');
      const enqueueSpy = vi.spyOn(queues, 'enqueueEmailJob');

      const result = await authService.resendVerificationEmail('unknown@example.com');

      expect(result).toBe(true);
      expect(updateSpy).not.toHaveBeenCalled();
      expect(enqueueSpy).not.toHaveBeenCalled();
    });
  });

  describe('4. Brevo Email Dispatch and Error Handling', () => {
    it('sendEmailVerificationEmail correctly builds payload and calls Brevo API', async () => {
      process.env.BREVO_API_KEY = 'test-brevo-key';
      process.env.CLIENT_URL = 'https://app.d-board.test';
      process.env.EMAIL_FROM = 'D-Board <noreply@d-board.test>';

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        json: async () => ({ messageId: '<brevo-verification-msg-id>' }),
      });
      global.fetch = mockFetch;

      const sent = await emailService.sendEmailVerificationEmail({
        toEmail: 'verify@example.com',
        username: 'verifyuser',
        token: 'raw-token-abc-123',
      });

      expect(sent).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('https://api.brevo.com/v3/smtp/email');
      const body = JSON.parse(options.body as string);
      expect(body.to).toEqual([{ email: 'verify@example.com' }]);
      expect(body.subject).toBe('Verify your D-Board email address');
      expect(body.htmlContent).toContain('https://app.d-board.test/verify-email?token=raw-token-abc-123');
      expect(body.htmlContent).toContain('24 hours');
      expect(body.textContent).toContain('https://app.d-board.test/verify-email?token=raw-token-abc-123');
    });

    it('Brevo API delivery failure throws in production and is handled safely', async () => {
      process.env.NODE_ENV = 'production';
      process.env.BREVO_API_KEY = 'test-brevo-key';

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'Internal Brevo Error',
      });

      await expect(
        emailService.sendEmailVerificationEmail({
          toEmail: 'fail@example.com',
          username: 'failuser',
          token: 'token-fail',
        })
      ).rejects.toThrow(/Failed to deliver transactional email/);
    });
  });
});
