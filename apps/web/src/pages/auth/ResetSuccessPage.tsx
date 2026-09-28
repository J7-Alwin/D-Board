import React from 'react';
import { AuthLayout } from '../../components/layout/AuthLayout';
import { useRouter } from '../../router/Router';
import { ArrowRightIcon } from '../../components/ui/Icons';

export const ResetSuccessPage: React.FC = () => {
  const { navigate } = useRouter();

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
        {/* Celebration Illustration */}
        <div className="reset-success-art-wrap" aria-hidden="true">
          <svg
            width="180"
            height="130"
            viewBox="0 0 180 130"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="reset-success-illustration"
          >
            {/* Soft Organic Background Blobs */}
            <path
              d="M74 16C108 8 138 20 145 50C151 76 131 106 101 112C68 118 42 100 36 74C31 48 44 23 74 16Z"
              fill="#F0FDF4"
            />
            <path
              d="M87 22C114 16 138 26 143 52C148 74 131 99 105 104C76 109 54 94 49 72C45 49 56 28 87 22Z"
              fill="#DCFCE7"
              opacity="0.7"
            />

            {/* Festive Radiating Sparks / Ticks */}
            {/* Top-left tick 1 */}
            <line
              x1="43"
              y1="49"
              x2="34"
              y2="45"
              stroke="#15803D"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            {/* Top-left tick 2 */}
            <line
              x1="51"
              y1="37"
              x2="45"
              y2="28"
              stroke="#15803D"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            {/* Top-right tick 1 */}
            <line
              x1="127"
              y1="33"
              x2="134"
              y2="25"
              stroke="#15803D"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            {/* Top-right tick 2 */}
            <line
              x1="137"
              y1="45"
              x2="147"
              y2="41"
              stroke="#15803D"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            {/* Top-right tick 3 */}
            <line
              x1="138"
              y1="59"
              x2="149"
              y2="59"
              stroke="#15803D"
              strokeWidth="2.5"
              strokeLinecap="round"
            />

            {/* Badge Glow / Halos */}
            <circle cx="90" cy="65" r="33" fill="#FFFFFF" fillOpacity="0.85" />
            <circle cx="90" cy="65" r="28" fill="#F0FDF4" />

            {/* Circular Green Badge */}
            <circle
              cx="90"
              cy="65"
              r="24"
              stroke="#22C55E"
              strokeWidth="3.2"
              fill="#FFFFFF"
            />

            {/* Checkmark */}
            <path
              d="M79.5 65.5L86.5 72.5L100.5 58.5"
              stroke="#16A34A"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        {/* Heading & Subtitle */}
        <div className="reset-success-header">
          <h1 className="reset-success-title">Password reset successful!</h1>
          <p className="reset-success-sub">
            Your password has been changed. You can now use your new password to sign in.
          </p>
        </div>

        {/* Security Checklist Card */}
        <div className="reset-success-card">
          <div className="reset-success-item">
            <div className="reset-success-item-icon">
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
            <span className="reset-success-item-text">
              Your D-Board account password was updated successfully.
            </span>
          </div>

          <div className="reset-success-item">
            <div className="reset-success-item-icon">
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
            <span className="reset-success-item-text">
              Old reset links are now invalidated for security.
            </span>
          </div>
        </div>

        {/* Action Button */}
        <div className="reset-success-action-wrap">
          <button
            type="button"
            className="reset-success-btn"
            onClick={() => navigate('/login')}
          >
            <span>Sign in to your account</span>
            <ArrowRightIcon size={16} />
          </button>
        </div>
      </div>
    </AuthLayout>
  );
};
