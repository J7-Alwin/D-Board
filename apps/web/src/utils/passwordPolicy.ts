export const MIN_PASSWORD_LENGTH = 15;
export const MAX_PASSWORD_LENGTH = 64;
export const MAX_PASSWORD_BYTES = 72;

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
 * Validates password on the frontend to provide immediate feedback matching NIST SP 800-63B.
 * Backend remains the authoritative security boundary.
 */
export function validatePassword(password: string): PasswordValidationResult {
  if (!password) {
    return { isValid: false, error: 'Password is required' };
  }

  if (/^\s*$/.test(password)) {
    return { isValid: false, error: 'Password cannot consist only of spaces or whitespace' };
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    return {
      isValid: false,
      error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
    };
  }

  if (password.length > MAX_PASSWORD_LENGTH) {
    return {
      isValid: false,
      error: `Password must not exceed ${MAX_PASSWORD_LENGTH} characters`,
    };
  }

  const byteLength = new TextEncoder().encode(password).length;
  if (byteLength > MAX_PASSWORD_BYTES) {
    return {
      isValid: false,
      error: `Password cannot exceed ${MAX_PASSWORD_BYTES} bytes due to hashing algorithm limits`,
    };
  }

  if (/^(.)\1+$/.test(password)) {
    return {
      isValid: false,
      error: 'Password cannot consist of a single repeated character',
    };
  }

  if (COMMON_PASSWORDS_SET.has(password.toLowerCase())) {
    return {
      isValid: false,
      error: 'This password is too common or easily guessed. Please choose a more secure password.',
    };
  }

  return { isValid: true };
}
