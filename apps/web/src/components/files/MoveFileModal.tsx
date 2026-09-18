import React, { useState, useMemo } from 'react';
import type { AttachmentDTO } from '../../api/files.api';
import type { FolderItem } from './CreateFolderModal';
import type { Project } from '../../api/projects.api';

interface MoveFileModalProps {
  isOpen: boolean;
  file: AttachmentDTO | null;
  onClose: () => void;
  onMove: (fileId: string, destinationFolderId: string | null) => void;
  folders: FolderItem[];
  projects?: Project[];
  currentFolderId?: string | null;
}

export const MoveFileModal: React.FC<MoveFileModalProps> = ({
  isOpen,
  file,
  onClose,
  onMove,
  folders = [],
  currentFolderId = null,
}) => {
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(currentFolderId || null);
  const [searchQuery, setSearchQuery] = useState('');

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

  const filteredFolders = useMemo(() => {
    if (!searchQuery.trim()) return folders;
    const q = searchQuery.toLowerCase();
    return folders.filter((f) => f.name.toLowerCase().includes(q));
  }, [folders, searchQuery]);

  if (!isOpen || !file) return null;

  const handleConfirmMove = () => {
    if (!file) return;
    onMove(file.id, selectedFolderId);
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="modal-container mfm-modal-window"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header matching screenshot */}
        <div className="mfm-header-container">
          <div className="mfm-header-left-col">
            <div className="mfm-header-icon-box">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#8B5CF6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
              </svg>
            </div>
            <div className="mfm-header-title-block">
              <h2 className="mfm-modal-title">Move File</h2>
              <p className="mfm-modal-subtitle">Select a destination folder for this file</p>
            </div>
          </div>

          <button type="button" className="mfm-header-close-btn" onClick={onClose} aria-label="Close modal">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        {/* Modal Body */}
        <div className="mfm-modal-body">
          {/* Current File Info Card matching screenshot */}
          <div className="mfm-file-card">
            <div className="mfm-file-thumb-box">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#EC4899" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>
                <circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21 15 16 10 5 21"/>
              </svg>
            </div>
            <div className="mfm-file-info-text">
              <div className="mfm-file-name" title={file.originalName}>{file.originalName}</div>
              <div className="mfm-file-meta">
                {getFileTypeLabel(file.originalName)} • {formatFileSize(file.sizeBytes)}
              </div>
            </div>
          </div>

          {/* Directory Navigation and Folders Box matching screenshot */}
          <div className="mfm-folder-container-frame">
            {/* Folder Header Row: Breadcrumb & Search */}
            <div className="mfm-nav-header-row">
              <div className="mfm-breadcrumb-box">
                <div className="mfm-home-icon-wrap">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6366F1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                    <polyline points="9 22 9 12 15 12 15 22"/>
                  </svg>
                </div>
                <span className="mfm-breadcrumb-label">Root Directory</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
              </div>

              <div className="mfm-search-input-box">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
                <input
                  type="text"
                  className="mfm-search-text-field"
                  placeholder="Search folders..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            {/* Folder Items List */}
            <div className="mfm-folders-scroll-list">
              {/* Item 1: Root Directory */}
              <div
                className={`mfm-folder-row ${selectedFolderId === null ? 'is-selected-row' : ''}`}
                onClick={() => setSelectedFolderId(null)}
              >
                <div className="mfm-folder-row-left">
                  <div className="mfm-folder-icon-purple">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8B5CF6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                    </svg>
                  </div>
                  <span className="mfm-folder-row-title">
                    Root Directory <span className="mfm-dim-text">(No folder)</span>
                  </span>
                </div>

                <div className="mfm-folder-row-right">
                  {selectedFolderId === null && (
                    <div className="mfm-radio-checked-purple">
                      <div className="mfm-radio-dot" />
                    </div>
                  )}
                </div>
              </div>

              {/* Folders List */}
              {filteredFolders.map((fld) => {
                const isSelected = selectedFolderId === fld.id;
                const folderColor = fld.color || '#F59E0B';
                return (
                  <div
                    key={fld.id}
                    className={`mfm-folder-row ${isSelected ? 'is-selected-row' : ''}`}
                    onClick={() => setSelectedFolderId(fld.id)}
                  >
                    <div className="mfm-folder-row-left">
                      <div className="mfm-folder-chevron-icon">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="9 18 15 12 9 6"></polyline>
                        </svg>
                      </div>
                      <div className="mfm-folder-colored-icon">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={folderColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                        </svg>
                      </div>
                      <span className="mfm-folder-row-title">{fld.name}</span>
                    </div>

                    <div className="mfm-folder-row-right">
                      {isSelected && (
                        <div className="mfm-radio-checked-purple">
                          <div className="mfm-radio-dot" />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {filteredFolders.length === 0 && searchQuery && (
                <div className="mfm-empty-search-msg">
                  No folders matching "{searchQuery}"
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer matching screenshot */}
        <div className="mfm-footer-bar">
          <div className="mfm-footer-security-note">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
              <polyline points="9 12 11 14 15 10"></polyline>
            </svg>
            <span>Your files are secure</span>
          </div>

          <div className="mfm-footer-buttons-wrap">
            <button
              type="button"
              className="mfm-btn-cancel-pill"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="button"
              className="mfm-btn-move-pill"
              onClick={handleConfirmMove}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
              </svg>
              <span>Move Here</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
