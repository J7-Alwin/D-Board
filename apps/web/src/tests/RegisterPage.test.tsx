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

  describe('RegisterPage Component Tests (Pre-Registration OTP Flow)', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

      it('1. should render registration form with inputs, terms checkbox, and inline Verify button', () => {
        render(<RegisterPage />);

        expect(screen.getByPlaceholderText(/e\.g\. Alex Henderson/i)).toBeInTheDocument();
        expect(screen.getByPlaceholderText(/e\.g\. alex_dev/i)).toBeInTheDocument();
        expect(screen.getByPlaceholderText(/name@company\.com/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /^verify$/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument();
      });

        it('2. should extend gap between email & password and display OTP input when Verify is clicked', async () => {
          const sendOtpSpy = vi.spyOn(authApi, 'sendRegistrationOtp').mockResolvedValueOnce({
            success: true,
            message: 'Verification code sent to your email',
          });

          render(<RegisterPage />);

          const emailInput = screen.getByPlaceholderText(/name@company\.com/i);
          fireEvent.change(emailInput, { target: { value: 'alex@example.com' } });

          const verifyBtn = screen.getByRole('button', { name: /^verify$/i });
          fireEvent.click(verifyBtn);

          await waitFor(() => {
            expect(sendOtpSpy).toHaveBeenCalledWith('alex@example.com');
          });

          // The gap opens and displays the OTP card
          expect(await screen.findByText('Enter 6-digit code')).toBeInTheDocument();
          expect(screen.getByPlaceholderText(/• • • • • •/i)).toBeInTheDocument();
          expect(screen.getByRole('button', { name: /verify code/i })).toBeInTheDocument();
          expect(screen.getByText(/Didn't receive code\?/i)).toBeInTheDocument();
        });

          it('3. should block form submission and prompt user to verify email if unverified', async () => {
            render(<RegisterPage />);

            fireEvent.change(screen.getByPlaceholderText(/e\.g\. Alex Henderson/i), { target: { value: 'Alex Henderson' } });
            fireEvent.change(screen.getByPlaceholderText(/e\.g\. alex_dev/i), { target: { value: 'alex_dev' } });
            fireEvent.change(screen.getByPlaceholderText(/name@company\.com/i), { target: { value: 'alex@example.com' } });
            fireEvent.change(screen.getByPlaceholderText(/minimum 15 characters/i), { target: { value: 'Password123!Secure' } });
            fireEvent.change(screen.getByPlaceholderText(/re-enter your password/i), { target: { value: 'Password123!Secure' } });
            fireEvent.click(screen.getByRole('checkbox'));

            const submitBtn = screen.getByRole('button', { name: /create account/i });
            fireEvent.click(submitBtn);

            // Register should not be called
            expect(mockRegister).not.toHaveBeenCalled();
            expect(await screen.findByText(/Please verify your email address before creating an account/i)).toBeInTheDocument();
          });

              it('4. should show error when invalid OTP is entered', async () => {
              vi.spyOn(authApi, 'sendRegistrationOtp').mockResolvedValueOnce({
                success: true,
                message: 'Verification code sent',
              });

              const verifyOtpSpy = vi.spyOn(authApi, 'verifyRegistrationOtp').mockRejectedValueOnce(
                new Error('Invalid verification code. 4 attempts remaining.')
              );

              render(<RegisterPage />);

              fireEvent.change(screen.getByPlaceholderText(/name@company\.com/i), { target: { value: 'alex@example.com' } });
              fireEvent.click(screen.getByRole('button', { name: /^verify$/i }));

              const otpInput = await screen.findByPlaceholderText(/• • • • • •/i);
              fireEvent.change(otpInput, { target: { value: '123456' } });

              const verifyCodeBtn = screen.getByRole('button', { name: /verify code/i });
              fireEvent.click(verifyCodeBtn);

              await waitFor(() => {
                expect(verifyOtpSpy).toHaveBeenCalledWith('alex@example.com', '123456');
              });

              expect(await screen.findByText(/Invalid verification code. 4 attempts remaining./i)).toBeInTheDocument();
            });

            it('5. should successfully verify OTP, display Verified badge, and allow creating account with direct redirect to dashboard', async () => {
              vi.spyOn(authApi, 'sendRegistrationOtp').mockResolvedValueOnce({
                success: true,
                message: 'Verification code sent',
              });

              vi.spyOn(authApi, 'verifyRegistrationOtp').mockResolvedValueOnce({
                success: true,
                message: 'Email address verified successfully',
                verificationToken: 'valid.jwt.proof.token',
              } as any);

              mockRegister.mockResolvedValueOnce({
                success: true,
                data: { user: { id: 'u1', email: 'alex@example.com', username: 'alex_dev', isEmailVerified: true } },
              });

              render(<RegisterPage />);

              fireEvent.change(screen.getByPlaceholderText(/e\.g\. Alex Henderson/i), { target: { value: 'Alex Henderson' } });
              fireEvent.change(screen.getByPlaceholderText(/e\.g\. alex_dev/i), { target: { value: 'alex_dev' } });
              fireEvent.change(screen.getByPlaceholderText(/name@company\.com/i), { target: { value: 'alex@example.com' } });

              // Step 1: Send OTP
              fireEvent.click(screen.getByRole('button', { name: /^verify$/i }));

              // Step 2: Enter valid OTP
              const otpInput = await screen.findByPlaceholderText(/• • • • • •/i);
              fireEvent.change(otpInput, { target: { value: '654321' } });
              fireEvent.click(screen.getByRole('button', { name: /verify code/i }));

              // Step 3: Verified badge appears and email verified banner appears
              expect(await screen.findByText('Verified')).toBeInTheDocument();
              expect(screen.getByText(/Email address verified. You can now set your password and create your account./i)).toBeInTheDocument();

              // Step 4: Enter passwords & accept terms
              fireEvent.change(screen.getByPlaceholderText(/minimum 15 characters/i), { target: { value: 'Password123!Secure' } });
              fireEvent.change(screen.getByPlaceholderText(/re-enter your password/i), { target: { value: 'Password123!Secure' } });
              fireEvent.click(screen.getByRole('checkbox'));

              // Step 5: Click Create account
              fireEvent.click(screen.getByRole('button', { name: /create account/i }));

              await waitFor(() => {
                expect(mockRegister).toHaveBeenCalledTimes(1);
                expect(mockRegister).toHaveBeenCalledWith(
                  expect.objectContaining({
                    fullName: 'Alex Henderson',
                    username: 'alex_dev',
                    email: 'alex@example.com',
                    verificationToken: 'valid.jwt.proof.token',
                    termsAccepted: true,
                  })
                );
              });

              // Step 6: Directly redirects to dashboard!
              await waitFor(() => {
                expect(mockNavigate).toHaveBeenCalledWith('/app/dashboard');
              });
            });
          });
