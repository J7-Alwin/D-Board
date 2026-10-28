import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useRouter } from '../../router/Router';
import { useWorkspace } from '../../context/WorkspaceContext';
import { type WorkspaceSummary } from '../../api/workspaces.api';
import {
  ChevronDownIcon,
  CheckIcon,
  PlusIcon,
  UsersIcon,
  LayersIcon,
} from '../ui/Icons';
import { WorkspaceManageModal } from './WorkspaceManageModal';
import { CreateWorkspaceModal } from './CreateWorkspaceModal';
import './WorkspaceSwitcher.css';

export interface WorkspaceSwitcherProps {
  onWorkspaceSwitched?: (workspace: WorkspaceSummary) => void;
}

export const WorkspaceSwitcher: React.FC<WorkspaceSwitcherProps> = ({ onWorkspaceSwitched }) => {
  const { navigate } = useRouter();
  const {
    workspaces,
    deletedWorkspaces,
    activeWorkspace,
    activeRole,
    isLoading,
    error,
    setActiveWorkspaceId,
    recoverWorkspace,
  } = useWorkspace();

  const [isOpen, setIsOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [manageModalOpen, setManageModalOpen] = useState(false);
  const [recoveringId, setRecoveringId] = useState<string | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click or Escape key
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleSelect = (ws: WorkspaceSummary) => {
    try {
      if (ws.isPersonal) {
        if (!ws.isDefault) {
          localStorage.setItem('dboard_recent_personal_ws', ws.id);
        }
      } else {
        localStorage.setItem('dboard_recent_team_ws', ws.id);
      }
    } catch {
      // ignore storage errors
    }

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
    setModalOpen(true);
  };

  const getWorkspaceInitials = (name: string) => {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  // Group Workspaces
  // 1. All Personal Workspaces
  const allPersonalWorkspaces = useMemo(() => {
    const combined = [...workspaces.owned, ...workspaces.joined];
    const seen = new Set<string>();
    return combined.filter((w) => {
      if (!w.isPersonal || seen.has(w.id)) return false;
      seen.add(w.id);
      return true;
    });
  }, [workspaces.owned, workspaces.joined]);

  // Default personal workspace
  const defaultPersonalWs = useMemo(() => {
    return allPersonalWorkspaces.find((w) => w.isDefault) || allPersonalWorkspaces[0];
  }, [allPersonalWorkspaces]);

  // Max 1 recently opened non-default personal workspace
  const secondaryPersonalWs = useMemo(() => {
    const other = allPersonalWorkspaces.filter((w) => w.id !== defaultPersonalWs?.id);
    if (other.length === 0) return null;
    let recentId: string | null = null;
    try {
      recentId = localStorage.getItem('dboard_recent_personal_ws');
    } catch {
      // ignore
    }
    return other.find((w) => w.id === recentId) || other[0];
  }, [allPersonalWorkspaces, defaultPersonalWs]);

  const displayedPersonalWorkspaces = useMemo(() => {
    const list: WorkspaceSummary[] = [];
    if (defaultPersonalWs) list.push(defaultPersonalWs);
    if (secondaryPersonalWs && secondaryPersonalWs.id !== defaultPersonalWs?.id) {
      list.push(secondaryPersonalWs);
    }
    return list;
  }, [defaultPersonalWs, secondaryPersonalWs]);

  // 2. All Team Workspaces (Owned & Joined)
  const allTeamWorkspaces = useMemo(() => {
    const combined = [...workspaces.owned, ...workspaces.joined];
    const seen = new Set<string>();
    return combined.filter((w) => {
      if (w.isPersonal || seen.has(w.id)) return false;
      seen.add(w.id);
      return true;
    });
  }, [workspaces.owned, workspaces.joined]);

  const displayedTeamWorkspaces = useMemo(() => {
    let recentId: string | null = null;
    try {
      recentId = localStorage.getItem('dboard_recent_team_ws');
    } catch {
      // ignore
    }
    const sorted = [...allTeamWorkspaces].sort((a, b) => {
      if (a.id === recentId) return -1;
      if (b.id === recentId) return 1;
      return 0;
    });
    return sorted.slice(0, 5);
  }, [allTeamWorkspaces]);

  const getRoleLabel = (ws: WorkspaceSummary) => {
    if (ws.isOwner || ws.userRole === 'OWNER') return 'Owner';
    if (ws.userRole === 'WORKSPACE_ADMIN') return 'Admin';
    if (ws.userRole === 'PROJECT_ADMIN') return 'Project Admin';
    return 'Member';
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
    if (activeRole === 'PROJECT_ADMIN') return 'Project Admin';
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
          {(error || restoreError) && (
            <div className="workspace-switcher-error-banner" role="alert">
              {error || restoreError}
            </div>
          )}

          <div className="workspace-switcher-scroll">
            {/* My Workspaces (Personal) */}
            <div className="workspace-section-header">
              <span>MY WORKSPACES</span>
              <span className="workspace-section-count">({allPersonalWorkspaces.length})</span>
            </div>

            {displayedPersonalWorkspaces.length === 0 ? (
              <div className="workspace-item-empty">No personal workspaces</div>
            ) : (
              displayedPersonalWorkspaces.map((ws) => {
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
                        {ws.isDefault ? (
                          <span className="workspace-tag-personal" style={{ backgroundColor: '#DBEAFE', color: '#1E40AF' }}>
                            Default
                          </span>
                        ) : (
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

            {/* Team Workspaces */}
            <div className="workspace-section-header" style={{ marginTop: '0.75rem' }}>
              <span>TEAM WORKSPACES</span>
              <span className="workspace-section-count">({allTeamWorkspaces.length})</span>
            </div>

            {displayedTeamWorkspaces.length === 0 ? (
              <div className="workspace-item-empty">No team workspaces joined</div>
            ) : (
              displayedTeamWorkspaces.map((ws) => {
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
                          {getRoleLabel(ws)}
                        </span>
                      </div>
                      <span className="workspace-option-meta">
                        {ws.isOwner ? (
                          `${ws.projectCount} ${ws.projectCount === 1 ? 'project' : 'projects'} • ${ws.memberCount} ${ws.memberCount === 1 ? 'member' : 'members'}`
                        ) : (
                          `by @${ws.owner.username} • ${ws.projectCount} ${ws.projectCount === 1 ? 'project' : 'projects'}`
                        )}
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

            {/* Recoverable Soft-Deleted Workspaces (Phase 5B) */}
            {deletedWorkspaces && deletedWorkspaces.length > 0 && (
              <>
                <div className="workspace-section-header" style={{ marginTop: '0.75rem', color: '#ef4444' }}>
                  <span>DELETED WORKSPACES (RECOVERY)</span>
                  <span className="workspace-section-count">({deletedWorkspaces.length})</span>
                </div>
                {deletedWorkspaces.map((dws) => (
                  <div
                    key={dws.id}
                    className="workspace-option-item is-deleted"
                    style={{ opacity: 0.9, backgroundColor: '#fef2f2', border: '1px dashed #fca5a5' }}
                  >
                    <div className="workspace-option-details">
                      <div className="workspace-option-title-row">
                        <span className="workspace-option-name" style={{ textDecoration: 'line-through' }}>
                          {dws.name}
                        </span>
                        <span
                          className="workspace-tag-recovery"
                          style={{
                            fontSize: '0.7rem',
                            fontWeight: 600,
                            color: '#b45309',
                            backgroundColor: '#fef3c7',
                            padding: '1px 5px',
                            borderRadius: '4px',
                          }}
                        >
                          {dws.daysRemaining}d left
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="workspace-restore-btn"
                      disabled={recoveringId === dws.id}
                      style={{
                        padding: '4px 8px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        borderRadius: '4px',
                        border: '1px solid #10b981',
                        color: '#065f46',
                        backgroundColor: '#d1fae5',
                        cursor: recoveringId === dws.id ? 'not-allowed' : 'pointer',
                        marginLeft: '8px',
                        opacity: recoveringId === dws.id ? 0.7 : 1,
                      }}
                      onClick={async (e) => {
                        e.stopPropagation();
                        try {
                          setRecoveringId(dws.id);
                          setRestoreError(null);
                          await recoverWorkspace(dws.id);
                          setIsOpen(false);
                        } catch (err: any) {
                          setRestoreError(err.message || 'Failed to restore workspace');
                        } finally {
                          setRecoveringId(null);
                        }
                      }}
                    >
                      {recoveringId === dws.id ? 'Restoring...' : 'Restore'}
                    </button>
                  </div>
                ))}
              </>
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
                  navigate('/app/workspace/settings');
                }}
              >
                <UsersIcon size={14} />
                <span>Members & Settings</span>
              </button>
            )}
            <button
              type="button"
              id="workspace-all-btn"
              className="workspace-manage-btn"
              onClick={() => {
                setIsOpen(false);
                navigate('/app/workspaces');
              }}
            >
              <LayersIcon size={14} />
              <span>All Workspaces</span>
            </button>
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
      <CreateWorkspaceModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={(created) => {
          if (onWorkspaceSwitched) {
            onWorkspaceSwitched(created);
          }
        }}
      />

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

