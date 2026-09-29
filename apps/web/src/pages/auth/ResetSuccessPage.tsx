import React, { useEffect } from 'react';
import { AuthLayout } from '../../components/layout/AuthLayout';
import { useRouter } from '../../router/Router';
import { ArrowRightIcon, ShieldCheckIcon } from '../../components/ui/Icons';

export const ResetSuccessPage: React.FC = () => {
  const { navigate } = useRouter();

  // Keyboard shortcut: Press Enter to quickly proceed to login
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        navigate('/login');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);

  return (
    <AuthLayout
      rightEyebrow="PASSWORD UPDATED"
      rightHeading={
        <>
          Ready to<br />
          continue<br />
          building.
        </>
      }
      rightSubtitle="Your credentials are secure. Log in to your workspace and collaborate with your team."
    >
      <div className="reset-success-wrapper">
        {/* Animated Celebration & Security Emblem */}
        <div className="reset-success-hero" aria-hidden="true">
          <div className="reset-success-glow-halo" />

          {/* Micro-sparkles */}
          <span className="reset-success-sparkle sparkle-1">✦</span>
          <span className="reset-success-sparkle sparkle-2">✧</span>
          <span className="reset-success-sparkle sparkle-3">✦</span>
          <span className="reset-success-sparkle sparkle-4">✧</span>

          {/* Orbital Ring */}
          <div className="reset-success-orbit-ring" />

          {/* Central Medallion */}
          <div className="reset-success-medallion">
            <div className="reset-success-medallion-inner">
              <svg
                width="34"
                height="34"
                viewBox="0 0 34 34"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="reset-success-check-svg"
              >
                <circle cx="17" cy="17" r="17" fill="#16A34A" />
                <path
                  d="M10.5 17.5L15 22L23.5 13.5"
                  stroke="#FFFFFF"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="reset-success-check-path"
                />
              </svg>
            </div>
          </div>
        </div>

        {/* Status Pill & Header */}
        <div className="reset-success-header">
          <div className="reset-success-status-pill">
            <span className="reset-success-status-dot" />
            <span className="reset-success-status-text">Security Verified</span>
          </div>

          <h1 className="reset-success-title">Password reset successful!</h1>
          <p className="reset-success-sub">
            Your password has been changed. You can now use your new password to sign in.
          </p>
        </div>

        {/* High-Trust Security Audit Card */}
        <div className="reset-success-card">
          <div className="reset-success-card-top">
            <div className="reset-success-card-badge">
              <ShieldCheckIcon size={14} className="reset-success-shield-icon" />
              <span>SECURITY CONFIRMATION</span>
            </div>
            <span className="reset-success-card-tag">Instant Update</span>
          </div>

          <div className="reset-success-card-list">
            <div className="reset-success-item">
              <div className="reset-success-item-icon" aria-hidden="true">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="10" cy="10" r="10" fill="#22C55E" />
                  <path
                    d="M6 10.2L8.7 12.9L14.2 7.4"
                    stroke="#FFFFFF"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <div className="reset-success-item-content">
                <div className="reset-success-item-heading">Credentials Updated</div>
                <span className="reset-success-item-text">
                  Your D-Board account password was updated successfully.
                </span>
              </div>
            </div>

            <div className="reset-success-item">
              <div className="reset-success-item-icon" aria-hidden="true">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="10" cy="10" r="10" fill="#22C55E" />
                  <path
                    d="M6 10.2L8.7 12.9L14.2 7.4"
                    stroke="#FFFFFF"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <div className="reset-success-item-content">
                <div className="reset-success-item-heading">Tokens Invalidated</div>
                <span className="reset-success-item-text">
                  Old reset links are now invalidated for security.
                </span>
              </div>
            </div>
          </div>

          <div className="reset-success-card-footer">
            <span className="reset-success-footer-icon" aria-hidden="true">🔒</span>
            <span>Account access is protected with 256-bit encryption</span>
          </div>
        </div>

        {/* Action Button & Keyboard Hint */}
        <div className="reset-success-action-wrap">
          <button
            type="button"
            className="reset-success-btn"
            onClick={() => navigate('/login')}
          >
            <span>Sign in to your account</span>
            <ArrowRightIcon size={18} className="reset-success-btn-icon" />
          </button>
        </div>

        <div className="reset-success-hint-row">
          <span className="reset-success-hint-text">
            Press <kbd className="reset-success-kbd">↵ Enter</kbd> to proceed
          </span>
        </div>
      </div>
    </AuthLayout>
  );
};
