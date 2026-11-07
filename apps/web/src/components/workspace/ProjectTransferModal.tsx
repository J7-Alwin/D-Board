import React, { useState, useEffect, useCallback } from 'react';
import {
  projectTransferApi,
  type ProjectTransferEligibility,
  type ProjectTransfer,
} from '../../api/projectTransfer.api';
import {
  CloseIcon,
  AlertCircleIcon,
  ArrowRightIcon,
  CheckIcon,
} from '../ui/Icons';
import './ProjectTransferModal.css';

export interface ProjectTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: {
    id: string;
    name: string;
    key?: string | null;
    workspaceId?: string;
  };
  onTransferred?: (newWorkspaceId: string) => void;
}

export const ProjectTransferModal: React.FC<ProjectTransferModalProps> = ({
  isOpen,
  onClose,
  project,
  onTransferred,
}) => {
  const [activeTab, setActiveTab] = useState<'transfer' | 'history'>('transfer');

  // Eligibility and form states
  const [loading, setLoading] = useState(false);
  const [eligibility, setEligibility] = useState<ProjectTransferEligibility | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [recipientEmail, setRecipientEmail] = useState('');
  const [destinationWorkspaceName, setDestinationWorkspaceName] = useState('');
  const [confirmationName, setConfirmationName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitFeedback, setSubmitFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // History state
  const [history, setHistory] = useState<ProjectTransfer[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);

  // Load Eligibility
  const loadEligibility = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const res = await projectTransferApi.getEligibility(project.id);
      if (res.success && res.data) {
        setEligibility(res.data);
      }
    } catch (err: any) {
      setLoadError(err.message || 'Failed to verify transfer eligibility');
    } finally {
      setLoading(false);
    }
  }, [project.id]);

  // Load History
  const loadHistory = useCallback(async () => {
    try {
      setHistoryLoading(true);
      const res = await projectTransferApi.getProjectTransfers(project.id);
      if (res.success && res.data) {
        setHistory(res.data.transfers || []);
      }
    } catch (err: any) {
      console.warn('Failed to load project transfer history', err);
    } finally {
      setHistoryLoading(false);
    }
  }, [project.id]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
      loadEligibility();
      loadHistory();
      setRecipientEmail('');
      setDestinationWorkspaceName('');
      setConfirmationName('');
      setSubmitFeedback(null);
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose, loadEligibility, loadHistory]);

  if (!isOpen) return null;

  const isConfirmed = confirmationName.trim() === project.name.trim();
  const canSubmit =
    recipientEmail.trim().length > 0 &&
    destinationWorkspaceName.trim().length > 0 &&
    isConfirmed &&
    !isSubmitting;

  const handleTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    try {
      setIsSubmitting(true);
      setSubmitFeedback(null);

      const res = await projectTransferApi.requestTransfer(project.id, {
        destinationUserEmail: recipientEmail.trim(),
        destinationWorkspaceName: destinationWorkspaceName.trim(),
      });

      if (res.success) {
        setSubmitFeedback({
          type: 'success',
          message:
            res.data?.message ||
            `Transfer request sent to ${recipientEmail}. The recipient has received an email and notification card.`,
        });

        if (res.data?.executedImmediately) {
          setTimeout(() => {
            onTransferred?.(destinationWorkspaceName);
            onClose();
          }, 1500);
        } else {
          loadHistory();
        }
      }
    } catch (err: any) {
      setSubmitFeedback({
        type: 'error',
        message: err.message || 'Failed to initiate project transfer',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelTransfer = async (transferId: string) => {
    try {
      setCancellingId(transferId);
      setHistoryError(null);
      const res = await projectTransferApi.cancelTransfer(transferId);
      if (res.success) {
        loadHistory();
      }
    } catch (err: any) {
      setHistoryError(err.message || 'Failed to cancel transfer request');
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <div className="ptm-overlay" onClick={onClose}>
      <div className="ptm-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="ptm-header">
          <div className="ptm-header-title-box">
            <h3 className="ptm-title">Transfer Project to Another Workspace</h3>
            <p className="ptm-subtitle">
              Initiate transfer of &ldquo;{project.name}&rdquo; across workspaces.
            </p>
          </div>
          <button
            type="button"
            className="ptm-close-btn"
            onClick={onClose}
            aria-label="Close modal"
          >
            <CloseIcon size={18} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="ptm-nav-tabs">
          <button
            type="button"
            className={`ptm-tab-btn ${activeTab === 'transfer' ? 'active' : ''}`}
            onClick={() => setActiveTab('transfer')}
          >
            Transfer Project
          </button>
          <button
            type="button"
            className={`ptm-tab-btn ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('history');
              loadHistory();
            }}
          >
            Transfer History ({history.length})
          </button>
        </div>

        {/* Content */}
        {activeTab === 'transfer' && (
          <form onSubmit={handleTransferSubmit} className="ptm-content">
            {loading ? (
              <div className="ptm-state-box">
                <div className="ptm-spinner" />
                <span>Checking transfer eligibility...</span>
              </div>
            ) : loadError ? (
              <div className="ptm-alert ptm-alert-error">
                <AlertCircleIcon size={16} />
                <span>{loadError}</span>
              </div>
            ) : !eligibility?.isEligible ? (
              <div className="ptm-alert ptm-alert-warning">
                <AlertCircleIcon size={16} />
                <span>
                  {eligibility?.reason ||
                    'Only Workspace Owners or Workspace Administrators can transfer projects.'}
                </span>
              </div>
            ) : (
              <>
                {/* Visual Direction Summary Card */}
                <div className="ptm-direction-card">
                  <div className="ptm-ws-pill">
                    <span className="ptm-ws-pill-label">Source Workspace</span>
                    <span className="ptm-ws-pill-name">{eligibility.sourceWorkspace.name}</span>
                  </div>
                  <div className="ptm-arrow-divider">
                    <ArrowRightIcon size={18} />
                  </div>
                  <div className="ptm-ws-pill">
                    <span className="ptm-ws-pill-label">Destination Workspace</span>
                    <span className="ptm-ws-pill-name">
                      {destinationWorkspaceName.trim() || 'Enter name below'}
                    </span>
                  </div>
                </div>

                {/* Feedback Alert */}
                {submitFeedback && (
                  <div className={`ptm-alert ptm-alert-${submitFeedback.type}`}>
                    {submitFeedback.type === 'success' ? (
                      <CheckIcon size={16} />
                    ) : (
                      <AlertCircleIcon size={16} />
                    )}
                    <span>{submitFeedback.message}</span>
                  </div>
                )}

                {/* Quick suggestions if user has candidate destination workspaces */}
                {eligibility.eligibleDestinations && eligibility.eligibleDestinations.length > 0 && (
                  <div className="ptm-suggestions-box" style={{ marginBottom: '1rem' }}>
                    <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted, #64748b)', display: 'block', marginBottom: '0.375rem' }}>
                      Or autofill with your other workspaces:
                    </span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                      {eligibility.eligibleDestinations.map((cand) => (
                        <button
                          key={cand.id}
                          type="button"
                          className="ptm-suggestion-pill"
                          style={{
                            fontSize: '0.75rem',
                            padding: '4px 10px',
                            borderRadius: '9999px',
                            background: '#f1f5f9',
                            border: '1px solid #cbd5e1',
                            cursor: 'pointer',
                            color: '#1e293b',
                            fontWeight: 500,
                          }}
                          onClick={() => {
                            setDestinationWorkspaceName(cand.name);
                            // Auto-fill recipient email with current member's email if available
                            if (cand.isOwner && eligibility.currentMembers.length > 0) {
                              const found = eligibility.currentMembers.find((m) => m.role === 'PROJECT_ADMIN');
                              if (found?.user?.email) {
                                setRecipientEmail(found.user.email);
                              }
                            }
                          }}
                        >
                          {cand.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recipient Email Input */}
                <div className="ptm-field-group">
                    <label htmlFor="ptm-recipient-email" className="ptm-label">
                      Recipient Email <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                  <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '0 0 0.375rem 0' }}>
                      Must be the email address of the Workspace Owner or Workspace Admin in the destination workspace.
                    </p>
                    <input
                      id="ptm-recipient-email"
                      type="email"
                      className="ptm-input"
                      placeholder="e.g. admin@organization.com"
                      value={recipientEmail}
                      onChange={(e) => setRecipientEmail(e.target.value)}
                      disabled={isSubmitting}
                    required
                  />
                </div>

                  {/* Destination Workspace Name Input */}
                  <div className="ptm-field-group">
                    <label htmlFor="ptm-dest-name" className="ptm-label">
                      Destination Workspace Name <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '0 0 0.375rem 0' }}>
                      The exact name of the destination workspace under the recipient's account.
                    </p>
                    <input
                      id="ptm-dest-name"
                      type="text"
                      className="ptm-input"
                      placeholder="e.g. Engineering Team"
                      value={destinationWorkspaceName}
                      onChange={(e) => setDestinationWorkspaceName(e.target.value)}
                      disabled={isSubmitting}
                      required
                    />
                  </div>

                  {/* Explanation */}
                  <div className="ptm-alert ptm-alert-info">
                    <AlertCircleIcon size={16} />
                    <div>
                        <strong>Approval Request Workflow</strong>
                        <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8125rem' }}>
                          The recipient will receive an email notice and an interactive transfer request card on their dashboard and invitations page to accept or decline. All project tasks, attachments, and historical work will be transferred.
                        </p>
                    </div>
                  </div>

                  {/* Confirmation Input */}
                  <div className="ptm-field-group">
                    <label htmlFor="ptm-confirm-input" className="ptm-label">
                      Type <strong>{project.name}</strong> to confirm transfer request
                    </label>
                    <input
                      id="ptm-confirm-input"
                      type="text"
                      className="ptm-input"
                      placeholder={`Enter "${project.name}"`}
                      value={confirmationName}
                      onChange={(e) => setConfirmationName(e.target.value)}
                      disabled={isSubmitting}
                    />
                  </div>

                  {/* Actions */}
                  <div className="ptm-actions">
                    <button
                      type="button"
                      className="ptm-btn-secondary"
                      onClick={onClose}
                      disabled={isSubmitting}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="ptm-btn-primary"
                      disabled={!canSubmit}
                    >
                      {isSubmitting ? (
                        <>
                          <div className="ptm-btn-spinner" />
                          <span>Sending Request...</span>
                        </>
                      ) : (
                        <span>Send Transfer Request</span>
                      )}
                    </button>
                  </div>
                </>
            )}
              </form>
        )}

            {/* Transfer History Tab */}
            {activeTab === 'history' && (
              <div className="ptm-content">
                {historyLoading ? (
                  <div className="ptm-state-box">
                    <div className="ptm-spinner" />
                    <span>Loading transfer history...</span>
                  </div>
                ) : historyError ? (
                  <div className="ptm-alert ptm-alert-error">
                    <AlertCircleIcon size={16} />
                    <span>{historyError}</span>
                  </div>
                ) : history.length === 0 ? (
                  <div className="ptm-state-box">
                    <p>No transfer history recorded for this project.</p>
                  </div>
                ) : (
                    <div className="ptm-history-list">
                      {history.map((t) => (
                        <div key={t.id} className="ptm-history-item">
                          <div className="ptm-history-header">
                            <div className="ptm-history-route">
                              <span>{t.sourceWorkspace?.name || 'Source'}</span>
                              <ArrowRightIcon size={14} />
                              <span>{t.destinationWorkspace?.name || t.destinationWorkspaceName || 'Destination'}</span>
                            </div>
                            <span className={`ptm-status-badge ptm-status-${t.status.toLowerCase()}`}>
                              {t.status}
                            </span>
                          </div>

                          <div className="ptm-history-meta">
                            <span>Initiated by: {t.initiatedBy?.fullName || t.initiatedBy?.username || 'Admin'}</span>
                            {t.recipientEmail && (
                              <span>Recipient: {t.recipientEmail}</span>
                            )}
                            <span>Date: {new Date(t.createdAt).toLocaleDateString()}</span>
                          </div>

                          {t.rejectionReason && (
                            <div className="ptm-history-reason">
                              <strong>Declined reason:</strong> {t.rejectionReason}
                            </div>
                          )}

                          {t.status === 'PENDING' && (
                            <div className="ptm-history-actions">
                              <button
                                type="button"
                                className="ptm-cancel-link"
                                disabled={cancellingId === t.id}
                                onClick={() => handleCancelTransfer(t.id)}
                              >
                                {cancellingId === t.id ? 'Cancelling...' : 'Cancel Request'}
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
            )}
                  </div>
                )}
              </div>
    </div>
        );
};
