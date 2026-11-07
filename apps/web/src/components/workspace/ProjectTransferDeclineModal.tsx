import React, { useState } from 'react';
import { projectTransferApi, type ProjectTransfer } from '../../api/projectTransfer.api';
import { CloseIcon, AlertCircleIcon } from '../ui/Icons';
import './ProjectTransferAcceptModal.css';

export interface ProjectTransferDeclineModalProps {
  isOpen: boolean;
  onClose: () => void;
  transfer: ProjectTransfer | null;
  onSuccess: () => void;
}

export const ProjectTransferDeclineModal: React.FC<ProjectTransferDeclineModalProps> = ({
  isOpen,
  onClose,
  transfer,
  onSuccess,
}) => {
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !transfer) return null;

  const projectName = transfer.project?.name || transfer.projectName || 'Project';

  const handleConfirmDecline = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      setError(null);

      const res = await projectTransferApi.rejectTransfer(transfer.id, reason.trim() || undefined);
      if (res.success) {
        onSuccess();
        onClose();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to decline project transfer');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="ptam-overlay" onClick={onClose}>
      <div className="ptam-modal" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
        <div className="ptam-header">
          <div>
            <h3 className="ptam-title">Decline Project Transfer</h3>
            <p className="ptam-subtitle">
              Decline transfer request for &ldquo;{projectName}&rdquo;.
            </p>
          </div>
          <button
            type="button"
            className="ptam-close-btn"
            onClick={onClose}
            aria-label="Close modal"
          >
            <CloseIcon size={18} />
          </button>
        </div>

        <form onSubmit={handleConfirmDecline} className="ptam-body">
          {error && (
            <div className="ptam-alert ptam-alert-error">
              <AlertCircleIcon size={16} />
              <span>{error}</span>
            </div>
          )}

          <p style={{ fontSize: '0.875rem', color: '#475569', margin: 0 }}>
            Are you sure you want to decline this transfer? Both you and the requester will receive an email confirmation.
          </p>

          <div className="ptam-section">
            <label htmlFor="decline-reason" className="ptam-section-title">
              Reason for declining (Optional)
            </label>
            <textarea
              id="decline-reason"
              rows={3}
              className="ptam-input"
              placeholder="e.g. Does not belong in this workspace or needs further discussion"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          <div className="ptam-footer" style={{ padding: '0.75rem 0 0 0', background: 'transparent' }}>
            <button
              type="button"
              className="ptam-btn-secondary"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="ptam-btn-primary"
              style={{ background: '#dc2626' }}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <div className="ptam-spinner" />
                  <span>Declining...</span>
                </>
              ) : (
                <span>Decline Transfer</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

