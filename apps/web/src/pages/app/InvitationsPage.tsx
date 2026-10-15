import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from '../../router/Router';
import { useWorkspace } from '../../context/WorkspaceContext';
import { invitationsApi, type ProjectInvitation } from '../../api/invitations.api';
import {
  workspacesApi,
  type PendingWorkspaceInvitation,
} from '../../api/workspaces.api';
import {
  MailIcon,
  CheckSquareIcon,
  CheckIcon,
  CloseIcon,
  ClockIcon,
  GridIcon,
  ExternalLinkIcon,
  AlertCircleIcon,
  LayersIcon,
} from '../../components/ui/Icons';
import { CustomSelect } from '../../components/ui/CustomSelect';
import { ProjectAvatar } from '../../components/ui/ProjectAvatar';
import { InvitationsHeaderAtmosphere } from '../../components/common/HeaderAtmosphereArt';

export const InvitationsPage: React.FC = () => {
  const { navigate } = useRouter();
  const { refreshWorkspaces, setActiveWorkspaceId } = useWorkspace();

  const [category, setCategory] = useState<'WORKSPACES' | 'PROJECTS'>('WORKSPACES');

  // Project Invitations State
  const [projectInvitations, setProjectInvitations] = useState<ProjectInvitation[]>([]);
  const [statusFilter, setStatusFilter] = useState<'PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED' | 'ALL'>('PENDING');
  const [sortOrder, setSortOrder] = useState<'latest' | 'oldest' | 'name'>('latest');
  const [loadingProjects, setLoadingProjects] = useState(true);

  // Workspace Invitations State
  const [workspaceInvitations, setWorkspaceInvitations] = useState<PendingWorkspaceInvitation[]>([]);
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(true);

  // General Processing State
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Token Prompt from Query Parameter
  const [tokenParam, setTokenParam] = useState<string | null>(null);

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const token = params.get('token');
      if (token) {
        setTokenParam(token);
        setCategory('WORKSPACES');
      }
    } catch {
      // Ignore query param error
    }
  }, []);

  const loadProjectInvitations = useCallback(async () => {
    setLoadingProjects(true);
    try {
      const res = await invitationsApi.getUserInvitations(statusFilter);
      if (res.success && res.data) {
        setProjectInvitations(res.data.invitations);
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to load project invitations' });
    } finally {
      setLoadingProjects(false);
    }
  }, [statusFilter]);

  const loadWorkspaceInvitations = useCallback(async () => {
    setLoadingWorkspaces(true);
    try {
      const res = await workspacesApi.getUserPendingInvitations();
      if (res.success && res.data) {
        setWorkspaceInvitations(res.data.invitations || []);
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to load workspace invitations' });
    } finally {
      setLoadingWorkspaces(false);
    }
  }, []);

  useEffect(() => {
    loadProjectInvitations();
  }, [loadProjectInvitations]);

  useEffect(() => {
    loadWorkspaceInvitations();
  }, [loadWorkspaceInvitations]);

  // Handle Accept Project Invitation
  const handleAcceptProject = async (invitationId: string) => {
    setProcessingId(invitationId);
    setFeedback(null);
    try {
      const res = await invitationsApi.acceptInvitation(invitationId);
      if (res.success) {
        setFeedback({ type: 'success', message: res.message || 'Project invitation accepted!' });
        loadProjectInvitations();
        await refreshWorkspaces();
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to accept invitation' });
    } finally {
      setProcessingId(null);
    }
  };

  // Handle Decline Project Invitation
  const handleDeclineProject = async (invitationId: string) => {
    if (!window.confirm('Are you sure you want to decline this project invitation?')) return;

    setProcessingId(invitationId);
    setFeedback(null);
    try {
      const res = await invitationsApi.declineInvitation(invitationId);
      if (res.success) {
        setFeedback({ type: 'success', message: 'Project invitation declined' });
        loadProjectInvitations();
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to decline invitation' });
    } finally {
      setProcessingId(null);
    }
  };

  // Handle Accept Workspace Invitation
  const handleAcceptWorkspace = async (invitationIdOrToken: string) => {
    setProcessingId(invitationIdOrToken);
    setFeedback(null);
    try {
      const res = await workspacesApi.acceptInvitation(invitationIdOrToken);
      if (res.success) {
        setFeedback({
          type: 'success',
          message: res.message || 'Workspace invitation accepted! You are now a member.',
        });
        setTokenParam(null);
        await loadWorkspaceInvitations();
        await refreshWorkspaces();
        if (res.data?.workspace?.id) {
          setActiveWorkspaceId(res.data.workspace.id);
        }
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to accept workspace invitation' });
    } finally {
      setProcessingId(null);
    }
  };

  // Handle Decline Workspace Invitation
  const handleDeclineWorkspace = async (invitationIdOrToken: string) => {
    if (!window.confirm('Are you sure you want to decline this workspace invitation?')) return;

    setProcessingId(invitationIdOrToken);
    setFeedback(null);
    try {
      const res = await workspacesApi.declineInvitation(invitationIdOrToken);
      if (res.success) {
        setFeedback({ type: 'success', message: 'Workspace invitation declined' });
        setTokenParam(null);
        await loadWorkspaceInvitations();
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to decline workspace invitation' });
    } finally {
      setProcessingId(null);
    }
  };

  const projectFilterTabs: Array<{
    id: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED' | 'ALL';
    label: string;
    icon: React.ReactNode;
  }> = [
    { id: 'PENDING', label: 'Pending', icon: <MailIcon size={14} /> },
    { id: 'ACCEPTED', label: 'Accepted', icon: <CheckSquareIcon size={14} /> },
    { id: 'DECLINED', label: 'Declined', icon: <CloseIcon size={14} /> },
    { id: 'EXPIRED', label: 'Expired', icon: <ClockIcon size={14} /> },
    { id: 'ALL', label: 'All', icon: <GridIcon size={14} /> },
  ];

  const displayedProjectInvitations = useMemo(() => {
    let list = [...projectInvitations];
    if (sortOrder === 'latest') {
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } else if (sortOrder === 'oldest') {
      list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    } else if (sortOrder === 'name') {
      list.sort((a, b) => (a.project?.name || '').localeCompare(b.project?.name || ''));
    }
    return list;
  }, [projectInvitations, sortOrder]);

  return (
    <div className="cal-experience-root invitations-page-experience">
      {/* Top Floating Header Card */}
      <div className="cal-page-header invitations-page-top-header">
        <div className="cal-header-left">
          <div className="cal-title-row">
            <span className="cal-header-icon-box invitations-icon-box">
              <MailIcon size={24} />
            </span>
            <h1 className="cal-header-title">Collaboration Invitations</h1>
          </div>
          <p className="cal-header-subtitle">
            Review and respond to invitations to join team workspaces and collaborate on projects.
          </p>
        </div>

        {/* Atmosphere Quote & Illustration Artwork */}
        <InvitationsHeaderAtmosphere />
      </div>

      {/* Token Link Prompt Banner */}
      {tokenParam && (
        <div
          className="form-feedback-banner feedback-success"
          style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <MailIcon size={18} />
            <span>You have an invitation token ready to accept! Click below to join the workspace.</span>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className="invitation-btn-accept"
              disabled={processingId === tokenParam}
              onClick={() => handleAcceptWorkspace(tokenParam)}
            >
              {processingId === tokenParam ? <span className="btn-spinner" /> : <CheckIcon size={14} />}
              <span>Accept with Token</span>
            </button>
            <button
              type="button"
              className="invitation-btn-decline"
              disabled={processingId === tokenParam}
              onClick={() => setTokenParam(null)}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`form-feedback-banner ${
            feedback.type === 'success' ? 'feedback-success' : 'feedback-error'
          }`}
          style={{ marginBottom: '0.5rem' }}
        >
          {feedback.type === 'success' ? <CheckIcon size={16} /> : <AlertCircleIcon size={16} />}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Category Tabs: Workspaces vs Projects */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '1rem' }}>
        <button
          type="button"
          onClick={() => setCategory('WORKSPACES')}
          className={`invitations-filter-pill ${category === 'WORKSPACES' ? 'active' : ''}`}
          style={{ padding: '8px 16px', fontSize: '13px', fontWeight: 600 }}
        >
          <LayersIcon size={16} />
          <span>Workspace Invitations</span>
          {workspaceInvitations.length > 0 && (
            <span className="sidebar-invites-badge" style={{ marginLeft: '4px' }}>
              {workspaceInvitations.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setCategory('PROJECTS')}
          className={`invitations-filter-pill ${category === 'PROJECTS' ? 'active' : ''}`}
          style={{ padding: '8px 16px', fontSize: '13px', fontWeight: 600 }}
        >
          <CheckSquareIcon size={16} />
          <span>Project Invitations</span>
          {projectInvitations.filter((p) => p.status === 'PENDING').length > 0 && (
            <span className="sidebar-invites-badge" style={{ marginLeft: '4px' }}>
              {projectInvitations.filter((p) => p.status === 'PENDING').length}
            </span>
          )}
        </button>
      </div>

      {/* Main Section Card */}
      <div className="cal-card-primary invitations-card-primary">
        {/* Category 1: Workspace Invitations */}
        {category === 'WORKSPACES' && (
          <div>
            {loadingWorkspaces ? (
              <div className="workspace-loading-state" style={{ padding: '4rem 1.5rem' }}>
                <div className="btn-spinner" />
                <p>Loading workspace invitations...</p>
              </div>
            ) : workspaceInvitations.length === 0 ? (
              <div className="invitations-empty-state">
                <div className="invitations-empty-illustration-wrap">
                  <div className="invitations-empty-mint-circle">
                    <LayersIcon size={36} />
                    <div className="invitations-empty-sparkle-dash" />
                  </div>
                </div>
                <h3 className="invitations-empty-headline">No Pending Workspace Invitations</h3>
                <p className="invitations-empty-desc">
                  You don&apos;t have any pending workspace invitations right now. When an owner or admin invites you to their workspace, it will appear here.
                </p>
                <button
                  type="button"
                  className="invitations-btn-back"
                  onClick={() => navigate('/app/dashboard')}
                >
                  <span>&larr; Back to Dashboard</span>
                </button>
              </div>
            ) : (
              <div className="invitations-cards-grid">
                {workspaceInvitations.map((inv) => {
                  const wsInitials = inv.workspace.name.slice(0, 2).toUpperCase();
                  const inviterInitials = inv.invitedBy.fullName
                    ? inv.invitedBy.fullName.slice(0, 2).toUpperCase()
                    : inv.invitedBy.username.slice(0, 2).toUpperCase();

                  return (
                    <div key={inv.id} className="invitation-card">
                      <div className="invitation-card-top">
                        <div
                          style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '8px',
                            background: 'linear-gradient(135deg, #3B82F6, #6366F1)',
                            color: '#FFFFFF',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 700,
                            fontSize: '15px',
                            flexShrink: 0,
                          }}
                        >
                          {wsInitials}
                        </div>
                        <div className="invitation-project-info">
                          <div className="invitation-project-title-row">
                            <h3 className="invitation-project-name">{inv.workspace.name}</h3>
                            <span className="invite-status-pill status-pending">PENDING</span>
                          </div>
                          <span style={{ fontSize: '12px', color: '#6B7280' }}>
                            Workspace • @{inv.workspace.slug}
                          </span>
                        </div>
                      </div>

                      {inv.message && (
                        <div className="invitation-message-quote">&ldquo;{inv.message}&rdquo;</div>
                      )}

                      <div className="invitation-card-meta">
                        <div className="invitation-meta-item">
                          <span className="meta-label">Invited by:</span>
                          <div className="inviter-pill">
                            <span className="inviter-avatar">{inviterInitials}</span>
                            <span className="inviter-name">
                              {inv.invitedBy.fullName || `@${inv.invitedBy.username}`}
                            </span>
                          </div>
                        </div>

                        <div className="invitation-meta-item">
                          <span className="meta-label">Role offered:</span>
                          <span
                            className={`member-role-badge ${
                              inv.role === 'WORKSPACE_ADMIN' ? 'badge-admin' : 'badge-member'
                            }`}
                          >
                            {inv.role === 'WORKSPACE_ADMIN' ? 'Workspace Admin' : 'Workspace Member'}
                          </span>
                        </div>

                        <div className="invitation-meta-item">
                          <span className="meta-label">Expires:</span>
                          <span className="invitation-expiry-val">
                            <ClockIcon size={12} />
                            {new Date(inv.expiresAt).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </span>
                        </div>
                      </div>

                      {/* Card Actions */}
                      <div className="invitation-card-actions">
                        <button
                          type="button"
                          className="invitation-btn-decline"
                          disabled={processingId === inv.id}
                          onClick={() => handleDeclineWorkspace(inv.id)}
                        >
                          Decline
                        </button>
                        <button
                          type="button"
                          className="invitation-btn-accept"
                          disabled={processingId === inv.id}
                          onClick={() => handleAcceptWorkspace(inv.id)}
                        >
                          {processingId === inv.id ? (
                            <span className="btn-spinner" />
                          ) : (
                            <CheckIcon size={14} />
                          )}
                          <span>Accept Workspace Invitation</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Category 2: Project Invitations */}
        {category === 'PROJECTS' && (
          <div>
            {/* Toolbar Row: Filter Pills + Sort Dropdown */}
            <div className="invitations-controls-toolbar">
              <div className="invitations-filter-pills-wrap">
                {projectFilterTabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    className={`invitations-filter-pill ${statusFilter === tab.id ? 'active' : ''}`}
                    onClick={() => setStatusFilter(tab.id)}
                  >
                    {tab.icon}
                    <span>{tab.label}</span>
                  </button>
                ))}
              </div>

              <div className="invitations-toolbar-right">
                <CustomSelect
                  value={sortOrder}
                  onChange={(val) => setSortOrder(val as any)}
                  compact
                  fullWidth={false}
                  options={[
                    { value: 'latest', label: 'Latest First' },
                    { value: 'oldest', label: 'Oldest First' },
                    { value: 'name', label: 'Project Name' },
                  ]}
                />
              </div>
            </div>

            {loadingProjects ? (
              <div className="workspace-loading-state" style={{ padding: '4rem 1.5rem' }}>
                <div className="btn-spinner" />
                <p>Loading project invitations...</p>
              </div>
            ) : displayedProjectInvitations.length === 0 ? (
              <div className="invitations-empty-state">
                <div className="invitations-empty-illustration-wrap">
                  <div className="invitations-empty-mint-circle">
                    <MailIcon size={36} />
                    <div className="invitations-empty-sparkle-dash" />
                  </div>
                </div>

                <h3 className="invitations-empty-headline">
                  {statusFilter === 'ALL'
                    ? 'No project invitations found'
                    : `No ${statusFilter.toLowerCase()} project invitations`}
                </h3>

                <p className="invitations-empty-desc">
                  {statusFilter === 'PENDING'
                    ? "You don't have any pending project invitations right now."
                    : `No project invitations with status "${statusFilter.toLowerCase()}".`}
                </p>

                <button
                  type="button"
                  className="invitations-btn-back"
                  onClick={() => navigate('/app/dashboard')}
                >
                  <span>&larr; Back to Dashboard</span>
                </button>
              </div>
            ) : (
              <div className="invitations-cards-grid">
                {displayedProjectInvitations.map((inv) => {
                  const isPending = inv.status === 'PENDING';
                  const isAccepted = inv.status === 'ACCEPTED';
                  const inviterInitials = inv.invitedBy?.fullName
                    ? inv.invitedBy.fullName.slice(0, 2).toUpperCase()
                    : (inv.invitedBy?.username || 'AD').slice(0, 2).toUpperCase();

                  return (
                    <div key={inv.id} className="invitation-card">
                      <div className="invitation-card-top">
                        <ProjectAvatar project={inv.project} size="md" />
                        <div className="invitation-project-info">
                          <div className="invitation-project-title-row">
                            <h3 className="invitation-project-name">{inv.project?.name || 'Project'}</h3>
                            {inv.project?.key && (
                              <span className="project-key-badge">{inv.project.key}</span>
                            )}
                            <span className={`invite-status-pill status-${inv.status.toLowerCase()}`}>
                              {inv.status}
                            </span>
                          </div>
                          {inv.project?.description && (
                            <p className="invitation-project-desc">{inv.project.description}</p>
                          )}
                        </div>
                      </div>

                      {inv.message && (
                        <div className="invitation-message-quote">&ldquo;{inv.message}&rdquo;</div>
                      )}

                      <div className="invitation-card-meta">
                        <div className="invitation-meta-item">
                          <span className="meta-label">Invited by:</span>
                          <div className="inviter-pill">
                            <span className="inviter-avatar">{inviterInitials}</span>
                            <span className="inviter-name">
                              {inv.invitedBy?.fullName || inv.invitedBy?.username || 'Project Administrator'}
                            </span>
                          </div>
                        </div>

                        <div className="invitation-meta-item">
                          <span className="meta-label">Role:</span>
                          <span
                            className={`member-role-badge ${
                              inv.role === 'PROJECT_ADMIN' ? 'badge-admin' : 'badge-member'
                            }`}
                          >
                            {inv.role === 'PROJECT_ADMIN' ? 'Admin' : 'Member'}
                          </span>
                        </div>

                        <div className="invitation-meta-item">
                          <span className="meta-label">Expires:</span>
                          <span className="invitation-expiry-val">
                            <ClockIcon size={12} />
                            {new Date(inv.expiresAt).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </span>
                        </div>
                      </div>

                      {/* Card Actions */}
                      <div className="invitation-card-actions">
                        {isPending && (
                          <>
                            <button
                              type="button"
                              className="invitation-btn-decline"
                              disabled={processingId === inv.id}
                              onClick={() => handleDeclineProject(inv.id)}
                            >
                              Decline
                            </button>
                            <button
                              type="button"
                              className="invitation-btn-accept"
                              disabled={processingId === inv.id}
                              onClick={() => handleAcceptProject(inv.id)}
                            >
                              {processingId === inv.id ? (
                                <span className="btn-spinner" />
                              ) : (
                                <CheckIcon size={14} />
                              )}
                              <span>Accept Invitation</span>
                            </button>
                          </>
                        )}

                        {isAccepted && inv.projectId && (
                          <button
                            type="button"
                            className="invitation-btn-accept"
                            onClick={() => navigate(`/app/projects/${inv.projectId}`)}
                          >
                            <ExternalLinkIcon size={14} />
                            <span>Open Project Workspace</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
