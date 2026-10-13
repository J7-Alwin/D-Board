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
    fireEvent.change(screen.getByPlaceholderText(/minimum 15 characters/i), { target: { value: 'Password123!Secure' } });
    fireEvent.change(screen.getByPlaceholderText(/re-enter your password/i), { target: { value: 'Password123!Secure' } });

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
    fireEvent.change(screen.getByPlaceholderText(/minimum 15 characters/i), { target: { value: 'Password123!Secure' } });
    fireEvent.change(screen.getByPlaceholderText(/re-enter your password/i), { target: { value: 'Password123!Secure' } });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));

    const resendBtn = await screen.findByRole('button', { name: /resend verification email/i });
    fireEvent.click(resendBtn);

    await waitFor(() => {
      expect(resendSpy).toHaveBeenCalledWith('alex@example.com');
      expect(screen.getByText(/A new verification email has been dispatched/i)).toBeInTheDocument();
    });
  });

  it('should display error message, populate field error, reset loading state, and keep form usable on registration failure', async () => {
    const apiError = Object.assign(new Error('Email address is already registered'), {
      data: {
        errors: {
          email: ['This email address is already registered'],
        },
      },
    });
    mockRegister.mockRejectedValueOnce(apiError);

    render(<RegisterPage />);

    fireEvent.change(screen.getByPlaceholderText(/e\.g\. Alex Henderson/i), { target: { value: 'Alex Henderson' } });
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. alex_dev/i), { target: { value: 'alex_dev' } });
    fireEvent.change(screen.getByPlaceholderText(/name@company\.com/i), { target: { value: 'duplicate@example.com' } });
    fireEvent.change(screen.getByPlaceholderText(/minimum 15 characters/i), { target: { value: 'Password123!Secure' } });
    fireEvent.change(screen.getByPlaceholderText(/re-enter your password/i), { target: { value: 'Password123!Secure' } });
    fireEvent.click(screen.getByRole('checkbox'));

    const submitBtn = screen.getByRole('button', { name: /create account/i });
    fireEvent.click(submitBtn);

    // Verify error is displayed on UI in both general banner and field error
    expect(await screen.findByText('Email address is already registered')).toBeInTheDocument();
    expect(screen.getByText('This email address is already registered')).toBeInTheDocument();

    // Verify loading has reset and button is not disabled
    expect(submitBtn).not.toBeDisabled();

    // Verify inputs remain interactive
    const emailInput = screen.getByPlaceholderText(/name@company\.com/i);
    expect(emailInput).not.toBeDisabled();
    fireEvent.change(emailInput, { target: { value: 'new_unique@example.com' } });
    expect(emailInput).toHaveValue('new_unique@example.com');
  });

  it('should transition to account created screen when email delivery failed without reporting false registration failure', async () => {
    mockRegister.mockResolvedValueOnce({
      success: true,
      message: 'Account created successfully, but we could not deliver the verification email. You can request a new one from the verification screen.',
      data: {
        user: { id: 'u1', username: 'alex_dev', email: 'alex@example.com' },
        emailDeliveryStatus: 'failed',
      },
    });

    render(<RegisterPage />);

    fireEvent.change(screen.getByPlaceholderText(/e\.g\. Alex Henderson/i), { target: { value: 'Alex Henderson' } });
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. alex_dev/i), { target: { value: 'alex_dev' } });
    fireEvent.change(screen.getByPlaceholderText(/name@company\.com/i), { target: { value: 'alex@example.com' } });
    fireEvent.change(screen.getByPlaceholderText(/minimum 15 characters/i), { target: { value: 'Password123!Secure' } });
    fireEvent.change(screen.getByPlaceholderText(/re-enter your password/i), { target: { value: 'Password123!Secure' } });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));

    // User should see Account created screen (NOT a registration failure)
    expect(await screen.findByText('Account created')).toBeInTheDocument();
    expect(screen.getByText('alex@example.com')).toBeInTheDocument();

    // User should see actionable delivery failure note and resend button
    expect(screen.getByText(/could not deliver your verification email automatically/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /resend verification email/i })).toBeInTheDocument();
  });
});
