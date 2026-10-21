import React, { useState, useEffect } from 'react';
import type { Project } from '../../api/projects.api';
import { invitationsApi, type ProjectInvitation } from '../../api/invitations.api';
import { workspacesApi, type WorkspaceMemberItem } from '../../api/workspaces.api';
import { CloseIcon, MailIcon, UsersIcon, MessageSquareIcon } from '../ui/Icons';
import { CustomSelect } from '../ui/CustomSelect';

interface InviteMemberModalProps {
  project: Project;
  isOpen: boolean;
  onClose: () => void;
  onInvited: (invitation: ProjectInvitation) => void;
}

export const InviteMemberModal: React.FC<InviteMemberModalProps> = ({
  project,
  isOpen,
  onClose,
  onInvited,
}) => {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'PROJECT_MEMBER' | 'PROJECT_ADMIN'>('PROJECT_MEMBER');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Quick-picker workspace members state
  const [wsMembers, setWsMembers] = useState<WorkspaceMemberItem[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  useEffect(() => {
    if (isOpen && project.workspaceId) {
      setLoadingMembers(true);
      workspacesApi
        .getMembers(project.workspaceId, { limit: 100 })
        .then((res) => {
          if (res.success && res.data?.members) {
            setWsMembers(res.data.members);
          }
        })
        .catch(() => {})
        .finally(() => setLoadingMembers(false));
    }
  }, [isOpen, project.workspaceId]);

  // Accessibility: Escape key and body scroll lock
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Email address is required');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await invitationsApi.createInvitation(project.id, {
        email: email.trim(),
        role,
        message: message.trim() || undefined,
      });

      if (res.success && res.data.invitation) {
        onInvited(res.data.invitation);
        setEmail('');
        setMessage('');
        setRole('PROJECT_MEMBER');
        onClose();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to send invitation');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-container invite-modal-luxury" onClick={(e) => e.stopPropagation()}>
        {/* Top Header Row with Atmosphere Art & Close Button */}
        <div className="im-modal-header">
          <div className="im-header-left">
            <div className="im-header-icon-box">
              <MailIcon size={20} className="im-header-mail-icon" />
            </div>
            <div className="im-header-text">
              <h2 className="im-header-title">Invite Team Member</h2>
              <p className="im-header-subtitle">
                Send an invitation to collaborate on this project.
              </p>
            </div>
          </div>

          {/* Envelope & Flying Airplane Atmosphere Art */}
          <div className="im-atmosphere-wrap">
            <svg
              width="150"
              height="80"
              viewBox="0 0 150 80"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="im-atmosphere-svg"
            >
              {/* Soft green hills / clouds */}
              <ellipse cx="120" cy="74" rx="42" ry="20" fill="#DCFCE7" opacity="0.6" />
              <ellipse cx="85" cy="76" rx="35" ry="18" fill="#D1FAE5" opacity="0.8" />
              <ellipse cx="130" cy="68" rx="28" ry="14" fill="#A7F3D0" opacity="0.5" />

              {/* Envelope Shadow */}
              <ellipse cx="78" cy="70" rx="24" ry="5" fill="#000000" opacity="0.04" />

              {/* Yellow Envelope Back */}
              <rect x="62" y="46" width="34" height="24" rx="3" fill="#F59E0B" />

              {/* Emerging White Letter */}
              <rect x="66" y="32" width="26" height="24" rx="2.5" fill="#FFFFFF" stroke="#E2E8F0" strokeWidth="1" />
              <rect x="70" y="37" width="18" height="2" rx="1" fill="#10B981" />
              <rect x="70" y="42" width="14" height="2" rx="1" fill="#10B981" />
              <rect x="70" y="47" width="11" height="2" rx="1" fill="#34D399" />

              {/* Sun sparkles radiating above letter */}
              <line x1="79" y1="23" x2="79" y2="28" stroke="#F59E0B" strokeWidth="1.75" strokeLinecap="round" />
              <line x1="69" y1="26" x2="72" y2="29" stroke="#FBBF24" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="89" y1="26" x2="86" y2="29" stroke="#FBBF24" strokeWidth="1.5" strokeLinecap="round" />

              {/* Envelope Front Flaps */}
              <path d="M62 70L79 56L96 70H62Z" fill="#FBBF24" />
              <path d="M62 48L79 61L62 70V48Z" fill="#F59E0B" />
              <path d="M96 48L79 61L96 70V48Z" fill="#F59E0B" />
              <path d="M62 48L79 61L96 48" stroke="#D97706" strokeWidth="0.8" />

              {/* Dashed Flight Trail */}
              <path
                d="M94 52 C104 54, 110 45, 116 38"
                stroke="#60A5FA"
                strokeWidth="1.5"
                strokeDasharray="2.5 2.5"
                strokeLinecap="round"
                fill="none"
              />

              {/* Paper Airplane (Blue) */}
              <g transform="translate(116, 26) rotate(10)">
                <path d="M0 10 L18 0 L8 17 L6 11 L0 10Z" fill="#3B82F6" />
                <path d="M6 11 L18 0 L8 17 L6 11Z" fill="#2563EB" />
                <path d="M6 11 L10 14 L8 17 L6 11Z" fill="#1D4ED8" />
              </g>
            </svg>
          </div>

          {/* Close button */}
          <button
            type="button"
            className="im-close-btn"
            onClick={onClose}
            aria-label="Close"
          >
            <CloseIcon size={16} />
          </button>
        </div>

        {error && <div className="form-error-banner" style={{ margin: '1rem 2rem 0 2rem' }}>{error}</div>}

        <form onSubmit={handleSubmit} className="im-modal-body">
          {/* Quick-select from Workspace Members */}
          {wsMembers.length > 0 && (
            <div className="im-form-group" style={{ marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                <label className="im-field-label" style={{ margin: 0 }}>
                  Workspace Members
                </label>
                <span style={{ fontSize: '0.75rem', color: '#16A34A', fontWeight: 600 }}>
                  {loadingMembers ? 'Loading members...' : `${wsMembers.length} active member${wsMembers.length === 1 ? '' : 's'}`}
                </span>
              </div>
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '0.4rem',
                  maxHeight: '90px',
                  overflowY: 'auto',
                  padding: '0.2rem 0',
                }}
              >
                {wsMembers.map((m) => {
                  const isSelected = email.toLowerCase() === m.user.email.toLowerCase();
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setEmail(m.user.email)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        padding: '0.3rem 0.6rem',
                        borderRadius: '9999px',
                        border: isSelected ? '1.5px solid #16A34A' : '1px solid #E2E8F0',
                        backgroundColor: isSelected ? '#F0FDF4' : '#FFFFFF',
                        cursor: 'pointer',
                        fontSize: '0.75rem',
                        color: isSelected ? '#15803D' : '#334155',
                        transition: 'all 0.15s ease',
                      }}
                      title={m.user.email}
                    >
                      <span
                        style={{
                          width: '18px',
                          height: '18px',
                          borderRadius: '50%',
                          backgroundColor: isSelected ? '#DCFCE7' : '#F1F5F9',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.625rem',
                          fontWeight: 700,
                          color: isSelected ? '#16A34A' : '#64748B',
                        }}
                      >
                        {m.user.fullName ? m.user.fullName[0].toUpperCase() : m.user.username[0].toUpperCase()}
                      </span>
                      <span style={{ fontWeight: isSelected ? 600 : 500 }}>
                        {m.user.fullName || m.user.username}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Email Address Field */}
          <div className="im-form-group">
            <label htmlFor="invite-email" className="im-field-label">
              Email Address *
            </label>
            <div className="im-input-wrapper">
              <MailIcon size={16} className="im-input-leading-icon" />
              <input
                id="invite-email"
                type="email"
                className="im-text-input"
                placeholder="colleague@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
              />
            </div>
            <span className="im-field-helper">
              Recipients must be active members of this workspace. An invitation will be sent to join this project.
            </span>
          </div>

          {/* Project Role Field */}
          <div className="im-form-group">
            <label className="im-field-label">Project Role</label>
            <CustomSelect
              value={role}
              onChange={(val) => setRole(val as any)}
              triggerClassName="im-select-trigger"
              options={[
                {
                  value: 'PROJECT_MEMBER',
                  label: 'Project Member',
                  icon: <UsersIcon size={16} />,
                  description: 'Can view, create, and update tasks',
                },
                {
                  value: 'PROJECT_ADMIN',
                  label: 'Project Administrator',
                  icon: <UsersIcon size={16} />,
                  description: 'Can manage settings, members, and delete tasks',
                },
              ]}
            />
            <span className="im-field-helper">
              You can always change their role later.
            </span>
          </div>

          {/* Personal Message (Optional) Field */}
          <div className="im-form-group">
            <label htmlFor="invite-message" className="im-field-label">
              Personal Message (Optional)
            </label>
            <div className="im-textarea-wrapper">
              <MessageSquareIcon size={16} className="im-textarea-leading-icon" />
              <textarea
                id="invite-message"
                className="im-textarea-input"
                rows={3}
                maxLength={500}
                placeholder="Add a welcoming note or details about the project..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            </div>
            <div className="im-textarea-counter-row">
              <span className="im-char-counter">{message.length}/500</span>
            </div>
          </div>

          {/* Modal Actions Footer */}
          <div className="im-modal-footer">
            <button
              type="button"
              className="im-cancel-btn"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="im-submit-btn"
              disabled={isSubmitting}
            >
              <MailIcon size={16} />
              <span>{isSubmitting ? 'Sending...' : 'Send Invitation'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
