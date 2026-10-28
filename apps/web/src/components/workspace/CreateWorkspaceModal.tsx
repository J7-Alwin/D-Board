import React, { useState, useRef } from 'react';
import { Modal } from '../ui/Modal';
import {
  UserIcon,
  UsersIcon,
  FolderIcon,
  FileTextIcon,
  LinkIcon,
  CameraIcon,
  UploadIcon,
  CheckIcon,
  CloseIcon,
  PlusIcon,
} from '../ui/Icons';
import { useWorkspace } from '../../context/WorkspaceContext';
import './CreateWorkspaceModal.css';

export interface CreateWorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (createdWorkspace: any) => void;
}

const CreateWorkspaceIllustration: React.FC = () => (
  <svg
    width="270"
    height="148"
    viewBox="0 0 270 148"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="cwm-header-art-svg"
  >
    <defs>
      <filter id="cwm-halo" x="-35%" y="-35%" width="170%" height="170%">
        <feDropShadow dx="0" dy="2" stdDeviation="3.5" floodColor="#0F172A" floodOpacity="0.09" />
      </filter>
    </defs>

    {/* Soft Mint Glow Circles */}
    <circle cx="150" cy="78" r="68" fill="#E2F7EB" opacity="0.88" />
    <circle cx="156" cy="74" r="50" fill="#EDFAF2" />

    {/* Dashed Flight Path Arc */}
    <path
      d="M 52 105 C 48 64, 74 27, 108 26 C 132 25, 144 50, 162 62 C 180 72, 194 64, 208 42"
      stroke="#5B7083"
      strokeWidth="1.6"
      strokeDasharray="2.5 3.5"
      strokeLinecap="round"
    />

    {/* Botanical Plant on Left */}
    <g>
      {/* Main Stem */}
      <path
        d="M 52 148 C 50 130, 48 114, 47 98"
        stroke="#1A3B2B"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      {/* Leaf 1 (bottom left) */}
      <path
        d="M 48 125 C 31 127, 16 115, 22 105 C 33 101, 44 111, 48 125 Z"
        fill="#8CE8A8"
        stroke="#15803D"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <path
        d="M 48 125 C 38 117, 29 111, 22 105"
        stroke="#15803D"
        strokeWidth="0.9"
        strokeLinecap="round"
      />
      {/* Leaf 2 (top left tall) */}
      <path
        d="M 47 104 C 35 92, 27 68, 35 60 C 47 60, 53 84, 47 104 Z"
        fill="#42B96C"
        stroke="#15803D"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path
        d="M 47 104 C 41 90, 37 75, 35 60"
        stroke="#15803D"
        strokeWidth="1"
        strokeLinecap="round"
      />
      {/* Leaf 3 (right small) */}
      <path
        d="M 48 114 C 59 106, 68 110, 65 118 C 60 125, 52 121, 48 114 Z"
        fill="#38A169"
        stroke="#15803D"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </g>

    {/* Golden 3D Folder */}
    <g>
      {/* Back Tab */}
      <path
        d="M 64 94 C 64 91, 66 89, 69 89 L 85 89 C 88 89, 90 91, 92 94 L 95 99 L 140 99 C 143 99, 145 101, 145 104 L 145 142 L 64 142 Z"
        fill="#F59E0B"
      />
      {/* Front Body */}
      <path
        d="M 65 102 L 142 102 C 145 102, 147 104, 146 107 L 139 142 C 138 145, 135 147, 132 147 L 70 147 C 67 147, 64 144, 65 141 L 65 102 Z"
        fill="#FEE58A"
        stroke="#F59E0B"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </g>

    {/* Top Blue Avatar */}
    <g filter="url(#cwm-halo)">
      <circle cx="114" cy="36" r="21" fill="#FFFFFF" />
      <circle cx="114" cy="36" r="14" fill="#2563EB" />
      <circle cx="114" cy="32" r="4.2" fill="#FFFFFF" />
      <path
        d="M 105 42.5 C 105 38.5, 108.5 37.5, 114 37.5 C 119.5 37.5, 123 38.5, 123 42.5 Z"
        fill="#FFFFFF"
      />
    </g>

    {/* Middle Emerald Avatar */}
    <g filter="url(#cwm-halo)">
      <circle cx="148" cy="67" r="17" fill="#FFFFFF" />
      <circle cx="148" cy="67" r="11" fill="#10B981" />
      <circle cx="148" cy="64" r="3.3" fill="#FFFFFF" />
      <path
        d="M 140.5 72.5 C 140.5 69, 143.5 68, 148 68 C 152.5 68, 155.5 69, 155.5 72.5 Z"
        fill="#FFFFFF"
      />
    </g>

    {/* Bottom Purple Avatar */}
    <g filter="url(#cwm-halo)">
      <circle cx="178" cy="110" r="19" fill="#FFFFFF" />
      <circle cx="178" cy="110" r="12.5" fill="#A855F7" />
      <circle cx="178" cy="106.5" r="3.6" fill="#FFFFFF" />
      <path
        d="M 170 115 C 170 111.5, 173.5 110.5, 178 110.5 C 182.5 110.5, 186 111.5, 186 115 Z"
        fill="#FFFFFF"
      />
    </g>

    {/* Paper Airplane */}
    <g transform="translate(206, 35) rotate(18)">
      <path
        d="M 26 0 L 0 14 L 9 21 L 26 0 Z"
        fill="#FFFFFF"
        stroke="#0F172A"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M 26 0 L 9 21 L 14 21 L 26 0 Z"
        fill="#CBD5E1"
        stroke="#0F172A"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <line
        x1="9"
        y1="21"
        x2="26"
        y2="0"
        stroke="#0F172A"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </g>
  </svg>
);

