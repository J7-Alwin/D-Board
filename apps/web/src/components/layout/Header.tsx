import React, { useState } from 'react';
import { Link, useRouter } from '../../router/Router';
import { Button } from '../ui/Button';
import { MenuIcon, CloseIcon, ArrowRightIcon } from '../ui/Icons';
import { Logo } from '../ui/Logo';

export const Header: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { navigate } = useRouter();

  const navItems = [
    { label: 'Features', to: '/features' },
    { label: 'How it works', to: '/how-it-works' },
    { label: 'Pricing', to: '/pricing' },
    { label: 'About', to: '/about' },
  ];

  return (
    <header className="site-header">
      <div className="header-inner container">
        {/* Brand Logo */}
        <Link to="/" className="brand-logo" aria-label="D-Board Home">
          <Logo size="md" withText withTagline />
        </Link>

        {/* Desktop Navigation */}
        <nav className="desktop-nav" aria-label="Main Navigation">
          <ul className="nav-list">
            {navItems.map((item) => (
              <li key={item.to} className="nav-item">
                <Link to={item.to} className="nav-link">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* Right CTA */}
        <div className="header-actions">
          <Link to="/login" className="btn-signin-link">
            Sign in
          </Link>
          <Button
            variant="primary"
            size="md"
            rightIcon={<ArrowRightIcon size={16} />}
            onClick={() => navigate('/register')}
          >
            Get started
          </Button>

          {/* Mobile Menu Toggle */}
          <button
            type="button"
            className="mobile-menu-btn"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <CloseIcon size={24} /> : <MenuIcon size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Drawer */}
      {mobileMenuOpen && (
        <div className="mobile-drawer" role="dialog" aria-modal="true">
          <div className="mobile-drawer-inner">
            <nav className="mobile-nav" aria-label="Mobile Navigation">
              <ul className="mobile-nav-list">
                {navItems.map((item) => (
                  <li key={item.to} className="mobile-nav-item">
                    <Link
                      to={item.to}
                      className="mobile-nav-link"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
            <div className="mobile-drawer-actions">
              <Link
                to="/login"
                className="mobile-signin-btn"
                onClick={() => setMobileMenuOpen(false)}
              >
                Sign in
              </Link>
              <Button
                variant="primary"
                size="lg"
                fullWidth
                rightIcon={<ArrowRightIcon size={16} />}
                onClick={() => {
                  setMobileMenuOpen(false);
                  navigate('/register');
                }}
              >
                Get started
              </Button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
