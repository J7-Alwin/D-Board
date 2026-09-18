import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { authApi } from '../../api/auth.api';
import { CloseIcon, CheckIcon, UserIcon, ArrowRightIcon } from '../ui/Icons';
import { Button } from '../ui/Button';

interface ChooseUsernameModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUsername?: string;
}

export const ChooseUsernameModal: React.FC<ChooseUsernameModalProps> = ({
  isOpen,
  onClose,
  currentUsername = '',
}) => {
  const { refreshUser, user } = useAuth();
  const [username, setUsername] = useState(currentUsername);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanUsername = username.trim().toLowerCase();

    if (!cleanUsername) {
      setError('Username handle is required');
      return;
    }

    if (cleanUsername.length < 3 || cleanUsername.length > 30) {
      setError('Username must be between 3 and 30 characters');
      return;
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(cleanUsername)) {
      setError('Username can only contain letters, numbers, underscores, and hyphens');
      return;
    }

    try {
      setIsSaving(true);
      const res = await authApi.updateUsername(cleanUsername);
      if (res.success) {
        setIsSaved(true);
        await refreshUser();
        setTimeout(() => {
          onClose();
        }, 800);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to update username. It might already be taken.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="modal-container modal-md"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '30rem' }}
      >
        <div className="modal-header">
          <div className="modal-title-box">
            <UserIcon size={20} />
            <h2>Choose Your @Username</h2>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Close">
            <CloseIcon size={18} />
          </button>
        </div>

        {error && <div className="form-error-banner" style={{ margin: '1rem 1.5rem 0' }}>{error}</div>}

        {isSaved ? (
          <div style={{ padding: '2rem 1.5rem', textAlign: 'center' }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '3rem',
                height: '3rem',
                borderRadius: '50%',
                backgroundColor: 'var(--badge-green-bg, #E7F6EC)',
                color: 'var(--badge-green-text, #166534)',
                marginBottom: '1rem',
              }}
            >
              <CheckIcon size={24} />
            </div>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
              Username updated!
            </h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              You are now known as <strong>@{username}</strong> across your engineering workspaces.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="modal-form" style={{ padding: '1.25rem 1.5rem 1.5rem' }}>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
              Welcome to D-Board{user?.fullName ? `, ${user.fullName}` : ''}! Choose a unique handle for your profile, team @mentions, and collaboration.
            </p>

            <div className="form-group" style={{ marginTop: '0.5rem' }}>
              <label htmlFor="user-handle-input" style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                Unique Handle *
              </label>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  backgroundColor: 'var(--bg-white, #FFFFFF)',
                  border: '1px solid var(--border-light, #E5E6DE)',
                  borderRadius: 'var(--radius-sm, 6px)',
                  overflow: 'hidden',
                  transition: 'border-color 150ms ease',
                }}
              >
                <span
                  style={{
                    padding: '0.625rem 0.75rem',
                    backgroundColor: 'var(--bg-subtle, #F4F4F4)',
                    color: 'var(--text-muted, #7E7E7E)',
                    fontWeight: 600,
                    fontSize: '0.875rem',
                    borderRight: '1px solid var(--border-light, #E5E6DE)',
                    userSelect: 'none',
                  }}
                >
                  @
                </span>
                <input
                  id="user-handle-input"
                  type="text"
                  placeholder="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ''))}
                  required
                  disabled={isSaving}
                  autoFocus
                  style={{
                    flex: 1,
                    border: 'none',
                    outline: 'none',
                    padding: '0.625rem 0.875rem',
                    fontSize: '0.875rem',
                    color: 'var(--text-primary, #1F1F1F)',
                    backgroundColor: 'transparent',
                    fontFamily: 'inherit',
                  }}
                />
              </div>
              <span className="input-helper-msg" style={{ fontSize: '0.75rem', color: 'var(--text-muted, #7E7E7E)', marginTop: '0.375rem' }}>
                Letters, numbers, underscores, and hyphens (3–30 characters).
              </span>
            </div>

            <div
              className="modal-footer"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: '0.75rem',
                marginTop: '0.75rem',
                paddingTop: '1rem',
                borderTop: '1px solid var(--border-subtle, #ECECE6)',
                flexWrap: 'wrap',
              }}
            >
              <Button
                type="button"
                variant="outline"
                size="md"
                onClick={onClose}
                disabled={isSaving}
              >
                Keep (@{currentUsername || 'user'})
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="md"
                isLoading={isSaving}
                rightIcon={<ArrowRightIcon size={16} />}
              >
                Save Handle
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
