import React, { useState } from 'react';
import { AuthLayout } from '../../components/layout/AuthLayout';
import { Link, useRouter } from '../../router/Router';
import { Input } from '../../components/ui/Input';
import { PasswordInput } from '../../components/ui/PasswordInput';
import { Checkbox } from '../../components/ui/Checkbox';
import { Button } from '../../components/ui/Button';
import { GoogleIcon, ArrowRightIcon, UserIcon, LockIcon } from '../../components/ui/Icons';
import { authApi } from '../../api/auth.api';
import { useAuth } from '../../context/AuthContext';

export const LoginPage: React.FC = () => {
  const { navigate } = useRouter();
  const { login } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [errors, setErrors] = useState<{ identifier?: string; password?: string; general?: string }>({});
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const newErrors: { identifier?: string; password?: string } = {};
    if (!identifier.trim()) {
      newErrors.identifier = 'Username or email is required';
    }
    if (!password) {
      newErrors.password = 'Password is required';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    try {
      setIsLoading(true);
      await login({
        identifier: identifier.trim(),
        password,
        rememberMe,
      });

      navigate('/app/dashboard');
    } catch (err: any) {
      setErrors({
        general: err.message || 'Unable to sign in. Please check your credentials and try again.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    window.location.href = authApi.getGoogleAuthUrl();
  };

  return (
    <AuthLayout
      headerAction={
        <div className="auth-header-nav-link">
          <span className="auth-header-nav-text">Don&apos;t have an account?</span>{' '}
          <Link to="/register" className="auth-header-link-highlight">
            Sign up
          </Link>
        </div>
      }
    >
      <div className="auth-form-wrapper">
        {/* Title */}
        <div className="auth-header-text">
          <h1 className="auth-page-title">
            Welcome back <span className="auth-waving-hand">👋</span>
          </h1>
          <p className="auth-page-sub">
            Log in to your account and continue building together.
          </p>
        </div>

        {/* Google Sign In Button */}
        <button
          type="button"
          className="google-auth-btn"
          onClick={handleGoogleLogin}
          disabled={isLoading}
        >
          <GoogleIcon size={18} />
          <span>Continue with Google</span>
        </button>

        {/* Divider 1 */}
        <div className="auth-divider">
          <span className="divider-text">OR</span>
        </div>

        {/* General Error Alert */}
        {errors.general && (
          <div className="auth-alert error-alert" role="alert">
            {errors.general}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="auth-form-fields" noValidate>
          <Input
            label="Email or Username"
            type="text"
            placeholder="Enter your email or username"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            error={errors.identifier}
            leftIcon={<UserIcon size={18} />}
            required
            autoComplete="username"
            disabled={isLoading}
          />

          <PasswordInput
            label="Password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={errors.password}
            leftIcon={<LockIcon size={18} />}
            required
            autoComplete="current-password"
            disabled={isLoading}
          />

          <div className="auth-options-row">
            <Checkbox
              label="Keep me logged in"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              disabled={isLoading}
            />
            <Link to="/forgot-password" className="forgot-password-link">
              Forgot password?
            </Link>
          </div>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            fullWidth
            rightIcon={<ArrowRightIcon size={18} />}
            isLoading={isLoading}
          >
            Log in &rarr;
          </Button>
        </form>

        {/* Divider 2 */}
        <div className="auth-divider">
          <span className="divider-text">New to D-Board?</span>
        </div>

        {/* Create Account Secondary Button */}
        <Button
          type="button"
          variant="outline"
          size="lg"
          fullWidth
          onClick={() => navigate('/register')}
          disabled={isLoading}
        >
          Create an account
        </Button>
      </div>
    </AuthLayout>
  );
};
