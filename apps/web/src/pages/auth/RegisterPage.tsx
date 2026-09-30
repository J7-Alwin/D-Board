import React, { useState, useMemo } from 'react';
import { AuthLayout } from '../../components/layout/AuthLayout';
import { Link, useRouter } from '../../router/Router';
import { Input } from '../../components/ui/Input';
import { PasswordInput } from '../../components/ui/PasswordInput';
import { Checkbox } from '../../components/ui/Checkbox';
import { Button } from '../../components/ui/Button';
import { GoogleIcon, ArrowRightIcon, ArrowLeftIcon, UserIcon, LockIcon, MailIcon } from '../../components/ui/Icons';
import { authApi } from '../../api/auth.api';
import { GOOGLE_AUTH_ENABLED } from '../../config/features';
import { useAuth } from '../../context/AuthContext';
import { LegalModal } from '../../components/modals/LegalModal';

function getEmailProviderUrl(email: string): string {
  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain) return 'mailto:';
  if (domain === 'gmail.com' || domain === 'googlemail.com') {
    return 'https://mail.google.com';
  }
  if (domain === 'outlook.com' || domain === 'hotmail.com' || domain === 'live.com') {
    return 'https://outlook.live.com';
  }
  if (domain === 'yahoo.com' || domain === 'ymail.com') {
    return 'https://mail.yahoo.com';
  }
  if (domain === 'icloud.com') {
    return 'https://www.icloud.com/mail';
  }
  return `mailto:${email}`;
}

