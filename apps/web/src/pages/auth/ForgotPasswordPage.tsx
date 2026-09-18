import React, { useState } from 'react';
import { AuthLayout } from '../../components/layout/AuthLayout';
import { Link, useRouter } from '../../router/Router';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { ArrowLeftIcon, ArrowRightIcon } from '../../components/ui/Icons';
import { authApi } from '../../api/auth.api';

export const ForgotPasswordPage: React.FC = () => {
  const { navigate } = useRouter();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim()) {
      setError('Email address is required');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Please enter a valid email address');
      return;
    }

    try {
      setIsLoading(true);
      await authApi.forgotPassword({ email: email.trim() });
      navigate(`/reset-password?email=${encodeURIComponent(email.trim())}`);
    } catch {
      // Generic success to prevent user enumeration
      navigate(`/reset-password?email=${encodeURIComponent(email.trim())}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout
      rightEyebrow="ACCOUNT SECURITY"
      rightHeading={
        <>
          Secure,<br />
          reliable<br />
          access.
        </>
      }
      rightSubtitle="Keep your development workspaces protected with single-use security tokens."
    >
      <div className="auth-form-wrapper">
        <Link to="/login" className="back-link">
          <ArrowLeftIcon size={16} />
          <span>Back to sign in</span>
        </Link>

        <div className="auth-header-text">
          <h1 className="auth-page-title">Reset your password</h1>
          <p className="auth-page-sub">
            Enter the email address associated with your D-Board account.
          </p>
        </div>

        <div className="auth-card">
          <form onSubmit={handleSubmit} className="auth-form-fields" noValidate>
            <Input
              label="Email address"
              type="email"
              placeholder="name@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={error}
              required
              autoComplete="email"
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
              Send reset instructions
            </Button>
          </form>
        </div>
      </div>
    </AuthLayout>
  );
};
