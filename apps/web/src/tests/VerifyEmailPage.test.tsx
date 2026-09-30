import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { VerifyEmailPage } from '../pages/auth/VerifyEmailPage';
import { authApi } from '../api/auth.api';

const mockNavigate = vi.fn();
const mockRefreshUser = vi.fn().mockResolvedValue(undefined);

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    isAuthenticated: false,
    user: null,
    refreshUser: mockRefreshUser,
    isLoading: false,
  }),
}));

vi.mock('../router/Router', () => ({
  useRouter: () => ({
    navigate: mockNavigate,
    path: '/verify-email',
  }),
  Link: ({ children, to, ...props }: any) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

describe('VerifyEmailPage Component Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete (window as any).location;
    (window as any).location = new URL('http://localhost:5173/verify-email');
  });

  it('1. should show invalid state when no token is present in URL', async () => {
    (window as any).location = new URL('http://localhost:5173/verify-email');

    render(<VerifyEmailPage />);

    expect(await screen.findByText(/Invalid verification link/i)).toBeInTheDocument();
    expect(screen.getByText(/No verification token was provided/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /resend verification email/i })).toBeInTheDocument();
  });

  it('2. should show loading state and transition to success on valid token', async () => {
    (window as any).location = new URL('http://localhost:5173/verify-email?token=valid-token-123');
    const verifySpy = vi.spyOn(authApi, 'verifyEmail').mockResolvedValueOnce({
      success: true,
      message: 'Email verified successfully',
    });

    render(<VerifyEmailPage />);

    // Verifying text should show during initial check or transition
    expect(await screen.findByText(/Account Verified/i)).toBeInTheDocument();
    expect(screen.getByText(/Your D-Board account is now fully verified/i)).toBeInTheDocument();
    expect(verifySpy).toHaveBeenCalledWith('valid-token-123');

    const continueBtn = screen.getByRole('button', { name: /continue to login/i });
    expect(continueBtn).toBeInTheDocument();
    fireEvent.click(continueBtn);
    expect(mockNavigate).toHaveBeenCalledWith('/login');
  });

  it('3. should show expired state when backend returns TOKEN_EXPIRED error', async () => {
    (window as any).location = new URL('http://localhost:5173/verify-email?token=expired-token-123');
    const apiError = new Error('Verification link expired');
    (apiError as any).data = { code: 'TOKEN_EXPIRED', message: 'Verification link expired' };
    vi.spyOn(authApi, 'verifyEmail').mockRejectedValueOnce(apiError);

    render(<VerifyEmailPage />);

    expect(await screen.findByText(/Verification link expired/i)).toBeInTheDocument();
    expect(screen.getByText(/Request a fresh verification link/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/name@example.com/i)).toBeInTheDocument();
  });

  it('4. should show invalid state when backend returns TOKEN_INVALID error', async () => {
    (window as any).location = new URL('http://localhost:5173/verify-email?token=invalid-token-123');
    const apiError = new Error('Invalid verification link');
    (apiError as any).data = { code: 'TOKEN_INVALID', message: 'Invalid or already used verification link' };
    vi.spyOn(authApi, 'verifyEmail').mockRejectedValueOnce(apiError);

    render(<VerifyEmailPage />);

    expect(await screen.findByText(/Invalid verification link/i)).toBeInTheDocument();
    expect(screen.getByText(/Verification Unsuccessful/i)).toBeInTheDocument();
  });

  it('5. should allow user to resend verification email from expired/invalid state', async () => {
    (window as any).location = new URL('http://localhost:5173/verify-email');
    const resendSpy = vi.spyOn(authApi, 'resendVerification').mockResolvedValueOnce({
      success: true,
      message: 'Verification email sent',
    });

    render(<VerifyEmailPage />);

    const emailInput = await screen.findByPlaceholderText(/name@example.com/i);
    fireEvent.change(emailInput, { target: { value: 'user@example.com' } });

    const submitBtn = screen.getByRole('button', { name: /resend verification email/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(resendSpy).toHaveBeenCalledWith('user@example.com');
      expect(screen.getByText(/If an account exists with this email address, a new verification link has been sent/i)).toBeInTheDocument();
    });
  });
});
