import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RegisterPage } from '../pages/auth/RegisterPage';
import { authApi } from '../api/auth.api';

const mockRegister = vi.fn();
const mockNavigate = vi.fn();

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    register: mockRegister,
    user: null,
    isAuthenticated: false,
    isLoading: false,
  }),
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

describe('RegisterPage Component Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render registration form with inputs and terms checkbox', () => {
    render(<RegisterPage />);

    expect(screen.getByPlaceholderText(/e\.g\. Alex Henderson/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/e\.g\. alex_dev/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument();
  });

  it('should transition to verification-pending UI after successful registration and not immediately redirect', async () => {
    mockRegister.mockResolvedValueOnce(undefined);
    render(<RegisterPage />);

    fireEvent.change(screen.getByPlaceholderText(/e\.g\. Alex Henderson/i), { target: { value: 'Alex Henderson' } });
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. alex_dev/i), { target: { value: 'alex_dev' } });
    fireEvent.change(screen.getByPlaceholderText(/name@company\.com/i), { target: { value: 'alex@example.com' } });
    fireEvent.change(screen.getByPlaceholderText(/minimum 8 characters/i), { target: { value: 'Password123!' } });
    fireEvent.change(screen.getByPlaceholderText(/re-enter your password/i), { target: { value: 'Password123!' } });

    // Check terms
    const termsCheckbox = screen.getByRole('checkbox');
    fireEvent.click(termsCheckbox);

    const submitBtn = screen.getByRole('button', { name: /create account/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledTimes(1);
    });

    // Verify verification-pending screen appears
    expect(await screen.findByText('Account created')).toBeInTheDocument();
    expect(screen.getByText('Check your inbox')).toBeInTheDocument();
    expect(screen.getByText('alex@example.com')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /open email \/ check inbox/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /resend verification email/i })).toBeInTheDocument();

    // Verify user is NOT immediately navigated to /app/dashboard
    expect(mockNavigate).not.toHaveBeenCalledWith('/app/dashboard');
  });

  it('should allow requesting a resend of verification email from pending screen', async () => {
    mockRegister.mockResolvedValueOnce(undefined);
    const resendSpy = vi.spyOn(authApi, 'resendVerification').mockResolvedValueOnce({
      success: true,
      message: 'Dispatched',
    });

    render(<RegisterPage />);

    fireEvent.change(screen.getByPlaceholderText(/e\.g\. Alex Henderson/i), { target: { value: 'Alex Henderson' } });
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. alex_dev/i), { target: { value: 'alex_dev' } });
    fireEvent.change(screen.getByPlaceholderText(/name@company\.com/i), { target: { value: 'alex@example.com' } });
    fireEvent.change(screen.getByPlaceholderText(/minimum 8 characters/i), { target: { value: 'Password123!' } });
    fireEvent.change(screen.getByPlaceholderText(/re-enter your password/i), { target: { value: 'Password123!' } });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));

    const resendBtn = await screen.findByRole('button', { name: /resend verification email/i });
    fireEvent.click(resendBtn);

    await waitFor(() => {
      expect(resendSpy).toHaveBeenCalledWith('alex@example.com');
      expect(screen.getByText(/A new verification email has been dispatched/i)).toBeInTheDocument();
    });
  });
});
