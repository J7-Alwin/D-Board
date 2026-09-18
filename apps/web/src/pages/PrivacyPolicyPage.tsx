import React from 'react';
import { Link } from '../router/Router';
import { ArrowLeftIcon, ShieldCheckIcon, LockIcon } from '../components/ui/Icons';

export const PrivacyPolicyPage: React.FC = () => {
  return (
    <div className="privacy-page-container" style={{ maxWidth: '54rem', margin: '0 auto', padding: '3rem 1.5rem 5rem' }}>
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
            backgroundColor: 'var(--badge-green-bg, #E7F6EC)',
            color: 'var(--badge-green-text, #166534)',
            fontSize: '0.75rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginBottom: '1rem',
          }}
        >
          <LockIcon size={14} />
          <span>Privacy &amp; Security</span>
        </div>
        <h1 style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--text-primary, #1F1F1F)', letterSpacing: '-0.02em', margin: '0 0 0.5rem' }}>
          Privacy Policy
        </h1>
        <p style={{ fontSize: '0.9375rem', color: 'var(--text-secondary, #575757)', margin: 0 }}>
          Last updated: September 7, 2026 &bull; Committed to transparency and data sovereignty
        </p>
      </div>

      {/* Content */}
      <div
        className="privacy-content-body"
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
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.75rem' }}>1. Overview &amp; Commitment</h2>
          <p style={{ color: 'var(--text-secondary, #575757)' }}>
            At D-Board, we respect the privacy of developers and teams. This Privacy Policy explains how we collect, use, protect, and handle your personal and workspace information when you use our web application, APIs, and collaborative services.
          </p>
        </section>

        <section>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.75rem' }}>2. Information We Collect</h2>
          <p style={{ color: 'var(--text-secondary, #575757)', marginBottom: '0.75rem' }}>
            We collect only information necessary to deliver our developer workspace capabilities:
          </p>
          <ul style={{ paddingLeft: '1.5rem', color: 'var(--text-secondary, #575757)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <li>
              <strong>Account Information:</strong> Full name, unique @username handle, email address, and cryptographically hashed passwords (using Argon2id).
            </li>
            <li>
              <strong>Google OAuth Profile Data:</strong> When signing in with Google, we access your verified email address, display name, and avatar profile picture. We do not access your Google Drive or contacts.
            </li>
            <li>
              <strong>Workspace &amp; Collaboration Data:</strong> Projects created, Kanban work items, notes, architectural decision records, comments, team @mentions, calendar milestones, and file attachment metadata.
            </li>
            <li>
              <strong>Ephemeral Security Tokens:</strong> Password reset OTPs (stored solely as single-use SHA-256 hashes with a 15-minute expiry) and HTTP-only session JWT cookies.
            </li>
          </ul>
        </section>

        <section>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.75rem' }}>3. How We Use Your Information</h2>
          <p style={{ color: 'var(--text-secondary, #575757)', marginBottom: '0.75rem' }}>
            Your information is used strictly to power platform functionality:
          </p>
          <ul style={{ paddingLeft: '1.5rem', color: 'var(--text-secondary, #575757)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <li>Authenticating your identity and preventing unauthorized access or account collisions.</li>
            <li>Routing project invitations to registered and unregistered team members.</li>
            <li>Sending critical transactional emails (Welcome onboarding, password reset verification codes, and project join confirmations via Resend/SMTP).</li>
            <li>Broadcasting real-time socket events for Kanban boards, comments, and notifications.</li>
          </ul>
        </section>

        <section>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.75rem' }}>4. Data Retention &amp; Auto-Purge Cycles</h2>
          <p style={{ color: 'var(--text-secondary, #575757)', marginBottom: '0.75rem' }}>
            We implement automated lifecycle management to minimize stored data footprint:
          </p>
          <ul style={{ paddingLeft: '1.5rem', color: 'var(--text-secondary, #575757)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <li>
              <strong>In-App Notifications:</strong> Expire and are permanently purged from the database after <strong>7 days</strong>.
            </li>
            <li>
              <strong>Password Reset Verification Codes (OTPs):</strong> Automatically invalidated upon first use or after <strong>15 minutes</strong>.
            </li>
            <li>
              <strong>Project Invitations:</strong> Expire after 7 days if unaccepted.
            </li>
          </ul>
        </section>

        <section>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.75rem' }}>5. Security Architecture</h2>
          <p style={{ color: 'var(--text-secondary, #575757)' }}>
            We employ modern defense-in-depth security standards: passwords are encrypted with Argon2id, reset tokens and OTPs are hashed using SHA-256 before storage, session tokens use secure HTTP-only cookies, and strict Insecure Direct Object Reference (IDOR) filters guarantee cross-tenant data isolation.
          </p>
        </section>

        <section>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.75rem' }}>6. Your Rights &amp; Data Control</h2>
          <p style={{ color: 'var(--text-secondary, #575757)' }}>
            You have the right to inspect, update, export, or permanently delete your account and workspace data at any time. We do not sell, rent, or monetize your personal or project data to any advertisers or third-party brokers.
          </p>
        </section>

        <section style={{ backgroundColor: 'var(--bg-white, #FFFFFF)', border: '1px solid var(--border-light, #E5E6DE)', borderRadius: 'var(--radius-md, 10px)', padding: '1.5rem' }}>
          <h2 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ShieldCheckIcon size={18} />
            <span>Contact Our Privacy Team</span>
          </h2>
          <p style={{ color: 'var(--text-secondary, #575757)', margin: 0 }}>
            For privacy inquiries, data deletion requests, or security audits, contact us directly at <a href="mailto:privacy@dboard.dev" style={{ color: 'var(--text-primary, #1F1F1F)', fontWeight: 600, textDecoration: 'underline' }}>privacy@dboard.dev</a>.
          </p>
        </section>
      </div>
    </div>
  );
};
