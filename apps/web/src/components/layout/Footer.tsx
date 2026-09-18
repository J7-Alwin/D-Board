import React, { useState } from 'react';
import { Link } from '../../router/Router';
import { Logo } from '../ui/Logo';
import { MailIcon, ChatIcon, MapPinIcon } from '../ui/Icons';
import { LegalModal } from '../modals/LegalModal';

export const Footer: React.FC = () => {
  const [legalModalType, setLegalModalType] = useState<'terms' | 'privacy' | null>(null);

  const handleOpenLegal = (e: React.MouseEvent, type: 'terms' | 'privacy') => {
    // If user clicked normally without meta/ctrl key, open modal seamlessly
    if (!e.ctrlKey && !e.metaKey && !e.shiftKey) {
      e.preventDefault();
      setLegalModalType(type);
    }
  };

  return (
    <footer className="site-footer">
      <div className="container footer-inner">
        <div className="footer-grid-container">
          {/* Column 1: Brand & Philosophy */}
          <div className="footer-brand-section">
            <Link to="/" className="brand-logo footer-logo-link" aria-label="D-Board Home">
              <Logo size="md" withText withTagline />
            </Link>
            <p className="footer-tagline">
              A modern, focused workspace for developer teams to plan, organize, track, and ship.
            </p>

            {/* Feature Tag Badges */}
            <div className="footer-brand-pills">
              <span className="footer-tag-pill">Modular Monolith</span>
              <span className="footer-tag-pill">Developer First</span>
              <span className="footer-tag-pill">Open Collaboration</span>
            </div>

            {/* Handwritten Doodle */}
            <div className="footer-doodle-row">
              <svg className="footer-sketch-arrow" width="34" height="34" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path d="M12 6 C9 18 13 28 29 29 M22 24 L29 29 L25 36" stroke="#4D6B30" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="footer-doodle-text">Build Better Together.</span>
            </div>
          </div>

          {/* Navigation Columns (Product, Company, Legal) */}
          <div className="footer-links-group">
            {/* Product */}
            <div className="footer-col">
              <h4 className="footer-col-title">Product</h4>
              <ul className="footer-col-list">
                <li><Link to="/features">Features</Link></li>
                <li><Link to="/how-it-works">How It Works</Link></li>
                <li><Link to="/pricing">Pricing</Link></li>
              </ul>
            </div>

            {/* Company */}
            <div className="footer-col">
              <h4 className="footer-col-title">Company</h4>
              <ul className="footer-col-list">
                <li><Link to="/about">About D-Board</Link></li>
              </ul>
            </div>

            {/* Legal */}
            <div className="footer-col">
              <h4 className="footer-col-title">Legal</h4>
              <ul className="footer-col-list">
                <li>
                  <Link to="/terms" onClick={(e) => handleOpenLegal(e, 'terms')}>
                    Terms of Service
                  </Link>
                </li>
                <li>
                  <Link to="/privacy" onClick={(e) => handleOpenLegal(e, 'privacy')}>
                    Privacy Policy
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          {/* Column 5: Get in Touch Card */}
          <div className="footer-contact-column">
            <h3 className="footer-contact-heading">Get in Touch</h3>
            <p className="footer-contact-desc">
              Have questions, feedback, or just want to say hi? We&apos;d love to hear from you.
            </p>

            <div className="footer-contact-card">
              {/* Email Us */}
              <a
                href="mailto:dboard.info@gmail.com?subject=Inquiry%20-%20D-Board"
                className="footer-contact-row"
                title="Send email to dboard.info@gmail.com"
              >
                <div className="footer-contact-icon-box">
                  <MailIcon size={18} />
                </div>
                <div className="footer-contact-info">
                  <span className="footer-contact-label">Email us</span>
                  <span className="footer-contact-value">dboard.info@gmail.com</span>
                </div>
              </a>

              {/* Live Chat */}
              <a
                href="mailto:dboard.info@gmail.com?subject=Live%20Chat%20Support%20-%20D-Board"
                className="footer-contact-row"
                title="Chat with our team"
              >
                <div className="footer-contact-icon-box">
                  <ChatIcon size={18} />
                </div>
                <div className="footer-contact-info">
                  <span className="footer-contact-label">Live Chat</span>
                  <span className="footer-contact-value">Chat with our team</span>
                </div>
              </a>

              {/* Our Location */}
              <div className="footer-contact-row static-row">
                <div className="footer-contact-icon-box">
                  <MapPinIcon size={18} />
                </div>
                <div className="footer-contact-info">
                  <span className="footer-contact-label">Our Location</span>
                  <span className="footer-contact-value">Remote First, Worldwide</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar: Copyright & Monospace Pills */}
        <div className="footer-bottom">
          <p className="footer-copyright">
            &copy; {new Date().getFullYear()} D-Board. Built for developer teams. All rights reserved.
          </p>
          <div className="footer-bottom-links">
            <span className="footer-pill">Modular Monolith</span>
            <span className="footer-pill">Developer First</span>
          </div>
        </div>
      </div>

      {/* Legal Modal Popup */}
      {legalModalType && (
        <LegalModal
          isOpen={!!legalModalType}
          onClose={() => setLegalModalType(null)}
          type={legalModalType}
        />
      )}
    </footer>
  );
};
