import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { authApi } from '../../api/auth.api';
import {
  CloseIcon,
  CheckIcon,
  UserIcon,
  ArrowRightIcon,
  ChatIcon,
  UsersIcon,
  StarIcon,
  InfoIcon,
} from '../ui/Icons';

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

  // Suggested handles state
  const [suggestedHandles, setSuggestedHandles] = useState<string[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  // Live availability check state
  const [isChecking, setIsChecking] = useState(false);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(true);
  const [availabilityMessage, setAvailabilityMessage] = useState<string | null>(null);

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize username & fetch verified unique suggestions
  useEffect(() => {
    if (isOpen) {
      const initialHandle = currentUsername || user?.username || '';
      setUsername(initialHandle);
      setError(null);
      setIsSaved(false);
      setIsAvailable(true);
      setAvailabilityMessage(null);

      // Fetch suggestions verified against the database
      setLoadingSuggestions(true);
      authApi
        .getSuggestedUsernames()
        .then((res) => {
          if (res.success && res.data?.suggestions && res.data.suggestions.length > 0) {
            setSuggestedHandles(res.data.suggestions);
          } else {
            // Local fallback suggestions based on user info
            const fallback: string[] = [];
            if (initialHandle) fallback.push(initialHandle);
            if (user?.fullName) {
              const parts = user.fullName.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean);
              if (parts.length >= 2) {
                fallback.push(`${parts[0]}${parts[1]}`);
                fallback.push(`${parts[0]}.${parts[1]}`);
              }
            }
            if (fallback.length === 0 && user?.email) {
              const prefix = user.email.split('@')[0].replace(/[^a-zA-Z0-9_.-]/g, '');
              fallback.push(prefix);
            }
            setSuggestedHandles(Array.from(new Set(fallback)).slice(0, 3));
          }
        })
        .catch(() => {
          // Fallback based on user context
          const fallback: string[] = [];
          if (initialHandle) fallback.push(initialHandle);
          if (user?.fullName) {
            const parts = user.fullName.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean);
            if (parts.length >= 2) {
              fallback.push(`${parts[0]}${parts[1]}`);
              fallback.push(`${parts[0]}.${parts[1]}`);
            }
          }
          setSuggestedHandles(Array.from(new Set(fallback)).slice(0, 3));
        })
        .finally(() => {
          setLoadingSuggestions(false);
        });
    }
  }, [isOpen, currentUsername, user]);

  // Live availability verification debounce
  const checkHandleAvailability = useCallback(
    async (handleToCheck: string) => {
      const clean = handleToCheck.trim().toLowerCase();

      if (!clean) {
        setIsAvailable(null);
        setAvailabilityMessage(null);
        return;
      }

      if (clean.length < 3 || clean.length > 30) {
        setIsAvailable(false);
        setAvailabilityMessage('3–30 characters required');
        return;
      }

      if (!/^[a-zA-Z0-9_.-]+$/.test(clean)) {
        setIsAvailable(false);
        setAvailabilityMessage('Only letters, numbers, underscores, hyphens, and periods allowed');
        return;
      }

      // If matches user's current handle, it is automatically available to them
      if (clean === (user?.username || '').toLowerCase()) {
        setIsAvailable(true);
        setAvailabilityMessage(null);
        return;
      }

      setIsChecking(true);
      try {
        const res = await authApi.checkUsername(clean);
        if (res.success && res.data) {
          setIsAvailable(res.data.available);
          setAvailabilityMessage(res.data.available ? null : 'This handle is already taken');
        } else {
          setIsAvailable(true);
          setAvailabilityMessage(null);
        }
      } catch {
        // If check API is transiently unavailable, don't hard block typing
        setIsAvailable(true);
        setAvailabilityMessage(null);
      } finally {
        setIsChecking(false);
      }
    },
    [user?.username]
  );

  const handleInputChange = (val: string) => {
    const sanitized = val.replace(/[^a-zA-Z0-9_.-]/g, '');
    setUsername(sanitized);
    setError(null);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      checkHandleAvailability(sanitized);
    }, 280);
  };

  const handleSelectSuggested = (handle: string) => {
    setUsername(handle);
    setError(null);
    setIsAvailable(true);
    setAvailabilityMessage(null);
  };

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

    if (!/^[a-zA-Z0-9_.-]+$/.test(cleanUsername)) {
      setError('Username can only contain letters, numbers, underscores, hyphens, and periods');
      return;
    }

    if (isAvailable === false) {
      setError('This username is already taken. Please choose another unique handle.');
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
      setIsAvailable(false);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  const userInitial = (user?.fullName?.trim()[0] || user?.username?.[0] || 'U').toUpperCase();
  const displayName = user?.fullName || user?.username || 'developer';

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-container cum-modal-window" onClick={(e) => e.stopPropagation()}>
        {/* Header Bar */}
        <div className="cum-header-bar">
          <div className="cum-header-left">
            <div className="cum-header-icon-box">
              <UserIcon size={24} />
            </div>
            <div className="cum-header-titles">
              <h2 className="cum-title">Choose Your @Username</h2>
              <p className="cum-subtitle">
                Welcome to D-Board, {displayName}! Choose a unique handle for your profile, team @mentions, and collaboration.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="cum-close-btn"
            onClick={onClose}
            aria-label="Close modal"
          >
            <CloseIcon size={18} />
          </button>
        </div>

        {error && (
          <div className="form-error-banner" style={{ margin: '0.75rem 2rem 0' }}>
            {error}
          </div>
        )}

        {isSaved ? (
          <div style={{ padding: '3.5rem 2rem', textAlign: 'center' }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '3.5rem',
                height: '3.5rem',
                borderRadius: '50%',
                backgroundColor: '#ECFDF5',
                color: '#10B981',
                marginBottom: '1rem',
                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)',
              }}
            >
              <CheckIcon size={28} />
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0F172A', marginBottom: '0.35rem' }}>
              Handle updated successfully!
            </h3>
            <p style={{ fontSize: '0.9375rem', color: '#64748B' }}>
              You are now known as <strong style={{ color: '#0F172A' }}>@{username}</strong> across your engineering workspaces.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'contents' }}>
            {/* 2-Column Body */}
            <div className="cum-body-grid">
              {/* Left Column: Form & Suggestions */}
              <div className="cum-left-col">
                <label htmlFor="cum-handle-input" className="cum-field-label">
                  Unique Handle *
                </label>

                <div
                  className={`cum-input-wrapper ${
                    isAvailable === true && username.trim().length >= 3
                      ? 'is-valid'
                      : isAvailable === false
                      ? 'is-invalid'
                      : ''
                  }`}
                >
                  <span className="cum-input-at">@</span>
                  <input
                    id="cum-handle-input"
                    type="text"
                    placeholder="yourhandle"
                    value={username}
                    onChange={(e) => handleInputChange(e.target.value)}
                    required
                    disabled={isSaving}
                    autoFocus
                    className="cum-input-field"
                  />
                  <div className="cum-input-status-icon">
                    {isChecking ? (
                      <div
                        style={{
                          width: '16px',
                          height: '16px',
                          borderRadius: '50%',
                          border: '2px solid #CBD5E1',
                          borderTopColor: '#10B981',
                          animation: 'spin 0.6s linear infinite',
                        }}
                      />
                    ) : isAvailable === true && username.trim().length >= 3 ? (
                      <div className="cum-valid-check-circle" title="Handle is available">
                        ✓
                      </div>
                    ) : isAvailable === false ? (
                      <div className="cum-invalid-circle" title="Handle is already taken">
                        !
                      </div>
                    ) : null}
                  </div>
                </div>

                <span className="cum-helper-text">
                  Letters, numbers, underscores, and hyphens (3–30 characters).
                </span>

                {availabilityMessage && (
                  <span className={`cum-feedback-msg ${isAvailable ? 'success' : 'error'}`}>
                    {isAvailable ? '✓ ' : '✕ '}
                    {availabilityMessage}
                  </span>
                )}

                {/* Suggested handles */}
                <div className="cum-suggested-section">
                  <span className="cum-suggested-label">Suggested handles</span>
                  <div className="cum-suggested-chips-row">
                    {suggestedHandles.map((handle) => {
                      const isSelected = username.toLowerCase() === handle.toLowerCase();
                      return (
                        <button
                          key={handle}
                          type="button"
                          className={`cum-suggested-chip ${isSelected ? 'active' : ''}`}
                          onClick={() => handleSelectSuggested(handle)}
                          title={`Click to use @${handle}`}
                        >
                          @{handle}
                        </button>
                      );
                    })}
                    {suggestedHandles.length === 0 && !loadingSuggestions && (
                      <span style={{ fontSize: '0.8125rem', color: '#94A3B8' }}>
                        Loading verified unique suggestions...
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Column: Atmosphere Mockup & Value Props */}
              <div className="cum-right-panel">
                {/* Floating Profile Card Mockup */}
                <div className="cum-mockup-wrapper">
                  {/* Radiating 3 sparkle lines above mockup */}
                  <svg
                    className="cum-radiate-marks"
                    width="28"
                    height="24"
                    viewBox="0 0 30 25"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <line x1="6" y1="20" x2="2" y2="10" stroke="#1E293B" strokeWidth="2" strokeLinecap="round" />
                    <line x1="16" y1="20" x2="16" y2="4" stroke="#1E293B" strokeWidth="2" strokeLinecap="round" />
                    <line x1="26" y1="20" x2="30" y2="11" stroke="#1E293B" strokeWidth="2" strokeLinecap="round" />
                  </svg>

                  {/* Profile Preview Card */}
                  <div className="cum-profile-card-mockup">
                    <div className="cum-mockup-top-row">
                      <div className="cum-mockup-avatar">{userInitial}</div>
                      <div className="cum-mockup-skeleton-lines">
                        <div className="cum-skeleton-bar-long" />
                        <div className="cum-skeleton-bar-short" />
                      </div>
                    </div>
                    <div className="cum-mockup-badge-row">
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        @{username || 'handle'}
                      </span>
                      <span className="cum-mockup-badge-check">✓</span>
                    </div>
                  </div>

                  {/* Whimsical Handwritten Script & Sketch Arrow */}
                  <div className="cum-script-annotation">
                    <span className="cum-handwritten-text">
                      A unique handle
                      <br />
                      for a better
                      <br />
                      together.
                    </span>
                    <svg
                      className="cum-arrow-doodle"
                      width="38"
                      height="38"
                      viewBox="0 0 40 40"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M28 6 C32 18 26 28 8 28 M16 22 L8 28 L14 34"
                        stroke="#4D6B30"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                </div>

                {/* 3 Key Benefits */}
                <div className="cum-benefits-list">
                  <div className="cum-benefit-row">
                    <div className="cum-benefit-icon-box">
                      <ChatIcon size={18} />
                    </div>
                    <div className="cum-benefit-text-wrap">
                      <span className="cum-benefit-title">Connect easily</span>
                      <span className="cum-benefit-desc">Use @mentions across projects</span>
                    </div>
                  </div>

                  <div className="cum-benefit-row">
                    <div className="cum-benefit-icon-box">
                      <UsersIcon size={18} />
                    </div>
                    <div className="cum-benefit-text-wrap">
                      <span className="cum-benefit-title">Be discoverable</span>
                      <span className="cum-benefit-desc">Your team can find and mention you</span>
                    </div>
                  </div>

                  <div className="cum-benefit-row">
                    <div className="cum-benefit-icon-box">
                      <StarIcon size={18} />
                    </div>
                    <div className="cum-benefit-text-wrap">
                      <span className="cum-benefit-title">Make it yours</span>
                      <span className="cum-benefit-desc">A unique identity for your profile</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="cum-modal-footer">
              <div className="cum-footer-note">
                <span className="cum-info-circle">
                  <InfoIcon size={12} />
                </span>
                <span>You can change this later in your profile settings.</span>
              </div>

              <div className="cum-footer-actions">
                <button
                  type="button"
                  className="cum-btn-keep"
                  onClick={onClose}
                  disabled={isSaving}
                >
                  Keep (@{currentUsername || user?.username || 'handle'})
                </button>
                <button
                  type="submit"
                  className="cum-btn-save"
                  disabled={isSaving || isAvailable === false || username.trim().length < 3}
                >
                  <span>{isSaving ? 'Saving...' : 'Save Handle'}</span>
                  {!isSaving && <ArrowRightIcon size={15} />}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