const EmailEnvelopeIllustration: React.FC = () => {
  return (
    <svg
      className="account-created-svg"
      viewBox="0 0 320 330"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        {/* Soft shadow for the sliding letter card */}
        <filter id="cardShadow" x="-15%" y="-15%" width="130%" height="135%" filterUnits="userSpaceOnUse">
          <feDropShadow dx="0" dy="8" stdDeviation="10" floodColor="#18181B" floodOpacity="0.08" />
        </filter>
        {/* Shadow for the floating dark circular badge */}
        <filter id="darkBadgeShadow" x="-25%" y="-25%" width="150%" height="150%" filterUnits="userSpaceOnUse">
          <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#18181B" floodOpacity="0.16" />
        </filter>
        {/* Soft base shadow */}
        <filter id="envelopeBaseGlow" x="-10%" y="-10%" width="120%" height="120%" filterUnits="userSpaceOnUse">
          <feDropShadow dx="0" dy="10" stdDeviation="14" floodColor="#18181B" floodOpacity="0.06" />
        </filter>
      </defs>

      {/* Background Soft Organic Circular Aura */}
      <circle cx="150" cy="180" r="115" fill="#EFF3E8" />
      <circle cx="180" cy="150" r="135" fill="#F4F6EE" opacity="0.65" />
      <circle cx="145" cy="180" r="150" stroke="#E2E7D8" strokeWidth="1" fill="none" opacity="0.55" />

      {/* Subtle Dot Matrix in Top-Left Background */}
      <g opacity="0.45" fill="#A8B29C">
        <circle cx="65" cy="52" r="1.75" />
        <circle cx="78" cy="52" r="1.75" />
        <circle cx="91" cy="52" r="1.75" />
        <circle cx="104" cy="52" r="1.75" />
        <circle cx="117" cy="52" r="1.75" />

        <circle cx="65" cy="65" r="1.75" />
        <circle cx="78" cy="65" r="1.75" />
        <circle cx="91" cy="65" r="1.75" />
        <circle cx="104" cy="65" r="1.75" />
        <circle cx="117" cy="65" r="1.75" />

        <circle cx="65" cy="78" r="1.75" />
        <circle cx="78" cy="78" r="1.75" />
        <circle cx="91" cy="78" r="1.75" />
        <circle cx="104" cy="78" r="1.75" />
        <circle cx="117" cy="78" r="1.75" />

        <circle cx="65" cy="91" r="1.75" />
        <circle cx="78" cy="91" r="1.75" />
        <circle cx="91" cy="91" r="1.75" />
        <circle cx="104" cy="91" r="1.75" />
        <circle cx="117" cy="91" r="1.75" />
      </g>

      {/* Sweeping Dashed Arc Flight Path from lower-left to top-right airplane */}
      <path
        d="M 52 245 C 50 165, 120 95, 252 75"
        stroke="#88907E"
        strokeWidth="1.4"
        strokeDasharray="4 4"
        strokeLinecap="round"
        fill="none"
      />

      {/* Paper Airplane at Upper Right (flying ↗) */}
      <g transform="translate(258, 54) rotate(24)">
        <polygon points="0,22 26,0 17,25 10,14" fill="#FFFFFF" stroke="#18181B" strokeWidth="1.3" strokeLinejoin="round" />
        <polygon points="26,0 10,14 17,25" fill="#EAEFE2" />
        <line x1="26" y1="0" x2="10" y2="14" stroke="#18181B" strokeWidth="1.3" strokeLinejoin="round" />
        <polygon points="10,14 10,21 14,18" fill="#D6DCD0" stroke="#18181B" strokeWidth="1.3" strokeLinejoin="round" />
      </g>

      {/* Envelope Group with Soft Base Shadow */}
      <g filter="url(#envelopeBaseGlow)">
        {/* Open Envelope Back Flap (pointing upward behind the letter card) */}
        <polygon
          points="68,185 160,118 252,185"
          fill="#E7ECE0"
          stroke="#DBE1D2"
          strokeWidth="1.2"
        />

        {/* Interior Pocket Cavity Shadow behind the letter card */}
        <polygon
          points="68,185 252,185 252,260 68,260"
          fill="#DEE4D6"
        />

        {/* Sliding Letter Card (tilted ~ -6 deg) */}
        <g transform="translate(94, 126) rotate(-6)" filter="url(#cardShadow)">
          {/* Card Body */}
          <rect
            width="140"
            height="112"
            rx="16"
            fill="#FFFFFF"
            stroke="#E1E6D8"
            strokeWidth="1.4"
          />

          {/* D-Board Squircle Logo Badge on the Letter */}
          <g transform="translate(53, 16)">
            <rect width="34" height="34" rx="9" fill="#18181B" />
            <g transform="translate(1, 1) scale(0.32)">
              {/* Brand Lime Neon Chevron Arrow */}
              <polygon points="22.44,43.11 43.11,57.95 22.44,75.97" fill="#D2F843" />
              {/* White Developer 'D' shape */}
              <path
                d="M 29.33 21.38 A 6.89 6.89 0 0 0 29.33 35.16 L 54.24 35.16 C 55.3 35.16 66.43 40.46 66.43 49.47 C 66.43 58.48 53.18 63.25 47.88 59.54 L 33.57 71.73 C 31.45 74.91 31.98 77.56 36.22 77.56 L 55.3 77.56 C 72.26 77.56 80.74 65.9 80.74 49.47 C 80.74 33.04 72.26 21.38 55.3 21.38 Z"
                fill="#FFFFFF"
              />
            </g>
          </g>

          {/* Rounded Placeholder Text Lines on the Card */}
          <rect x="30" y="60" width="80" height="7" rx="3.5" fill="#D0D6C6" />
          <rect x="32" y="73" width="66" height="7" rx="3.5" fill="#DEE4D6" />

          {/* Floating Dark Circular Badge on Top-Right Corner of Card (Image 2) */}
          <g transform="translate(130, 10)">
            {/* 3 Radiating Burst Tick Marks */}
            <g stroke="#8E9480" strokeWidth="2.2" strokeLinecap="round">
              {/* Top-left tick */}
              <line x1="-10" y1="-23" x2="-15" y2="-32" />
              {/* Top-right tick */}
              <line x1="8" y1="-22" x2="16" y2="-30" />
              {/* Right tick */}
              <line x1="22" y1="-6" x2="31" y2="-5" />
            </g>

            {/* Dark Circle */}
            <circle cx="0" cy="0" r="19" fill="#18181B" filter="url(#darkBadgeShadow)" />

            {/* Small White Paper Airplane inside Dark Circle */}
            <g transform="translate(-7.5, -8) scale(0.85)">
              <polygon points="0,17 19,0 13,19 7,11" fill="#FFFFFF" stroke="#18181B" strokeWidth="0.8" strokeLinejoin="round" />
              <polygon points="19,0 7,11 13,19" fill="#E4E7DF" />
            </g>
          </g>
        </g>

        {/* Envelope Front Pocket - Left Side Flap */}
        <polygon
          points="68,185 146,242 68,285"
          fill="#F4F6EC"
          stroke="#DBE1D2"
          strokeWidth="1.2"
        />

        {/* Envelope Front Pocket - Right Side Flap */}
        <polygon
          points="252,185 174,242 252,285"
          fill="#F4F6EC"
          stroke="#DBE1D2"
          strokeWidth="1.2"
        />

        {/* Envelope Front Pocket - Bottom Center Flap with Rounded Crest (Matching Image 2) */}
        <path
          d="M 68 285 L 252 285 L 188 234 C 172 222, 148 222, 132 234 Z"
          fill="#FAFBF6"
          stroke="#DBE1D2"
          strokeWidth="1.2"
        />
      </g>
    </svg>
  );
};

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

  const [isRegistered, setIsRegistered] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState('');
  const [isResending, setIsResending] = useState(false);
  const [resendStatus, setResendStatus] = useState<string | null>(null);

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

  const handleResendVerification = async () => {
    if (!registeredEmail) return;
    setIsResending(true);
    setResendStatus(null);
    try {
      await authApi.resendVerification(registeredEmail);
      setResendStatus('A new verification email has been dispatched. Please check your inbox.');
    } catch {
      setResendStatus('A new verification email has been dispatched. Please check your inbox.');
    } finally {
      setIsResending(false);
    }
  };

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

      setRegisteredEmail(email.trim());
      setIsRegistered(true);
    } catch (err: any) {
      setErrors({
        general: err.message || 'Registration failed. Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isRegistered) {
    return (
      <AuthLayout
        headerAction={
          <div className="auth-header-nav-link">
            <span className="auth-header-nav-text">Already verified?</span>{' '}
            <Link to="/login" className="auth-header-link-highlight">
              Log in
            </Link>
          </div>
        }
      >
        <div className="account-created-wrapper">
          <Link to="/login" className="back-link" style={{ alignSelf: 'flex-start', marginBottom: '1.25rem' }}>
            <ArrowLeftIcon size={16} />
            <span>Back to sign in</span>
          </Link>

          <div className="account-created-hero-row">
            <div className="account-created-text-col">
              <h1 className="account-created-heading">Account created</h1>
              <h2 className="account-created-subheading">Check your inbox</h2>
              <p className="account-created-body">
                We sent a verification link to{' '}
                <strong className="account-created-email-highlight">{registeredEmail}</strong>.{' '}
                Click the button in your email to verify your address and unlock project collaboration.
              </p>
            </div>

            <div className="account-created-illustration-col" aria-hidden="true">
              <EmailEnvelopeIllustration />
            </div>
          </div>

          {resendStatus && (
            <div
              className="auth-alert success-alert"
              role="alert"
              style={{
                width: '100%',
                backgroundColor: '#E7F6EC',
                color: '#166534',
                border: '1px solid #BBF7D0',
                marginBottom: '1.25rem',
                borderRadius: '8px',
                padding: '0.75rem 1rem',
                fontSize: '0.875rem',
              }}
            >
              {resendStatus}
            </div>
          )}

          <div className="account-created-actions-stack">
            <button
              type="button"
              className="account-created-primary-btn"
              onClick={() => {
                const mailUrl = getEmailProviderUrl(registeredEmail);
                if (mailUrl.startsWith('http')) {
                  window.open(mailUrl, '_blank', 'noopener,noreferrer');
                } else {
                  window.location.href = mailUrl;
                }
              }}
            >
              <span>Open email / Check inbox</span>
              <ArrowRightIcon size={18} />
            </button>

            <button
              type="button"
              className="account-created-secondary-btn"
              onClick={handleResendVerification}
              disabled={isResending}
            >
              {isResending ? 'Resending...' : 'Resend verification email'}
            </button>

            <button
              type="button"
              className="account-created-text-link"
              onClick={() => navigate('/login')}
            >
              Continue to Login
            </button>
          </div>
        </div>
      </AuthLayout>
    );
  }

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
        {GOOGLE_AUTH_ENABLED && (
          <>
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
          </>
        )}

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
