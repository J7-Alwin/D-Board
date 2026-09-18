import React from 'react';
import { useRouter } from '../router/Router';
import { Button } from '../components/ui/Button';
import { RefreshCwIcon, HomeIcon, AlertCircleIcon } from '../components/ui/Icons';

interface ServerErrorPageProps {
  error?: Error | string;
  onReset?: () => void;
}

export const ServerErrorPage: React.FC<ServerErrorPageProps> = ({ error, onReset }) => {
  const { navigate } = useRouter();

  const handleRefresh = () => {
    if (onReset) {
      onReset();
    } else {
      window.location.reload();
    }
  };

  return (
    <div
      className="server-error-page-container"
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
          backgroundColor: '#FEF2F2',
          border: '1px solid #FECACA',
          color: '#DC2626',
          marginBottom: '1.5rem',
        }}
      >
        <AlertCircleIcon size={32} />
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
        Something went wrong
      </h1>

      <p
        style={{
          maxWidth: '32rem',
          fontSize: '1rem',
          color: 'var(--text-secondary, #575757)',
          lineHeight: 1.6,
          marginBottom: '1.5rem',
        }}
      >
        We encountered an unexpected error while processing your request. Our system logs have recorded this incident.
      </p>

      {error && (
        <div
          style={{
            maxWidth: '32rem',
            width: '100%',
            padding: '0.75rem 1rem',
            backgroundColor: 'var(--bg-white, #FFFFFF)',
            border: '1px solid var(--border-light, #E5E6DE)',
            borderRadius: 'var(--radius-sm, 6px)',
            fontFamily: 'var(--font-mono, monospace)',
            fontSize: '0.8125rem',
            color: '#DC2626',
            textAlign: 'left',
            marginBottom: '2rem',
            wordBreak: 'break-word',
          }}
        >
          {typeof error === 'string' ? error : error.message}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
        <Button
          variant="primary"
          size="md"
          leftIcon={<RefreshCwIcon size={16} />}
          onClick={handleRefresh}
        >
          Try Again
        </Button>
        <Button
          variant="outline"
          size="md"
          leftIcon={<HomeIcon size={16} />}
          onClick={() => navigate('/')}
        >
          Go to Home
        </Button>
      </div>
    </div>
  );
};
