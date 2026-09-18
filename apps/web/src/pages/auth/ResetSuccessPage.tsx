import React from 'react';
import { AuthLayout } from '../../components/layout/AuthLayout';
import { useRouter } from '../../router/Router';
import { Button } from '../../components/ui/Button';
import { ArrowRightIcon, CheckIcon } from '../../components/ui/Icons';

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
      <div className="auth-form-wrapper">
        <div className="auth-header-text">
          <h1 className="auth-page-title">Password reset successful</h1>
          <p className="auth-page-sub">
            Your password has been changed. You can now use your new password to sign in.
          </p>
        </div>

        <div className="auth-card">
          <div className="auth-success-state">
            <div className="success-icon-wrap">
              <CheckIcon size={24} />
            </div>
            <h3 className="success-title">All set!</h3>
            <p className="success-desc">
              Your D-Board account password was updated successfully. Old reset links are now invalidated.
            </p>

            <div className="success-actions">
              <Button
                variant="primary"
                size="lg"
                fullWidth
                rightIcon={<ArrowRightIcon size={18} />}
                onClick={() => navigate('/login')}
              >
                Sign in to your account
              </Button>
            </div>
          </div>
        </div>
      </div>
    </AuthLayout>
  );
};
