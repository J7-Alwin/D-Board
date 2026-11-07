import React from 'react';
import type { AttachmentDTO } from '../../api/files.api';

export interface DeleteFileModalProps {
  isOpen: boolean;
  file?: AttachmentDTO | null;
  files?: AttachmentDTO[] | null;
  onClose: () => void;
  onConfirmDelete: (fileId: string) => Promise<void> | void;
  isDeleting?: boolean;
}

export const DeleteFileModal: React.FC<DeleteFileModalProps> = ({
  isOpen,
  file,
  files,
  onClose,
  onConfirmDelete,
  isDeleting = false,
}) => {
  // Accessibility: Escape key and body scroll lock
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape' && isOpen && !isDeleting) {
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
}, [isOpen, isDeleting, onClose]);

const targetFiles: AttachmentDTO[] = React.useMemo(() => {
  if (files && files.length > 0) return files;
  if (file) return [file];
  return [];
}, [file, files]);

if (!isOpen || targetFiles.length === 0) return null;

const isBulk = targetFiles.length > 1;
const singleFile = targetFiles[0];

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
  if (['JS', 'TS', 'TSX', 'JSX', 'PY', 'HTML', 'CSS', 'JSON'].includes(ext)) return `${ext} Code`;
  return 'File Document';
};

    const getOriginDetails = (item: AttachmentDTO) => {
      if (item.workItem) {
        return {
          label: 'Task',
          subtext: `Attached to Task "${item.workItem.title}"`,
          iconBg: '#DBEAFE',
          color: '#1D4ED8',
          tagClass: 'origin-badge-task',
          attachedWarning: `This file is attached to task "${item.workItem.title}". Deleting it will detach it from the task.`,
        };
      }
        if (item.note) {
          const isPriv = item.note.visibility === 'USERS';
          return {
            label: isPriv ? 'Note (Private)' : 'Note (Team)',
            subtext: `Attached to Note "${item.note.title}"`,
            iconBg: isPriv ? '#F3E8FF' : '#FEF3C7',
            color: isPriv ? '#7E22CE' : '#B45309',
            tagClass: isPriv ? 'origin-badge-note-private' : 'origin-badge-note-team',
            attachedWarning: `This file is attached to note "${item.note.title}". Deleting it will detach it from the note.`,
          };
        }
          if (item.isPrivate) {
            return {
              label: 'Direct (Private)',
              subtext: 'Directly uploaded for your eyes only',
              iconBg: '#F3E8FF',
              color: '#7E22CE',
              tagClass: 'origin-badge-direct-private',
              attachedWarning: null,
            };
          }
          return {
            label: 'Direct (Public)',
            subtext: 'Directly uploaded for project members',
            iconBg: '#DCFCE7',
            color: '#15803D',
            tagClass: 'origin-badge-direct-public',
            attachedWarning: null,
          };
        };

        const singleOrigin = getOriginDetails(singleFile);
        const totalSizeBytes = targetFiles.reduce((acc, f) => acc + (f.sizeBytes || 0), 0);

        const handleConfirm = async () => {
          if (!singleFile) return;
          await onConfirmDelete(singleFile.id);
          onClose();
        };

        return (
          <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
            <div
              className="modal-container dfm-modal-window"
              onClick={(e) => e.stopPropagation()}
              style={{ maxWidth: isBulk ? '540px' : '480px' }}
            >
              {/* Header */}
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
                    <h2 className="dfm-modal-title">
                      {isBulk ? `Delete ${targetFiles.length} Files` : 'Delete File'}
                    </h2>
                    <p className="dfm-modal-subtitle">This action cannot be undone.</p>
                  </div>
                </div>

                  <button
                    type="button"
                    className="dfm-header-close-btn"
                    onClick={onClose}
                    disabled={isDeleting}
                    aria-label="Close modal"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18"></line>
                      <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                  </button>
              </div>

              {/* Modal Body */}
              <div className="dfm-modal-body">
                      {/* File Card or Multi-file List */}
                      {!isBulk ? (
                        <>
                          <div className="dfm-file-card">
                            <div className="dfm-file-thumb-box">
                              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#EC4899" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                                <circle cx="8.5" cy="8.5" r="1.5" />
                                <polyline points="21 15 16 10 5 21" />
                              </svg>
                            </div>
                            <div className="dfm-file-info-text">
                              <div className="dfm-file-name" title={singleFile.originalName}>
                                {singleFile.originalName}
                              </div>
                              <div className="dfm-file-meta" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                <span>{getFileTypeLabel(singleFile.originalName)} • {formatFileSize(singleFile.sizeBytes)}</span>
                                <span
                                  style={{
                                    backgroundColor: singleOrigin.iconBg,
                                    color: singleOrigin.color,
                                    padding: '0.15rem 0.5rem',
                                    borderRadius: '9999px',
                                    fontSize: '0.6875rem',
                                    fontWeight: 600,
                                  }}
                                >
                                  {singleOrigin.label}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Context Origin Banner */}
                          <div
                            style={{
                              backgroundColor: '#F8FAFC',
                              border: '1px solid #E2E8F0',
                              borderRadius: '8px',
                              padding: '0.625rem 0.875rem',
                              fontSize: '0.8125rem',
                              color: '#475569',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.5rem',
                            }}
                          >
                            <span style={{ fontWeight: 600, color: '#1E293B' }}>Origin:</span>
                            <span>{singleOrigin.subtext}</span>
                          </div>
                        </>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              fontSize: '0.8125rem',
                              color: '#64748B',
                              fontWeight: 600,
                              padding: '0 0.25rem',
                            }}
                          >
                            <span>Selected files ({targetFiles.length})</span>
                            <span>Total: {formatFileSize(totalSizeBytes)}</span>
                          </div>
                          <div
                            style={{
                              maxHeight: '190px',
                              overflowY: 'auto',
                              border: '1px solid #E2E8F0',
                              borderRadius: '10px',
                              backgroundColor: '#FFFFFF',
                              padding: '0.25rem',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '0.25rem',
                            }}
                          >
                            {targetFiles.map((f) => {
                              const orig = getOriginDetails(f);
                              return (
                                <div
                                  key={f.id}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '0.45rem 0.65rem',
                                    borderRadius: '6px',
                                    backgroundColor: '#F8FAFC',
                                    fontSize: '0.8125rem',
                                  }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
                                    <span
                                      style={{
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                        maxWidth: '240px',
                                        fontWeight: 500,
                                        color: '#1E293B',
                                      }}
                                      title={f.originalName}
                                    >
                                      {f.originalName}
                                    </span>
                                    <span style={{ color: '#94A3B8', fontSize: '0.75rem' }}>
                                      {formatFileSize(f.sizeBytes)}
                                    </span>
                                  </div>
                                  <span
                                    style={{
                                      backgroundColor: orig.iconBg,
                                      color: orig.color,
                                      padding: '0.12rem 0.45rem',
                                      borderRadius: '9999px',
                                      fontSize: '0.6875rem',
                                      fontWeight: 600,
                                      flexShrink: 0,
                                    }}
                                  >
                                    {orig.label}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                        {/* Warning Banner */}
                        <div className="dfm-warning-card">
                          <div className="dfm-warning-icon">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path>
                              <line x1="12" y1="9" x2="12" y2="13"></line>
                              <line x1="12" y1="17" x2="12.01" y2="17"></line>
                            </svg>
                          </div>
                              <div className="dfm-warning-text-block">
                                <div className="dfm-warning-heading">
                                  {isBulk
                                    ? `Permanently delete ${targetFiles.length} file${targetFiles.length > 1 ? 's' : ''}?`
                                    : 'Permanently delete this file?'}
                                </div>
                                  <div className="dfm-warning-subtext">
                                    {isBulk
                                      ? 'All selected files will be removed to free storage space. This cannot be undone.'
                                      : singleOrigin.attachedWarning || 'This file will be permanently removed to free storage space.'}
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Footer */}
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
                                <span>{isDeleting ? 'Deleting...' : isBulk ? `Delete ${targetFiles.length} Files` : 'Delete File'}</span>
                              </button>
                            </div>
                          </div>
                        </div>
                        );
};
