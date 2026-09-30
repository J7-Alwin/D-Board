import React, { useState, useEffect, useRef } from 'react';
import { AuthLayout } from '../../components/layout/AuthLayout';
import { Link, useRouter } from '../../router/Router';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import {
  CheckIcon,
  AlertCircleIcon,
  ClockIcon,
  ArrowRightIcon,
  ArrowLeftIcon,
  MailIcon,
} from '../../components/ui/Icons';
import { authApi } from '../../api/auth.api';
import { useAuth } from '../../context/AuthContext';

type VerificationState = 'loading' | 'success' | 'expired' | 'invalid';

export const VerifyEmailPage: React.FC = () => {
  const { navigate } = useRouter();
  const { isAuthenticated, refreshUser } = useAuth();

  const [state, setState] = useState<VerificationState>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [resendEmail, setResendEmail] = useState('');
  const [isResending, setIsResending] = useState(false);
  const [resendStatus, setResendStatus] = useState<string | null>(null);
  const [resendError, setResendError] = useState<string | null>(null);

  const verificationAttempted = useRef(false);

  useEffect(() => {
    if (verificationAttempted.current) return;
    verificationAttempted.current = true;

    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');

    if (!token || !token.trim()) {
      setState('invalid');
      setErrorMessage('No verification token was provided in the link.');
      return;
    }

    async function executeVerification(rawToken: string) {
      try {
        setState('loading');
        await authApi.verifyEmail(rawToken);
        setState('success');
        // If user already had an active session, refresh profile state
        if (isAuthenticated) {
          refreshUser().catch(() => {});
        }
      } catch (err: any) {
        const errorCode = err?.data?.code || err?.code;
        const msg = err?.data?.message || err?.message || 'Verification failed';

        if (errorCode === 'TOKEN_EXPIRED' || msg.toLowerCase().includes('expire')) {
          setState('expired');
          setErrorMessage('Your verification link has expired. Verification links are valid for 24 hours.');
        } else {
          setState('invalid');
          setErrorMessage('This verification link is invalid or has already been used.');
        }
      }
    }

    executeVerification(token.trim());
  }, [isAuthenticated, refreshUser]);

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resendEmail.trim()) {
      setResendError('Please enter your email address');
      return;
    }

    setIsResending(true);
    setResendStatus(null);
    setResendError(null);

    try {
      await authApi.resendVerification(resendEmail.trim());
      setResendStatus('If an account exists with this email address, a new verification link has been sent to your inbox.');
    } catch (err: any) {
      const msg = err?.data?.message || err?.message || 'Failed to dispatch verification email. Please try again.';
      setResendError(msg);
    } finally {
      setIsResending(false);
    }
  };

  return (
    <AuthLayout
      headerAction={
        <div className="auth-header-nav-link">
          <span className="auth-header-nav-text">Need help?</span>{' '}
          <Link to="/login" className="auth-header-link-highlight">
            Sign in
          </Link>
        </div>
      }
    >
      <div className="auth-form-wrapper">
        <Link to="/login" className="back-link">
          <ArrowLeftIcon size={16} />
          <span>Back to sign in</span>
        </Link>

        {/* 1. Loading State */}
        {state === 'loading' && (
          <div className="auth-card" style={{ textAlign: 'center', padding: '3rem 2rem' }}>
            <div
              className="loading-spinner"
              style={{
                width: '48px',
                height: '48px',
                border: '3px solid rgba(0, 0, 0, 0.1)',
                borderTopColor: '#1F1F1F',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
                margin: '0 auto 1.5rem',
              }}
            />
            <h2 className="auth-page-title" style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>
              Verifying your email...
            </h2>
            <p className="auth-page-sub">
              Please wait a moment while we validate your verification token with D-Board.
            </p>
          </div>
        )}

        {/* 2. Success State */}
        {state === 'success' && (
          <div>
            <div className="auth-header-text">
              <h1 className="auth-page-title">Email verified</h1>
              <p className="auth-page-sub">
                Your email address has been verified successfully.
              </p>
            </div>

            <div className="auth-card">
              <div className="auth-success-state">
                <div
                  className="success-icon-wrap"
                  style={{
                    backgroundColor: '#E7F6EC',
                    color: '#166534',
                    border: '1px solid #BBF7D0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '56px',
                    height: '56px',
                    borderRadius: '50%',
                    margin: '0 auto 1.25rem',
                  }}
                >
                  <CheckIcon size={28} />
                </div>
                <h3 className="success-title">Account Verified</h3>
                <p className="success-desc">
                  Your D-Board account is now fully verified. You can now accept project invitations, collaborate with teammates, and manage sprints.
                </p>

                <div className="success-actions" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', width: '100%', marginTop: '1.25rem' }}>
                  <Button
                    variant="primary"
                    size="lg"
                    fullWidth
                    rightIcon={<ArrowRightIcon size={18} />}
                    onClick={() => navigate(isAuthenticated ? '/app/dashboard' : '/login')}
                  >
                    {isAuthenticated ? 'Go to Workspace' : 'Continue to Login'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 3. Expired State */}
        {state === 'expired' && (
          <div>
            <div className="auth-header-text">
              <h1 className="auth-page-title">Verification link expired</h1>
              <p className="auth-page-sub">
                {errorMessage || 'This verification link has expired. Verification links are valid for 24 hours.'}
              </p>
            </div>

            <div className="auth-card">
              <div className="auth-success-state">
                <div
                  className="success-icon-wrap"
                  style={{
                    backgroundColor: 'rgba(234, 179, 8, 0.1)',
                    color: '#CA8A04',
                    border: '1px solid rgba(234, 179, 8, 0.25)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '56px',
                    height: '56px',
                    borderRadius: '50%',
                    margin: '0 auto 1.25rem',
                  }}
                >
                  <ClockIcon size={28} />
                </div>
                <h3 className="success-title">Request a fresh verification link</h3>
                <p className="success-desc">
                  Enter your email address below and we'll send you a new link to verify your account.
                </p>

                {resendStatus && (
                  <div
                    className="auth-alert success-alert"
                    role="alert"
                    style={{ width: '100%', backgroundColor: '#E7F6EC', color: '#166534', border: '1px solid #BBF7D0', margin: '1rem 0' }}
                  >
                    {resendStatus}
                  </div>
                )}

                {resendError && (
                  <div className="auth-alert error-alert" role="alert" style={{ width: '100%', margin: '1rem 0' }}>
                    {resendError}
                  </div>
                )}

                <form onSubmit={handleResend} style={{ width: '100%', marginTop: '1rem' }}>
                  <Input
                    label="Email address"
                    type="email"
                    placeholder="name@example.com"
                    value={resendEmail}
                    onChange={(e) => setResendEmail(e.target.value)}
                    leftIcon={<MailIcon size={18} />}
                    required
                    disabled={isResending}
                  />

                  <div style={{ marginTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <Button
                      type="submit"
                      variant="primary"
                      size="lg"
                      fullWidth
                      isLoading={isResending}
                    >
                      Resend verification email
                    </Button>

                    <Button
                      type="button"
                      variant="ghost"
                      size="md"
                      fullWidth
                      onClick={() => navigate('/login')}
                    >
                      Back to sign in
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* 4. Invalid State */}
        {state === 'invalid' && (
          <div>
            <div className="auth-header-text">
              <h1 className="auth-page-title">Invalid verification link</h1>
              <p className="auth-page-sub">
                {errorMessage || 'This link is invalid or has already been used to verify an account.'}
              </p>
            </div>

            <div className="auth-card">
              <div className="auth-success-state">
                <div
                  className="success-icon-wrap"
                  style={{
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    color: '#DC2626',
                    border: '1px solid rgba(239, 68, 68, 0.25)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '56px',
                    height: '56px',
                    borderRadius: '50%',
                    margin: '0 auto 1.25rem',
                  }}
                >
                  <AlertCircleIcon size={28} />
                </div>
                <h3 className="success-title">Verification Unsuccessful</h3>
                <p className="success-desc">
                  The link you used may have already been used, or it might be incomplete. You can request a new verification email below or try signing in.
                </p>

                {resendStatus && (
                  <div
                    className="auth-alert success-alert"
                    role="alert"
                    style={{ width: '100%', backgroundColor: '#E7F6EC', color: '#166534', border: '1px solid #BBF7D0', margin: '1rem 0' }}
                  >
                    {resendStatus}
                  </div>
                )}

                {resendError && (
                  <div className="auth-alert error-alert" role="alert" style={{ width: '100%', margin: '1rem 0' }}>
                    {resendError}
                  </div>
                )}

                <form onSubmit={handleResend} style={{ width: '100%', marginTop: '1rem' }}>
                  <Input
                    label="Email address"
                    type="email"
                    placeholder="name@example.com"
                    value={resendEmail}
                    onChange={(e) => setResendEmail(e.target.value)}
                    leftIcon={<MailIcon size={18} />}
                    required
                    disabled={isResending}
                  />

                  <div style={{ marginTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <Button
                      type="submit"
                      variant="primary"
                      size="lg"
                      fullWidth
                      isLoading={isResending}
                    >
                      Resend verification email
                    </Button>

                    <Button
                      type="button"
                      variant="ghost"
                      size="md"
                      fullWidth
                      onClick={() => navigate('/login')}
                    >
                      Return to sign in
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </AuthLayout>
  );
};
