import React, { useState, useMemo } from 'react';
import { AuthLayout } from '../../components/layout/AuthLayout';
import { Link, useRouter } from '../../router/Router';
import { Input } from '../../components/ui/Input';
import { PasswordInput } from '../../components/ui/PasswordInput';
import { Checkbox } from '../../components/ui/Checkbox';
import { Button } from '../../components/ui/Button';
import { GoogleIcon, ArrowRightIcon, UserIcon, LockIcon, MailIcon } from '../../components/ui/Icons';
import { authApi } from '../../api/auth.api';
import { useAuth } from '../../context/AuthContext';
import { LegalModal } from '../../components/modals/LegalModal';

export const RegisterPage: React.FC = () => {
  const { navigate } = useRouter();
  const { register } = useAuth();

  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState('');
  const [legalModalType, setLegalModalType] = useState<'terms' | 'privacy' | null>(null);

  const [errors, setErrors] = useState<{
    fullName?: string;
    username?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
    termsAccepted?: string;
    general?: string;
  }>({});
  const [isLoading, setIsLoading] = useState(false);

  // Compute initials for the fallback avatar
  const initials = useMemo(() => {
    if (fullName.trim()) {
      const parts = fullName.trim().split(/\s+/);
      if (parts.length >= 2) {
        return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
      }
      return parts[0].slice(0, 2).toUpperCase();
    }
    if (username.trim()) {
      return username.trim().slice(0, 2).toUpperCase();
    }
    return '';
  }, [fullName, username]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const newErrors: {
      fullName?: string;
      username?: string;
      email?: string;
      password?: string;
      confirmPassword?: string;
      termsAccepted?: string;
    } = {};

    if (!fullName.trim()) {
      newErrors.fullName = 'Full name is required';
    }

    if (!username.trim()) {
      newErrors.username = 'Username is required';
    } else if (username.trim().length < 3) {
      newErrors.username = 'Username must be at least 3 characters';
    } else if (!/^[a-zA-Z0-9_-]+$/.test(username.trim())) {
      newErrors.username = 'Username can only contain letters, numbers, underscores and dashes';
    }

    if (!email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!password) {
      newErrors.password = 'Password is required';
    } else if (password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    }

    if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    if (!termsAccepted) {
      newErrors.termsAccepted = 'You must accept the terms of service to continue';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    try {
      setIsLoading(true);
      await register({
        fullName: fullName.trim(),
        username: username.trim(),
        email: email.trim(),
        password,
        avatarUrl: avatarUrl.trim() || undefined,
        termsAccepted: true,
      });

      navigate('/app/dashboard');
    } catch (err: any) {
      setErrors({
        general: err.message || 'Registration failed. Please try again.',
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
          <span className="auth-header-nav-text">Already have an account?</span>{' '}
          <Link to="/login" className="auth-header-link-highlight">
            Log in
          </Link>
        </div>
      }
    >
      <div className="auth-form-wrapper">
        {/* Title */}
        <div className="auth-header-text">
          <h1 className="auth-page-title">Create an account</h1>
          <p className="auth-page-sub">
            Start organizing your development projects with your team today.
          </p>
        </div>

        {/* Google Sign In */}
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
          {/* Optional Avatar Placeholder */}
          <div className="avatar-picker-section">
            <div className="avatar-preview-circle">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar Preview" className="avatar-preview-img" />
              ) : initials ? (
                <span className="avatar-initials-text">{initials}</span>
              ) : (
                <UserIcon size={22} className="avatar-placeholder-icon" />
              )}
            </div>
            <div className="avatar-picker-info">
              <div className="avatar-picker-label">
                Profile photo <span className="avatar-optional-badge">(Optional)</span>
              </div>
              <div className="avatar-picker-help">
                {initials ? `Using initials "${initials}".` : 'JPG, PNG or SVG.'}
              </div>
              <div className="avatar-picker-actions">
                <label className="avatar-upload-btn">
                  <span>{avatarUrl ? 'Change photo' : '+ Add Photo'}</span>
                  <input
                    type="file"
                    accept="image/png, image/jpeg, image/svg+xml"
                    className="avatar-file-input"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (event) => {
                          if (typeof event.target?.result === 'string') {
                            setAvatarUrl(event.target.result);
                          }
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                    disabled={isLoading}
                  />
                </label>
                {avatarUrl && (
                  <button
                    type="button"
                    className="avatar-remove-btn"
                    onClick={() => setAvatarUrl('')}
                    disabled={isLoading}
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          </div>

          <Input
            label="Full Name"
            type="text"
            placeholder="e.g. Alex Henderson"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            error={errors.fullName}
            leftIcon={<UserIcon size={18} />}
            required
            autoComplete="name"
            disabled={isLoading}
          />

          <Input
            label="Username"
            type="text"
            placeholder="e.g. alex_dev"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            error={errors.username}
            leftIcon={<span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-muted)' }}>@</span>}
            required
            autoComplete="username"
            disabled={isLoading}
          />

          <Input
            label="Email address"
            type="email"
            placeholder="name@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={errors.email}
            leftIcon={<MailIcon size={18} />}
            required
            autoComplete="email"
            disabled={isLoading}
          />

          <PasswordInput
            label="Password"
            placeholder="Minimum 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={errors.password}
            leftIcon={<LockIcon size={18} />}
            required
            autoComplete="new-password"
            disabled={isLoading}
          />

          <PasswordInput
            label="Confirm Password"
            placeholder="Re-enter your password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            error={errors.confirmPassword}
            leftIcon={<LockIcon size={18} />}
            required
            autoComplete="new-password"
            disabled={isLoading}
          />

          <div className="terms-checkbox-wrap">
            <Checkbox
              label={
                <span>
                  I agree to the{' '}
                  <button
                    type="button"
                    className="legal-link"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setLegalModalType('terms');
                    }}
                    style={{ background: 'none', border: 'none', padding: 0, textDecoration: 'underline', color: 'inherit', font: 'inherit', cursor: 'pointer', fontWeight: 600 }}
                  >
                    Terms of Service
                  </button>{' '}
                  and{' '}
                  <button
                    type="button"
                    className="legal-link"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setLegalModalType('privacy');
                    }}
                    style={{ background: 'none', border: 'none', padding: 0, textDecoration: 'underline', color: 'inherit', font: 'inherit', cursor: 'pointer', fontWeight: 600 }}
                  >
                    Privacy Policy
                  </button>
                </span>
              }
              checked={termsAccepted}
              onChange={(e) => setTermsAccepted(e.target.checked)}
              disabled={isLoading}
            />
            {errors.termsAccepted && (
              <span className="input-error-msg">{errors.termsAccepted}</span>
            )}
          </div>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            fullWidth
            rightIcon={<ArrowRightIcon size={18} />}
            isLoading={isLoading}
          >
            Create account
          </Button>
        </form>

        {/* Divider 2 */}
        <div className="auth-divider">
          <span className="divider-text">Already registered?</span>
        </div>

        {/* Log in Outline Button */}
        <Button
          type="button"
          variant="outline"
          size="lg"
          fullWidth
          onClick={() => navigate('/login')}
          disabled={isLoading}
        >
          Log in instead
        </Button>

        {/* Inline Legal Modal */}
        {legalModalType && (
          <LegalModal
            isOpen={!!legalModalType}
            onClose={() => setLegalModalType(null)}
            type={legalModalType}
          />
        )}
      </div>
    </AuthLayout>
  );
};
