import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, Link } from '../../router/Router';
import { useAuth } from '../../context/AuthContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { projectsApi, type Project, type ProjectCompletionStatusResponse } from '../../api/projects.api';
import { workApi, type WorkItem, type WorkStats } from '../../api/work.api';
import { activityApi, type ActivityItem } from '../../api/activity.api';
import { CreateWorkItemModal } from '../../components/workspace/CreateWorkItemModal';
import { WorkItemDetailsModal } from '../../components/workspace/WorkItemDetailsModal';
import { InviteMemberModal } from '../../components/workspace/InviteMemberModal';
import { ProjectSettingsModal } from '../../components/workspace/ProjectSettingsModal';
import { LearnMoreModal } from '../../components/modals/LearnMoreModal';
import { Modal } from '../../components/ui/Modal';
import { ProjectWorkspaceHeader } from '../../components/workspace/ProjectWorkspaceHeader';
import { ApplicationCategoryIcon } from '../../components/common/ApplicationCategoryIcon';
import {
  LayersIcon,
  CheckSquareIcon,
  ClockIcon,
  PlusIcon,
  AlertCircleIcon,
  UsersIcon,
  CircleDotIcon,
  PlayIcon,
  CheckCircleIcon,
  CalendarIcon,
  FileTextIcon,
  SettingsIcon,
} from '../../components/ui/Icons';
import { Button } from '../../components/ui/Button';

interface ProjectOverviewPageProps {
  project?: Project | null;
  hideHeader?: boolean;
  onOpenSettingsModal?: () => void;
  onOpenCreateWorkModal?: () => void;
  refreshTrigger?: any;
}

