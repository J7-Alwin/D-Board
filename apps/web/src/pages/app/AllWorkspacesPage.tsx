import React, { useState, useMemo } from 'react';
import { useRouter } from '../../router/Router';
import { useWorkspace } from '../../context/WorkspaceContext';
import { type WorkspaceSummary } from '../../api/workspaces.api';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Textarea } from '../../components/ui/Textarea';
import { Modal } from '../../components/ui/Modal';
import {
  LayersIcon,
  SearchIcon,
  PlusIcon,
  UsersIcon,
  FolderIcon,
  CheckIcon,
  ArrowRightIcon,
  SettingsIcon,
} from '../../components/ui/Icons';
import './AllWorkspacesPage.css';

export const AllWorkspacesPage: React.FC = () => {
  const { navigate } = useRouter();
  const {
    workspaces,
    activeWorkspace,
    setActiveWorkspaceId,
    createWorkspace,
  } = useWorkspace();

  const [searchQuery, setSearchQuery] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [workspaceType, setWorkspaceType] = useState<'PERSONAL' | 'TEAM'>('TEAM');
  const [newWsName, setNewWsName] = useState('');
  const [newWsDescription, setNewWsDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Combine and deduplicate owned and joined workspaces
  const allWorkspacesList = useMemo(() => {
    const combined = [...workspaces.owned, ...workspaces.joined];
    const seen = new Set<string>();
    return combined.filter((w) => {
      if (seen.has(w.id)) return false;
      seen.add(w.id);
      return true;
    });
  }, [workspaces.owned, workspaces.joined]);

  // Separate into Personal and Team workspaces
  const personalWorkspaces = useMemo(() => {
    return allWorkspacesList.filter((w) => w.isPersonal);
  }, [allWorkspacesList]);

  const teamWorkspaces = useMemo(() => {
    return allWorkspacesList.filter((w) => !w.isPersonal);
  }, [allWorkspacesList]);

  // Filter based on search query
  const filteredPersonal = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return personalWorkspaces;
    return personalWorkspaces.filter(
      (w) => w.name.toLowerCase().includes(q) || w.slug.toLowerCase().includes(q)
    );
  }, [personalWorkspaces, searchQuery]);

  const filteredTeam = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return teamWorkspaces;
    return teamWorkspaces.filter(
      (w) =>
        w.name.toLowerCase().includes(q) ||
        w.slug.toLowerCase().includes(q) ||
        (w.owner?.username && w.owner.username.toLowerCase().includes(q))
    );
  }, [teamWorkspaces, searchQuery]);

  const handleSelectWorkspace = (ws: WorkspaceSummary) => {
    try {
      if (ws.isPersonal) {
        if (!ws.isDefault) {
          localStorage.setItem('dboard_recent_personal_ws', ws.id);
        }
      } else {
        localStorage.setItem('dboard_recent_team_ws', ws.id);
      }
    } catch {
      // ignore
    }

    setActiveWorkspaceId(ws.id);
    navigate('/app/dashboard');
  };

  const handleOpenSettings = (e: React.MouseEvent, ws: WorkspaceSummary) => {
    e.stopPropagation();
    setActiveWorkspaceId(ws.id);
    navigate('/app/workspace/settings');
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
      const isPersonal = workspaceType === 'PERSONAL';
      const created = await createWorkspace({
        name: trimmed,
        description: newWsDescription.trim() || undefined,
        isPersonal,
      });
      setModalOpen(false);
      setActiveWorkspaceId(created.id);
      navigate('/app/dashboard');
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

  const getRoleBadge = (ws: WorkspaceSummary) => {
    if (ws.isPersonal) {
      return <span className="all-workspace-badge badge-personal">Personal</span>;
    }
    if (ws.isOwner || ws.userRole === 'OWNER') {
      return <span className="all-workspace-badge badge-role-owner">Owner</span>;
    }
    if (ws.userRole === 'WORKSPACE_ADMIN') {
      return <span className="all-workspace-badge badge-role-admin">Admin</span>;
    }
    if (ws.userRole === 'PROJECT_ADMIN') {
      return <span className="all-workspace-badge badge-role-projadmin">Project Admin</span>;
    }
    return <span className="all-workspace-badge badge-role-member">Member</span>;
  };

  return (
    <div className="all-workspaces-page">
      {/* Page Header */}
      <div className="all-workspaces-header">
        <div className="all-workspaces-header-left">
          <h1>All Workspaces</h1>
          <p>Browse, access, and manage all your personal and team workspaces.</p>
        </div>
        <div>
          <Button
            variant="primary"
            size="md"
            leftIcon={<PlusIcon size={16} />}
            onClick={() => {
              setWorkspaceType('TEAM');
              setNewWsName('');
              setNewWsDescription('');
              setFormError(null);
              setModalOpen(true);
            }}
            id="all-workspaces-create-btn"
          >
            Create Workspace
          </Button>
        </div>
      </div>

      {/* Toolbar / Search */}
      <div className="all-workspaces-toolbar">
        <div className="all-workspaces-search">
          <SearchIcon size={16} />
          <input
            type="text"
            placeholder="Search workspaces by name or slug..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            id="all-workspaces-search-input"
          />
        </div>
      </div>

      {/* Section 1: Personal Workspaces */}
      <section className="all-workspaces-section">
        <div className="all-workspaces-section-header">
          <div className="all-workspaces-section-title-row">
            <h2>Personal Workspaces</h2>
            <span className="all-workspaces-section-count">{personalWorkspaces.length}</span>
          </div>
          <p className="all-workspaces-section-desc">
            Your private environments for individual projects and tasks.
          </p>
        </div>

        {filteredPersonal.length === 0 ? (
          <div className="all-workspace-empty">
            <LayersIcon size={32} style={{ opacity: 0.5 }} />
            <p>No personal workspaces found matching your search.</p>
          </div>
        ) : (
          <div className="all-workspaces-grid">
            {filteredPersonal.map((ws) => {
              const isActive = activeWorkspace?.id === ws.id;
              return (
                <div
                  key={ws.id}
                  className={`all-workspace-card ${isActive ? 'is-active' : ''}`}
                >
                  <div>
                    <div className="all-workspace-card-top">
                      <div className="all-workspace-avatar">
                        {ws.avatarUrl ? (
                          <img src={ws.avatarUrl} alt={ws.name} />
                        ) : (
                          <span>{getWorkspaceInitials(ws.name)}</span>
                        )}
                      </div>
                      <div className="all-workspace-details">
                        <div className="all-workspace-title-row">
                          <span className="all-workspace-name" title={ws.name}>
                            {ws.name}
                          </span>
                          {ws.isDefault && (
                            <span className="all-workspace-badge badge-default">Default</span>
                          )}
                          {getRoleBadge(ws)}
                        </div>
                        {ws.description && (
                          <p className="all-workspace-description">{ws.description}</p>
                        )}
                      </div>
                    </div>

                    <div className="all-workspace-meta-row">
                      <div className="all-workspace-meta-item">
                        <FolderIcon size={14} />
                        <span>
                          {ws.projectCount} {ws.projectCount === 1 ? 'project' : 'projects'}
                        </span>
                      </div>
                      <div className="all-workspace-meta-item">
                        <UsersIcon size={14} />
                        <span>
                          {ws.memberCount} {ws.memberCount === 1 ? 'member' : 'members'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="all-workspace-card-footer">
                    <Button
                      type="button"
                      variant={isActive ? 'outline' : 'primary'}
                      size="sm"
                      rightIcon={isActive ? <CheckIcon size={14} /> : <ArrowRightIcon size={14} />}
                      onClick={() => handleSelectWorkspace(ws)}
                    >
                      {isActive ? 'Current Workspace' : 'Open Workspace'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      leftIcon={<SettingsIcon size={14} />}
                      onClick={(e) => handleOpenSettings(e, ws)}
                      title="Workspace Settings"
                    >
                      Settings
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Section 2: Team Workspaces */}
      <section className="all-workspaces-section">
        <div className="all-workspaces-section-header">
          <div className="all-workspaces-section-title-row">
            <h2>Team Workspaces</h2>
            <span className="all-workspaces-section-count">{teamWorkspaces.length}</span>
          </div>
          <p className="all-workspaces-section-desc">
            Collaborative workspaces shared with teammates and assigned roles.
          </p>
        </div>

        {filteredTeam.length === 0 ? (
          <div className="all-workspace-empty">
            <UsersIcon size={32} style={{ opacity: 0.5 }} />
            <p>No team workspaces found matching your search.</p>
          </div>
        ) : (
          <div className="all-workspaces-grid">
            {filteredTeam.map((ws) => {
              const isActive = activeWorkspace?.id === ws.id;
              const canAccessSettings = ws.isOwner || ws.userRole === 'OWNER' || ws.userRole === 'WORKSPACE_ADMIN';
              return (
                <div
                  key={ws.id}
                  className={`all-workspace-card ${isActive ? 'is-active' : ''}`}
                >
                  <div>
                    <div className="all-workspace-card-top">
                      <div className="all-workspace-avatar team-avatar">
                        {ws.avatarUrl ? (
                          <img src={ws.avatarUrl} alt={ws.name} />
                        ) : (
                          <span>{getWorkspaceInitials(ws.name)}</span>
                        )}
                      </div>
                      <div className="all-workspace-details">
                        <div className="all-workspace-title-row">
                          <span className="all-workspace-name" title={ws.name}>
                            {ws.name}
                          </span>
                          {getRoleBadge(ws)}
                        </div>
                        {ws.description && (
                          <p className="all-workspace-description">{ws.description}</p>
                        )}
                        {!ws.isOwner && ws.owner?.username && (
                          <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '4px 0 0 0' }}>
                            Created by @{ws.owner.username}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="all-workspace-meta-row">
                      <div className="all-workspace-meta-item">
                        <FolderIcon size={14} />
                        <span>
                          {ws.projectCount} {ws.projectCount === 1 ? 'project' : 'projects'}
                        </span>
                      </div>
                      <div className="all-workspace-meta-item">
                        <UsersIcon size={14} />
                        <span>
                          {ws.memberCount} {ws.memberCount === 1 ? 'member' : 'members'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="all-workspace-card-footer">
                    <Button
                      type="button"
                      variant={isActive ? 'outline' : 'primary'}
                      size="sm"
                      rightIcon={isActive ? <CheckIcon size={14} /> : <ArrowRightIcon size={14} />}
                      onClick={() => handleSelectWorkspace(ws)}
                    >
                      {isActive ? 'Current Workspace' : 'Open Workspace'}
                    </Button>
                    {canAccessSettings && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        leftIcon={<SettingsIcon size={14} />}
                        onClick={(e) => handleOpenSettings(e, ws)}
                        title="Workspace Settings"
                      >
                        Settings
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

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

          {/* Workspace Type Selector */}
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: '0.5rem' }}>
              Workspace Type
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <button
                type="button"
                style={{
                  padding: '0.75rem',
                  borderRadius: '8px',
                  border: workspaceType === 'PERSONAL' ? '2px solid #2563EB' : '1px solid #CBD5E1',
                  backgroundColor: workspaceType === 'PERSONAL' ? '#EFF6FF' : '#FFFFFF',
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                onClick={() => setWorkspaceType('PERSONAL')}
              >
                <div style={{ fontWeight: 700, fontSize: '0.875rem', color: workspaceType === 'PERSONAL' ? '#1E40AF' : '#1E293B' }}>
                  Personal
                </div>
                <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '2px', lineHeight: 1.3 }}>
                  Categorized under My Workspaces
                </div>
              </button>

              <button
                type="button"
                style={{
                  padding: '0.75rem',
                  borderRadius: '8px',
                  border: workspaceType === 'TEAM' ? '2px solid #2563EB' : '1px solid #CBD5E1',
                  backgroundColor: workspaceType === 'TEAM' ? '#EFF6FF' : '#FFFFFF',
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                onClick={() => setWorkspaceType('TEAM')}
              >
                <div style={{ fontWeight: 700, fontSize: '0.875rem', color: workspaceType === 'TEAM' ? '#1E40AF' : '#1E293B' }}>
                  Team
                </div>
                <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '2px', lineHeight: 1.3 }}>
                  Categorized under Team Workspaces
                </div>
              </button>
            </div>
          </div>

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
    </div>
  );
};
