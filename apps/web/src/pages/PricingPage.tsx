import React from 'react';
import { useRouter } from '../router/Router';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Primitives';
import { CheckIcon, ArrowRightIcon } from '../components/ui/Icons';

export const PricingPage: React.FC = () => {
  const { navigate } = useRouter();

  return (
    <div className="pricing-page">
      <section className="page-hero-section">
        <div className="container text-center">
          <div className="eyebrow">TRANSPARENT PRICING</div>
          <h1 className="heading-display page-title">Simple, predictable pricing for teams.</h1>
          <p className="body-large page-subtitle">
            Start building for free with your team. Upgrade when your projects demand advanced automation.
          </p>
        </div>
      </section>

      <section className="pricing-cards-section">
        <div className="container">
          <div className="pricing-grid">
            {/* Free Plan */}
            <div className="pricing-card free-plan-card">
              <div className="plan-header">
                <div className="plan-name-wrap">
                  <h2 className="plan-name">Community Free</h2>
                  <Badge variant="green" size="sm">ACTIVE</Badge>
                </div>
                <div className="plan-price">
                  <span className="currency">₹</span>
                  <span className="amount">0</span>
                  <span className="period">/ month</span>
                </div>
                <p className="plan-tagline">
                  Free to start. Everything you need to plan, track, and ship projects with your team.
                </p>
              </div>

              <div className="plan-divider" />

              <div className="plan-features">
                <div className="features-label">INCLUDED IN FREE:</div>
                <ul className="plan-feature-list">
                  <li><CheckIcon size={16} className="check-icon" /> Unlimited project workspaces</li>
                  <li><CheckIcon size={16} className="check-icon" /> Full task &amp; bug tracking board</li>
                  <li><CheckIcon size={16} className="check-icon" /> Project-scoped team members &amp; roles</li>
                  <li><CheckIcon size={16} className="check-icon" /> Shared markdown notes &amp; docs</li>
                  <li><CheckIcon size={16} className="check-icon" /> Project files &amp; asset storage</li>
                  <li><CheckIcon size={16} className="check-icon" /> Milestone calendar &amp; deadlines</li>
                  <li><CheckIcon size={16} className="check-icon" /> Activity audit log &amp; notifications</li>
                </ul>
              </div>

              <div className="plan-cta">
                <Button
                  variant="primary"
                  size="lg"
                  fullWidth
                  rightIcon={<ArrowRightIcon size={16} />}
                  onClick={() => navigate('/register')}
                >
                  Get started — Free
                </Button>
                <span className="plan-microcopy">No credit card required</span>
              </div>
            </div>

            {/* Pro Plan (Coming Soon) */}
            <div className="pricing-card pro-plan-card">
              <div className="plan-header">
                <div className="plan-name-wrap">
                  <h2 className="plan-name">Pro Workspace</h2>
                  <Badge variant="dark" size="sm">COMING SOON</Badge>
                </div>
                <div className="plan-price">
                  <span className="coming-soon-price">Coming Soon</span>
                </div>
                <p className="plan-tagline">
                  Advanced tools and automation for scaling development organizations.
                </p>
              </div>

              <div className="plan-divider" />

              <div className="plan-features">
                <div className="features-label">PLANNED PRO CAPABILITIES:</div>
                <ul className="plan-feature-list muted-list">
                  <li><CheckIcon size={16} className="check-icon" /> Advanced cross-project analytics</li>
                  <li><CheckIcon size={16} className="check-icon" /> Workflow automation &amp; webhooks</li>
                  <li><CheckIcon size={16} className="check-icon" /> Enterprise SAML / SSO authentication</li>
                  <li><CheckIcon size={16} className="check-icon" /> AI-assisted task breakdown &amp; summaries</li>
                  <li><CheckIcon size={16} className="check-icon" /> Priority engineering support</li>
                </ul>
              </div>

              <div className="plan-cta">
                <Button
                  variant="outline"
                  size="lg"
                  fullWidth
                  disabled
                >
                  Available in future release
                </Button>
                <span className="plan-microcopy">Currently in active engineering</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
