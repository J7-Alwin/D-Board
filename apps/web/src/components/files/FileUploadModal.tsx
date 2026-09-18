import React, { useState, useRef, useEffect, useMemo } from 'react';
import type { Project } from '../../api/projects.api';
import { filesApi } from '../../api/files.api';
import type { FolderItem } from './CreateFolderModal';
import { CustomSelect } from '../ui/CustomSelect';

interface FileUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadSuccess: (createdFiles?: any[], destinationFolderId?: string | null) => void;
  projects?: Project[];
  activeProjectId?: string;
  folders?: FolderItem[];
  currentFolderId?: string | null;
  workItemId?: string;
}

export const FileUploadModal: React.FC<FileUploadModalProps> = ({
  isOpen,
  onClose,
  onUploadSuccess,
  projects = [],
  activeProjectId,
  folders = [],
  currentFolderId = null,
  workItemId,
}) => {
  const defaultTarget = currentFolderId
    ? `folder-${currentFolderId}`
    : activeProjectId
    ? `proj-${activeProjectId}`
    : projects[0]
    ? `proj-${projects[0].id}`
    : 'root';

  const [selectedFolderTarget, setSelectedFolderTarget] = useState<string>(defaultTarget);
  const [filesToUpload, setFilesToUpload] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      const initial = currentFolderId
        ? `folder-${currentFolderId}`
        : activeProjectId
        ? `proj-${activeProjectId}`
        : projects[0]
        ? `proj-${projects[0].id}`
        : 'root';
      setSelectedFolderTarget(initial);
      setFilesToUpload([]);
      setError(null);
      setUploadProgress(0);
    }
  }, [isOpen, currentFolderId, activeProjectId, projects]);

  // Resolve target Project ID and target Folder ID
  let targetProjectId = activeProjectId || (projects[0] ? projects[0].id : '');
  let resolvedFolderId: string | null = null;

  if (selectedFolderTarget.startsWith('proj-')) {
    targetProjectId = selectedFolderTarget.replace('proj-', '');
    resolvedFolderId = null;
  } else if (selectedFolderTarget.startsWith('folder-')) {
    resolvedFolderId = selectedFolderTarget.replace('folder-', '');
    const foundFolder = folders.find((f) => f.id === resolvedFolderId);
    if (foundFolder && foundFolder.projectId !== 'all' && foundFolder.projectId !== 'personal') {
      targetProjectId = foundFolder.projectId;
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(Array.from(e.target.files));
    }
  };

  const addFiles = (newFiles: File[]) => {
    setError(null);
    const maxSizeBytes = 50 * 1024 * 1024; // 50MB per file
    const oversized = newFiles.filter((f) => f.size > maxSizeBytes);

    if (oversized.length > 0) {
      setError(`Some files exceed the 50MB limit: ${oversized.map((f) => f.name).join(', ')}`);
      return;
    }

    setFilesToUpload((prev) => {
      const combined = [...prev, ...newFiles];
      return combined.slice(0, 15);
    });
  };

  const handleRemoveFile = (index: number) => {
    setFilesToUpload((prev) => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 MB';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const totalBytes = useMemo(() => {
    return filesToUpload.reduce((acc, f) => acc + f.size, 0);
  }, [filesToUpload]);

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetProjectId) {
      setError('Please select a destination folder or project for these files');
      return;
    }

    if (filesToUpload.length === 0) {
      setError('Please select at least one file to upload');
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setError(null);

    try {
      const res = await filesApi.uploadFiles(
        targetProjectId,
        filesToUpload,
        workItemId || null,
        (progress) => setUploadProgress(progress)
      );

      setFilesToUpload([]);
      onUploadSuccess(res.data?.files || [], resolvedFolderId);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to upload files');
    } finally {
      setUploading(false);
    }
  };

  // Build options for "Destination Folder"
  const folderOptions = [
    ...projects.map((p) => ({
      value: `proj-${p.id}`,
      label: `Project: ${p.name}`,
      initials: (p.key || p.name.trim().slice(0, 3)).toUpperCase(),
      badgeType: 'default' as const,
    })),
    ...folders.map((f) => ({
      value: `folder-${f.id}`,
      label: f.name,
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill={f.color || '#3B82F6'}>
          <path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
        </svg>
      ),
    })),
  ];

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="modal-container ufm-modal-window"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header matching screenshot */}
        <div className="ufm-header-container">
          <div className="ufm-header-left-col">
            <div className="ufm-header-icon-box">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
              </svg>
            </div>
            <div className="ufm-header-title-block">
              <h2 className="ufm-modal-title">Upload Files</h2>
              <p className="ufm-modal-subtitle">
                Upload documents, spreadsheets, presentations, code, images, or archives to your project folders or personal folders.
              </p>
            </div>
          </div>

          {/* Right Header Illustration: Mint Cloud + Floating PDF/Word/Excel Cards + Green Folder */}
          <div className="ufm-header-art-wrapper">
            <div className="ufm-art-backdrop-box">
              {/* Soft mint cloud */}
              <div className="ufm-art-cloud-glow" />

              {/* Mint Tree/Leaf Sparkle */}
              <div className="ufm-art-leaf-top">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="#86EFAC" opacity="0.7">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10c1.5 0 2.5-.5 2.5-1.5 0-.46-.19-.89-.49-1.2-.31-.32-.51-.76-.51-1.3 0-1.1.9-2 2-2h2.4c3.31 0 6-2.69 6-6 0-5.52-5.37-10-12-10z"/>
                </svg>
              </div>

              {/* Dashed trajectory arc */}
              <svg className="ufm-art-dashed-arc" width="90" height="40" viewBox="0 0 90 40" fill="none">
                <path d="M5 30 Q 45 5 85 25" stroke="#86EFAC" strokeWidth="1.5" strokeDasharray="3 3" />
              </svg>

              {/* PDF Floating Card (Red) */}
              <div className="ufm-art-mini-card card-pdf">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="#EF4444">
                  <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm2 14H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
                </svg>
              </div>

              {/* Word Floating Card (Blue) */}
              <div className="ufm-art-mini-card card-word">
                <span className="ufm-letter-w">W</span>
              </div>

              {/* Excel Floating Card (Green) */}
              <div className="ufm-art-mini-card card-excel">
                <span className="ufm-letter-x">X</span>
              </div>

              {/* Green Open Folder */}
              <div className="ufm-art-green-folder">
                <svg width="52" height="42" viewBox="0 0 52 42" fill="none">
                  <path d="M4 8C4 5.79086 5.79086 4 8 4H18L22 9H44C46.2091 9 48 10.7909 48 13V34C48 36.2091 46.2091 38 44 38H8C5.79086 38 4 36.2091 4 34V8Z" fill="#34D399"/>
                  <path d="M3 16H49V34C49 36.2091 47.2091 38 45 38H7C4.79086 38 3 36.2091 3 34V16Z" fill="#10B981"/>
                  <path d="M2 19C2 17.3431 3.34315 16 5 16H47C48.6569 16 50 17.3431 50 19L48 35C48 36.6569 46.6569 38 45 38H7C5.34315 38 4 36.6569 4 35L2 19Z" fill="#6EE7B7" fillOpacity="0.5"/>
                </svg>
              </div>
            </div>

            <button type="button" className="ufm-header-close-btn" onClick={onClose} aria-label="Close modal">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleUploadSubmit} className="ufm-form-container">
          <div className="ufm-modal-body">
            {error && <div className="ufm-error-banner">{error}</div>}

            {/* Field: Destination Folder */}
            <div className="ufm-field-group">
              <label className="ufm-field-label">
                Destination Folder <span className="ufm-required-asterisk">*</span>
              </label>
              <CustomSelect
                value={selectedFolderTarget}
                onChange={(val) => setSelectedFolderTarget(val)}
                options={folderOptions}
              />
              <div className="ufm-footnote-text">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="16" x2="12" y2="12"></line>
                  <line x1="12" y1="8" x2="12.01" y2="8"></line>
                </svg>
                <span>Files will be uploaded to this folder in your project.</span>
              </div>
            </div>

            {/* Dropzone Box matching screenshot */}
            <div
              className={`ufm-dropzone-box ${isDragging ? 'is-dragging' : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileInputChange}
                style={{ display: 'none' }}
              />

              {/* Cloud upload icon with up arrow */}
              <div className="ufm-dropzone-cloud-icon">
                <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" />
                  <path d="M12 12v9" />
                  <path d="m16 16-4-4-4 4" />
                </svg>
              </div>

              <div className="ufm-dropzone-title">
                Drag and drop your files here, or <span className="ufm-browse-underline">browse</span>
              </div>
              <div className="ufm-dropzone-subtitle">
                Supports PDF, DOCX, XLSX, PPTX, Code, Images, ZIP up to 50MB each
              </div>

              {/* Row of format badge cards (PDF, W, X, P, </>, 🖼️) */}
              <div className="ufm-format-badges-row">
                <div className="ufm-format-badge badge-pdf">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="#EF4444">
                    <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm2 14H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
                  </svg>
                </div>
                <div className="ufm-format-badge badge-word">
                  <span className="ufm-badge-text-w">W</span>
                </div>
                <div className="ufm-format-badge badge-excel">
                  <span className="ufm-badge-text-x">X</span>
                </div>
                <div className="ufm-format-badge badge-ppt">
                  <span className="ufm-badge-text-p">P</span>
                </div>
                <div className="ufm-format-badge badge-code">
                  <span className="ufm-badge-text-code">&lt;/&gt;</span>
                </div>
                <div className="ufm-format-badge badge-img">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="#8B5CF6">
                    <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>
                    <circle cx="8.5" cy="8.5" r="1.5"/>
                    <polyline points="21 15 16 10 5 21"/>
                  </svg>
                </div>
              </div>
            </div>

            {/* Selected Files Section matching screenshot */}
            <div className="ufm-selected-files-section">
              <div className="ufm-selected-files-header-row">
                <span className="ufm-selected-files-heading">
                  Selected Files ({filesToUpload.length})
                </span>
                <span className="ufm-selected-files-size">
                  Total Size: {formatFileSize(totalBytes)}
                </span>
              </div>

              {filesToUpload.length === 0 ? (
                /* Empty state container matching screenshot */
                <div className="ufm-empty-files-card">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                  </svg>
                  <div className="ufm-empty-files-title">No files selected yet</div>
                  <div className="ufm-empty-files-sub">Choose files or drag and drop to upload.</div>
                </div>
              ) : (
                /* Selected files list */
                <div className="ufm-selected-items-list">
                  {filesToUpload.map((file, idx) => (
                    <div key={`${file.name}-${idx}`} className="ufm-selected-file-row">
                      <div className="ufm-file-left-cluster">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                          <polyline points="14 2 14 8 20 8"></polyline>
                        </svg>
                        <div className="ufm-file-details">
                          <span className="ufm-file-name" title={file.name}>{file.name}</span>
                          <span className="ufm-file-size-sub">{formatFileSize(file.size)}</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="ufm-btn-remove-file"
                        onClick={() => handleRemoveFile(idx)}
                        title="Remove file"
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6"></polyline>
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Uploading progress bar */}
            {uploading && (
              <div className="ufm-upload-progress-panel">
                <div className="ufm-progress-header-text">
                  <span>Uploading files...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="ufm-progress-bar-bg">
                  <div
                    className="ufm-progress-bar-filled"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Modal Footer matching screenshot */}
          <div className="ufm-footer-bar">
            <div className="ufm-footer-security-note">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                <polyline points="9 12 11 14 15 10"></polyline>
              </svg>
              <span>Your files are securely uploaded</span>
            </div>

            <div className="ufm-footer-buttons-wrap">
              <button
                type="button"
                className="ufm-btn-cancel-pill"
                onClick={onClose}
                disabled={uploading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="ufm-btn-upload-emerald"
                disabled={uploading || filesToUpload.length === 0}
              >
                {uploading ? (
                  <>
                    <span className="ufm-spinner-icon" />
                    <span>Uploading ({uploadProgress}%)...</span>
                  </>
                ) : (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" />
                      <path d="M12 12v9" />
                      <path d="m16 16-4-4-4 4" />
                    </svg>
                    <span>Upload Files</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

