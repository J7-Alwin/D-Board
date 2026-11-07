import React, { useState, useMemo, useEffect } from 'react';
import { AuthLayout } from '../../components/layout/AuthLayout';
import { Link, useRouter } from '../../router/Router';
import { Input } from '../../components/ui/Input';
import { PasswordInput } from '../../components/ui/PasswordInput';
import { Checkbox } from '../../components/ui/Checkbox';
import { Button } from '../../components/ui/Button';
import { GoogleIcon, ArrowRightIcon, UserIcon, LockIcon, MailIcon } from '../../components/ui/Icons';
import { authApi } from '../../api/auth.api';
import { GOOGLE_AUTH_ENABLED } from '../../config/features';
import { useAuth } from '../../context/AuthContext';
import { LegalModal } from '../../components/modals/LegalModal';
import { validatePassword } from '../../utils/passwordPolicy';

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

  // Pre-registration OTP email verification state
  const [isEmailVerified, setIsEmailVerified] = useState(false);
  const [verificationToken, setVerificationToken] = useState<string | null>(null);
  const [showOtpBox, setShowOtpBox] = useState(false);
  const [otp, setOtp] = useState('');
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpSuccessMessage, setOtpSuccessMessage] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

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

  // Countdown timer for OTP resend cooldown
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

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

    const handleSendOtp = async () => {
      const trimmedEmail = email.trim();
      if (!trimmedEmail) {
        setErrors((prev) => ({ ...prev, email: 'Email address is required' }));
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
        setErrors((prev) => ({ ...prev, email: 'Please enter a valid email address' }));
        return;
      }

      try {
        setIsSendingOtp(true);
        setErrors((prev) => ({ ...prev, email: undefined }));
        setOtpError(null);
        setOtpSuccessMessage(null);

        const res: any = await authApi.sendRegistrationOtp(trimmedEmail);
        setShowOtpBox(true);
        setResendCooldown(60);
        setOtpSuccessMessage(res.message || 'Verification code sent to your email');
      } catch (err: any) {
        const errMsg =
          err?.message ||
          err?.data?.message ||
          err?.data?.errors?.email?.[0] ||
          'Failed to send verification code. Please try again.';
        setErrors((prev) => ({ ...prev, email: errMsg }));
        setOtpError(errMsg);
      } finally {
        setIsSendingOtp(false);
      }
    };

    const handleVerifyOtp = async () => {
      const cleanOtp = otp.trim();
      if (!cleanOtp || cleanOtp.length !== 6) {
        setOtpError('Please enter the 6-digit verification code');
        return;
      }

      try {
        setIsVerifyingOtp(true);
        setOtpError(null);

        const res: any = await authApi.verifyRegistrationOtp(email.trim(), cleanOtp);
        const token = res.verificationToken || res.data?.verificationToken;
        if (token) {
          setVerificationToken(token);
          setIsEmailVerified(true);
          setShowOtpBox(false);
          setOtp('');
          setOtpError(null);
          setErrors((prev) => ({ ...prev, email: undefined }));
        } else {
          setOtpError('Verification failed. Invalid verification token.');
        }
      } catch (err: any) {
        const errMsg =
          err?.message ||
          err?.data?.message ||
          'Verification failed. Please check your code and try again.';
        setOtpError(errMsg);
      } finally {
        setIsVerifyingOtp(false);
      }
    };

    const handleResendOtp = async () => {
      if (resendCooldown > 0 || isSendingOtp) return;
      await handleSendOtp();
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
        newErrors.email = 'Email address is required';
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        newErrors.email = 'Please enter a valid email address';
      } else if (!isEmailVerified) {
        newErrors.email = 'Please verify your email address before creating an account';
        if (!showOtpBox) {
          handleSendOtp();
        }
      }

      const passwordValidation = validatePassword(password);
      if (!passwordValidation.isValid) {
        newErrors.password = passwordValidation.error;
      }

      if (!confirmPassword) {
        newErrors.confirmPassword = 'Confirm password is required';
      } else if (password !== confirmPassword) {
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
            verificationToken: verificationToken || undefined,
          });

        // Direct authenticated user straight to the dashboard
        navigate('/app/dashboard');
      } catch (err: any) {
        const fieldErrors: typeof errors = {};
        if (err.data?.errors) {
          if (err.data.errors.username?.[0]) fieldErrors.username = err.data.errors.username[0];
          if (err.data.errors.email?.[0]) fieldErrors.email = err.data.errors.email[0];
          if (err.data.errors.password?.[0]) fieldErrors.password = err.data.errors.password[0];
          if (err.data.errors.fullName?.[0]) fieldErrors.fullName = err.data.errors.fullName[0];
        }
        setErrors({
          ...fieldErrors,
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

            {/* Email address field with inline Verify button */}
            <div className="register-email-section">
              <div className="input-group">
                <label htmlFor="register-email-input" className="input-label">
                  Email address <span className="input-required" aria-hidden="true">*</span>
                </label>
                <div className={`input-wrapper ${errors.email ? 'has-error' : ''} has-left-icon`}>
                  <span className="input-icon-left">
                    <MailIcon size={18} />
                  </span>
                  <input
                    id="register-email-input"
                    type="email"
                    placeholder="name@company.com"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (isEmailVerified) {
                        setIsEmailVerified(false);
                        setVerificationToken(null);
                      }
                      if (errors.email) {
                        setErrors((prev) => ({ ...prev, email: undefined }));
                      }
                    }}
                    className="input-field"
                    style={{ paddingRight: isEmailVerified ? '7.5rem' : '5.5rem' }}
                    required
                    autoComplete="email"
                    disabled={isLoading || isSendingOtp || isEmailVerified}
                  />
                  <div className="email-verify-action-slot">
                    {isEmailVerified ? (
                      <div className="email-verified-pill-wrap">
                        <span className="email-verified-pill" aria-label="Email verified">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                          Verified
                        </span>
                        <button
                          type="button"
                          className="email-change-btn"
                          onClick={() => {
                            setIsEmailVerified(false);
                            setVerificationToken(null);
                            setShowOtpBox(false);
                            setOtp('');
                          }}
                          title="Change email address"
                        >
                          Change
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="email-verify-inline-btn"
                        onClick={handleSendOtp}
                        disabled={isSendingOtp || !email.trim() || isLoading}
                      >
                        {isSendingOtp ? 'Sending...' : 'Verify'}
                      </button>
                    )}
                  </div>
                </div>
                {errors.email && (
                  <p className="input-error-msg" role="alert">
                    {errors.email}
                  </p>
                )}
              </div>

              {/* Gap Extension for OTP Input when Verify is pressed */}
              {showOtpBox && !isEmailVerified && (
                <div className="register-otp-card" role="region" aria-label="Email Verification Code">
                  <div className="register-otp-header">
                    <span className="register-otp-badge">Verification Code</span>
                    <h4 className="register-otp-title">Enter 6-digit code</h4>
                    <p className="register-otp-desc">
                      We sent a verification code to <strong>{email.trim()}</strong>. Enter it below to verify your email.
                    </p>
                  </div>

                  <div className="register-otp-input-row">
                    <input
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      pattern="[0-9]*"
                      maxLength={6}
                      placeholder="• • • • • •"
                      value={otp}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                        setOtp(val);
                        if (otpError) setOtpError(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          if (otp.length === 6 && !isVerifyingOtp) {
                            handleVerifyOtp();
                          }
                        }
                      }}
                      className={`register-otp-field ${otpError ? 'has-error' : ''}`}
                      disabled={isVerifyingOtp}
                      aria-label="Enter 6-digit verification code"
                    />
                    <button
                      type="button"
                      className="register-otp-verify-btn"
                      onClick={handleVerifyOtp}
                      disabled={isVerifyingOtp || otp.length !== 6}
                    >
                      {isVerifyingOtp ? 'Verifying...' : 'Verify Code'}
                    </button>
                  </div>

                  {otpError && (
                    <div className="register-otp-error-msg" role="alert">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                      </svg>
                      <span>{otpError}</span>
                    </div>
                  )}

                  {otpSuccessMessage && !otpError && (
                    <div className="register-otp-success-msg" role="status">
                      <span>{otpSuccessMessage}</span>
                    </div>
                  )}

                  <div className="register-otp-footer">
                    <span className="register-otp-resend-text">Didn't receive code?</span>
                    <button
                      type="button"
                      className="register-otp-resend-btn"
                      onClick={handleResendOtp}
                      disabled={resendCooldown > 0 || isSendingOtp}
                    >
                      {resendCooldown > 0 ? `Resend OTP (${resendCooldown}s)` : 'Resend OTP'}
                    </button>
                  </div>
                </div>
              )}

              {isEmailVerified && (
                <div className="register-email-verified-banner" role="status">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#166534" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span>Email address verified. You can now set your password and create your account.</span>
                </div>
              )}
            </div>

            <PasswordInput
              label="Password"
              placeholder="Minimum 15 characters"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (errors.password) {
                  setErrors((prev) => ({ ...prev, password: undefined }));
                }
              }}
              error={errors.password}
              helperText="💡 Tip: A memorable passphrase of 3–4 words with spaces is easy to remember and secure (min 15 characters). No complex symbols required."
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
