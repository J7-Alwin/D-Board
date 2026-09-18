import React from 'react';
import type { WorkItem } from '../../api/work.api';
import {
  TrashIcon,
  CloseIcon,
  AlertCircleIcon,
  BugIcon,
  CodeIcon,
  TrendingUpIcon,
  FileTextIcon,
  CheckSquareIcon,
} from '../ui/Icons';

export interface DeleteWorkItemModalProps {
  isOpen: boolean;
  workItem: WorkItem | null;
  onClose: () => void;
  onConfirmDelete: (workItem: WorkItem) => Promise<void> | void;
  isDeleting?: boolean;
}

export const DeleteWorkItemModal: React.FC<DeleteWorkItemModalProps> = ({
  isOpen,
  workItem,
  onClose,
  onConfirmDelete,
  isDeleting = false,
}) => {
  if (!isOpen || !workItem) return null;

  const handleConfirm = async () => {
    if (!workItem || isDeleting) return;
    await onConfirmDelete(workItem);
  };

  const renderTypeIcon = (type: string) => {
    switch (type) {
      case 'BUG':
        return <BugIcon size={16} />;
      case 'FEATURE':
        return <CodeIcon size={16} />;
      case 'IMPROVEMENT':
        return <TrendingUpIcon size={16} />;
      case 'RESEARCH':
      case 'DOCUMENTATION':
        return <FileTextIcon size={16} />;
      default:
        return <CheckSquareIcon size={16} />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'BUG':
        return { bg: '#FEF2F2', text: '#DC2626', border: '#FEE2E2' };
      case 'FEATURE':
        return { bg: '#EFF6FF', text: '#2563EB', border: '#DBEAFE' };
      case 'IMPROVEMENT':
        return { bg: '#F3E8FF', text: '#9333EA', border: '#E9D5FF' };
      case 'RESEARCH':
        return { bg: '#FEF3C7', text: '#D97706', border: '#FDE68A' };
      default:
        return { bg: '#F1F5F9', text: '#475569', border: '#E2E8F0' };
    }
  };

  const typeStyle = getTypeColor(workItem.type);

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="modal-container dfm-modal-window"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header matching D-Board delete modal style */}
        <div className="dfm-header-container">
          <div className="dfm-header-left-col">
            <div className="dfm-header-icon-box">
              <TrashIcon size={22} className="text-danger" />
            </div>
            <div className="dfm-header-title-block">
              <h2 className="dfm-modal-title">Delete Work Item</h2>
              <p className="dfm-modal-subtitle">This action cannot be undone.</p>
            </div>
          </div>

          <button
            type="button"
            className="dfm-header-close-btn"
            onClick={onClose}
            aria-label="Close modal"
            disabled={isDeleting}
          >
            <CloseIcon size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="dfm-modal-body">
          {/* Work Item Information Card */}
          <div className="dfm-file-card" style={{ gap: '1rem' }}>
            <div
              style={{
                width: '2.75rem',
                height: '2.75rem',
                borderRadius: '10px',
                backgroundColor: typeStyle.bg,
                color: typeStyle.text,
                border: `1px solid ${typeStyle.border}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              {renderTypeIcon(workItem.type)}
            </div>
            <div className="dfm-file-info-text" style={{ flex: 1, minWidth: 0 }}>
              <div
                className="dfm-file-name"
                title={workItem.title}
                style={{ fontSize: '0.925rem', fontWeight: 600 }}
              >
                {workItem.title}
              </div>
              <div className="dfm-file-meta" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.2rem' }}>
                <span style={{ fontWeight: 600, color: typeStyle.text }}>
                  {workItem.type}
                </span>
                {workItem.project?.name && (
                  <>
                    <span>•</span>
                    <span>{workItem.project.name}</span>
                  </>
                )}
                {workItem.status && (
                  <>
                    <span>•</span>
                    <span style={{ textTransform: 'capitalize' }}>
                      {workItem.status.toLowerCase().replace('_', ' ')}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Warning Card */}
          <div className="dfm-warning-card">
            <div className="dfm-warning-icon">
              <AlertCircleIcon size={20} className="text-danger" />
            </div>
            <div className="dfm-warning-text-block">
              <div className="dfm-warning-heading">Are you sure you want to delete this work item?</div>
              <div className="dfm-warning-subtext">
                This item, along with its comments and activity logs, will be permanently removed.
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="dfm-footer-bar">
          <button
            type="button"
            className="dfm-btn-cancel-pill"
            onClick={onClose}
            disabled={isDeleting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="dfm-btn-delete-pill"
            onClick={handleConfirm}
            disabled={isDeleting}
          >
            <TrashIcon size={15} />
            <span>{isDeleting ? 'Deleting...' : 'Delete'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
