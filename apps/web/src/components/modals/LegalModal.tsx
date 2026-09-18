import React from 'react';
import { CloseIcon, FileTextIcon, LockIcon, HelpCircleIcon } from '../ui/Icons';

export interface LegalModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'terms' | 'privacy';
}

const TERMS_ITEMS = [
  {
    num: 1,
    title: 'Unified Accounts',
    desc: 'You are responsible for your account credentials. Google OAuth sign-in with a registered email links to your existing account.',
  },
  {
    num: 2,
    title: 'Workspace Ownership',
    desc: 'All code, notes, architecture documents, and attachments remain your exclusive property.',
  },
  {
    num: 3,
    title: 'Acceptable Use',
    desc: 'Do not upload malicious software or disrupt system infrastructure.',
  },
  {
    num: 4,
    title: 'Ephemeral Lifecycles',
    desc: 'Notifications expire after 7 days, and reset verification OTPs expire in 15 minutes.',
  },
  {
    num: 5,
    title: 'Scoped Permissions',
    desc: 'Project administrators control role assignments, repository links, and workspace membership.',
  },
  {
    num: 6,
    title: 'Service Availability',
    desc: 'D-Board is provided on a reliable high-availability basis, with regular automated backups and maintenance.',
  },
];

const PRIVACY_ITEMS = [
  {
    num: 1,
    title: 'Data Minimization',
    desc: 'We collect only essential account information: email, username, and project collaboration data.',
  },
  {
    num: 2,
    title: 'No Data Selling',
    desc: 'We never sell, monetize, or share your personal or workspace data with advertisers or third-party brokers.',
  },
  {
    num: 3,
    title: 'Cryptographic Security',
    desc: 'Passwords use industry-standard hashing, and all sessions, OTPs, and tokens are encrypted.',
  },
  {
    num: 4,
    title: 'Full Data Control',
    desc: 'You can export all your project data or permanently delete your user account at any time.',
  },
  {
    num: 5,
    title: 'Project Isolation',
    desc: 'Your project documents, notes, and files are strictly scoped and accessible only to invited team members.',
  },
  {
    num: 6,
    title: 'Transactional Communications',
    desc: 'Emails are sent solely for authentication verification codes, project invites, and critical security notices.',
  },
];

export const LegalModal: React.FC<LegalModalProps> = ({ isOpen, onClose, type }) => {
  if (!isOpen) return null;

  const isTerms = type === 'terms';
  const items = isTerms ? TERMS_ITEMS : PRIVACY_ITEMS;

  return (
    <div className="modal-backdrop legal-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="modal-container legal-modal-window"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="legal-modal-header">
          <div className="legal-modal-header-left">
            <div className="legal-modal-icon-badge">
              {isTerms ? <FileTextIcon size={22} /> : <LockIcon size={22} />}
            </div>
            <div className="legal-modal-title-group">
              <h2 className="legal-modal-title">
                {isTerms ? 'Terms of Service' : 'Privacy Policy'}
              </h2>
              <p className="legal-modal-subtitle">
                {isTerms
                  ? 'By using D-Board, you agree to these Terms of Service.'
                  : 'D-Board is committed to transparent privacy and enterprise security.'}
              </p>
            </div>
          </div>

          <button
            type="button"
            className="legal-modal-close-btn"
            onClick={onClose}
            aria-label="Close modal"
          >
            <CloseIcon size={16} />
          </button>
        </div>

        {/* Body Split */}
        <div className="legal-modal-body">
          {/* Left: Numbered Points List */}
          <div className="legal-modal-list">
            {items.map((item) => (
              <div key={item.num} className="legal-modal-item">
                <div className="legal-modal-num-badge">{item.num}</div>
                <div className="legal-modal-item-content">
                  <h4 className="legal-modal-item-title">{item.title}</h4>
                  <p className="legal-modal-item-desc">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Right: Editorial Visual Card */}
          <div className="legal-modal-visual-card">
            {/* Soft decorative background circles */}
            <div className="legal-card-orb legal-card-orb-1" aria-hidden="true" />
            <div className="legal-card-orb legal-card-orb-2" aria-hidden="true" />

            <div className="legal-card-content">
              {/* Handwritten script header */}
              <div className="legal-card-script-wrap">
                <span className="legal-card-script">Build Better Together.</span>
                <svg className="legal-card-swash" width="48" height="10" viewBox="0 0 60 12" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                  <path d="M2 9 C20 2 40 2 58 8" stroke="#4D6B30" strokeWidth="2.2" strokeLinecap="round" />
                </svg>
              </div>

              {/* Center Emblem / Illustration */}
              <div className="legal-card-emblem-wrap">
                <svg width="76" height="76" viewBox="0 0 76 76" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                  {/* Document sheet */}
                  <path
                    d="M22 14 C22 11.79 23.79 10 26 10 L44 10 L54 20 L54 52 C54 54.21 52.21 56 50 56 L26 56 C23.79 56 22 54.21 22 52 Z"
                    fill="#FFFFFF"
                    stroke="#18181A"
                    strokeWidth="2.5"
                    strokeLinejoin="round"
                  />
                  {/* Folded corner */}
                  <path d="M44 10 L44 20 L54 20" fill="#F4F4EE" stroke="#18181A" strokeWidth="2.5" strokeLinejoin="round" />
                  {/* Document lines */}
                  <line x1="29" y1="26" x2="39" y2="26" stroke="#18181A" strokeWidth="2.2" strokeLinecap="round" />
                  <line x1="29" y1="34" x2="47" y2="34" stroke="#18181A" strokeWidth="2.2" strokeLinecap="round" />
                  <line x1="29" y1="42" x2="43" y2="42" stroke="#18181A" strokeWidth="2.2" strokeLinecap="round" />
                  {/* Shield badge */}
                  <g transform="translate(40, 37)">
                    <path
                      d="M12 2 C18 2 22 4 22 4 C22 13 17 21 12 24 C7 21 2 13 2 4 C2 4 6 2 12 2 Z"
                      fill="#D2F843"
                      stroke="#18181A"
                      strokeWidth="2.2"
                      strokeLinejoin="round"
                    />
                    <path d="M8 12 L11 15 L16 9" stroke="#18181A" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                  </g>
                </svg>
              </div>

              {/* Title */}
              <h3 className="legal-card-heading">
                {isTerms
                  ? 'A safe and fair workspace for developers.'
                  : 'Enterprise privacy and complete data sovereignty.'}
              </h3>

              {/* Olive accent line */}
              <div className="legal-card-line" />

              {/* Paragraph */}
              <p className="legal-card-body">
                {isTerms
                  ? 'These terms help keep D-Board secure, productive, and collaborative for everyone.'
                  : 'Your intellectual property, project notes, and repository assets remain strictly yours.'}
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="legal-modal-footer">
          <div className="legal-modal-help">
            <HelpCircleIcon size={19} className="legal-help-icon" />
            <div className="legal-help-text">
              <span>Have questions about our {isTerms ? 'terms' : 'privacy'}?</span>
              <a
                href="mailto:dboard.info@gmail.com?subject=Legal%20Inquiry%20-%20D-Board"
                className="legal-help-link"
              >
                Get in touch &rarr;
              </a>
            </div>
          </div>

          <div className="legal-modal-actions">
            <button type="button" className="legal-btn-close" onClick={onClose}>
              Close
            </button>
            <button type="button" className="legal-btn-understand" onClick={onClose}>
              I Understand
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
