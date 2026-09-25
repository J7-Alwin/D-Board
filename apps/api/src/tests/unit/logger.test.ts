import { describe, it, expect } from 'vitest';
import { sanitizeLogData } from '../../utils/logger.js';

describe('Structured Logger - Secret Redaction Unit Tests', () => {
  it('should redact sensitive keys such as password, token, secret, and otp', () => {
    const input = {
      username: 'johndoe',
      password: 'SuperSecretPassword123!',
      token: 'jwt.token.here',
      otp: '123456',
      nested: {
        api_secret: 'top-secret',
        normalField: 'public-data',
      },
    };

    const sanitized = sanitizeLogData(input);

    expect(sanitized.username).toBe('johndoe');
    expect(sanitized.password).toBe('[REDACTED]');
    expect(sanitized.token).toBe('[REDACTED]');
    expect(sanitized.otp).toBe('[REDACTED]');
    expect(sanitized.nested.api_secret).toBe('[REDACTED]');
    expect(sanitized.nested.normalField).toBe('public-data');
  });

  it('should redact buffer data safely without leaking bytes', () => {
    const bufferInput = {
      filename: 'document.pdf',
      buffer: Buffer.from('confidential file bytes'),
    };

    const sanitized = sanitizeLogData(bufferInput);
    expect(sanitized.filename).toBe('document.pdf');
    expect(sanitized.buffer).toMatch(/<Buffer length=\d+>/);
  });
});
