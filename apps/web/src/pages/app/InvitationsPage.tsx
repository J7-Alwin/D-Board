import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from '../../router/Router';
import { invitationsApi, type ProjectInvitation } from '../../api/invitations.api';
import {
  MailIcon,
  CheckSquareIcon,
  CheckIcon,
  CloseIcon,
  ClockIcon,
  GridIcon,
  ExternalLinkIcon,
  AlertCircleIcon,
} from '../../components/ui/Icons';
import { CustomSelect } from '../../components/ui/CustomSelect';
import { ProjectAvatar } from '../../components/ui/ProjectAvatar';
import { InvitationsHeaderAtmosphere } from '../../components/common/HeaderAtmosphereArt';

export const InvitationsPage: React.FC = () => {
  const { navigate } = useRouter();
  const [invitations, setInvitations] = useState<ProjectInvitation[]>([]);
  const [statusFilter, setStatusFilter] = useState<'PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED' | 'ALL'>('PENDING');
  const [sortOrder, setSortOrder] = useState<'latest' | 'oldest' | 'name'>('latest');
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const loadInvitations = useCallback(async () => {
    setLoading(true);
    try {
      const res = await invitationsApi.getUserInvitations(statusFilter);
      if (res.success && res.data) {
        setInvitations(res.data.invitations);
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to load invitations' });
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    loadInvitations();
  }, [loadInvitations]);

  const handleAccept = async (invitationId: string) => {
    setProcessingId(invitationId);
    setFeedback(null);
    try {
      const res = await invitationsApi.acceptInvitation(invitationId);
      if (res.success) {
        setFeedback({ type: 'success', message: res.message || 'Invitation accepted!' });
        loadInvitations();
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to accept invitation' });
    } finally {
      setProcessingId(null);
    }
  };

  const handleDecline = async (invitationId: string) => {
    if (!window.confirm('Are you sure you want to decline this project invitation?')) return;

    setProcessingId(invitationId);
    setFeedback(null);
    try {
      const res = await invitationsApi.declineInvitation(invitationId);
      if (res.success) {
        setFeedback({ type: 'success', message: 'Invitation declined' });
        loadInvitations();
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to decline invitation' });
    } finally {
      setProcessingId(null);
    }
  };

  const filterTabs: Array<{
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

  const displayedInvitations = useMemo(() => {
    let list = [...invitations];
    if (sortOrder === 'latest') {
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } else if (sortOrder === 'oldest') {
      list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    } else if (sortOrder === 'name') {
      list.sort((a, b) => (a.project?.name || '').localeCompare(b.project?.name || ''));
    }
    return list;
  }, [invitations, sortOrder]);

  return (
    <div className="cal-experience-root invitations-page-experience">
      {/* Top Floating Header Card */}
      <div className="cal-page-header invitations-page-top-header">
        <div className="cal-header-left">
          <div className="cal-title-row">
            <span className="cal-header-icon-box invitations-icon-box">
              <MailIcon size={24} />
            </span>
            <h1 className="cal-header-title">Project Invitations</h1>
          </div>
          <p className="cal-header-subtitle">
            Review and respond to invitations to collaborate on development projects.
          </p>
        </div>

        {/* Atmosphere Quote & Illustration Artwork */}
        <InvitationsHeaderAtmosphere />
      </div>

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

      {/* Main Section Card */}
      <div className="cal-card-primary invitations-card-primary">
        {/* Toolbar Row: Filter Pills + Sort Dropdown */}
        <div className="invitations-controls-toolbar">
          {/* Pill Tabs */}
          <div className="invitations-filter-pills-wrap">
            {filterTabs.map((tab) => (
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

          {/* Right Toolbar Actions */}
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

        {/* Content Area: Loading / Empty State / Cards Grid */}
        {loading ? (
          <div className="workspace-loading-state" style={{ padding: '4rem 1.5rem' }}>
            <div className="btn-spinner" />
            <p>Loading invitations...</p>
          </div>
        ) : displayedInvitations.length === 0 ? (
          <div className="invitations-empty-state">
            <div className="invitations-empty-illustration-wrap">
              {/* Soft mint circle with cloud and envelope */}
              <div className="invitations-empty-mint-circle">
                <MailIcon size={36} />
                <div className="invitations-empty-sparkle-dash" />
              </div>
            </div>

            <h3 className="invitations-empty-headline">
              {statusFilter === 'ALL'
                ? 'No invitations found'
                : `No ${statusFilter.toLowerCase()} invitations`}
            </h3>

            <p className="invitations-empty-desc">
              {statusFilter === 'PENDING'
                ? "You don't have any pending invitations right now. When a project administrator invites you by email, it will appear here."
                : `No invitations with status "${statusFilter.toLowerCase()}".`}
            </p>

            <button
              type="button"
              className="invitations-btn-back"
              onClick={() => navigate('/app/dashboard')}
            >
              <span>← Back to Dashboard</span>
            </button>
          </div>
        ) : (
          <div className="invitations-cards-grid">
            {displayedInvitations.map((inv) => {
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
                    <div className="invitation-message-quote">"{inv.message}"</div>
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
                          onClick={() => handleDecline(inv.id)}
                        >
                          Decline
                        </button>
                        <button
                          type="button"
                          className="invitation-btn-accept"
                          disabled={processingId === inv.id}
                          onClick={() => handleAccept(inv.id)}
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
    </div>
  );
};
