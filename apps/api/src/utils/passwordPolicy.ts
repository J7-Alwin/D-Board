import { z } from 'zod';

export const MIN_PASSWORD_LENGTH = 15;
export const MAX_PASSWORD_LENGTH = 64;
export const MAX_PASSWORD_BYTES = 72;

/**
 * Curated blocklist of common, easily guessed, dictionary or predictable passwords and passphrases.
 * Evaluated locally in-memory (O(1) lookup) without transmitting passwords to any third-party.
 */
const COMMON_PASSWORDS_LIST: string[] = [
  'password1234567',
  'password12345678',
  'password123456789',
  '123456789012345',
  '1234567890123456',
  '12345678901234567',
  'qwertyuiopasdfg',
  'qwertyuiopasdfgh',
  'qwertyuiopasdfghjkl',
  'administrator12',
  'administrator123',
  'admin1234567890',
  'welcome12345678',
  'welcome123456789',
  'letmein12345678',
  'letmein123456789',
  'iloveyouiloveyou',
  'iloveyou1234567',
  'correcthorsebatterystaple',
  'changeme1234567',
  'changeme12345678',
  'trustno11234567',
  'abcdefghijklmno',
  'abcdefghijklmnop',
  '0123456789012345',
  'sunshine1234567',
  'football1234567',
  'monkey123456789',
  'master123456789',
  'dragon123456789',
  'passphrase12345',
  'passphrase123456',
  'supersecretpassword',
  'supersecret12345',
  'testpassword123',
  'defaultpassword1',
];

export const COMMON_PASSWORDS_SET = new Set<string>(
  COMMON_PASSWORDS_LIST.map((p) => p.toLowerCase())
);

export interface PasswordValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Validates a password against NIST SP 800-63B guidelines and bcrypt constraints:
 * 1. Must not be empty or consist only of whitespace.
 * 2. Minimum 15 characters (single-factor NIST guidance).
 * 3. Maximum 64 characters (supports at least 64 characters).
 * 4. Maximum 72 bytes UTF-8 (prevents silent bcrypt 72-byte truncation).
 * 5. Rejects single-character repeated sequences (e.g. "aaaaaaaaaaaaaaa").
 * 6. Rejects common / compromised passwords.
 * 7. Allows spaces alongside legitimate characters; does NOT alter or trim input.
 * 8. Does not impose arbitrary composition rules (no mandatory uppercase, lowercase, numbers, or symbols).
 */
export function validatePasswordPolicy(password: unknown): PasswordValidationResult {
  if (typeof password !== 'string') {
    return { isValid: false, error: 'Password is required' };
  }

  // 1. Check for empty string
  if (password.length === 0) {
    return { isValid: false, error: 'Password is required' };
  }

  // 2. Reject passwords containing only whitespace (spaces, tabs, newlines, etc.)
  if (/^\s*$/.test(password)) {
    return { isValid: false, error: 'Password cannot consist only of spaces or whitespace' };
  }

  // 3. Minimum length (NIST SP 800-63B recommends >= 15 for single-factor)
  if (password.length < MIN_PASSWORD_LENGTH) {
    return {
      isValid: false,
      error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
    };
  }

  // 4. Maximum character length
  if (password.length > MAX_PASSWORD_LENGTH) {
    return {
      isValid: false,
      error: `Password must not exceed ${MAX_PASSWORD_LENGTH} characters`,
    };
  }

  // 5. Maximum byte length (bcrypt 72-byte limit to prevent silent truncation)
  const byteLength = Buffer.byteLength(password, 'utf8');
  if (byteLength > MAX_PASSWORD_BYTES) {
    return {
      isValid: false,
      error: `Password cannot exceed ${MAX_PASSWORD_BYTES} bytes due to hashing algorithm limits`,
    };
  }

  // 6. Check for single repeated character (e.g. 15 'a's or 15 '1's)
  if (/^(.)\1+$/.test(password)) {
    return {
      isValid: false,
      error: 'Password cannot consist of a single repeated character',
    };
  }

  // 7. Check against blocklist of common / compromised passwords
  if (COMMON_PASSWORDS_SET.has(password.toLowerCase())) {
    return {
      isValid: false,
      error: 'This password is too common or easily guessed. Please choose a more secure password.',
    };
  }

  return { isValid: true };
}

/**
 * Zod schema for enforcing password policy during registration and password reset.
 */
export const passwordPolicySchema = z
  .string()
  .superRefine((val, ctx) => {
    const result = validatePasswordPolicy(val);
    if (!result.isValid) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: result.error || 'Password does not meet security requirements',
      });
    }
  });