export const CreateWorkspaceModal: React.FC<CreateWorkspaceModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { createWorkspace } = useWorkspace();

  const [newWsName, setNewWsName] = useState('');
  const [newWsDescription, setNewWsDescription] = useState('');
  const [workspaceType, setWorkspaceType] = useState<'PERSONAL' | 'TEAM'>('TEAM');
  const [newWsAvatar, setNewWsAvatar] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const avatarFileInputRef = useRef<HTMLInputElement>(null);

  const resetForm = () => {
    setNewWsName('');
    setNewWsDescription('');
    setWorkspaceType('TEAM');
    setNewWsAvatar('');
    setFormError(null);
  };

  const handleClose = () => {
    if (isSubmitting) return;
    resetForm();
    onClose();
  };

  const handleAvatarFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setFormError('Image size exceeds 5MB limit');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setNewWsAvatar(reader.result as string);
      setFormError(null);
    };
    reader.readAsDataURL(file);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newWsName.trim();
    if (!trimmed) {
      setFormError('Workspace name is required');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      const isPersonal = workspaceType === 'PERSONAL';
      const payload: any = {
        name: trimmed,
        description: newWsDescription.trim() || undefined,
        isPersonal,
      };
      if (newWsAvatar.trim()) {
        payload.avatarUrl = newWsAvatar.trim();
      }

      const created = await createWorkspace(payload);
      resetForm();
      onClose();
      if (onSuccess) {
        onSuccess(created);
      }
    } catch (err: any) {
      setFormError(err.message || 'Failed to create workspace');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      hideHeader
      className="cwm-modal-container"
    >
      {/* Atmospheric Header Banner */}
      <div className="cwm-header-banner">
        <div className="cwm-header-content">
          <h2 className="cwm-title">Create New Workspace</h2>
          <p className="cwm-subtitle">
            Set up a new workspace to organize your projects, tasks, and collaborate with your team.
          </p>
        </div>

        <div className="cwm-header-art" aria-hidden="true">
          <CreateWorkspaceIllustration />
        </div>

        <button
          type="button"
          className="cwm-close-btn"
          onClick={handleClose}
          aria-label="Close modal"
        >
          <CloseIcon size={14} strokeWidth="2.4" />
        </button>
      </div>

      {/* Modal Form Body */}
      <form onSubmit={handleCreateSubmit} className="cwm-form">
        <div className="cwm-body">
          {formError && (
            <div className="cwm-error-banner" role="alert">
              {formError}
            </div>
          )}

          {/* Workspace Type Selector */}
          <div className="cwm-field-group">
            <label className="cwm-field-label">Workspace Type</label>
            <div className="cwm-type-grid">
              {/* Personal */}
              <button
                type="button"
                className={`cwm-type-card ${workspaceType === 'PERSONAL' ? 'is-selected' : ''}`}
                onClick={() => setWorkspaceType('PERSONAL')}
              >
                <div className="cwm-type-icon-box personal">
                  <UserIcon size={20} />
                </div>
                <div className="cwm-type-info">
                  <div className="cwm-type-title">Personal</div>
                  <div className="cwm-type-desc">Categorized under My Workspaces</div>
                </div>
                {workspaceType === 'PERSONAL' && (
                  <div className="cwm-selected-badge" aria-label="Selected">
                    <CheckIcon size={12} strokeWidth={3} />
                  </div>
                )}
              </button>

              {/* Team */}
              <button
                type="button"
                className={`cwm-type-card ${workspaceType === 'TEAM' ? 'is-selected' : ''}`}
                onClick={() => setWorkspaceType('TEAM')}
              >
                <div className="cwm-type-icon-box team">
                  <UsersIcon size={20} />
                </div>
                <div className="cwm-type-info">
                  <div className="cwm-type-title">Team</div>
                  <div className="cwm-type-desc">Categorized under Team Workspaces</div>
                </div>
                {workspaceType === 'TEAM' && (
                  <div className="cwm-selected-badge" aria-label="Selected">
                    <CheckIcon size={12} strokeWidth={3} />
                  </div>
                )}
              </button>
            </div>
          </div>

          {/* Workspace Icon (Optional) */}
          <div className="cwm-field-group">
            <label className="cwm-field-label">Workspace Icon (Optional)</label>
            
            <div className="cwm-icon-row">
              {/* Dashed preview/upload box */}
              <div
                className={`cwm-icon-box ${newWsAvatar ? 'has-avatar' : ''}`}
                onClick={() => avatarFileInputRef.current?.click()}
                title={newWsAvatar ? 'Click to change icon' : 'Click to upload image'}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    avatarFileInputRef.current?.click();
                  }
                }}
              >
                {newWsAvatar ? (
                  <div className="cwm-avatar-preview-wrap">
                    <img
                      src={newWsAvatar}
                      alt="Workspace icon preview"
                      className="cwm-avatar-img"
                    />
                    <button
                      type="button"
                      className="cwm-avatar-remove-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setNewWsAvatar('');
                      }}
                      title="Remove icon"
                      aria-label="Remove icon"
                    >
                      <CloseIcon size={12} />
                    </button>
                  </div>
                ) : (
                  <div className="cwm-icon-box-empty">
                    <CameraIcon size={20} className="cwm-camera-icon" />
                    <span className="cwm-box-label">Upload Image</span>
                  </div>
                )}
              </div>

              <div className="cwm-icon-controls">
                <input
                  type="file"
                  ref={avatarFileInputRef}
                  style={{ display: 'none' }}
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  onChange={handleAvatarFileUpload}
                />
                <button
                  type="button"
                  className="cwm-upload-btn"
                  onClick={() => avatarFileInputRef.current?.click()}
                  disabled={isSubmitting}
                >
                  <UploadIcon size={15} />
                  <span>Upload Image</span>
                </button>
                <span className="cwm-icon-hint">PNG, JPG, WebP (max 5MB) or direct link</span>
              </div>
            </div>

            {/* Direct Image URL input */}
            <div className="cwm-input-box">
              <LinkIcon size={16} className="cwm-input-icon" />
              <input
                type="text"
                className="cwm-input-field"
                placeholder="Or paste direct image URL (https://...)"
                value={newWsAvatar.startsWith('data:') ? '' : newWsAvatar}
                onChange={(e) => setNewWsAvatar(e.target.value)}
                disabled={isSubmitting || newWsAvatar.startsWith('data:')}
              />
            </div>
          </div>

          {/* Workspace Name */}
          <div className="cwm-field-group">
            <label className="cwm-field-label">
              Workspace Name <span className="cwm-required">*</span>
            </label>
            <div className="cwm-input-box">
              <FolderIcon size={18} className="cwm-input-icon" />
              <input
                type="text"
                className="cwm-input-field"
                placeholder="e.g. Acme Corp, Mobile Studio"
                value={newWsName}
                onChange={(e) => setNewWsName(e.target.value)}
                required
                disabled={isSubmitting}
              />
            </div>
          </div>

          {/* Description (Optional) */}
          <div className="cwm-field-group">
            <label className="cwm-field-label">Description (Optional)</label>
            <div className="cwm-textarea-box">
              <FileTextIcon size={18} className="cwm-textarea-icon" />
              <textarea
                className="cwm-textarea-field"
                placeholder="What is this workspace for?"
                value={newWsDescription}
                onChange={(e) => setNewWsDescription(e.target.value)}
                rows={3}
                disabled={isSubmitting}
              />
            </div>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="cwm-footer">
          <button
            type="button"
            className="cwm-cancel-btn"
            onClick={handleClose}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="cwm-submit-btn"
            disabled={isSubmitting || !newWsName.trim()}
          >
            <PlusIcon size={16} strokeWidth={2.5} />
            <span>{isSubmitting ? 'Creating...' : 'Create Workspace'}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};
