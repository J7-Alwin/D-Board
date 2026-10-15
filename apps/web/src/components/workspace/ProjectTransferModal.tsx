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

  const [selectedDestinationId, setSelectedDestinationId] = useState<string>('');
  const [confirmationName, setConfirmationName] = useState<string>('');
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
        if (res.data.eligibleDestinations.length > 0) {
          setSelectedDestinationId(res.data.eligibleDestinations[0].id);
        }
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
      setConfirmationName('');
      setSubmitFeedback(null);
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose, loadEligibility, loadHistory]);

  if (!isOpen) return null;

  const selectedDestination = eligibility?.eligibleDestinations.find(
    (d) => d.id === selectedDestinationId
  );

  const isSameOwner = Boolean(
    selectedDestination &&
    eligibility?.sourceWorkspace.isOwner &&
    selectedDestination.isOwner
  );

  const isConfirmed = confirmationName.trim() === project.name.trim();

  const handleTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDestinationId || !isConfirmed || isSubmitting) return;

    try {
      setIsSubmitting(true);
      setSubmitFeedback(null);

      const res = await projectTransferApi.requestTransfer(project.id, selectedDestinationId);

      if (res.success) {
        setSubmitFeedback({
          type: 'success',
          message: res.data?.message || 'Transfer completed successfully',
        });

        if (res.data?.executedImmediately) {
          setTimeout(() => {
            onTransferred?.(selectedDestinationId);
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
            <h3 className="ptm-title">Transfer Project to Workspace</h3>
            <p className="ptm-subtitle">
              Move &ldquo;{project.name}&rdquo; and all associated tasks, files, and resources.
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
                    'You must be a Workspace Owner or Workspace Admin to transfer this project.'}
                </span>
              </div>
            ) : eligibility.eligibleDestinations.length === 0 ? (
              <div className="ptm-alert ptm-alert-info">
                <AlertCircleIcon size={16} />
                <span>
                  No eligible destination workspaces available. You must be an Owner or Admin of another non-personal team workspace to transfer this project.
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
                    <span className="ptm-ws-pill-label">Target Workspace</span>
                    <span className="ptm-ws-pill-name">
                      {selectedDestination?.name || 'Select a destination'}
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

                {/* Destination Selector */}
                <div className="ptm-field-group">
                  <label htmlFor="ptm-dest-select" className="ptm-label">
                    Select Destination Workspace
                  </label>
                  <select
                    id="ptm-dest-select"
                    className="ptm-select"
                    value={selectedDestinationId}
                    onChange={(e) => setSelectedDestinationId(e.target.value)}
                    disabled={isSubmitting}
                  >
                    {eligibility.eligibleDestinations.map((dest) => (
                      <option key={dest.id} value={dest.id}>
                        {dest.name} ({dest.isOwner ? 'Owner' : 'Admin'})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Transfer Mode Explanation */}
                <div className={`ptm-alert ${isSameOwner ? 'ptm-alert-info' : 'ptm-alert-warning'}`}>
                  <AlertCircleIcon size={16} />
                  <div>
                    <strong>
                      {isSameOwner
                        ? 'Immediate Execution'
                        : 'Approval Required by Destination Owner'}
                    </strong>
                    <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem' }}>
                      {isSameOwner
                        ? 'You own both the source and target workspaces. This project and all its data will transfer immediately.'
                        : 'Since this is a cross-owner transfer, a transfer request will be submitted to the destination workspace administrators for authorization.'}
                    </p>
                  </div>
                </div>

                {/* Impact Analysis & Data Preservation Notice */}
                <div className="ptm-impact-box">
                  <h4 className="ptm-impact-title">Transfer Consequences & Data Preservation</h4>
                  <ul className="ptm-impact-list">
                    <li className="ptm-impact-item">
                      <span className="ptm-impact-dot success" />
                      <span>
                        <strong>Preserved completely:</strong> All tasks, comments, subtasks, files, folders, notes, calendar events, and historical author attribution.
                      </span>
                    </li>
                    <li className="ptm-impact-item">
                      <span className="ptm-impact-dot warning" />
                      <span>
                        <strong>Workspace boundary enforcement:</strong> Project members who do not belong to the destination workspace will lose project access, and their assigned work items will be unassigned.
                      </span>
                    </li>
                    <li className="ptm-impact-item">
                      <span className="ptm-impact-dot success" />
                      <span>
                        Members present in both workspaces retain their eligible project roles automatically.
                      </span>
                    </li>
                  </ul>
                </div>

                {/* Confirmation Input */}
                <div className="ptm-field-group">
                  <label htmlFor="ptm-confirm-input" className="ptm-label">
                    Type <strong>{project.name}</strong> to confirm:
                  </label>
                  <input
                    id="ptm-confirm-input"
                    type="text"
                    className="ptm-input"
                    placeholder={project.name}
                    value={confirmationName}
                    onChange={(e) => setConfirmationName(e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>
              </>
            )}

            {/* Footer Buttons */}
            {eligibility?.isEligible && eligibility.eligibleDestinations.length > 0 && (
              <div className="ptm-footer" style={{ margin: '1rem -1.5rem -1.5rem', padding: '1rem 1.5rem' }}>
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
                  disabled={!isConfirmed || !selectedDestinationId || isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <div className="ptm-spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
                      <span>Processing...</span>
                    </>
                  ) : (
                    <span>{isSameOwner ? 'Transfer Project Now' : 'Request Transfer'}</span>
                  )}
                </button>
              </div>
            )}
          </form>
        )}

        {/* Tab 2: History */}
        {activeTab === 'history' && (
          <div className="ptm-content">
            {historyError && (
              <div className="ptm-alert ptm-alert-error" style={{ marginBottom: '1rem' }}>
                <AlertCircleIcon size={16} />
                <span>{historyError}</span>
              </div>
            )}
            {historyLoading ? (
              <div className="ptm-state-box">
                <div className="ptm-spinner" />
                <span>Loading transfer history...</span>
              </div>
            ) : history.length === 0 ? (
              <div className="ptm-state-box">
                <span>No transfer history for this project.</span>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="ptm-history-table">
                  <thead>
                    <tr>
                      <th>Status</th>
                      <th>Destination</th>
                      <th>Initiated By</th>
                      <th>Date</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <span
                            className={`ptm-badge ptm-badge-${item.status.toLowerCase()}`}
                          >
                            {item.status}
                          </span>
                        </td>
                        <td>{item.destinationWorkspace?.name || item.destinationWorkspaceId}</td>
                        <td>{item.initiatedBy?.fullName || item.initiatedBy?.username || 'User'}</td>
                        <td>{new Date(item.createdAt).toLocaleDateString()}</td>
                        <td>
                          {item.status === 'PENDING' && (
                            <button
                              type="button"
                              className="ptm-btn-secondary"
                              style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                              onClick={() => handleCancelTransfer(item.id)}
                              disabled={cancellingId === item.id}
                            >
                              {cancellingId === item.id ? 'Cancelling...' : 'Cancel'}
                            </button>
                          )}
                          {item.status === 'REJECTED' && item.rejectionReason && (
                            <span style={{ fontSize: '0.75rem', color: '#991b1b' }}>
                              Reason: {item.rejectionReason}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
