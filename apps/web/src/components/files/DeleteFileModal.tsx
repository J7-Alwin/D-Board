import React from 'react';
import type { AttachmentDTO } from '../../api/files.api';

interface DeleteFileModalProps {
  isOpen: boolean;
  file: AttachmentDTO | null;
  onClose: () => void;
  onConfirmDelete: (fileId: string) => Promise<void> | void;
  isDeleting?: boolean;
}

export const DeleteFileModal: React.FC<DeleteFileModalProps> = ({
  isOpen,
  file,
  onClose,
  onConfirmDelete,
  isDeleting = false,
}) => {
  if (!isOpen || !file) return null;

  const formatFileSize = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 MB';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileTypeLabel = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toUpperCase() || '';
    if (['PNG', 'JPG', 'JPEG', 'WEBP', 'GIF', 'SVG'].includes(ext)) {
      return `${ext} Image`;
    }
    if (ext === 'PDF') return 'PDF Document';
    if (['DOC', 'DOCX'].includes(ext)) return 'Word Document';
    if (['XLS', 'XLSX', 'CSV'].includes(ext)) return 'Excel Spreadsheet';
    if (['PPT', 'PPTX'].includes(ext)) return 'PowerPoint Presentation';
    if (['ZIP', 'RAR', '7Z', 'TAR'].includes(ext)) return 'Archive File';
    if (['JS', 'TS', 'TSX', 'JSX', 'PY', 'HTML', 'CSS', 'JSON'].includes(ext)) return `${ext} Code File`;
    return 'File Document';
  };

  const handleConfirm = async () => {
    if (!file) return;
    await onConfirmDelete(file.id);
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="modal-container dfm-modal-window"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header matching screenshot */}
        <div className="dfm-header-container">
          <div className="dfm-header-left-col">
            <div className="dfm-header-icon-box">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6h18"></path>
                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                <line x1="10" y1="11" x2="10" y2="17"></line>
                <line x1="14" y1="11" x2="14" y2="17"></line>
              </svg>
            </div>
            <div className="dfm-header-title-block">
              <h2 className="dfm-modal-title">Delete File</h2>
              <p className="dfm-modal-subtitle">This action cannot be undone.</p>
            </div>
          </div>

          <button type="button" className="dfm-header-close-btn" onClick={onClose} aria-label="Close modal">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        {/* Modal Body */}
        <div className="dfm-modal-body">
          {/* File Information Card matching screenshot */}
          <div className="dfm-file-card">
            <div className="dfm-file-thumb-box">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#EC4899" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>
                <circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21 15 16 10 5 21"/>
              </svg>
            </div>
            <div className="dfm-file-info-text">
              <div className="dfm-file-name" title={file.originalName}>{file.originalName}</div>
              <div className="dfm-file-meta">
                {getFileTypeLabel(file.originalName)} • {formatFileSize(file.sizeBytes)}
              </div>
            </div>
          </div>

          {/* Warning Banner matching screenshot */}
          <div className="dfm-warning-card">
            <div className="dfm-warning-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path>
                <line x1="12" y1="9" x2="12" y2="13"></line>
                <line x1="12" y1="17" x2="12.01" y2="17"></line>
              </svg>
            </div>
            <div className="dfm-warning-text-block">
              <div className="dfm-warning-heading">Are you sure you want to delete this file?</div>
              <div className="dfm-warning-subtext">This file will be permanently removed from the project.</div>
            </div>
          </div>
        </div>

        {/* Footer matching screenshot */}
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
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18"></path>
              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
              <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
            </svg>
            <span>{isDeleting ? 'Deleting...' : 'Delete'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
