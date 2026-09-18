import React, { useState, useEffect } from 'react';
import { Link } from '../../router/Router';
import {
  CheckSquareIcon,
  UsersIcon,
  FolderIcon,
  BarChartIcon,
  ActivityIcon,
  FileTextIcon,
  BellIcon,
  ShieldCheckIcon,
  LayersIcon,
  MailIcon,
  GoogleIcon,
  ClockIcon
} from '../ui/Icons';
import { LegalModal } from '../modals/LegalModal';
import { Logo } from '../ui/Logo';

export interface AuthLayoutProps {
  children: React.ReactNode;
  headerAction?: React.ReactNode;
  rightHeading?: React.ReactNode;
  rightSubtitle?: string;
  rightEyebrow?: string;
}

interface SlideData {
  eyebrow: string;
  titlePart1: string;
  titleHighlight: string;
  titlePart2?: string;
  subtitle: string;
  features: { label: string; icon: React.ReactNode }[];
  quote: string;
  author: string;
}

const SLIDES: SlideData[] = [
  {
    eyebrow: 'PLAN • COLLABORATE • BUILD',
    titlePart1: 'Turn ideas into ',
    titleHighlight: 'real progress.',
    subtitle: 'D-Board helps you plan, collaborate, and build amazing projects with your team.',
    features: [
      { label: 'Organize Tasks', icon: <CheckSquareIcon size={18} /> },
      { label: 'Work Together', icon: <UsersIcon size={18} /> },
      { label: 'Share Files', icon: <FolderIcon size={18} /> },
      { label: 'Track Progress', icon: <BarChartIcon size={18} /> },
    ],
    quote: 'Alone we can do so little, together we can do so much.',
    author: 'Helen Keller',
  },
  {
    eyebrow: 'SAME GOAL • HIGHER PROGRESS',
    titlePart1: 'Better projects, ',
    titleHighlight: 'brighter futures.',
    subtitle: 'Centralize real-time discussions, code snippets, notes, and automated alerts in one unified workspace.',
    features: [
      { label: 'Real-time Sync', icon: <ActivityIcon size={18} /> },
      { label: 'Dev Notes', icon: <FileTextIcon size={18} /> },
      { label: 'Smart Alerts', icon: <BellIcon size={18} /> },
      { label: 'Cloud Security', icon: <ShieldCheckIcon size={18} /> },
    ],
    quote: 'Simplicity is prerequisite for reliability.',
    author: 'Edsger W. Dijkstra',
  },
  {
    eyebrow: 'ENGINEERED FOR MODERN TEAMS',
    titlePart1: 'Build faster, ',
    titleHighlight: 'ship together.',
    subtitle: 'Manage sprint boards, invite teammates effortlessly, and ship milestones ahead of schedule.',
    features: [
      { label: 'Kanban Boards', icon: <LayersIcon size={18} /> },
      { label: 'Smart Invites', icon: <MailIcon size={18} /> },
      { label: 'Google OAuth', icon: <GoogleIcon size={18} /> },
      { label: 'Audit Trails', icon: <ClockIcon size={18} /> },
    ],
    quote: 'Great things in business are never done by one person. They\'re done by a team of people.',
    author: 'Steve Jobs',
  },
];

