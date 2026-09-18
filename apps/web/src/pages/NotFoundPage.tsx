import React from 'react';
import { useRouter, Link } from '../router/Router';
import { Button } from '../components/ui/Button';
import { ArrowLeftIcon, HomeIcon } from '../components/ui/Icons';

export const NotFoundPage: React.FC = () => {
  const { navigate } = useRouter();

  return (
    <div
      className="not-found-page-container"
      style={{
        minHeight: '75vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '3rem 1.5rem',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '4.5rem',
          height: '4.5rem',
          borderRadius: 'var(--radius-lg, 16px)',
          backgroundColor: 'var(--bg-white, #FFFFFF)',
          border: '1px solid var(--border-light, #E5E6DE)',
          boxShadow: 'var(--shadow-sm, 0 1px 2px 0 rgba(0, 0, 0, 0.05))',
          marginBottom: '1.5rem',
        }}
      >
        <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary, #1F1F1F)' }}>
          404
        </span>
      </div>

      <h1
        style={{
          fontSize: '2.25rem',
          fontWeight: 800,
          color: 'var(--text-primary, #1F1F1F)',
          letterSpacing: '-0.02em',
          marginBottom: '0.75rem',
        }}
      >
        Page not found
      </h1>

      <p
        style={{
          maxWidth: '32rem',
          fontSize: '1rem',
          color: 'var(--text-secondary, #575757)',
          lineHeight: 1.6,
          marginBottom: '2rem',
        }}
      >
        The page, workspace, or resource you are looking for doesn't exist, has been removed, or was moved to another route.
      </p>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
        <Button
          variant="outline"
          size="md"
          leftIcon={<ArrowLeftIcon size={16} />}
          onClick={() => window.history.back()}
        >
          Go Back
        </Button>
        <Button
          variant="primary"
          size="md"
          leftIcon={<HomeIcon size={16} />}
          onClick={() => navigate('/app/dashboard')}
        >
          Return to Dashboard
        </Button>
      </div>

      <div
        style={{
          marginTop: '3.5rem',
          paddingTop: '2rem',
          borderTop: '1px solid var(--border-subtle, #ECECE6)',
          display: 'flex',
          gap: '1.5rem',
          fontSize: '0.8125rem',
          color: 'var(--text-muted, #7E7E7E)',
        }}
      >
        <Link to="/" style={{ color: 'inherit', textDecoration: 'underline' }}>Home</Link>
        <Link to="/features" style={{ color: 'inherit', textDecoration: 'underline' }}>Features</Link>
        <Link to="/about" style={{ color: 'inherit', textDecoration: 'underline' }}>About</Link>
        <Link to="/terms" style={{ color: 'inherit', textDecoration: 'underline' }}>Terms</Link>
        <Link to="/privacy" style={{ color: 'inherit', textDecoration: 'underline' }}>Privacy</Link>
      </div>
    </div>
  );
};
