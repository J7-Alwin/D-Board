import React, { useState, useEffect } from 'react';
import { AuthLayout } from '../../components/layout/AuthLayout';
import { Link, useRouter } from '../../router/Router';
import { Input } from '../../components/ui/Input';
import { PasswordInput } from '../../components/ui/PasswordInput';
import { Button } from '../../components/ui/Button';
import { ArrowLeftIcon, ArrowRightIcon, CheckIcon } from '../../components/ui/Icons';
import { authApi } from '../../api/auth.api';

export const ResetPasswordPage: React.FC = () => {
  const { navigate } = useRouter();
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; otp?: string; newPassword?: string; confirmPassword?: string; general?: string }>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendStatus, setResendStatus] = useState<string | null>(null);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tokenParam = urlParams.get('token');
    const emailParam = urlParams.get('email');
    if (tokenParam) {
      setToken(tokenParam);
    }
    if (emailParam) {
      setEmail(emailParam);
    }
  }, []);

  const handleResendOtp = async () => {
    if (!email.trim()) {
      setErrors({ email: 'Please enter your email to resend code' });
      return;
    }
    setIsResending(true);
    setResendStatus(null);
    try {
      await authApi.forgotPassword({ email: email.trim() });
      setResendStatus('A new 6-digit verification code has been sent to your email.');
    } catch {
      setResendStatus('A new 6-digit verification code has been sent to your email.');
    } finally {
      setIsResending(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setResendStatus(null);

    const newErrors: { email?: string; otp?: string; newPassword?: string; confirmPassword?: string; general?: string } = {};

    if (!token && !email.trim()) {
      newErrors.email = 'Email is required';
    }

    if (!token && (!otp.trim() || otp.trim().length !== 6)) {
      newErrors.otp = 'Please enter a valid 6-digit verification code';
    }

    if (!newPassword) {
      newErrors.newPassword = 'New password is required';
    } else if (newPassword.length < 8) {
      newErrors.newPassword = 'Password must be at least 8 characters';
    }

    if (newPassword !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    try {
      setIsLoading(true);
      const payload = token
        ? { token, newPassword }
        : { email: email.trim(), otp: otp.trim(), newPassword };

      const res = await authApi.resetPassword(payload);

      if (res.success) {
        navigate('/reset-success');
      }
    } catch (err: any) {
      setErrors({
        general: err.message || 'Failed to reset password. The code may be invalid or expired.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout
      rightEyebrow="SECURE RECOVERY"
      rightHeading={
        <>
          Set your<br />
          new<br />
          password.
        </>
      }
      rightSubtitle="Enter the 6-digit verification code sent to your email to verify identity and update your password."
    >
      <div className="auth-form-wrapper">
        <Link to="/login" className="back-link">
          <ArrowLeftIcon size={16} />
          <span>Back to sign in</span>
        </Link>

        <div className="auth-header-text">
          <h1 className="auth-page-title">Reset password</h1>
          <p className="auth-page-sub">
            {email
              ? `Enter the 6-digit code sent to ${email} and your new password.`
              : 'Enter your email, 6-digit verification code, and new password.'}
          </p>
        </div>

        <div className="auth-card">
          <form onSubmit={handleSubmit} className="auth-form-fields" noValidate>
            {errors.general && (
              <div className="auth-alert error-alert" role="alert">
                {errors.general}
              </div>
            )}

            {resendStatus && (
              <div
                className="auth-alert success-alert"
                role="alert"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  backgroundColor: '#E7F6EC',
                  color: '#166534',
                  border: '1px solid #BBF7D0',
                  padding: '0.75rem 1rem',
                  borderRadius: '8px',
                  fontSize: '0.875rem',
                }}
              >
                <CheckIcon size={16} />
                <span>{resendStatus}</span>
              </div>
            )}

            {!token && (
              <>
                <Input
                  label="Email address"
                  type="email"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  error={errors.email}
                  required
                  autoComplete="email"
                  disabled={isLoading}
                />

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label className="input-label" style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-primary)' }}>
                      6-Digit Verification Code
                    </label>
                    <button
                      type="button"
                      onClick={handleResendOtp}
                      disabled={isResending || isLoading}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--primary-color, #2563EB)',
                        fontSize: '0.8125rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        padding: 0,
                      }}
                    >
                      {isResending ? 'Sending...' : 'Resend code'}
                    </button>
                  </div>
                  <Input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="123456"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    error={errors.otp}
                    required
                    disabled={isLoading}
                    style={{ letterSpacing: '0.25em', fontSize: '1.25rem', textAlign: 'center', fontWeight: 600 }}
                  />
                </div>
              </>
            )}

            <PasswordInput
              label="New Password"
              placeholder="Minimum 8 characters"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              error={errors.newPassword}
              required
              autoComplete="new-password"
              disabled={isLoading}
            />

            <PasswordInput
              label="Confirm New Password"
              placeholder="Re-enter new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              error={errors.confirmPassword}
              required
              autoComplete="new-password"
              disabled={isLoading}
            />

            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              rightIcon={<ArrowRightIcon size={18} />}
              isLoading={isLoading}
            >
              Update password
            </Button>
          </form>
        </div>
      </div>
    </AuthLayout>
  );
};
