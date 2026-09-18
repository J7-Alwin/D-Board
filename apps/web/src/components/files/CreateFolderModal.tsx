import React, { useState, useMemo } from 'react';
import type { Project } from '../../api/projects.api';
import { CustomSelect } from '../ui/CustomSelect';

export interface FolderItem {
  id: string;
  name: string;
  projectId: string;
  projectName?: string;
  parentId?: string | null;
  color: string;
  createdAt: string;
}

interface CreateFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateFolder: (folder: Omit<FolderItem, 'id' | 'createdAt'>) => void;
  projects?: Project[];
  activeProjectId?: string;
  currentFolderId?: string | null;
  existingFolders?: FolderItem[];
}

const COLOR_OPTIONS = [
  { label: 'Amber', value: '#F59E0B' },
  { label: 'Blue', value: '#3B82F6' },
  { label: 'Emerald', value: '#10B981' },
  { label: 'Purple', value: '#8B5CF6' },
  { label: 'Rose', value: '#F43F5E' },
  { label: 'Slate', value: '#64748B' },
  { label: 'Dark', value: '#0F172A' },
];

export const CreateFolderModal: React.FC<CreateFolderModalProps> = ({
  isOpen,
  onClose,
  onCreateFolder,
  projects = [],
  activeProjectId,
  currentFolderId,
  existingFolders = [],
}) => {
  const [name, setName] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<string>(
    activeProjectId || (projects[0] ? projects[0].id : 'personal')
  );
  const [selectedColor, setSelectedColor] = useState<string>(COLOR_OPTIONS[0].value);
  const [parentId, setParentId] = useState<string>(currentFolderId || '');
  const [error, setError] = useState<string | null>(null);

  const targetProjectId = activeProjectId || selectedProjectId;

  const currentProjectName = useMemo(() => {
    if (targetProjectId === 'personal' || !targetProjectId) {
      return 'Personal Space';
    }
    const p = projects.find((proj) => proj.id === targetProjectId);
    return p ? p.name : 'Workspace';
  }, [targetProjectId, projects]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError('Folder name is required');
      return;
    }

    onCreateFolder({
      name: name.trim(),
      projectId: targetProjectId,
      projectName: currentProjectName,
      parentId: parentId || null,
      color: selectedColor,
    });

    setName('');
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="modal-container cfm-modal-window"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header matching screenshot */}
        <div className="cfm-header-container">
          <div className="cfm-header-left-col">
            <div className="cfm-header-icon-box">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
              </svg>
            </div>
            <div className="cfm-header-title-block">
              <h2 className="cfm-modal-title">Create New Folder</h2>
              <p className="cfm-modal-subtitle">Organize your project documents and files</p>
            </div>
          </div>

          {/* Right Header Illustration: Folder + Floating Photo Card + Sparkles */}
          <div className="cfm-header-art-wrapper">
            <div className="cfm-art-illustration-box">
              {/* Soft clouds backdrop */}
              <div className="cfm-art-cloud-backdrop" />

              {/* Sparkle Burst */}
              <div className="cfm-art-sparkle">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M12 3v3m0 12v3M3 12h3m12 0h3m-3.2-6.8l-2.1 2.1m-9.4 9.4l-2.1 2.1m0-13.6l2.1 2.1m9.4 9.4l2.1 2.1" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round"/>
                </svg>
              </div>

              {/* Dashed trajectory arc */}
              <svg className="cfm-art-arc" width="70" height="40" viewBox="0 0 70 40" fill="none">
                <path d="M5 30 Q 35 5 65 25" stroke="#86EFAC" strokeWidth="1.5" strokeDasharray="3 3" />
              </svg>

              {/* Floating Image Card */}
              <div className="cfm-art-floating-photo">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <rect width="24" height="24" rx="4" fill="#DBEAFE"/>
                  <circle cx="8" cy="8" r="2.5" fill="#3B82F6"/>
                  <path d="M4 18l5-6 4 4 3-3 4 5H4z" fill="#93C5FD"/>
                </svg>
              </div>

              {/* Main Golden Folder */}
              <div className="cfm-art-folder-body">
                <svg width="56" height="44" viewBox="0 0 56 44" fill="none">
                  {/* Folder Back */}
                  <path d="M4 8C4 5.79086 5.79086 4 8 4H20L24 9H48C50.2091 9 52 10.7909 52 13V36C52 38.2091 50.2091 40 48 40H8C5.79086 40 4 38.2091 4 36V8Z" fill="#FBBF24"/>
                  {/* Folder Front Open Pocket */}
                  <path d="M4 17H52V36C52 38.2091 50.2091 40 48 40H8C5.79086 40 4 38.2091 4 36V17Z" fill="#FCD34D"/>
                  <path d="M3 20C3 18.3431 4.34315 17 6 17H50C51.6569 17 53 18.3431 53 20L51 37C51 38.6569 49.6569 40 48 40H8C6.34315 40 5 38.6569 5 37L3 20Z" fill="#FDE047" fillOpacity="0.4"/>
                </svg>
              </div>
            </div>

            <button type="button" className="cfm-header-close-btn" onClick={onClose} aria-label="Close modal">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="cfm-form">
          <div className="cfm-modal-body">
            {error && <div className="cfm-error-banner">{error}</div>}

            {/* Field 1: Folder Name */}
            <div className="cfm-field-group">
              <label className="cfm-field-label" htmlFor="folder-name-field">
                Folder Name <span className="cfm-required-asterisk">*</span>
              </label>
              <div className="cfm-input-icon-box">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                </svg>
                <input
                  id="folder-name-field"
                  type="text"
                  className="cfm-text-input"
                  placeholder="e.g. Design Assets, Invoices, Documentation..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus
                  required
                />
              </div>
            </div>

            {/* Field 2: Destination Project */}
            <div className="cfm-field-group">
              <label className="cfm-field-label">
                Destination Project <span className="cfm-required-asterisk">*</span>
              </label>
              <CustomSelect
                value={selectedProjectId}
                onChange={(val) => setSelectedProjectId(val)}
                options={[
                  ...projects.map((p) => ({
                    value: p.id,
                    label: p.name,
                    initials: (p.key || p.name.trim().slice(0, 3)).toUpperCase(),
                    badgeType: 'default' as const,
                  })),
                  {
                    value: 'personal',
                    label: 'Personal Folder',
                    initials: 'PER',
                  },
                ]}
              />
            </div>

            {/* Field 3: Location / Parent Folder (Optional) */}
            <div className="cfm-field-group">
              <label className="cfm-field-label">Location / Parent Folder (Optional)</label>
              <CustomSelect
                value={parentId}
                onChange={(val) => setParentId(val)}
                placeholder="Select a parent folder..."
                options={[
                  {
                    value: '',
                    label: 'Select a parent folder...',
                    icon: (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                      </svg>
                    ),
                  },
                  ...existingFolders.map((f) => ({
                    value: f.id,
                    label: f.name,
                    icon: (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill={f.color || '#F59E0B'}>
                        <path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
                      </svg>
                    ),
                  })),
                ]}
              />
            </div>

            {/* Field 4: Folder Color Theme */}
            <div className="cfm-field-group">
              <label className="cfm-field-label">Folder Color Theme</label>
              <div className="cfm-color-picker-row">
                {COLOR_OPTIONS.map((c) => {
                  const isSelected = selectedColor === c.value;
                  return (
                    <button
                      key={c.value}
                      type="button"
                      className={`cfm-color-circle ${isSelected ? 'is-selected' : ''}`}
                      style={{ backgroundColor: c.value }}
                      onClick={() => setSelectedColor(c.value)}
                      title={c.label}
                      aria-label={`Select color ${c.label}`}
                    >
                      {isSelected && (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Preview Box matching screenshot */}
            <div className="cfm-preview-card">
              <div className="cfm-preview-tag">Preview</div>
              <div className="cfm-preview-content">
                <div className="cfm-preview-icon-box">
                  <svg width="34" height="34" viewBox="0 0 24 24" fill={selectedColor}>
                    <path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
                  </svg>
                </div>
                <div className="cfm-preview-text">
                  <div className="cfm-preview-title">{name.trim() || 'New Folder'}</div>
                  <div className="cfm-preview-subtitle">In {currentProjectName}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Modal Footer matching screenshot */}
          <div className="cfm-footer-bar">
            <div className="cfm-footer-security-note">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                <polyline points="9 12 11 14 15 10"></polyline>
              </svg>
              <span>Your data is secure</span>
            </div>

            <div className="cfm-footer-buttons-wrap">
              <button
                type="button"
                className="cfm-btn-cancel-pill"
                onClick={onClose}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="cfm-btn-create-pill"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                  <line x1="12" y1="11" x2="12" y2="17"></line>
                  <line x1="9" y1="14" x2="15" y2="14"></line>
                </svg>
                <span>Create Folder</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

