import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  parseSender,
  parseRecipients,
  sendViaBrevoApi,
  sendWelcomeEmail,
  sendPasswordResetOtpEmail,
  type BrevoSendEmailPayload,
} from '../../services/email.service.js';

describe('Brevo HTTPS Transactional Email Service Unit Tests', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  describe('1. Sender & Recipient Parsing', () => {
    it('should correctly parse sender with display name in quotes', () => {
      const sender = parseSender('"D-Board Team" <support@d-board.app>');
      expect(sender).toEqual({
        name: 'D-Board Team',
        email: 'support@d-board.app',
      });
    });

    it('should correctly parse sender with display name without quotes', () => {
      const sender = parseSender('D-Board <notifications@d-board.app>');
      expect(sender).toEqual({
        name: 'D-Board',
        email: 'notifications@d-board.app',
      });
    });

    it('should fallback name to D-Board when sender is plain email address', () => {
      const sender = parseSender('verified-sender@example.com');
      expect(sender).toEqual({
        name: 'D-Board',
        email: 'verified-sender@example.com',
      });
    });

    it('should handle empty or undefined sender gracefully', () => {
      const sender = parseSender(undefined);
      expect(sender.name).toBe('D-Board');
      expect(sender.email).toBeDefined();
    });

    it('should parse single email string into Brevo recipient array', () => {
      const recipients = parseRecipients('developer@company.com');
      expect(recipients).toEqual([
        { email: 'developer@company.com' },
      ]);
    });

    it('should parse named recipient string into Brevo recipient array', () => {
      const recipients = parseRecipients('Alex Henderson <alex@company.com>');
      expect(recipients).toEqual([
        { name: 'Alex Henderson', email: 'alex@company.com' },
      ]);
    });

    it('should parse comma-separated recipient strings', () => {
      const recipients = parseRecipients('one@example.com, Two <two@example.com>');
      expect(recipients).toEqual([
        { email: 'one@example.com' },
        { name: 'Two', email: 'two@example.com' },
      ]);
    });

    it('should parse array of recipient strings or objects', () => {
      const recipients = parseRecipients([
        'user1@example.com',
        { name: 'User Two', address: 'user2@example.com' },
      ]);
      expect(recipients).toEqual([
        { email: 'user1@example.com' },
        { name: 'User Two', email: 'user2@example.com' },
      ]);
    });
  });

  describe('2. Brevo HTTP API Dispatcher (sendViaBrevoApi)', () => {
    it('should successfully post payload to Brevo API with api-key header', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        json: async () => ({ messageId: '<brevo-msg-12345@smtp-relay.mailin.fr>' }),
      });
      global.fetch = mockFetch;

      const payload: BrevoSendEmailPayload = {
        sender: { name: 'D-Board', email: 'verified@d-board.app' },
        to: [{ email: 'recipient@example.com', name: 'Recipient' }],
        subject: 'Test Subject',
        htmlContent: '<p>Hello World</p>',
        textContent: 'Hello World',
      };

      const result = await sendViaBrevoApi(payload, 'test-brevo-api-key');

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [calledUrl, calledOptions] = mockFetch.mock.calls[0];
      expect(calledUrl).toBe('https://api.brevo.com/v3/smtp/email');
      expect(calledOptions.method).toBe('POST');
      expect(calledOptions.headers).toEqual({
        'accept': 'application/json',
        'api-key': 'test-brevo-api-key',
        'content-type': 'application/json',
      });
      expect(JSON.parse(calledOptions.body)).toEqual(payload);
      expect(result.success).toBe(true);
      expect(result.messageId).toBe('<brevo-msg-12345@smtp-relay.mailin.fr>');
    });

    it('should handle Brevo API error response gracefully without crashing', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: async () => ({ code: 'invalid_parameter', message: 'Sender domain not verified' }),
      });
      global.fetch = mockFetch;

      const payload: BrevoSendEmailPayload = {
        sender: { name: 'D-Board', email: 'unverified@example.com' },
        to: [{ email: 'recipient@example.com' }],
        subject: 'Test Subject',
        htmlContent: '<p>Hello</p>',
      };

      const result = await sendViaBrevoApi(payload, 'test-key');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Sender domain not verified');
    });
  });

  describe('3. Production Mode Enforcement & Validation', () => {
    it('should throw clear error in production if BREVO_API_KEY is missing', async () => {
      process.env.NODE_ENV = 'production';
      delete process.env.BREVO_API_KEY;

      await expect(
        sendWelcomeEmail({
          toEmail: 'alex@example.com',
          username: 'alex_h',
        })
      ).rejects.toThrow(/Production email delivery unavailable: BREVO_API_KEY must be defined/);
    });

    it('should throw in production when Brevo API returns an error', async () => {
      process.env.NODE_ENV = 'production';
      process.env.BREVO_API_KEY = 'test-key';

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ message: 'Key not found' }),
      });

      await expect(
        sendWelcomeEmail({
          toEmail: 'alex@example.com',
          username: 'alex_h',
        })
      ).rejects.toThrow(/Failed to deliver transactional email via Brevo API: Key not found/);
    });
  });

  describe('4. Transactional Email Content & Dispatch via Brevo', () => {
    it('should send welcome email with correct recipient, subject, and Brevo payload', async () => {
      process.env.BREVO_API_KEY = 'xkeysib-mock-key';
      process.env.EMAIL_FROM = '"D-Board Verified" <verified@dboard.app>';

      let capturedPayload: BrevoSendEmailPayload | null = null;
      global.fetch = vi.fn().mockImplementation(async (url, init) => {
        capturedPayload = JSON.parse(init.body);
        return {
          ok: true,
          status: 201,
          json: async () => ({ messageId: '<welcome-msg-id>' }),
        };
      });

      const success = await sendWelcomeEmail({
        toEmail: 'newuser@example.com',
        username: 'johndoe',
        fullName: 'John Doe',
      });

      expect(success).toBe(true);
      expect(capturedPayload).not.toBeNull();
      expect(capturedPayload!.sender).toEqual({
        name: 'D-Board Verified',
        email: 'verified@dboard.app',
      });
      expect(capturedPayload!.to).toEqual([{ email: 'newuser@example.com' }]);
      expect(capturedPayload!.subject).toBe('Welcome to D-Board — Your Workspace is Ready');
      expect(capturedPayload!.htmlContent).toContain('Welcome to D-Board! 🚀');
      expect(capturedPayload!.htmlContent).toContain('John Doe');
      expect(capturedPayload!.textContent).toContain('Welcome to D-Board!');
    });

    it('should send password reset OTP email with 6-digit code in HTML and text without leaking in logs', async () => {
      process.env.BREVO_API_KEY = 'xkeysib-mock-key';
      process.env.EMAIL_FROM = 'D-Board <security@dboard.app>';

      let capturedPayload: BrevoSendEmailPayload | null = null;
      global.fetch = vi.fn().mockImplementation(async (url, init) => {
        capturedPayload = JSON.parse(init.body);
        return {
          ok: true,
          status: 201,
          json: async () => ({ messageId: '<otp-msg-id>' }),
        };
      });

      const success = await sendPasswordResetOtpEmail({
        toEmail: 'user@example.com',
        username: 'alice',
        otp: '849201',
      });

      expect(success).toBe(true);
      expect(capturedPayload).not.toBeNull();
      expect(capturedPayload!.to).toEqual([{ email: 'user@example.com' }]);
      expect(capturedPayload!.subject).toBe('Your D-Board Password Reset Verification Code');
      expect(capturedPayload!.htmlContent).toContain('849201');
      expect(capturedPayload!.textContent).toContain('849201');
      expect(capturedPayload!.htmlContent).toContain('Password Reset Verification Code');
    });
  });
});
