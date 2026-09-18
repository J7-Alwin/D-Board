import React, { useState, useEffect } from 'react';
import { AuthLayout } from '../../components/layout/AuthLayout';
import { Link, useRouter } from '../../router/Router';
import { Button } from '../../components/ui/Button';
import { ArrowLeftIcon, ArrowRightIcon, CheckIcon } from '../../components/ui/Icons';
import { authApi } from '../../api/auth.api';

export const CheckEmailPage: React.FC = () => {
  const { navigate } = useRouter();
  const [email, setEmail] = useState('');
  const [isResending, setIsResending] = useState(false);
  const [resendStatus, setResendStatus] = useState<string | null>(null);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const emailParam = urlParams.get('email');
    if (emailParam) {
      setEmail(emailParam);
    }
  }, []);

  const handleResend = async () => {
    if (!email) return;
    setIsResending(true);
    setResendStatus(null);
    try {
      await authApi.forgotPassword({ email });
      setResendStatus('A new reset link has been dispatched.');
    } catch {
      setResendStatus('A new reset link has been dispatched.');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <AuthLayout
      rightEyebrow="CHECK YOUR INBOX"
      rightHeading={
        <>
          Security<br />
          first,<br />
          always.
        </>
      }
      rightSubtitle="We have sent password reset instructions to your registered email address."
    >
      <div className="auth-form-wrapper">
        <Link to="/login" className="back-link">
          <ArrowLeftIcon size={16} />
          <span>Back to sign in</span>
        </Link>

        <div className="auth-header-text">
          <h1 className="auth-page-title">Check your email</h1>
          <p className="auth-page-sub">
            We sent a secure password reset link to{' '}
            <strong>{email || 'your email address'}</strong>.
          </p>
        </div>

        <div className="auth-card">
          <div className="auth-success-state">
            <div className="success-icon-wrap">
              <CheckIcon size={24} />
            </div>
            <h3 className="success-title">Instructions dispatched</h3>
            <p className="success-desc">
              Please check your email and click the link to set a new password. The link will expire in 1 hour.
            </p>

            {resendStatus && (
              <div className="auth-alert success-alert" role="alert" style={{ width: '100%', backgroundColor: '#E7F6EC', color: '#166534', border: '1px solid #BBF7D0' }}>
                {resendStatus}
              </div>
            )}

            <div className="success-actions" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <Button
                variant="primary"
                size="lg"
                fullWidth
                rightIcon={<ArrowRightIcon size={18} />}
                onClick={() => navigate('/login')}
              >
                Return to sign in
              </Button>

              {email && (
                <Button
                  variant="outline"
                  size="md"
                  fullWidth
                  onClick={handleResend}
                  isLoading={isResending}
                >
                  Didn't receive email? Resend
                </Button>
              )}
            </div>
          </div>
        </div>

        <p className="auth-legal-text">
          Make sure to check your spam or junk folder if you don't see the email within a few minutes.
        </p>
      </div>
    </AuthLayout>
  );
};