export const ProjectOverviewPage: React.FC<ProjectOverviewPageProps> = ({
  project: propProject,
  hideHeader,
  onOpenSettingsModal,
  onOpenCreateWorkModal,
  refreshTrigger,
}) => {
  const { path, navigate } = useRouter();

  // Extract projectId from path e.g. /app/projects/:projectId
  const projectId = path.split('/')[3];

  const [project, setProject] = useState<Project | null>(propProject || null);
  const [workItems, setWorkItems] = useState<WorkItem[]>([]);
  const [stats, setStats] = useState<WorkStats | null>(null);
  const [recentActivities, setRecentActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals & UI toggles
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [learnMoreOpen, setLearnMoreOpen] = useState(false);
  const [tipDismissed, setTipDismissed] = useState(false);
  const [selectedWorkItemId, setSelectedWorkItemId] = useState<string | null>(null);

  // Completion Section states
  const { user } = useAuth();
  const { activeWorkspace, activeRole } = useWorkspace();
  const [completionStatus, setCompletionStatus] = useState<ProjectCompletionStatusResponse | null>(null);
  const [isCompleting, setIsCompleting] = useState(false);
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);
  const [completionReasonModalOpen, setCompletionReasonModalOpen] = useState(false);
  const [completionReason, setCompletionReason] = useState('');
  const [completionError, setCompletionError] = useState<string | null>(null);
  const [completionSuccess, setCompletionSuccess] = useState<string | null>(null);

  const isWsOwner = Boolean(
    activeRole === 'OWNER' ||
    (activeRole as string)?.toUpperCase() === 'OWNER' ||
    activeWorkspace?.isOwner ||
    (activeWorkspace?.ownerId && user?.id && activeWorkspace.ownerId === user.id)
  );
  const isWsAdmin = Boolean(
    activeRole === 'WORKSPACE_ADMIN' ||
    (activeRole as string)?.toUpperCase() === 'WORKSPACE_ADMIN' ||
    (activeRole as string)?.toUpperCase() === 'ADMIN' ||
    activeWorkspace?.userRole === 'WORKSPACE_ADMIN' ||
    (activeWorkspace?.userRole as string)?.toUpperCase() === 'WORKSPACE_ADMIN' ||
    (activeWorkspace as any)?.role === 'WORKSPACE_ADMIN'
  );
  const isWsLeader = isWsOwner || isWsAdmin;
  const isProjectAdmin = Boolean(
    isWsLeader ||
    project?.userRole === 'PROJECT_ADMIN' ||
    (project?.createdById && user?.id && project.createdById === user.id)
  );

  const canDirectlyComplete = useMemo(() => {
    if (isWsOwner) return true;
    if (isWsAdmin) {
      const perms = activeWorkspace?.adminPermissions;
      if (perms?.workspaceAdmin?.canDirectlyCompleteProject !== undefined) {
        return Boolean(perms.workspaceAdmin.canDirectlyCompleteProject);
      }
      if (perms?.canDirectlyCompleteProject !== undefined) {
        return Boolean(perms.canDirectlyCompleteProject);
      }
      return true;
    }
    return false;
  }, [isWsOwner, isWsAdmin, activeWorkspace]);

  const canRequestComplete = useMemo(() => {
    if (canDirectlyComplete) return false;
    if (isWsAdmin) return true;
    if (isProjectAdmin) {
      const perms = activeWorkspace?.adminPermissions;
      if (perms?.projectAdmin?.canRequestProjectCompletion !== undefined) {
        return Boolean(perms.projectAdmin.canRequestProjectCompletion);
      }
      return true;
    }
    return false;
  }, [canDirectlyComplete, isWsAdmin, isProjectAdmin, activeWorkspace]);

  const pendingRequest = completionStatus?.pendingRequest;
  const isCompleted = project?.status === 'COMPLETED';

  const handleOpenSettings = () => {
    if (onOpenSettingsModal) {
      onOpenSettingsModal();
    } else {
      setSettingsModalOpen(true);
    }
  };

  const handleOpenCreateModal = () => {
    if (onOpenCreateWorkModal) {
      onOpenCreateWorkModal();
    } else {
      setCreateModalOpen(true);
    }
  };

  const formatTimeAgo = (dateString?: string) => {
    if (!dateString) return 'recently';
    const date = new Date(dateString);
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
    if (diffInDays === 0) return 'today';
    if (diffInDays === 1) return 'yesterday';
    if (diffInDays < 30) return `${diffInDays} days ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const renderWorkItemTypeBadge = (type: string) => {
    const t = (type || 'TASK').toUpperCase();
    switch (t) {
      case 'BUG':
        return <span className="po-type-badge bug">BUG</span>;
      case 'IMPROVEMENT':
        return <span className="po-type-badge improvement">IMPROVEMENT</span>;
      case 'FEATURE':
        return <span className="po-type-badge feature">FEATURE</span>;
      default:
        return <span className="po-type-badge task">TASK</span>;
    }
  };

  const renderWorkItemStatusBadge = (status: string) => {
    const s = (status || 'TODO').toUpperCase();
    switch (s) {
      case 'BLOCKED':
        return (
          <span className="po-status-badge blocked">
            <AlertCircleIcon size={12} />
            <span>Canceled</span>
          </span>
        );
      case 'IN_PROGRESS':
        return (
          <span className="po-status-badge in-progress">
            <PlayIcon size={11} />
            <span>In Progress</span>
          </span>
        );
      case 'COMPLETED':
      case 'DONE':
        return (
          <span className="po-status-badge completed">
            <CheckCircleIcon size={12} />
            <span>Completed</span>
          </span>
        );
      default:
        return (
          <span className="po-status-badge todo">
            <CircleDotIcon size={12} />
            <span>To Do</span>
          </span>
        );
    }
  };

  const timelineStats = useMemo(() => {
    const now = new Date();
    // Normalize to midnight for accurate day calculations
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const startDateRaw = project?.startDate || project?.createdAt;
    const startDateObj = startDateRaw ? new Date(startDateRaw) : todayMidnight;
    const startMidnight = new Date(startDateObj.getFullYear(), startDateObj.getMonth(), startDateObj.getDate());

    const hasEndDate = Boolean(project?.endDate);
    const endDateObj = hasEndDate ? new Date(project!.endDate!) : null;
    const endMidnight = endDateObj
      ? new Date(endDateObj.getFullYear(), endDateObj.getMonth(), endDateObj.getDate())
      : null;

    if (!endMidnight) {
      const diffSinceStart = Math.max(0, Math.floor((todayMidnight.getTime() - startMidnight.getTime()) / (1000 * 60 * 60 * 24)));
      const taskProgress = stats?.progress || 0;
      return {
        hasEndDate: false,
        days: diffSinceStart,
        text: diffSinceStart === 0 ? 'Started today' : `${diffSinceStart} day${diffSinceStart === 1 ? '' : 's'} active`,
        subtitle: taskProgress > 0 ? `${taskProgress}% tasks completed` : "Keep going! You're on track.",
        onTrack: true,
        percent: taskProgress,
        statusType: 'on-track' as const,
        startDateFormatted: startMidnight.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        endDateFormatted: 'Open Timeline',
        startLabel: `${startMidnight.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} Start`,
        targetLabel: 'Ongoing',
      };
    }

    const totalDurationMs = Math.max(1000 * 60 * 60 * 24, endMidnight.getTime() - startMidnight.getTime());
    const elapsedMs = todayMidnight.getTime() - startMidnight.getTime();
    const percent = Math.min(100, Math.max(0, Math.round((elapsedMs / totalDurationMs) * 100)));

    const diffToTargetDays = Math.round((endMidnight.getTime() - todayMidnight.getTime()) / (1000 * 60 * 60 * 24));

    let text = '';
    let subtitle = '';
    let onTrack = true;
    let statusType: 'on-track' | 'due-today' | 'overdue' = 'on-track';

    if (diffToTargetDays < 0) {
      const overdueDays = Math.abs(diffToTargetDays);
      text = `${overdueDays} day${overdueDays === 1 ? '' : 's'} overdue`;
      subtitle = 'Target deadline has passed.';
      onTrack = false;
      statusType = 'overdue';
    } else if (diffToTargetDays === 0) {
      text = 'Due today';
      subtitle = 'Final day of target schedule.';
      onTrack = true;
      statusType = 'due-today';
    } else {
      text = `${diffToTargetDays} day${diffToTargetDays === 1 ? '' : 's'} left`;
      subtitle = "Keep going! You're on track.";
      onTrack = true;
      statusType = 'on-track';
    }

    return {
      hasEndDate: true,
      days: Math.abs(diffToTargetDays),
      text,
      subtitle,
      onTrack,
      percent,
      statusType,
      startDateFormatted: startMidnight.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      endDateFormatted: endMidnight.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      startLabel: `${startMidnight.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} Start`,
      targetLabel: `${endMidnight.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} Target`,
    };
  }, [project?.startDate, project?.createdAt, project?.endDate, stats?.progress]);

  useEffect(() => {
    if (propProject) {
      setProject(propProject);
    }
  }, [propProject]);

  const loadData = useCallback(async (forceProjectRefresh = false) => {
    if (!projectId) return;
    setLoading(true);
    setError(null);

    try {
      const needsProject = forceProjectRefresh || (!propProject && !project);
      const [projRes, workRes, actRes, compRes] = await Promise.all([
        needsProject ? projectsApi.getProjectById(projectId, activeWorkspace?.id) : Promise.resolve(null),
        workApi.getProjectWorkItems(projectId),
        activityApi.getProjectActivities(projectId, { limit: 8 }),
        typeof projectsApi.getCompletionStatus === 'function'
          ? projectsApi.getCompletionStatus(projectId, activeWorkspace?.id).catch(() => null)
          : Promise.resolve(null),
      ]);

      if (projRes && projRes.success && projRes.data?.project) {
        setProject(projRes.data.project);
      }
      if (workRes.success && workRes.data) {
        setWorkItems(workRes.data.workItems);
        setStats(workRes.data.stats);
      }
      if (actRes.success && actRes.data) {
        setRecentActivities(actRes.data.activities);
      }
      if (compRes && compRes.success && compRes.data) {
        setCompletionStatus(compRes.data);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load project');
    } finally {
      setLoading(false);
    }
  }, [projectId, propProject, project, activeWorkspace?.id]);

  useEffect(() => {
    loadData(Boolean(refreshTrigger && refreshTrigger > 0));
  }, [projectId, refreshTrigger, loadData]);

  const handleWorkItemCreated = (newItem: WorkItem) => {
    setWorkItems((prev) => [newItem, ...prev]);
    loadData();
  };

  const handleWorkItemUpdated = () => {
    loadData();
  };

  const handleWorkItemDeleted = (deletedId: string) => {
    setWorkItems((prev) => prev.filter((i) => i.id !== deletedId));
    loadData();
  };

  const handleDirectComplete = async () => {
    if (!project) return;
    setIsCompleting(true);
    setCompletionError(null);
    setCompletionSuccess(null);
    try {
      const res = await projectsApi.completeProject(project.id, undefined, activeWorkspace?.id);
      if (res.success) {
        setCompletionSuccess('Project marked as completed successfully and moved to the Completed section.');
        await loadData(true);
      }
    } catch (err: any) {
      setCompletionError(err.message || 'Failed to complete project');
    } finally {
      setIsCompleting(false);
    }
  };

  const handleRequestComplete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project) return;
    setIsSubmittingRequest(true);
    setCompletionError(null);
    setCompletionSuccess(null);
    try {
      const res = await projectsApi.completeProject(project.id, completionReason, activeWorkspace?.id);
      if (res.success) {
        setCompletionReasonModalOpen(false);
        setCompletionReason('');
        setCompletionSuccess('Completion request submitted to Workspace Owner and Workspace Admin.');
        await loadData(true);
      }
    } catch (err: any) {
      setCompletionError(err.message || 'Failed to submit completion request');
    } finally {
      setIsSubmittingRequest(false);
    }
  };

  const handleApproveRequest = async (requestId: string) => {
    if (!activeWorkspace?.id) return;
    setIsCompleting(true);
    setCompletionError(null);
    setCompletionSuccess(null);
    try {
      const res = await projectsApi.approveCompletionRequest(activeWorkspace.id, requestId);
      if (res.success) {
        setCompletionSuccess('Project completion approved successfully. Project moved to Completed.');
        await loadData(true);
      }
    } catch (err: any) {
      setCompletionError(err.message || 'Failed to approve completion request');
    } finally {
      setIsCompleting(false);
    }
  };

  const handleDeclineRequest = async (requestId: string) => {
    if (!activeWorkspace?.id) return;
    const reason = window.prompt('Reason for declining completion request (optional):');
    setIsCompleting(true);
    setCompletionError(null);
    setCompletionSuccess(null);
    try {
      const res = await projectsApi.rejectCompletionRequest(activeWorkspace.id, requestId, reason || undefined);
      if (res.success) {
        setCompletionSuccess('Completion request declined. Project remains in active projects.');
        await loadData(true);
      }
    } catch (err: any) {
      setCompletionError(err.message || 'Failed to decline completion request');
    } finally {
      setIsCompleting(false);
    }
  };

  const handleCancelRequest = async (requestId: string) => {
    if (!activeWorkspace?.id) return;
    setIsCompleting(true);
    setCompletionError(null);
    setCompletionSuccess(null);
    try {
      const res = await projectsApi.cancelCompletionRequest(activeWorkspace.id, requestId);
      if (res.success) {
        setCompletionSuccess('Completion request cancelled.');
        await loadData(true);
      }
    } catch (err: any) {
      setCompletionError(err.message || 'Failed to cancel completion request');
    } finally {
      setIsCompleting(false);
    }
  };

  const handleReactivate = async () => {
    if (!project) return;
    setIsCompleting(true);
    setCompletionError(null);
    setCompletionSuccess(null);
    try {
      const res = await projectsApi.reactivateProject(project.id, activeWorkspace?.id);
      if (res.success) {
        setCompletionSuccess('Project reactivated successfully and returned to Active projects.');
        await loadData(true);
      }
    } catch (err: any) {
      setCompletionError(err.message || 'Failed to reactivate project');
    } finally {
      setIsCompleting(false);
    }
  };

  if (loading && !project) {
    return (
      <div className="workspace-loading-state" style={{ minHeight: '60vh' }}>
        <div className="btn-spinner" />
        <p>Loading project workspace...</p>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="workspace-error-state" style={{ minHeight: '60vh' }}>
        <AlertCircleIcon size={32} />
        <h2>Unable to load project</h2>
        <p>{error || 'Project not found or you do not have permission to view it.'}</p>
        <Button variant="primary" onClick={() => navigate('/app/projects')}>
          Back to Projects
        </Button>
      </div>
    );
  }

  const displayItems = workItems;
  const displayActivities = recentActivities;

  return (
    <div className={hideHeader ? 'po-overview-embedded' : 'project-workspace-page po-overview-wrapper'}>
      {/* If standalone (not embedded in ProjectWorkspaceShell), render unified header matching Image 2 */}
      {!hideHeader && project && (
        <ProjectWorkspaceHeader
          project={project}
          currentTab="overview"
          showHeroCard={true}
          onOpenCreateWorkModal={handleOpenCreateModal}
          onOpenSettingsModal={handleOpenSettings}
          onOpenInviteModal={isProjectAdmin ? () => setInviteModalOpen(true) : undefined}
        />
      )}

      {/* Main 2-Column Overview Content Grid matching reference */}
      <div className="project-overview-content-grid">
        {/* ============================================================ */}
        {/* LEFT COLUMN: Metrics, Recent Work, Split Row, Tip */}
        {/* ============================================================ */}
        <div className="project-overview-main-col">
          {/* 1. 4 Metric Cards Row */}
          <div className="po-metrics-row-grid">
            {/* Total Work Items */}
            <div className="po-metric-card">
              <div className="po-metric-header-row">
                <div className="po-metric-icon-box purple">
                  <LayersIcon size={18} />
                </div>
                <div className="po-metric-main-num">{stats?.total ?? workItems.length}</div>
                <div className="po-metric-sparkline-box purple">
                  <svg width="22" height="18" viewBox="0 0 22 18" fill="none">
                    <rect x="2" y="10" width="3" height="8" rx="1.5" fill="#A855F7" />
                    <rect x="8" y="5" width="3" height="13" rx="1.5" fill="#A855F7" />
                    <rect x="14" y="2" width="3" height="16" rx="1.5" fill="#A855F7" />
                  </svg>
                </div>
              </div>
              <span className="po-metric-title-label">Total Tasks</span>
            </div>

            {/* In Progress */}
            <div className="po-metric-card">
              <div className="po-metric-header-row">
                <div className="po-metric-icon-box green">
                  <ClockIcon size={18} />
                </div>
                <div className="po-metric-main-num">{stats?.inProgress ?? 0}</div>
                <div className="po-metric-sparkline-box green">
                  <svg width="34" height="16" viewBox="0 0 34 16" fill="none">
                    <path
                      d="M2 14C8 14 12 4 18 8C24 12 28 2 32 3"
                      stroke="#16A34A"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              </div>
              <span className="po-metric-title-label">In Progress</span>
            </div>

            {/* Completed */}
            <div className="po-metric-card">
              <div className="po-metric-header-row">
                <div className="po-metric-icon-box blue">
                  <CheckSquareIcon size={18} />
                </div>
                <div className="po-metric-main-num">{stats?.completed ?? 0}</div>
                <div className="po-metric-pct-badge">
                  {stats?.completionPercentage ?? (stats?.total ? Math.round((stats.completed / stats.total) * 100) : 0)}%
                </div>
              </div>
              <span className="po-metric-title-label">Completed</span>
            </div>

            {/* Overdue */}
            <div className="po-metric-card">
              <div className="po-metric-header-row">
                <div className="po-metric-icon-box red">
                  <AlertCircleIcon size={18} />
                </div>
                <div className="po-metric-main-num red">{stats?.overdue ?? 0}</div>
                <div className="po-metric-arrow-red">↗</div>
              </div>
              <span className="po-metric-title-label red">Overdue</span>
            </div>
          </div>

          {/* 4. Recent Tasks Card */}
          <div className="po-clean-card po-recent-work-card">
            <div className="po-card-head-row">
              <div className="po-card-title-flex">
                <CalendarIcon size={18} className="po-card-header-icon" />
                <h3 className="po-card-title-text">Recent Tasks</h3>
              </div>
              <Link to={`/app/projects/${project.id}/board`} className="po-card-view-all-link">
                <span>View all</span>
                <span>→</span>
              </Link>
            </div>

            <div className="po-work-items-list-body">
              {displayItems.length === 0 ? (
                <div style={{ padding: '36px 16px', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>
                  No tasks created yet. Click &quot;Add Task&quot; above to create your first task.
                </div>
              ) : (
                displayItems.slice(0, 5).map((item, idx) => (
                <div
                  key={item.id}
                  className="po-work-item-row"
                  onClick={() => setSelectedWorkItemId(item.id)}
                >
                  {/* Drag Handle */}
                  <span className="po-drag-dots">⠿</span>

                  {/* Type Badge */}
                  {renderWorkItemTypeBadge(item.type)}

                  {/* Content Column */}
                  <div className="po-work-item-info-col">
                    <h4 className="po-work-item-title">{item.title}</h4>
                    <span className="po-work-item-metadata">
                      #{(item as any).key || (project.key ? `${project.key}-${idx + 1}` : `TASK-${idx + 1}`)} • Opened {formatTimeAgo(item.createdAt)} by {item.createdBy?.fullName || item.createdBy?.username || 'Team member'}
                    </span>
                  </div>

                  {/* Status Pill */}
                  {renderWorkItemStatusBadge(item.status)}

                  {/* Assignee Avatar */}
                  <div className="po-work-item-assignee-avatar">
                    {item.assignedTo?.avatarUrl ? (
                      <img src={item.assignedTo.avatarUrl} alt="" className="po-assignee-img" />
                    ) : (
                      <span>{(item.assignedTo?.fullName || item.assignedTo?.username || 'a')[0].toLowerCase()}</span>
                    )}
                  </div>

                  {/* Action Menu */}
                  <button
                    type="button"
                    className="po-work-item-more-dots-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedWorkItemId(item.id);
                    }}
                    title="Item options"
                  >
                    •••
                  </button>
                </div>
              ))
              )}
            </div>
          </div>

          {/* 5. Bottom 2-Card Split Row: Project Description & Quick Actions */}
          <div className="po-bottom-split-cards-row">
            {/* Project Description Card */}
            <div className="po-clean-card po-description-card">
              <div className="po-card-head-row">
                <div className="po-card-title-flex">
                  <FileTextIcon size={16} className="po-card-header-icon" />
                  <h3 className="po-card-title-text">Project Description</h3>
                </div>
                <button
                  type="button"
                  className="po-edit-desc-btn"
                  onClick={handleOpenSettings}
                  title="Edit Project Details"
                >
                  <span>✏ Edit</span>
                </button>
              </div>

              <div className="po-card-content-body">
                <p className="po-desc-paragraph">
                  {project.description || 'No project description provided.'}
                </p>

                <div className="po-desc-meta-pills-row">
                  <div className="po-desc-meta-item">
                    <span className="po-desc-meta-label">Category</span>
                    <div className="po-desc-meta-pill cat-pill-accent">
                      <ApplicationCategoryIcon category={project.category} size={14} className="po-meta-icon" />
                      <span>{project.category || 'General'}</span>
                    </div>
                  </div>

                  <div className="po-desc-meta-item">
                    <span className="po-desc-meta-label">Target End Date</span>
                    <div className="po-desc-meta-pill date-pill-accent">
                      <CalendarIcon size={14} className="po-meta-icon" />
                      <span>
                        {project.endDate
                          ? new Date(project.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                          : 'No deadline set'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Actions Card */}
            <div className="po-clean-card po-quick-actions-card">
              <div className="po-card-head-row">
                <div className="po-card-title-flex">
                  <CircleDotIcon size={16} className="po-card-header-icon" />
                  <h3 className="po-card-title-text">Quick Actions</h3>
                </div>
              </div>

              <div className="po-card-content-body">
                <div className="po-quick-actions-4grid">
                  <button
                    type="button"
                    className="po-quick-action-square-btn qa-purple"
                    onClick={handleOpenCreateModal}
                  >
                    <div className="po-qa-icon-wrap">
                      <PlusIcon size={16} />
                    </div>
                    <span className="po-qa-btn-title">Add Task</span>
                  </button>

                  {isProjectAdmin && (
                    <button
                      type="button"
                      className="po-quick-action-square-btn qa-green"
                      onClick={() => setInviteModalOpen(true)}
                    >
                      <div className="po-qa-icon-wrap">
                        <UsersIcon size={16} />
                      </div>
                      <span className="po-qa-btn-title">Add Member</span>
                    </button>
                  )}

                  <button
                    type="button"
                    className="po-quick-action-square-btn qa-blue"
                    onClick={() => navigate(`/app/projects/${project.id}/board`)}
                  >
                    <div className="po-qa-icon-wrap">
                      <CheckSquareIcon size={16} />
                    </div>
                    <span className="po-qa-btn-title">View Board</span>
                  </button>

                  <button
                    type="button"
                    className="po-quick-action-square-btn qa-amber"
                    onClick={handleOpenSettings}
                  >
                    <div className="po-qa-icon-wrap">
                      <SettingsIcon size={16} />
                    </div>
                    <span className="po-qa-btn-title">Project Settings</span>
                  </button>
                </div>

                <div style={{ fontSize: '0.75rem', color: '#94A3B8', marginTop: 'auto', paddingTop: '0.35rem' }}>
                  Quickly manage tasks, collaborators, kanban board, and project settings.
                </div>
              </div>
            </div>
          </div>

          {/* 6. Complete Project Section Card (Moved below Project Description & Quick Actions) */}
          <div className="po-clean-card po-completion-main-card">
            <div className="po-card-head-row">
              <div className="po-card-title-flex">
                <CheckSquareIcon size={17} className="po-card-header-icon" />
                <h3 className="po-card-title-text">Complete Project</h3>
              </div>
              <span
                className={`proj-status-pill status-${(project.status || 'ACTIVE').toLowerCase()}`}
                style={
                  project.status === 'ARCHIVED'
                    ? { background: '#FEF3C7', color: '#B45309', border: '1px solid #FCD34D' }
                    : undefined
                }
              >
                {project.status === 'COMPLETED'
                  ? 'Completed'
                  : project.status === 'ARCHIVED'
                  ? 'Archived'
                  : pendingRequest
                  ? 'Request Pending'
                  : 'Active'}
              </span>
            </div>

            <div className="po-card-content-body">
              {completionSuccess && (
                <div style={{ padding: '0.55rem 0.85rem', background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: '8px', color: '#065F46', fontSize: '0.8125rem' }}>
                  {completionSuccess}
                </div>
              )}
              {completionError && (
                <div style={{ padding: '0.55rem 0.85rem', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', color: '#991B1B', fontSize: '0.8125rem' }}>
                  {completionError}
                </div>
              )}

              {isCompleted ? (
                /* Project is already COMPLETED */
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '8px', padding: '0.85rem 1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <CheckCircleIcon size={20} style={{ color: '#059669', flexShrink: 0 }} />
                    <div>
                      <div style={{ color: '#166534', fontWeight: 600, fontSize: '0.875rem' }}>
                        This project is marked as Completed
                      </div>
                      <div style={{ color: '#4B5563', fontSize: '0.75rem', marginTop: '0.15rem' }}>
                        All tasks and deliverables are archived as completed. Project is in the Completed section.
                      </div>
                    </div>
                  </div>
                  {(isWsLeader || isProjectAdmin) && (
                    <button
                      type="button"
                      style={{
                        padding: '0.45rem 0.9rem',
                        fontSize: '0.8125rem',
                        fontWeight: 600,
                        borderRadius: '6px',
                        border: '1px solid #CBD5E1',
                        background: '#FFFFFF',
                        color: '#334155',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                      disabled={isCompleting}
                      onClick={handleReactivate}
                    >
                      {isCompleting ? 'Reactivating...' : 'Reopen / Mark as Active'}
                    </button>
                  )}
                </div>
              ) : pendingRequest ? (
                /* Completion Request is PENDING */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div style={{ background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: '8px', padding: '0.85rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#B45309', fontWeight: 700, fontSize: '0.84375rem' }}>
                        <ClockIcon size={15} />
                        <span>Completion Request Pending Review</span>
                      </div>
                      <div style={{ fontSize: '0.78125rem', color: '#64748B', marginTop: '0.2rem' }}>
                        Requested by <strong>{pendingRequest.requestedByName}</strong> • {new Date(pendingRequest.requestedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </div>
                      {pendingRequest.reason && (
                        <div style={{ marginTop: '0.35rem', fontSize: '0.8125rem', fontStyle: 'italic', color: '#475569' }}>
                          &quot;{pendingRequest.reason}&quot;
                        </div>
                      )}
                    </div>

                    {isWsLeader ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <button
                          type="button"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            padding: '0.5rem 0.85rem',
                            fontSize: '0.8125rem',
                            fontWeight: 600,
                            borderRadius: '6px',
                            border: 'none',
                            background: '#059669',
                            color: '#FFFFFF',
                            cursor: 'pointer',
                          }}
                          disabled={isCompleting}
                          onClick={() => handleApproveRequest(pendingRequest.id)}
                        >
                          <CheckSquareIcon size={14} />
                          <span>{isCompleting ? 'Approving...' : 'Approve & Complete'}</span>
                        </button>
                        <button
                          type="button"
                          style={{
                            padding: '0.5rem 0.85rem',
                            fontSize: '0.8125rem',
                            fontWeight: 600,
                            borderRadius: '6px',
                            border: '1px solid #CBD5E1',
                            background: '#FFFFFF',
                            color: '#DC2626',
                            cursor: 'pointer',
                          }}
                          disabled={isCompleting}
                          onClick={() => handleDeclineRequest(pendingRequest.id)}
                        >
                          Decline
                        </button>
                      </div>
                    ) : (
                      (pendingRequest.requestedById === user?.id || isProjectAdmin) && (
                        <button
                          type="button"
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#DC2626',
                            fontSize: '0.78125rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            textDecoration: 'underline',
                          }}
                          onClick={() => handleCancelRequest(pendingRequest.id)}
                        >
                          Cancel Request
                        </button>
                      )
                    )}
                  </div>
                </div>
              ) : (
                /* Project is ACTIVE with NO pending request */
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
                  <div style={{ maxWidth: '620px' }}>
                    <p style={{ margin: 0, fontSize: '0.84375rem', color: '#475569', lineHeight: '1.45' }}>
                      Mark this project as finished when all milestones, tasks, and deliverables are complete.
                    </p>
                    <span style={{ fontSize: '0.71875rem', color: '#94A3B8', marginTop: '0.25rem', display: 'block' }}>
                      {isWsLeader
                        ? (isWsOwner
                            ? 'As workspace owner, your action immediately moves this project to the Completed section.'
                            : 'As workspace administrator, your action immediately moves this project to the Completed section.')
                        : isProjectAdmin
                        ? 'Sends a completion request to Workspace Owner and Workspace Admin for approval.'
                        : 'Only Project Administrators or Workspace Administrators can complete this project.'}
                    </span>
                  </div>

                  <div>
                    {canDirectlyComplete ? (
                      <button
                        type="button"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          padding: '0.6rem 1.15rem',
                          background: '#059669',
                          color: '#FFFFFF',
                          border: 'none',
                          borderRadius: '8px',
                          fontSize: '0.84375rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                          whiteSpace: 'nowrap',
                        }}
                        disabled={isCompleting}
                        onClick={handleDirectComplete}
                      >
                        <CheckSquareIcon size={15} />
                        <span>{isCompleting ? 'Completing...' : 'Mark Project as Complete'}</span>
                      </button>
                    ) : canRequestComplete ? (
                      <button
                        type="button"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          padding: '0.6rem 1.15rem',
                          background: '#0F172A',
                          color: '#FFFFFF',
                          border: 'none',
                          borderRadius: '8px',
                          fontSize: '0.84375rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                        }}
                        disabled={isCompleting}
                        onClick={() => setCompletionReasonModalOpen(true)}
                      >
                        <CheckSquareIcon size={15} />
                        <span>Request Project Completion</span>
                      </button>
                    ) : null}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 7. Tip Banner */}
          {!tipDismissed && (
            <div className="po-tip-banner-container">
              <div className="po-tip-bulb-col">💡</div>
              <div className="po-tip-text-col">
                <h4 className="po-tip-head-title">Tip: Keep your project organized</h4>
                <p className="po-tip-sub-desc">
                  Break down large goals into smaller tasks and assign them to your team.
                </p>
              </div>
              <div className="po-tip-actions-right">
                <button
                  type="button"
                  className="po-tip-practices-btn"
                  onClick={() => setLearnMoreOpen(true)}
                >
                  <span>View Best Practices</span>
                  <span>↗</span>
                </button>
                <button
                  type="button"
                  className="po-tip-close-x-btn"
                  onClick={() => setTipDismissed(true)}
                  title="Dismiss tip"
                >
                  ✕
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ============================================================ */}
        {/* RIGHT COLUMN: Timeline, Team Members, Activity Feed */}
        {/* ============================================================ */}
        <div className="project-overview-sidebar-col">
          {/* 1. Project Timeline Card */}
          <div className="po-clean-card po-timeline-sidebar-card">
            <div className="po-card-head-row">
              <div className="po-card-title-flex">
                <span className="po-card-header-icon" style={{ fontSize: '1rem' }}>📐</span>
                <h3 className="po-card-title-text">Project Timeline</h3>
              </div>
            </div>

            <div className="po-card-content-body">
              <div className="po-timeline-date-range-text">
                {timelineStats.startDateFormatted} → {timelineStats.endDateFormatted}
              </div>

              {/* Progress Slider Track with Marker */}
              <div className="po-timeline-track-wrap">
                <div className="po-timeline-bar-bg">
                  <div
                    className={`po-timeline-bar-fill ${timelineStats.statusType === 'overdue' ? 'fill-overdue' : ''}`}
                    style={{ width: `${timelineStats.percent}%` }}
                  />
                  <div
                    className={`po-timeline-pin-circle ${timelineStats.statusType === 'overdue' ? 'pin-overdue' : ''}`}
                    style={{ left: `${timelineStats.percent}%` }}
                  >
                    <span>|</span>
                  </div>
                </div>
                <div className="po-timeline-dates-labels">
                  <span className="po-tl-start">
                    {timelineStats.startLabel}
                  </span>
                  <span className="po-tl-target">
                    {timelineStats.targetLabel}
                  </span>
                </div>
              </div>

              {/* Inner Status Box with Pulsing Dot */}
              <div className={`po-timeline-status-box status-${timelineStats.statusType}`}>
                <div className="po-tl-status-left">
                  <CalendarIcon
                    size={18}
                    className={timelineStats.statusType === 'overdue' ? 'po-tl-calendar-red' : 'po-tl-calendar-green'}
                  />
                  <div className="po-tl-status-texts">
                    <h5 className="po-tl-status-title">{timelineStats.text}</h5>
                    <span className="po-tl-status-subtitle">{timelineStats.subtitle}</span>
                  </div>
                </div>
                <span className={timelineStats.statusType === 'overdue' ? 'po-tl-red-dot' : 'po-tl-green-pulsing-dot'} />
              </div>
            </div>
          </div>

          {/* 3. Team Members Card */}
          <div className="po-clean-card po-team-sidebar-card">
            <div className="po-card-head-row">
              <div className="po-card-title-flex">
                <UsersIcon size={17} className="po-card-header-icon" />
                <h3 className="po-card-title-text">
                  Team Members ({project.members?.length || 1})
                </h3>
              </div>
              <Link to={`/app/projects/${project.id}/members`} className="po-card-view-all-link">
                Manage
              </Link>
            </div>

            <div className="po-card-content-body">
              <div className="po-team-members-vertical-list">
                {project.members && project.members.length > 0 ? (
                  project.members.map((m) => (
                    <div key={m.id} className="po-member-list-item">
                      <div className="po-member-avatar-box">
                        {m.user?.avatarUrl ? (
                          <img src={m.user.avatarUrl} alt="" className="po-member-avatar-img" />
                        ) : (
                          <div className="po-member-circle-avatar member-avatar-circle">
                            {(m.user?.fullName || m.user?.username || 'U')[0].toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className="po-member-names-col">
                        <span className="po-member-display-name">
                          {m.user?.fullName || m.user?.username || 'Team Member'}
                        </span>
                        <span className="po-member-username">@{m.user?.username || 'user'}</span>
                      </div>
                      <div className="po-member-role-group">
                        <span className={m.role === 'PROJECT_ADMIN' ? 'po-member-role-badge-dark' : 'po-member-role-badge-member'}>
                          {m.role === 'PROJECT_ADMIN' ? 'ADMIN' : 'MEMBER'}
                        </span>
                        <span className="po-member-active-green-dot" />
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{ padding: '16px', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>
                    No members yet.
                  </div>
                )}
              </div>

              {isProjectAdmin && (
                <button
                  type="button"
                  className="po-invite-members-pill-btn"
                  onClick={() => setInviteModalOpen(true)}
                >
                  + Add Members
                </button>
              )}
            </div>
          </div>

          {/* 4. Project Activity Card */}
          <div className="po-clean-card po-activity-sidebar-card">
            <div className="po-card-head-row">
              <div className="po-card-title-flex">
                <UsersIcon size={17} className="po-card-header-icon" />
                <h3 className="po-card-title-text">Project Activity</h3>
              </div>
              <Link to={`/app/projects/${project.id}/activity`} className="po-card-view-all-link">
                View all
              </Link>
            </div>

            <div className="po-card-content-body">
              {displayActivities.length === 0 ? (
                <div style={{ padding: '24px 16px', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>
                  No project activity recorded yet.
                </div>
              ) : (
                <div className="po-activity-timeline-feed">
                  {displayActivities.slice(0, 4).map((act, idx, arr) => (
                    <div key={act.id} className="po-activity-timeline-item">
                      <div className="po-activity-dot-rail">
                        <span className="po-activity-dot" />
                        {idx < arr.length - 1 && <span className="po-activity-rail-line" />}
                      </div>
                      <div className="po-activity-item-details">
                        <div className="po-activity-item-top">
                          <span className="po-activity-actor-name">
                            {act.actor?.fullName || act.actor?.username || 'Team Member'}
                          </span>
                          <span className="po-activity-item-timestamp">
                            {new Date(act.createdAt).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                        <span className="po-activity-action-desc">
                          {act.type === 'WORK_CREATED' && `created task "${act.workItem?.title || 'task'}"`}
                          {act.type === 'WORK_STATUS_CHANGED' && `updated a task`}
                          {act.type === 'WORK_COMPLETED' && `completed a task`}
                          {act.type === 'COMMENT_ADDED' && `commented on "${act.workItem?.title || 'task'}"`}
                          {act.type === 'PROJECT_CREATED' && `created the project`}
                          {!['WORK_CREATED', 'WORK_STATUS_CHANGED', 'WORK_COMPLETED', 'COMMENT_ADDED', 'PROJECT_CREATED'].includes(act.type) &&
                            `updated workspace`}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <CreateWorkItemModal
        project={project}
        isOpen={createModalOpen}
        lockProject={true}
        onClose={() => setCreateModalOpen(false)}
        onCreated={handleWorkItemCreated}
      />

      <InviteMemberModal
        project={project}
        isOpen={inviteModalOpen}
        onClose={() => setInviteModalOpen(false)}
        onInvited={() => loadData()}
      />

      <WorkItemDetailsModal
        project={project}
        workItemId={selectedWorkItemId}
        onClose={() => setSelectedWorkItemId(null)}
        onUpdated={handleWorkItemUpdated}
        onDeleted={handleWorkItemDeleted}
      />

      <ProjectSettingsModal
        project={project}
        isOpen={settingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
        onUpdated={(updated) => {
          setProject(updated);
          loadData();
        }}
        onDeleted={() => {
          navigate('/app/projects');
        }}
      />

      <LearnMoreModal
        isOpen={learnMoreOpen}
        onClose={() => setLearnMoreOpen(false)}
      />

      {/* Request Project Completion Modal */}
      <Modal
        isOpen={completionReasonModalOpen}
        onClose={() => !isSubmittingRequest && setCompletionReasonModalOpen(false)}
        title="Request Project Completion"
        maxWidth="md"
      >
        <form onSubmit={handleRequestComplete} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '0.5rem 0' }}>
          <div
            style={{
              backgroundColor: '#EFF6FF',
              border: '1px solid #BFDBFE',
              borderRadius: '8px',
              padding: '0.85rem',
              color: '#1E40AF',
              fontSize: '0.84375rem',
              lineHeight: '1.45',
            }}
          >
            <strong>Project Completion Review:</strong> As a Project Admin, your request to mark <strong>{project?.name}</strong> as completed will be sent to the Workspace Owner and Workspace Admin for approval.
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
            <label
              htmlFor="completionReason"
              style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#334155' }}
            >
              Completion Notes / Summary (Optional)
            </label>
            <textarea
              id="completionReason"
              rows={4}
              value={completionReason}
              onChange={(e) => setCompletionReason(e.target.value)}
              placeholder="Summarize key deliverables, milestones completed, or notes for workspace administrators..."
              style={{
                width: '100%',
                padding: '0.625rem 0.75rem',
                borderRadius: '8px',
                border: '1px solid #CBD5E1',
                fontSize: '0.875rem',
                fontFamily: 'inherit',
                color: '#0F172A',
                resize: 'vertical',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {completionError && (
            <div style={{ color: '#DC2626', fontSize: '0.8125rem' }}>
              {completionError}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
            <button
              type="button"
              onClick={() => setCompletionReasonModalOpen(false)}
              disabled={isSubmittingRequest}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '6px',
                border: '1px solid #CBD5E1',
                background: '#FFFFFF',
                color: '#475569',
                fontSize: '0.875rem',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmittingRequest}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.5rem 1.25rem',
                borderRadius: '6px',
                border: 'none',
                background: '#0F172A',
                color: '#FFFFFF',
                fontSize: '0.875rem',
                fontWeight: 600,
                cursor: isSubmittingRequest ? 'not-allowed' : 'pointer',
              }}
            >
              <CheckSquareIcon size={14} />
              <span>{isSubmittingRequest ? 'Submitting...' : 'Submit Request'}</span>
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default ProjectOverviewPage;