export const AuthLayout: React.FC<AuthLayoutProps> = ({
  children,
  headerAction,
}) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [legalModalType, setLegalModalType] = useState<'terms' | 'privacy' | null>(null);
  const [showHelpModal, setShowHelpModal] = useState(false);

  // Auto-slide every 5 seconds (5000ms)
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % SLIDES.length);
    }, 5000);

    return () => clearInterval(timer);
  }, []);

  const slide = SLIDES[currentSlide];

  return (
    <div className="auth-layout-root">
      {/* Left Column: Form Content */}
      <div className="auth-left-col">
        {/* Top Header */}
        <header className="auth-left-header">
          <div className="auth-brand-wrap">
            <Link to="/" className="brand-logo" style={{ textDecoration: 'none' }} aria-label="D-Board Home">
              <Logo size="md" withText withTagline />
            </Link>
          </div>

          {headerAction && (
            <div className="auth-header-action">
              {headerAction}
            </div>
          )}
        </header>

        {/* Main Form Slot */}
        <main className="auth-form-container">
          {children}
        </main>

        {/* Footer with Legal & Help Links */}
        <footer className="auth-left-footer">
          <div className="auth-footer-nav">
            <button
              type="button"
              className="auth-footer-link-btn"
              onClick={() => setLegalModalType('terms')}
            >
              Terms of Service
            </button>
            <span className="auth-footer-divider">|</span>
            <button
              type="button"
              className="auth-footer-link-btn"
              onClick={() => setLegalModalType('privacy')}
            >
              Privacy Policy
            </button>
            <span className="auth-footer-divider">|</span>
            <button
              type="button"
              className="auth-footer-link-btn"
              onClick={() => setShowHelpModal(true)}
            >
              Help
            </button>
          </div>
          <p className="auth-copyright">
            &copy; {new Date().getFullYear()} D-Board. All rights reserved.
          </p>
        </footer>
      </div>

      {/* Right Column: 3-Slide Auto Carousel */}
      <div className="auth-right-col" aria-label="Feature showcase carousel">
        <div className="auth-dark-backdrop">
          <div className="auth-dark-topography" />

          {/* Slide Content with smooth transition key */}
          <div className="auth-slide-container" key={currentSlide}>
            <div className="auth-editorial-eyebrow">
              {slide.eyebrow}
            </div>

            <h2 className="auth-carousel-heading">
              {slide.titlePart1}
              <span className="auth-carousel-highlight">{slide.titleHighlight}</span>
              {slide.titlePart2 && ` ${slide.titlePart2}`}
            </h2>

            <p className="auth-carousel-subtitle">
              {slide.subtitle}
            </p>

            {/* Feature Pills / Badges Grid */}
            <div className="auth-carousel-features">
              {slide.features.map((feat, index) => (
                <div key={index} className="auth-feature-card">
                  <span className="auth-feature-icon">{feat.icon}</span>
                  <span className="auth-feature-label">{feat.label}</span>
                </div>
              ))}
            </div>

            {/* Editorial Divider */}
            <div className="auth-editorial-divider" />

            {/* Quote */}
            <div className="auth-carousel-quote-box">
              <p className="auth-carousel-quote">
                &ldquo;{slide.quote}&rdquo;
              </p>
              <span className="auth-carousel-author">
                — {slide.author}
              </span>
            </div>
          </div>

          {/* Carousel Footer with 5s Progress Dots */}
          <div className="auth-editorial-footer">
            <div className="editorial-dots" role="tablist" aria-label="Slide Selector">
              {SLIDES.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setCurrentSlide(idx)}
                  className={`ed-dot ${idx === currentSlide ? 'active' : ''}`}
                  aria-label={`Go to slide ${idx + 1}`}
                  role="tab"
                  aria-selected={idx === currentSlide}
                />
              ))}
            </div>

            <div className="editorial-tags">
              <span>Collaborate</span>
              <span>•</span>
              <span>Organize</span>
              <span>•</span>
              <span>Ship</span>
            </div>
          </div>
        </div>
      </div>

      {/* Legal Modal */}
      {legalModalType && (
        <LegalModal
          isOpen={!!legalModalType}
          onClose={() => setLegalModalType(null)}
          type={legalModalType}
        />
      )}

      {/* Help Modal */}
      {showHelpModal && (
        <div className="modal-backdrop" onClick={() => setShowHelpModal(false)}>
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '440px' }}
          >
            <div className="modal-header">
              <h3 className="modal-title" style={{ fontSize: '1.25rem', fontWeight: 700 }}>
                Need Help with D-Board?
              </h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowHelpModal(false)}
                aria-label="Close"
              >
                &times;
              </button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', color: 'var(--text-secondary)', fontSize: '0.9375rem', lineHeight: 1.6 }}>
              <p>
                Have questions regarding signing in, password recovery, or workspace invitations?
              </p>
              <div style={{ backgroundColor: 'var(--bg-subtle)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                <strong style={{ display: 'block', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                  Support Email
                </strong>
                <a href="mailto:dbord.info@gmail.com" style={{ color: 'var(--text-primary)', fontWeight: 600, textDecoration: 'underline' }}>
                  dbord.info@gmail.com
                </a>
              </div>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                Password reset OTPs and invitations are sent immediately to your registered inbox. Please check your spam folder if you do not receive them within a minute.
              </p>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setShowHelpModal(false)}
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
