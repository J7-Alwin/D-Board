import { describe, it, expect } from 'vitest';
import {
  validatePasswordPolicy,
  MIN_PASSWORD_LENGTH,
  MAX_PASSWORD_LENGTH,
  MAX_PASSWORD_BYTES,
  passwordPolicySchema,
} from '../../utils/passwordPolicy.js';

describe('Password Policy Unit Tests (NIST SP 800-63B & Bcrypt Limits)', () => {
  describe('1. Empty and Whitespace-Only Password Rejection', () => {
    it('should reject empty password string', () => {
      const res = validatePasswordPolicy('');
      expect(res.isValid).toBe(false);
      expect(res.error).toBe('Password is required');
    });

    it('should reject non-string input', () => {
      const res = validatePasswordPolicy(null);
      expect(res.isValid).toBe(false);
      expect(res.error).toBe('Password is required');
    });

    it('should reject passwords containing 6 spaces only', () => {
      const res = validatePasswordPolicy('      ');
      expect(res.isValid).toBe(false);
      expect(res.error).toBe('Password cannot consist only of spaces or whitespace');
    });

    it('should reject passwords containing 8 spaces only', () => {
      const res = validatePasswordPolicy('        ');
      expect(res.isValid).toBe(false);
      expect(res.error).toBe('Password cannot consist only of spaces or whitespace');
    });

    it('should reject passwords containing 15 or more spaces only', () => {
      const res = validatePasswordPolicy('               ');
      expect(res.isValid).toBe(false);
      expect(res.error).toBe('Password cannot consist only of spaces or whitespace');
    });

    it('should reject passwords containing tabs only', () => {
      const res = validatePasswordPolicy('\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t');
      expect(res.isValid).toBe(false);
      expect(res.error).toBe('Password cannot consist only of spaces or whitespace');
    });

    it('should reject passwords containing newlines only', () => {
      const res = validatePasswordPolicy('\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n');
      expect(res.isValid).toBe(false);
      expect(res.error).toBe('Password cannot consist only of spaces or whitespace');
    });

    it('should reject passwords containing mixed whitespace only', () => {
      const res = validatePasswordPolicy('  \t \r \n  \t   ');
      expect(res.isValid).toBe(false);
      expect(res.error).toBe('Password cannot consist only of spaces or whitespace');
    });
  });

  describe('2. Length Boundaries (Minimum 15, Maximum 64)', () => {
    it('should reject passwords below minimum length (14 characters)', () => {
      const res = validatePasswordPolicy('ShortPasswd123');
      expect(res.isValid).toBe(false);
      expect(res.error).toBe(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
    });

    it('should accept passwords exactly at minimum length (15 characters)', () => {
      const res = validatePasswordPolicy('ValidPass15Char');
      expect(res.isValid).toBe(true);
      expect(res.error).toBeUndefined();
    });

    it('should accept passwords above minimum length (16+ characters)', () => {
      const res = validatePasswordPolicy('ThisIsAValidPassword16Chars');
      expect(res.isValid).toBe(true);
    });

    it('should accept passwords at maximum supported length (64 characters)', () => {
      const password64 = 'A'.repeat(32) + 'b'.repeat(32);
      expect(password64.length).toBe(MAX_PASSWORD_LENGTH);
      const res = validatePasswordPolicy(password64);
      expect(res.isValid).toBe(true);
    });

    it('should reject passwords one character beyond maximum length (65 characters)', () => {
      const password65 = 'A'.repeat(32) + 'b'.repeat(33);
      expect(password65.length).toBe(65);
      const res = validatePasswordPolicy(password65);
      expect(res.isValid).toBe(false);
      expect(res.error).toBe(`Password must not exceed ${MAX_PASSWORD_LENGTH} characters`);
    });
  });

  describe('3. Bcrypt Byte-Limit & UTF-8 Multi-Byte Handling (Max 72 Bytes)', () => {
    it('should accept multi-byte unicode passwords within 72 bytes limit', () => {
      // 15 emojis: 15 * 4 = 60 bytes (within 72 bytes, length 30 utf16 surrogate pairs / 15 code points)
      // Use unicode characters that are 2-3 bytes: 'CaféRenéBrûlée15' (16 chars, 19 bytes)
      const unicodePass = 'CaféRenéBrûlée15!';
      expect(unicodePass.length).toBeGreaterThanOrEqual(15);
      expect(Buffer.byteLength(unicodePass, 'utf8')).toBeLessThanOrEqual(MAX_PASSWORD_BYTES);
      const res = validatePasswordPolicy(unicodePass);
      expect(res.isValid).toBe(true);
    });

    it('should reject passwords exceeding 72 bytes to prevent silent bcrypt truncation', () => {
      // 19 emojis (19 * 4 = 76 bytes > 72 bytes, but code point length is 19 <= 64)
      const oversizedEmojis = '🚀'.repeat(19);
      expect(Buffer.byteLength(oversizedEmojis, 'utf8')).toBe(76);
      const res = validatePasswordPolicy(oversizedEmojis);
      expect(res.isValid).toBe(false);
      expect(res.error).toBe(`Password cannot exceed ${MAX_PASSWORD_BYTES} bytes due to hashing algorithm limits`);
    });

    it('should accept exactly 72 bytes input', () => {
      // 18 emojis = 18 * 4 = 72 bytes
      const exact72Bytes = '🚀'.repeat(18);
      expect(Buffer.byteLength(exact72Bytes, 'utf8')).toBe(72);
      const res = validatePasswordPolicy(exact72Bytes);
      expect(res.isValid).toBe(true);
    });

    it('should reject 73 bytes input (one byte beyond bcrypt limit)', () => {
      // 18 emojis (72 bytes) + 1 ascii char (1 byte) = 73 bytes
      const exact73Bytes = '🚀'.repeat(18) + '!';
      expect(Buffer.byteLength(exact73Bytes, 'utf8')).toBe(73);
      const res = validatePasswordPolicy(exact73Bytes);
      expect(res.isValid).toBe(false);
      expect(res.error).toBe(`Password cannot exceed ${MAX_PASSWORD_BYTES} bytes due to hashing algorithm limits`);
    });
  });

  describe('4. Spaces Alongside Legitimate Characters (Preservation without Alteration)', () => {
    it('should accept passphrases containing spaces alongside characters', () => {
      const res = validatePasswordPolicy('correct horse battery staple');
      expect(res.isValid).toBe(true);
    });

    it('should accept passwords with leading spaces alongside characters', () => {
      const res = validatePasswordPolicy('   leadingSpacePass15');
      expect(res.isValid).toBe(true);
    });

    it('should accept passwords with trailing spaces alongside characters', () => {
      const res = validatePasswordPolicy('trailingSpacePass15   ');
      expect(res.isValid).toBe(true);
    });

    it('should accept passwords with internal spaces', () => {
      const res = validatePasswordPolicy('d board secure workspace pass');
      expect(res.isValid).toBe(true);
    });
  });

  describe('5. Composition Rules (No Arbitrary Uppercase/Digit/Symbol Enforcement)', () => {
    it('should accept all-lowercase passphrases without requiring numbers or symbols', () => {
      const res = validatePasswordPolicy('myverystrongsecretpassphrase');
      expect(res.isValid).toBe(true);
    });

    it('should accept mixed passphrases with special characters', () => {
      const res = validatePasswordPolicy('P@ss-phrase!With#Symbols');
      expect(res.isValid).toBe(true);
    });
  });

  describe('6. Single Repeated Character Rejection', () => {
    it('should reject 15 repeated "a" characters', () => {
      const res = validatePasswordPolicy('aaaaaaaaaaaaaaa');
      expect(res.isValid).toBe(false);
      expect(res.error).toBe('Password cannot consist of a single repeated character');
    });

    it('should reject 15 repeated "1" characters', () => {
      const res = validatePasswordPolicy('111111111111111');
      expect(res.isValid).toBe(false);
      expect(res.error).toBe('Password cannot consist of a single repeated character');
    });
  });

  describe('7. Common / Compromised Password Blocklist', () => {
    it('should reject common password "password1234567"', () => {
      const res = validatePasswordPolicy('password1234567');
      expect(res.isValid).toBe(false);
      expect(res.error).toBe('This password is too common or easily guessed. Please choose a more secure password.');
    });

    it('should reject common password case-insensitively "PASSWORD1234567"', () => {
      const res = validatePasswordPolicy('PASSWORD1234567');
      expect(res.isValid).toBe(false);
      expect(res.error).toBe('This password is too common or easily guessed. Please choose a more secure password.');
    });

    it('should reject predictable sequence "123456789012345"', () => {
      const res = validatePasswordPolicy('123456789012345');
      expect(res.isValid).toBe(false);
      expect(res.error).toBe('This password is too common or easily guessed. Please choose a more secure password.');
    });

    it('should reject common pattern "administrator12"', () => {
      const res = validatePasswordPolicy('administrator12');
      expect(res.isValid).toBe(false);
      expect(res.error).toBe('This password is too common or easily guessed. Please choose a more secure password.');
    });
  });

  describe('8. Zod Schema Integration (passwordPolicySchema)', () => {
    it('should parse valid password successfully', () => {
      const parsed = passwordPolicySchema.safeParse('ValidPassphrase123!');
      expect(parsed.success).toBe(true);
    });

    it('should fail parse on 8 spaces', () => {
      const parsed = passwordPolicySchema.safeParse('        ');
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        expect(parsed.error.issues[0].message).toBe('Password cannot consist only of spaces or whitespace');
      }
    });

    it('should fail parse on 14 characters', () => {
      const parsed = passwordPolicySchema.safeParse('ShortPasswd123');
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        expect(parsed.error.issues[0].message).toBe('Password must be at least 15 characters');
      }
    });
  });
});
