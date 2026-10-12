import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { validatePassword } from '../utils/passwordPolicy';
import { RegisterPage } from '../pages/auth/RegisterPage';
import { LoginPage } from '../pages/auth/LoginPage';
import { ResetPasswordPage } from '../pages/auth/ResetPasswordPage';
import { AccountSettingsPage } from '../pages/app/AccountSettingsPage';
import { userApi } from '../api/user.api';

const mockRegister = vi.fn();
const mockLogin = vi.fn();
const mockNavigate = vi.fn();

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    register: mockRegister,
    login: mockLogin,
    user: { id: 'user-1', email: 'test@example.com', fullName: 'Test User' },
    isAuthenticated: true,
    isLoading: false,
    refreshUser: vi.fn(),
  }),
}));

vi.mock('../api/user.api', () => ({
  userApi: {
    getProfile: vi.fn().mockResolvedValue({
      success: true,
      data: {
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
        fullName: 'Test User',
        avatarUrl: null,
        googleId: null,
        headline: '',
        bio: '',
        timezone: 'UTC',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    }),
    changePassword: vi.fn().mockResolvedValue({
      success: true,
      message: 'Password changed successfully',
    }),
  },
}));

vi.mock('../router/Router', () => ({
  useRouter: () => ({
    navigate: mockNavigate,
    path: '/register',
  }),
  Link: ({ children, to, ...props }: any) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

describe('Frontend Password Policy & Form Validation Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. validatePassword Utility Tests', () => {
    it('should reject empty password', () => {
      const res = validatePassword('');
      expect(res.isValid).toBe(false);
      expect(res.error).toBe('Password is required');
    });

    it('should reject 6 spaces password', () => {
      const res = validatePassword('      ');
      expect(res.isValid).toBe(false);
      expect(res.error).toBe('Password cannot consist only of spaces or whitespace');
    });

    it('should reject 8 spaces password', () => {
      const res = validatePassword('        ');
      expect(res.isValid).toBe(false);
      expect(res.error).toBe('Password cannot consist only of spaces or whitespace');
    });

    it('should reject 15 spaces password', () => {
      const res = validatePassword('               ');
      expect(res.isValid).toBe(false);
      expect(res.error).toBe('Password cannot consist only of spaces or whitespace');
    });

    it('should reject 14 characters password', () => {
      const res = validatePassword('ShortPasswd123');
      expect(res.isValid).toBe(false);
      expect(res.error).toBe('Password must be at least 15 characters');
    });

    it('should accept 15 characters valid password', () => {
      const res = validatePassword('ValidPass15Char');
      expect(res.isValid).toBe(true);
    });

    it('should accept 64 characters valid password', () => {
      const res = validatePassword('A'.repeat(32) + 'B'.repeat(32));
      expect(res.isValid).toBe(true);
    });

    it('should reject 65 characters password', () => {
      const res = validatePassword('A'.repeat(32) + 'B'.repeat(33));
      expect(res.isValid).toBe(false);
      expect(res.error).toBe('Password must not exceed 64 characters');
    });

    it('should reject common passwords', () => {
      const res = validatePassword('password1234567');
      expect(res.isValid).toBe(false);
      expect(res.error).toBe('This password is too common or easily guessed. Please choose a more secure password.');
    });

    it('should reject single repeated character', () => {
      const res = validatePassword('aaaaaaaaaaaaaaa');
      expect(res.isValid).toBe(false);
      expect(res.error).toBe('Password cannot consist of a single repeated character');
    });

    it('should accept passwords with spaces alongside characters', () => {
      const res = validatePassword('correct horse battery staple');
      expect(res.isValid).toBe(true);
    });

    it('should accept passwords with leading/trailing spaces alongside characters', () => {
      const res = validatePassword('  leading and trailing 15  ');
      expect(res.isValid).toBe(true);
    });
  });

  describe('2. RegisterPage UI Validation', () => {
    it('should reject spaces-only password on submission and display error message', async () => {
      render(<RegisterPage />);

      fireEvent.change(screen.getByPlaceholderText(/e\.g\. Alex Henderson/i), { target: { value: 'Alex Henderson' } });
      fireEvent.change(screen.getByPlaceholderText(/e\.g\. alex_dev/i), { target: { value: 'alex_dev' } });
      fireEvent.change(screen.getByPlaceholderText(/name@company\.com/i), { target: { value: 'alex@example.com' } });
      fireEvent.change(screen.getByPlaceholderText(/minimum 15 characters/i), { target: { value: '        ' } });
      fireEvent.change(screen.getByPlaceholderText(/re-enter your password/i), { target: { value: '        ' } });
      fireEvent.click(screen.getByRole('checkbox'));

      fireEvent.click(screen.getByRole('button', { name: /create account/i }));

      expect(await screen.findByText('Password cannot consist only of spaces or whitespace')).toBeInTheDocument();
      expect(mockRegister).not.toHaveBeenCalled();
    });

    it('should reject password with less than 15 characters on RegisterPage', async () => {
      render(<RegisterPage />);

      fireEvent.change(screen.getByPlaceholderText(/e\.g\. Alex Henderson/i), { target: { value: 'Alex Henderson' } });
      fireEvent.change(screen.getByPlaceholderText(/e\.g\. alex_dev/i), { target: { value: 'alex_dev' } });
      fireEvent.change(screen.getByPlaceholderText(/name@company\.com/i), { target: { value: 'alex@example.com' } });
      fireEvent.change(screen.getByPlaceholderText(/minimum 15 characters/i), { target: { value: 'ShortPass123' } });
      fireEvent.change(screen.getByPlaceholderText(/re-enter your password/i), { target: { value: 'ShortPass123' } });
      fireEvent.click(screen.getByRole('checkbox'));

      fireEvent.click(screen.getByRole('button', { name: /create account/i }));

      expect(await screen.findByText('Password must be at least 15 characters')).toBeInTheDocument();
      expect(mockRegister).not.toHaveBeenCalled();
    });

    it('should reject password confirmation mismatch on RegisterPage', async () => {
      render(<RegisterPage />);

      fireEvent.change(screen.getByPlaceholderText(/e\.g\. Alex Henderson/i), { target: { value: 'Alex Henderson' } });
      fireEvent.change(screen.getByPlaceholderText(/e\.g\. alex_dev/i), { target: { value: 'alex_dev' } });
      fireEvent.change(screen.getByPlaceholderText(/name@company\.com/i), { target: { value: 'alex@example.com' } });
      fireEvent.change(screen.getByPlaceholderText(/minimum 15 characters/i), { target: { value: 'ValidPassphrase123!' } });
      fireEvent.change(screen.getByPlaceholderText(/re-enter your password/i), { target: { value: 'DifferentPass123!' } });
      fireEvent.click(screen.getByRole('checkbox'));

      fireEvent.click(screen.getByRole('button', { name: /create account/i }));

      expect(await screen.findByText('Passwords do not match')).toBeInTheDocument();
      expect(mockRegister).not.toHaveBeenCalled();
    });
  });

  describe('3. LoginPage UI Validation', () => {
    it('should reject spaces-only password on LoginPage', async () => {
      render(<LoginPage />);

      fireEvent.change(screen.getByPlaceholderText(/enter your email or username/i), { target: { value: 'testuser' } });
      fireEvent.change(screen.getByPlaceholderText(/enter your password/i), { target: { value: '      ' } });

      fireEvent.click(screen.getByRole('button', { name: /log in/i }));

      expect(await screen.findByText('Password is required')).toBeInTheDocument();
      expect(mockLogin).not.toHaveBeenCalled();
    });
  });

  describe('4. ResetPasswordPage UI Validation', () => {
    it('should reject spaces-only new password on ResetPasswordPage', async () => {
      render(<ResetPasswordPage />);

      fireEvent.change(screen.getByPlaceholderText(/name@company\.com/i), { target: { value: 'test@example.com' } });
      fireEvent.change(screen.getByPlaceholderText(/123456/i), { target: { value: '123456' } });
      fireEvent.change(screen.getByPlaceholderText(/minimum 15 characters/i), { target: { value: '        ' } });
      fireEvent.change(screen.getByPlaceholderText(/re-enter new password/i), { target: { value: '        ' } });

      fireEvent.click(screen.getByRole('button', { name: /update password/i }));

      expect(await screen.findByText('Password cannot consist only of spaces or whitespace')).toBeInTheDocument();
    });

    it('should reject new password below 15 characters on ResetPasswordPage', async () => {
      render(<ResetPasswordPage />);

      fireEvent.change(screen.getByPlaceholderText(/name@company\.com/i), { target: { value: 'test@example.com' } });
      fireEvent.change(screen.getByPlaceholderText(/123456/i), { target: { value: '123456' } });
      fireEvent.change(screen.getByPlaceholderText(/minimum 15 characters/i), { target: { value: 'ShortPass123' } });
      fireEvent.change(screen.getByPlaceholderText(/re-enter new password/i), { target: { value: 'ShortPass123' } });

      fireEvent.click(screen.getByRole('button', { name: /update password/i }));

      expect(await screen.findByText('Password must be at least 15 characters')).toBeInTheDocument();
    });

    it('should reject confirmation mismatch on ResetPasswordPage', async () => {
      render(<ResetPasswordPage />);

      fireEvent.change(screen.getByPlaceholderText(/name@company\.com/i), { target: { value: 'test@example.com' } });
      fireEvent.change(screen.getByPlaceholderText(/123456/i), { target: { value: '123456' } });
      fireEvent.change(screen.getByPlaceholderText(/minimum 15 characters/i), { target: { value: 'ValidNewPassword15!' } });
      fireEvent.change(screen.getByPlaceholderText(/re-enter new password/i), { target: { value: 'DifferentNewPassword15!' } });

      fireEvent.click(screen.getByRole('button', { name: /update password/i }));

      expect(await screen.findByText('Passwords do not match')).toBeInTheDocument();
    });

    it('should display Option 1 passphrase tip on ResetPasswordPage', () => {
      render(<ResetPasswordPage />);
      expect(screen.getByText(/Tip: A memorable passphrase of 3–4 words with spaces is easy to remember and secure/i)).toBeInTheDocument();
    });
  });

  describe('5. Option 1 Helper Text on RegisterPage', () => {
    it('should display Option 1 passphrase tip on RegisterPage', () => {
      render(<RegisterPage />);
      expect(screen.getByText(/Tip: A memorable passphrase of 3–4 words with spaces is easy to remember and secure/i)).toBeInTheDocument();
    });
  });

  describe('6. AccountSettingsPage Credentials & Security Tab Validation', () => {
    it('should render Credentials tab with Option 1 passphrase tip and NIST requirement pills', async () => {
      render(<AccountSettingsPage />);

      await waitFor(() => {
        expect(screen.queryByText('Loading account details...')).not.toBeInTheDocument();
      });

      const credsTabBtn = screen.getByRole('button', { name: /credentials/i });
      fireEvent.click(credsTabBtn);

      expect(await screen.findByText('Change Password')).toBeInTheDocument();
      expect(screen.getByText(/Tip: A memorable passphrase of 3–4 words with spaces is easy to remember and secure/i)).toBeInTheDocument();
      expect(screen.getByText('At least 15 characters')).toBeInTheDocument();
      expect(screen.getByText('Not only spaces')).toBeInTheDocument();
      expect(screen.getByText('Max 64 chars / 72 bytes')).toBeInTheDocument();
    });

    it('should reject password under 15 characters in AccountSettings', async () => {
      render(<AccountSettingsPage />);

      await waitFor(() => {
        expect(screen.queryByText('Loading account details...')).not.toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /credentials/i }));

      fireEvent.change(screen.getByPlaceholderText(/enter your current password/i), { target: { value: 'CurrentPass12345!' } });
      fireEvent.change(screen.getByPlaceholderText(/minimum 15 characters/i), { target: { value: 'Short123' } });
      fireEvent.change(screen.getByPlaceholderText(/repeat new password/i), { target: { value: 'Short123' } });

      fireEvent.click(screen.getByRole('button', { name: /update password/i }));

      expect(await screen.findByText('Password must be at least 15 characters')).toBeInTheDocument();
      expect(userApi.changePassword).not.toHaveBeenCalled();
    });

    it('should reject spaces-only password in AccountSettings', async () => {
      render(<AccountSettingsPage />);

      await waitFor(() => {
        expect(screen.queryByText('Loading account details...')).not.toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /credentials/i }));

      fireEvent.change(screen.getByPlaceholderText(/enter your current password/i), { target: { value: 'CurrentPass12345!' } });
      fireEvent.change(screen.getByPlaceholderText(/minimum 15 characters/i), { target: { value: '               ' } });
      fireEvent.change(screen.getByPlaceholderText(/repeat new password/i), { target: { value: '               ' } });

      fireEvent.click(screen.getByRole('button', { name: /update password/i }));

      expect(await screen.findByText('Password cannot consist only of spaces or whitespace')).toBeInTheDocument();
      expect(userApi.changePassword).not.toHaveBeenCalled();
    });

    it('should accept valid 15+ character password and call changePassword API', async () => {
      render(<AccountSettingsPage />);

      await waitFor(() => {
        expect(screen.queryByText('Loading account details...')).not.toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /credentials/i }));

      fireEvent.change(screen.getByPlaceholderText(/enter your current password/i), { target: { value: 'OldPassword12345!' } });
      fireEvent.change(screen.getByPlaceholderText(/minimum 15 characters/i), { target: { value: 'correct horse battery staple' } });
      fireEvent.change(screen.getByPlaceholderText(/repeat new password/i), { target: { value: 'correct horse battery staple' } });

      fireEvent.click(screen.getByRole('button', { name: /update password/i }));

      await waitFor(() => {
        expect(userApi.changePassword).toHaveBeenCalledWith({
          currentPassword: 'OldPassword12345!',
          newPassword: 'correct horse battery staple',
          confirmPassword: 'correct horse battery staple',
        });
      });
    });
  });
});
