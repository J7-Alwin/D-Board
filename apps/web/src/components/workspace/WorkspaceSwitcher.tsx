import React, { useState, useRef, useEffect } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { type WorkspaceSummary } from '../../api/workspaces.api';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Textarea } from '../ui/Textarea';
import {
  ChevronDownIcon,
  CheckIcon,
  PlusIcon,
  UsersIcon,
} from '../ui/Icons';
import { WorkspaceManageModal } from './WorkspaceManageModal';
import './WorkspaceSwitcher.css';

export interface WorkspaceSwitcherProps {
  onWorkspaceSwitched?: (workspace: WorkspaceSummary) => void;
}

export const WorkspaceSwitcher: React.FC<WorkspaceSwitcherProps> = ({ onWorkspaceSwitched }) => {
  const {
    workspaces,
    activeWorkspace,
    activeRole,
    isLoading,
    error,
    setActiveWorkspaceId,
    createWorkspace,
  } = useWorkspace();

  const [isOpen, setIsOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [manageModalOpen, setManageModalOpen] = useState(false);
  const [newWsName, setNewWsName] = useState('');
  const [newWsDescription, setNewWsDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (ws: WorkspaceSummary) => {
    if (activeWorkspace?.id === ws.id) {
      setIsOpen(false);
      return;
    }
    setActiveWorkspaceId(ws.id);
    setIsOpen(false);
    if (onWorkspaceSwitched) {
      onWorkspaceSwitched(ws);
    }
  };

  const handleOpenCreateModal = () => {
    setIsOpen(false);
    setNewWsName('');
    setNewWsDescription('');
    setFormError(null);
    setModalOpen(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newWsName.trim();
    if (!trimmed) {
      setFormError('Workspace name is required');
      return;
    }
    if (trimmed.length < 2) {
      setFormError('Workspace name must be at least 2 characters');
      return;
    }

    try {
      setIsSubmitting(true);
      setFormError(null);
      const created = await createWorkspace({
        name: trimmed,
        description: newWsDescription.trim() || undefined,
      });
      setModalOpen(false);
      if (onWorkspaceSwitched) {
        onWorkspaceSwitched(created);
      }
    } catch (err: any) {
      setFormError(err.message || 'Failed to create workspace');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getWorkspaceInitials = (name: string) => {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  if (isLoading && !activeWorkspace) {
    return (
      <div className="workspace-switcher-skeleton">
        <div className="skeleton-avatar" />
        <div className="skeleton-text" />
      </div>
    );
  }

  const roleBadgeLabel = () => {
    if (!activeWorkspace) return null;
    if (activeWorkspace.isPersonal) return 'Personal';
    if (activeRole === 'OWNER') return 'Owner';
    if (activeRole === 'WORKSPACE_ADMIN') return 'Admin';
    return 'Member';
  };

  return (
    <div className="workspace-switcher-wrapper" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        id="workspace-switcher-trigger"
        className={`workspace-switcher-trigger ${isOpen ? 'is-active' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label="Switch workspace"
      >
        <div className="workspace-switcher-left">
          <div className="workspace-switcher-avatar">
            {activeWorkspace?.avatarUrl ? (
              <img src={activeWorkspace.avatarUrl} alt={activeWorkspace.name} />
            ) : (
              <span>{activeWorkspace ? getWorkspaceInitials(activeWorkspace.name) : 'WS'}</span>
            )}
          </div>
          <div className="workspace-switcher-info">
            <span className="workspace-switcher-name" title={activeWorkspace?.name || 'Select Workspace'}>
              {activeWorkspace?.name || 'Select Workspace'}
            </span>
            <span className="workspace-switcher-role-badge">
              {roleBadgeLabel()}
            </span>
          </div>
        </div>
        <span className={`workspace-switcher-chevron ${isOpen ? 'rotate-180' : ''}`}>
          <ChevronDownIcon size={14} />
        </span>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="workspace-switcher-dropdown" role="listbox">
          {error && (
            <div className="workspace-switcher-error-banner" role="alert">
              {error}
            </div>
          )}

          <div className="workspace-switcher-scroll">
            {/* My Workspaces (Owned) */}
            <div className="workspace-section-header">
              <span>MY WORKSPACES</span>
              <span className="workspace-section-count">({workspaces.owned.length})</span>
            </div>

            {workspaces.owned.length === 0 ? (
              <div className="workspace-item-empty">No owned workspaces</div>
            ) : (
              workspaces.owned.map((ws) => {
                const isSelected = activeWorkspace?.id === ws.id;
                return (
                  <button
                    key={ws.id}
                    type="button"
                    className={`workspace-option-item ${isSelected ? 'is-selected' : ''}`}
                    onClick={() => handleSelect(ws)}
                    role="option"
                    aria-selected={isSelected}
                  >
                    <div className="workspace-option-avatar">
                      {ws.avatarUrl ? (
                        <img src={ws.avatarUrl} alt={ws.name} />
                      ) : (
                        <span>{getWorkspaceInitials(ws.name)}</span>
                      )}
                    </div>
                    <div className="workspace-option-details">
                      <div className="workspace-option-title-row">
                        <span className="workspace-option-name">{ws.name}</span>
                        {ws.isPersonal && (
                          <span className="workspace-tag-personal">Personal</span>
                        )}
                      </div>
                      <span className="workspace-option-meta">
                        {ws.projectCount} {ws.projectCount === 1 ? 'project' : 'projects'} • {ws.memberCount} {ws.memberCount === 1 ? 'member' : 'members'}
                      </span>
                    </div>
                    {isSelected && (
                      <span className="workspace-option-check">
                        <CheckIcon size={16} />
                      </span>
                    )}
                  </button>
                );
              })
            )}

            {/* Team Workspaces (Joined) */}
            <div className="workspace-section-header" style={{ marginTop: '0.75rem' }}>
              <span>TEAM WORKSPACES</span>
              <span className="workspace-section-count">({workspaces.joined.length})</span>
            </div>

            {workspaces.joined.length === 0 ? (
              <div className="workspace-item-empty">No team workspaces joined</div>
            ) : (
              workspaces.joined.map((ws) => {
                const isSelected = activeWorkspace?.id === ws.id;
                return (
                  <button
                    key={ws.id}
                    type="button"
                    className={`workspace-option-item ${isSelected ? 'is-selected' : ''}`}
                    onClick={() => handleSelect(ws)}
                    role="option"
                    aria-selected={isSelected}
                  >
                    <div className="workspace-option-avatar team-avatar">
                      {ws.avatarUrl ? (
                        <img src={ws.avatarUrl} alt={ws.name} />
                      ) : (
                        <span>{getWorkspaceInitials(ws.name)}</span>
                      )}
                    </div>
                    <div className="workspace-option-details">
                      <div className="workspace-option-title-row">
                        <span className="workspace-option-name">{ws.name}</span>
                        <span className="workspace-tag-role">
                          {ws.userRole === 'WORKSPACE_ADMIN' ? 'Admin' : 'Member'}
                        </span>
                      </div>
                      <span className="workspace-option-meta">
                        by @{ws.owner.username} • {ws.projectCount} {ws.projectCount === 1 ? 'project' : 'projects'}
                      </span>
                    </div>
                    {isSelected && (
                      <span className="workspace-option-check">
                        <CheckIcon size={16} />
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* Footer Actions */}
          <div className="workspace-switcher-footer">
            {activeWorkspace && (
              <button
                type="button"
                id="workspace-manage-btn"
                className="workspace-manage-btn"
                onClick={() => {
                  setIsOpen(false);
                  setManageModalOpen(true);
                }}
              >
                <UsersIcon size={14} />
                <span>Members & Settings</span>
              </button>
            )}
            <button
              type="button"
              className="workspace-create-btn"
              onClick={handleOpenCreateModal}
            >
              <PlusIcon size={14} />
              <span>Create Workspace</span>
            </button>
          </div>
        </div>
      )}

      {/* Create Workspace Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => !isSubmitting && setModalOpen(false)}
        title="Create New Workspace"
        maxWidth="sm"
      >
        <form onSubmit={handleCreateSubmit} className="workspace-create-form">
          {formError && (
            <div className="workspace-form-error" role="alert">
              {formError}
            </div>
          )}

          <div style={{ marginBottom: '1rem' }}>
            <Input
              label="Workspace Name"
              placeholder="e.g. Acme Corp, Mobile Studio"
              value={newWsName}
              onChange={(e) => setNewWsName(e.target.value)}
              required
              autoFocus
              disabled={isSubmitting}
            />
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <Textarea
              label="Description (Optional)"
              placeholder="What is this workspace for?"
              value={newWsDescription}
              onChange={(e) => setNewWsDescription(e.target.value)}
              rows={3}
              disabled={isSubmitting}
            />
          </div>

          <div className="workspace-modal-actions">
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={() => setModalOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={isSubmitting}
              leftIcon={<PlusIcon size={16} />}
            >
              Create Workspace
            </Button>
          </div>
        </form>
      </Modal>

      {/* Workspace Management Modal */}
      {manageModalOpen && (
        <WorkspaceManageModal
          isOpen={manageModalOpen}
          onClose={() => setManageModalOpen(false)}
        />
      )}
    </div>
  );
};
