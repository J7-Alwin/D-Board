import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LoginPage } from '../pages/auth/LoginPage';
import { RegisterPage } from '../pages/auth/RegisterPage';
import { AccountSettingsPage } from '../pages/app/AccountSettingsPage';
import { GOOGLE_AUTH_ENABLED } from '../config/features';

const mockNavigate = vi.fn();
const mockLogin = vi.fn();
const mockRegister = vi.fn();

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    login: mockLogin,
    register: mockRegister,
    user: { id: 'user-1', email: 'test@example.com', fullName: 'Test User' },
    isAuthenticated: true,
    isLoading: false,
    refreshUser: vi.fn(),
  }),
}));

vi.mock('../router/Router', () => ({
  useRouter: () => ({
    navigate: mockNavigate,
    path: '/login',
  }),
  Link: ({ children, to, ...props }: any) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
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
  },
}));

describe('Google Authentication Disabled Feature Flag', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('verifies GOOGLE_AUTH_ENABLED feature flag evaluates to false by default', () => {
    expect(GOOGLE_AUTH_ENABLED).toBe(false);
  });

  describe('LoginPage', () => {
    it('does not render "Continue with Google" button or the OR divider', () => {
      render(<LoginPage />);

      expect(screen.queryByText(/continue with google/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/^OR$/)).not.toBeInTheDocument();
      // Form elements should remain intact
      expect(screen.getByPlaceholderText(/enter your email or username/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/enter your password/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /log in/i })).toBeInTheDocument();
    });
  });

  describe('RegisterPage', () => {
    it('does not render "Continue with Google" button or the OR divider', () => {
      render(<RegisterPage />);

      expect(screen.queryByText(/continue with google/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/^OR$/)).not.toBeInTheDocument();
      // Registration form elements should remain intact
      expect(screen.getByPlaceholderText(/e\.g\. Alex Henderson/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/e\.g\. alex_dev/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/name@company\.com/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument();
    });
  });

  describe('AccountSettingsPage', () => {
    it('shows Google Account as temporarily unavailable without link button', async () => {
      render(<AccountSettingsPage />);

      await waitFor(() => {
        expect(screen.queryByText('Loading account details...')).not.toBeInTheDocument();
      });

      // Navigate to Credentials & Security tab
      const credsTabBtn = screen.getByRole('button', { name: /credentials/i });
      fireEvent.click(credsTabBtn);

      expect(await screen.findByText('Google Account')).toBeInTheDocument();
      expect(screen.getByText('Temporarily unavailable')).toBeInTheDocument();
      expect(screen.getByText('Unavailable')).toBeInTheDocument();
      expect(screen.queryByText(/link google/i)).not.toBeInTheDocument();
    });
  });
});
