import React from 'react';
import { Link } from '../router/Router';
import { ArrowLeftIcon, FileTextIcon, ShieldCheckIcon } from '../components/ui/Icons';

export const TermsPage: React.FC = () => {
  return (
    <div className="terms-page-container" style={{ maxWidth: '54rem', margin: '0 auto', padding: '3rem 1.5rem 5rem' }}>
      {/* Back Link */}
      <Link
        to="/"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.5rem',
          fontSize: '0.875rem',
          fontWeight: 600,
          color: 'var(--text-secondary, #575757)',
          marginBottom: '2rem',
          transition: 'color 150ms ease',
        }}
      >
        <ArrowLeftIcon size={16} />
        <span>Back to Home</span>
      </Link>

      {/* Header */}
      <div style={{ marginBottom: '2.5rem', borderBottom: '1px solid var(--border-light, #E5E6DE)', paddingBottom: '2rem' }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.25rem 0.75rem',
            borderRadius: '999px',
            backgroundColor: 'var(--badge-bg, #ECEEE4)',
            color: 'var(--badge-text, #3D4233)',
            fontSize: '0.75rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginBottom: '1rem',
          }}
        >
          <FileTextIcon size={14} />
          <span>Legal Agreement</span>
        </div>
        <h1 style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--text-primary, #1F1F1F)', letterSpacing: '-0.02em', margin: '0 0 0.5rem' }}>
          Terms of Service
        </h1>
        <p style={{ fontSize: '0.9375rem', color: 'var(--text-secondary, #575757)', margin: 0 }}>
          Last updated: September 7, 2026 &bull; Effective Date: September 7, 2026
        </p>
      </div>

      {/* Content */}
      <div
        className="terms-content-body"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '2rem',
          fontSize: '0.9375rem',
          lineHeight: 1.7,
          color: 'var(--text-primary, #1F1F1F)',
        }}
      >
        <section>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.75rem' }}>1. Acceptance of Terms</h2>
          <p style={{ color: 'var(--text-secondary, #575757)' }}>
            Welcome to D-Board. By accessing, registering for, or using our collaborative engineering platform, web application, and associated developer services (collectively, the &ldquo;Platform&rdquo;), you agree to be bound by these Terms of Service (&ldquo;Terms&rdquo;). If you do not agree with these Terms, you must not access or use the Platform.
          </p>
        </section>

        <section>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.75rem' }}>2. Accounts &amp; Authentication</h2>
          <p style={{ color: 'var(--text-secondary, #575757)', marginBottom: '0.75rem' }}>
            To utilize D-Board, you may create an account via standard email registration or through Google OAuth authentication. You agree to:
          </p>
          <ul style={{ paddingLeft: '1.5rem', color: 'var(--text-secondary, #575757)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <li>Provide accurate, current, and complete registration information.</li>
            <li>Maintain the confidentiality of your credentials, password reset verification codes (OTPs), and session tokens.</li>
            <li>Acknowledge that signing in via Google with an existing registered email address links your credentials to your unified single account.</li>
            <li>Promptly notify D-Board of any unauthorized access or security breaches concerning your account.</li>
          </ul>
        </section>

        <section>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.75rem' }}>3. Acceptable Use &amp; Collaboration Conduct</h2>
          <p style={{ color: 'var(--text-secondary, #575757)', marginBottom: '0.75rem' }}>
            You agree to use D-Board only for lawful software development, project management, and team collaboration purposes. You shall not:
          </p>
          <ul style={{ paddingLeft: '1.5rem', color: 'var(--text-secondary, #575757)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <li>Upload malicious payloads, viruses, or unauthorized executable scripts into project files or attachments.</li>
            <li>Interfere with, compromise, or disrupt the integrity, rate limiters, or performance of D-Board servers, databases, or Redis background workers.</li>
            <li>Attempt unauthorized access to projects, work items, or notifications belonging to other organizations or users (IDOR prevention).</li>
            <li>Impersonate other developers or use deceptive project invitation workflows.</li>
          </ul>
        </section>

        <section>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.75rem' }}>4. Workspace Data Ownership &amp; Intellectual Property</h2>
          <p style={{ color: 'var(--text-secondary, #575757)' }}>
            You and your team retain all proprietary rights, copyright, and ownership of any source code, project notes, tasks, architecture diagrams, and files uploaded to D-Board. D-Board claims no ownership over your intellectual property and processes your data solely to deliver the platform features.
          </p>
        </section>

        <section>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.75rem' }}>5. Third-Party Integrations &amp; Email Delivery</h2>
          <p style={{ color: 'var(--text-secondary, #575757)' }}>
            D-Board integrates with Google Identity services for authentication and Resend / SMTP for transactional email delivery (such as welcome onboarding, password reset verification codes, and project invitations). Your use of these third-party integrations is subject to their respective terms and privacy policies.
          </p>
        </section>

        <section>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.75rem' }}>6. Ephemeral Data &amp; Notification Lifecycle</h2>
          <p style={{ color: 'var(--text-secondary, #575757)' }}>
            To optimize database performance and privacy, in-platform notifications expire and are automatically purged from our databases after 7 days. Password recovery verification OTPs are single-use and expire within 15 minutes.
          </p>
        </section>

        <section>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.75rem' }}>7. Termination &amp; Account Deletion</h2>
          <p style={{ color: 'var(--text-secondary, #575757)' }}>
            You may discontinue use or request account deletion at any time. D-Board reserves the right to suspend or terminate accounts that violate these Terms or present security risks to the infrastructure.
          </p>
        </section>

        <section>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.75rem' }}>8. Limitation of Liability</h2>
          <p style={{ color: 'var(--text-secondary, #575757)' }}>
            To the maximum extent permitted by applicable law, D-Board is provided on an &ldquo;AS IS&rdquo; and &ldquo;AS AVAILABLE&rdquo; basis. In no event shall D-Board be liable for any indirect, incidental, special, or consequential damages resulting from platform downtime or data transmission delays.
          </p>
        </section>

        <section style={{ backgroundColor: 'var(--bg-white, #FFFFFF)', border: '1px solid var(--border-light, #E5E6DE)', borderRadius: 'var(--radius-md, 10px)', padding: '1.5rem' }}>
          <h2 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ShieldCheckIcon size={18} />
            <span>Questions or Legal Inquiries</span>
          </h2>
          <p style={{ color: 'var(--text-secondary, #575757)', margin: 0 }}>
            If you have questions regarding these Terms of Service, please reach out to our legal and security team at <a href="mailto:support@dboard.dev" style={{ color: 'var(--text-primary, #1F1F1F)', fontWeight: 600, textDecoration: 'underline' }}>support@dboard.dev</a>.
          </p>
        </section>
      </div>
    </div>
  );
};
