import React, { useState } from 'react';
import type { AttachmentDTO } from '../../api/files.api';
import { filesApi } from '../../api/files.api';
import { ViewerResolver } from './ViewerResolver';
import { DeleteFileModal } from './DeleteFileModal';
import {
  UserIcon,
  ClockIcon,
  LayersIcon,
  CheckSquareIcon,
  FileTextIcon,
  CheckIcon,
} from '../ui/Icons';

interface FileViewerModalProps {
  file: AttachmentDTO | null;
  onClose: () => void;
  onFileUpdated?: () => void;
  onFileDeleted?: () => void;
  canEdit?: boolean;
  canDelete?: boolean;
  onOpenWorkItem?: (workItemId: string) => void;
}

export const FileViewerModal: React.FC<FileViewerModalProps> = ({
  file,
  onClose,
  onFileUpdated,
  onFileDeleted,
  canEdit = true,
  canDelete = true,
  onOpenWorkItem,
}) => {
  const [showMeta, setShowMeta] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [newName, setNewName] = useState('');
  const [savingRename, setSavingRename] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  if (!file) return null;

  const handleStartRename = () => {
    setNewName(file.originalName);
    setIsRenaming(true);
    setRenameError(null);
  };

  const handleSaveRename = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newName.trim() || newName.trim() === file.originalName) {
      setIsRenaming(false);
      return;
    }

    setSavingRename(true);
    setRenameError(null);
    try {
      await filesApi.renameFile(file.projectId, file.id, newName.trim());
      setIsRenaming(false);
      onFileUpdated?.();
    } catch (err: any) {
      setRenameError(err.message || 'Failed to rename file');
    } finally {
      setSavingRename(false);
    }
  };

  const handleConfirmDelete = async (fileId: string) => {
    try {
      setIsDeleting(true);
      await filesApi.deleteFile(file.projectId, fileId);
      setIsDeleteModalOpen(false);
      onFileDeleted?.();
      onClose();
    } catch (err: any) {
      alert(err.message || 'Failed to delete file');
    } finally {
      setIsDeleting(false);
    }
  };

  const formattedSize =
    file.sizeBytes < 1024
      ? `${file.sizeBytes} B`
      : file.sizeBytes < 1024 * 1024
      ? `${(file.sizeBytes / 1024).toFixed(1)} KB`
      : `${(file.sizeBytes / (1024 * 1024)).toFixed(2)} MB`;

  const categoryLabel = file.category || file.extension?.toUpperCase() || 'FILE';
  const projectName = file.project?.name || 'test';

  return (
    <>
      <div className="modal-backdrop fvm-backdrop-overlay" onClick={onClose} role="dialog" aria-modal="true">
        <div
          className="modal-container fvm-modal-container"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Top Bar matching reference screenshot */}
          <div className="fvm-topbar">
            {/* Left Identity: Icon, Filename, Category Badge, Project Badge */}
            <div className="fvm-identity-group">
              <div className="fvm-icon-box">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                </svg>
              </div>

              {isRenaming ? (
                <form onSubmit={handleSaveRename} className="fvm-rename-form">
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="fvm-rename-input"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') setIsRenaming(false);
                    }}
                  />
                  <button
                    type="submit"
                    className="fvm-rename-btn fvm-rename-btn-save"
                    disabled={savingRename}
                    title="Save name"
                  >
                    <CheckIcon size={14} />
                  </button>
                  <button
                    type="button"
                    className="fvm-rename-btn fvm-rename-btn-cancel"
                    onClick={() => setIsRenaming(false)}
                    title="Cancel"
                  >
                    ✕
                  </button>
                </form>
              ) : (
                <div className="fvm-title-row">
                  <h2 className="fvm-file-name" title={file.originalName}>
                    {file.originalName}
                  </h2>
                  <span className="fvm-badge-category">{categoryLabel}</span>
                  <span className="fvm-badge-project">{projectName}</span>
                </div>
              )}
            </div>

            {/* Right Actions matching screenshot: Rename, Download, Delete, Details, Close */}
            <div className="fvm-actions-group">
              {canEdit && !isRenaming && (
                <button
                  type="button"
                  className="fvm-pill-btn"
                  onClick={handleStartRename}
                  title="Rename file"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
                  </svg>
                  <span>Rename</span>
                </button>
              )}

              <a
                href={filesApi.getFileDownloadUrl(file.projectId, file.id)}
                download={file.originalName}
                className="fvm-pill-btn"
                title="Download file"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="7 10 12 15 17 10"></polyline>
                  <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
                <span>Download</span>
              </a>

              {canDelete && (
                <button
                  type="button"
                  className="fvm-icon-btn fvm-btn-delete"
                  onClick={() => setIsDeleteModalOpen(true)}
                  title="Delete file"
                  aria-label="Delete file"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                  </svg>
                </button>
              )}

              <button
                type="button"
                className={`fvm-pill-btn ${showMeta ? 'active' : ''}`}
                onClick={() => setShowMeta(!showMeta)}
                title="File Details & Properties"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="16" x2="12" y2="12"></line>
                  <line x1="12" y1="8" x2="12.01" y2="8"></line>
                </svg>
                <span>Details</span>
              </button>

              <button
                type="button"
                className="fvm-close-btn"
                onClick={onClose}
                aria-label="Close viewer"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
          </div>

          {renameError && <div className="form-error-banner">{renameError}</div>}

          {/* Main Body Layout: Dark Viewport Canvas & Collapsible Details Drawer */}
          <div className="fvm-body-layout">
            <div className="fvm-canvas-area">
              <ViewerResolver file={file} />
            </div>

            {/* Collapsible Slide-Out File Properties Drawer */}
            {showMeta && (
              <div className="fvm-details-drawer">
                <div className="fvm-drawer-header">
                  <h3>File Properties</h3>
                  <button
                    type="button"
                    className="fvm-drawer-close"
                    onClick={() => setShowMeta(false)}
                  >
                    ✕
                  </button>
                </div>

                <div className="fvm-drawer-content">
                  <div className="fvm-prop-row">
                    <label>
                      <LayersIcon size={13} /> Category
                    </label>
                    <span className="fvm-prop-val">{file.category}</span>
                  </div>

                  <div className="fvm-prop-row">
                    <label>MIME Type</label>
                    <span className="fvm-prop-val">{file.mimeType}</span>
                  </div>

                  <div className="fvm-prop-row">
                    <label>Size</label>
                    <span className="fvm-prop-val">
                      {formattedSize} ({file.sizeBytes.toLocaleString()} bytes)
                    </span>
                  </div>

                  <div className="fvm-prop-row">
                    <label>
                      <UserIcon size={13} /> Uploaded By
                    </label>
                    <span className="fvm-prop-val">
                      {file.uploadedBy?.fullName || file.uploadedBy?.username || 'Unknown'}
                    </span>
                  </div>

                  <div className="fvm-prop-row">
                    <label>
                      <ClockIcon size={13} /> Uploaded Date
                    </label>
                    <span className="fvm-prop-val">
                      {new Date(file.createdAt).toLocaleString()}
                    </span>
                  </div>

                  {file.workItem && (
                    <div className="fvm-prop-row">
                      <label>
                        <CheckSquareIcon size={13} /> Linked Work Item
                      </label>
                      <div
                        className="fvm-linked-card"
                        onClick={() => onOpenWorkItem && file.workItem && onOpenWorkItem(file.workItem.id)}
                      >
                        <span className="fvm-linked-title">{file.workItem.title}</span>
                        <span className="fvm-linked-status">{file.workItem.status}</span>
                      </div>
                    </div>
                  )}

                  {file.note && (
                    <div className="fvm-prop-row">
                      <label>
                        <FileTextIcon size={13} /> Linked Note
                      </label>
                      <div className="fvm-linked-card">
                        <span className="fvm-linked-title">{file.note.title}</span>
                        <span className="fvm-linked-status">
                          {file.note.visibility === 'TEAM' ? 'Team Note' : 'Private Note'}
                        </span>
                      </div>
                    </div>
                  )}

                  {file.checksum && (
                    <div className="fvm-prop-row">
                      <label>SHA-256 Checksum</label>
                      <div className="fvm-checksum-box" title={file.checksum}>
                        <code>{file.checksum}</code>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal Integration */}
      {isDeleteModalOpen && (
        <DeleteFileModal
          isOpen={isDeleteModalOpen}
          file={file}
          onClose={() => setIsDeleteModalOpen(false)}
          onConfirmDelete={handleConfirmDelete}
          isDeleting={isDeleting}
        />
      )}
    </>
  );
};
