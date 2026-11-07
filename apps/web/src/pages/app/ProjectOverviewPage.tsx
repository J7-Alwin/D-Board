import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, Link } from '../../router/Router';
import { useAuth } from '../../context/AuthContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { projectsApi, type Project, type ProjectCompletionStatusResponse, type ProjectMember } from '../../api/projects.api';
import { workspacesApi, type WorkspaceMemberItem } from '../../api/workspaces.api';
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
  ShieldIcon,
  CheckIcon,
  EditIcon,
  TagIcon,
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
  const [completionModalMode, setCompletionModalMode] = useState<'direct' | 'request'>('direct');
  const [autoResolveOpenTasks, setAutoResolveOpenTasks] = useState(true);
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

  const [workspaceMembers, setWorkspaceMembers] = useState<WorkspaceMemberItem[]>([]);

  const wsMembersMap = useMemo(() => {
    const map = new Map<string, { role: string; isOwner?: boolean }>();

    // 1. Seed from project.workspace?.members if present
    const rawWsMembers = (project as any)?.workspace?.members;
    if (Array.isArray(rawWsMembers)) {
      rawWsMembers.forEach((wm: any) => {
        if (wm?.userId) {
          map.set(wm.userId, { role: wm.role });
        }
      });
    }

    // 2. Overlay from workspaceMembers loaded via API
    workspaceMembers.forEach((wm) => {
      const uId = wm.userId || wm.user?.id;
      if (uId) {
        map.set(uId, { role: wm.role, isOwner: wm.isOwner });
      }
    });

    return map;
  }, [project, workspaceMembers]);

  const getMemberRoleTag = useCallback(
      (m: ProjectMember): { label: string; badgeClass: string } => {
        const memberUserId = m.userId || m.user?.id;

        // 1. Workspace Owner or Project Creator -> OWNER
        const wsOwnerId = activeWorkspace?.ownerId || (project as any)?.workspace?.ownerId;
        const wsMemberInfo = memberUserId ? wsMembersMap.get(memberUserId) : undefined;
        const isOwnerUser = Boolean(
          (wsOwnerId && memberUserId === wsOwnerId) ||
          (isWsOwner && memberUserId === user?.id) ||
          (project?.createdById && memberUserId === project.createdById) ||
          (m as any).isCreator ||
          (m as any).isOwner ||
          wsMemberInfo?.role === 'OWNER' ||
          wsMemberInfo?.isOwner
        );

        if (isOwnerUser) {
          return {
            label: 'OWNER',
            badgeClass: 'po-member-role-badge-owner',
          };
        }

        // 2. Project Admin or Workspace Admin -> ADMIN
        const isWsAdminUser = Boolean(
          wsMemberInfo?.role === 'WORKSPACE_ADMIN' ||
          (isWsAdmin && memberUserId === user?.id) ||
          (project as any)?.workspace?.members?.some(
            (wm: any) => wm?.userId === memberUserId && wm.role === 'WORKSPACE_ADMIN'
          )
        );
        const isAdminRole = m.role === 'PROJECT_ADMIN' || isWsAdminUser;

        if (isAdminRole) {
          return {
            label: 'ADMIN',
            badgeClass: 'po-member-role-badge-admin',
          };
      }

      // 3. Otherwise -> MEMBER
      return {
        label: 'MEMBER',
        badgeClass: 'po-member-role-badge-member',
      };
    },
    [project, activeWorkspace, isWsOwner, isWsAdmin, user, wsMembersMap]
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

  const totalTasksCount = workItems.length;
  const completedTasksCount = workItems.filter((i) => i.status === 'COMPLETED').length;
  const openTasksCount = totalTasksCount - completedTasksCount;
  const completionPercent = totalTasksCount > 0 ? Math.round((completedTasksCount / totalTasksCount) * 100) : 100;

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
      const targetWsId = activeWorkspace?.id || (propProject as any)?.workspaceId || (project as any)?.workspaceId;
      const [projRes, workRes, actRes, compRes, wsMembersRes] = await Promise.all([
        needsProject ? projectsApi.getProjectById(projectId, activeWorkspace?.id) : Promise.resolve(null),
        workApi.getProjectWorkItems(projectId),
        activityApi.getProjectActivities(projectId, { limit: 8 }).catch((err) => {
          console.warn('Activity feed unavailable:', err);
          return null;
        }),
        typeof projectsApi.getCompletionStatus === 'function'
          ? projectsApi.getCompletionStatus(projectId, activeWorkspace?.id).catch(() => null)
          : Promise.resolve(null),
        targetWsId ? workspacesApi.getMembers(targetWsId, { limit: 100 }).catch(() => null) : Promise.resolve(null),
      ]);

      if (projRes && projRes.success && projRes.data?.project) {
        setProject(projRes.data.project);
      }
      if (workRes && workRes.success && workRes.data) {
        setWorkItems(workRes.data.workItems);
        setStats(workRes.data.stats);
      }
      if (actRes && actRes.success && actRes.data) {
        setRecentActivities(actRes.data.activities);
      }
      if (compRes && compRes.success && compRes.data) {
        setCompletionStatus(compRes.data);
      }
      if (wsMembersRes && wsMembersRes.success && wsMembersRes.data?.members) {
        setWorkspaceMembers(wsMembersRes.data.members);
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

  const handleDirectComplete = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!project) return;
    setIsCompleting(true);
    setCompletionError(null);
    setCompletionSuccess(null);
    try {
      const res = await projectsApi.completeProject(
        project.id,
        completionReason.trim() || undefined,
        activeWorkspace?.id,
        openTasksCount > 0 ? autoResolveOpenTasks : false
      );
      if (res.success) {
        setCompletionReasonModalOpen(false);
        setCompletionReason('');
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
      const res = await projectsApi.completeProject(
        project.id,
        completionReason.trim() || undefined,
        activeWorkspace?.id,
        openTasksCount > 0 ? autoResolveOpenTasks : false
      );
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
            {/* Total Tasks */}
            <div className="po-metric-card">
              <div className="po-metric-content-row">
                <div className="po-metric-icon-box purple">
                  <LayersIcon size={18} />
                </div>
                <div className="po-metric-value-col">
                  <div className="po-metric-main-num">{stats?.total ?? workItems.length}</div>
                  <span className="po-metric-title-label">Total Tasks</span>
                </div>
                <div className="po-metric-extra-right">
                  <div className="po-metric-sparkline-box purple">
                    <svg width="22" height="18" viewBox="0 0 22 18" fill="none">
                      <rect x="2" y="10" width="3" height="8" rx="1.5" fill="#A855F7" />
                      <rect x="8" y="5" width="3" height="13" rx="1.5" fill="#A855F7" />
                      <rect x="14" y="2" width="3" height="16" rx="1.5" fill="#A855F7" />
                    </svg>
                  </div>
                </div>
              </div>
              <div className="po-metric-wave-wrap" aria-hidden="true">
                <svg viewBox="0 0 200 45" preserveAspectRatio="none" className="po-metric-wave-svg">
                  <path
                    d="M0 38 C50 32, 100 44, 145 28 C170 18, 188 22, 200 25 L200 45 L0 45 Z"
                    fill="#FAF5FF"
                  />
                  <path
                    d="M0 42 C60 38, 110 44, 155 34 C175 28, 190 32, 200 33 L200 45 L0 45 Z"
                    fill="#F3E8FF"
                  />
                </svg>
              </div>
            </div>

            {/* In Progress */}
            <div className="po-metric-card">
              <div className="po-metric-content-row">
                <div className="po-metric-icon-box amber">
                  <ClockIcon size={18} />
                </div>
                <div className="po-metric-value-col">
                  <div className="po-metric-main-num">{stats?.inProgress ?? 0}</div>
                  <span className="po-metric-title-label">In Progress</span>
                </div>
                <div className="po-metric-extra-right">
                  <div className="po-metric-sparkline-box amber">
                    <svg width="34" height="16" viewBox="0 0 34 16" fill="none">
                      <path
                        d="M2 14C8 14 12 4 18 8C24 12 28 2 32 3"
                        stroke="#D97706"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                </div>
              </div>
              <div className="po-metric-wave-wrap" aria-hidden="true">
                <svg viewBox="0 0 200 45" preserveAspectRatio="none" className="po-metric-wave-svg">
                  <path
                    d="M0 38 C50 32, 100 44, 145 28 C170 18, 188 22, 200 25 L200 45 L0 45 Z"
                    fill="#FFFBEB"
                  />
                  <path
                    d="M0 42 C60 38, 110 44, 155 34 C175 28, 190 32, 200 33 L200 45 L0 45 Z"
                    fill="#FEF3C7"
                  />
                </svg>
              </div>
            </div>

            {/* Completed */}
            <div className="po-metric-card">
              <div className="po-metric-content-row">
                <div className="po-metric-icon-box blue">
                  <CheckSquareIcon size={18} />
                </div>
                <div className="po-metric-value-col">
                  <div className="po-metric-main-num">{stats?.completed ?? 0}</div>
                  <span className="po-metric-title-label">Completed</span>
                </div>
                <div className="po-metric-extra-right">
                  <div className="po-metric-pct-badge">
                    {stats?.completionPercentage ?? (stats?.total ? Math.round((stats.completed / stats.total) * 100) : 0)}%
                  </div>
                </div>
              </div>
              <div className="po-metric-wave-wrap" aria-hidden="true">
                <svg viewBox="0 0 200 45" preserveAspectRatio="none" className="po-metric-wave-svg">
                  <path
                    d="M0 38 C50 32, 100 44, 145 28 C170 18, 188 22, 200 25 L200 45 L0 45 Z"
                    fill="#F0F9FF"
                  />
                  <path
                    d="M0 42 C60 38, 110 44, 155 34 C175 28, 190 32, 200 33 L200 45 L0 45 Z"
                    fill="#E0F2FE"
                  />
                </svg>
              </div>
            </div>

            {/* Overdue */}
            <div className="po-metric-card">
              <div className="po-metric-content-row">
                <div className="po-metric-icon-box red">
                  <AlertCircleIcon size={18} />
                </div>
                <div className="po-metric-value-col">
                  <div className="po-metric-main-num red">{stats?.overdue ?? 0}</div>
                  <span className="po-metric-title-label">Overdue</span>
                </div>
                <div className="po-metric-extra-right">
                  <div className="po-metric-arrow-red">↗</div>
                </div>
              </div>
              <div className="po-metric-wave-wrap" aria-hidden="true">
                <svg viewBox="0 0 200 45" preserveAspectRatio="none" className="po-metric-wave-svg">
                  <path
                    d="M0 38 C50 32, 100 44, 145 28 C170 18, 188 22, 200 25 L200 45 L0 45 Z"
                    fill="#FFF1F2"
                  />
                  <path
                    d="M0 42 C60 38, 110 44, 155 34 C175 28, 190 32, 200 33 L200 45 L0 45 Z"
                    fill="#FFE4E6"
                  />
                </svg>
              </div>
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
              <div className="po-card-head-row po-desc-card-head">
                <div className="po-card-title-flex">
                  <div className="po-desc-icon-squircle">
                    <FileTextIcon size={20} />
                  </div>
                  <h3 className="po-card-title-text po-desc-card-title">Project Description</h3>
                </div>
                <button
                  type="button"
                  className="po-edit-desc-btn"
                  onClick={handleOpenSettings}
                  title="Edit Project Details"
                >
                  <EditIcon size={15} />
                  <span>Edit</span>
                </button>
              </div>

              <div className="po-desc-divider" />

              <div className="po-card-content-body">
                <p className="po-desc-paragraph">
                  {project.description || 'No project description provided.'}
                </p>

                <div className="po-desc-meta-split-row">
                  {/* Category Column */}
                  <div className="po-desc-meta-col">
                    <div className="po-desc-meta-header-row">
                      <TagIcon size={15} className="po-desc-meta-header-icon" />
                      <span className="po-desc-meta-header-title">Category</span>
                    </div>
                    <div className="po-desc-meta-pill cat-pill-accent">
                      <ApplicationCategoryIcon category={project.category} size={15} className="po-meta-icon" />
                      <span>{project.category || 'General'}</span>
                    </div>
                  </div>

                  {/* Vertical Divider Line */}
                  <div className="po-desc-meta-divider-line" />

                  {/* Target End Date Column */}
                  <div className="po-desc-meta-col">
                    <div className="po-desc-meta-header-row">
                      <CalendarIcon size={15} className="po-desc-meta-header-icon" />
                      <span className="po-desc-meta-header-title">Target End Date</span>
                    </div>
                    <div className="po-desc-meta-pill date-pill-accent">
                      <CalendarIcon size={15} className="po-meta-icon" />
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
              <div className="po-card-head-row po-qa-card-head">
                <div className="po-card-title-flex">
                  <div className="po-desc-icon-squircle po-qa-squircle">
                    <CircleDotIcon size={20} />
                  </div>
                  <h3 className="po-card-title-text po-desc-card-title">Quick Actions</h3>
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

              <div className="po-desc-divider" />

              <div className="po-card-content-body po-qa-card-body">
                {/* 4 Square Action Buttons */}
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

                {/* Inline Complete Project Section */}
                <div className="po-qa-complete-section">
                  {completionSuccess && (
                    <div className="po-qa-alert po-qa-alert-success">
                      {completionSuccess}
                    </div>
                  )}
                  {completionError && (
                    <div className="po-qa-alert po-qa-alert-error">
                      {completionError}
                    </div>
                  )}

                  {isCompleted ? (
                    <div className="po-qa-complete-box box-completed">
                      <div className="po-qa-complete-status-info">
                        <CheckCircleIcon size={18} className="po-qa-status-icon success" />
                        <div>
                          <div className="po-qa-status-title">Project Completed</div>
                          <div className="po-qa-status-desc">All deliverables preserved in read-only mode.</div>
                        </div>
                      </div>
                      {(isWsLeader || isProjectAdmin) && (
                        <button
                          type="button"
                          className="po-qa-reopen-btn"
                          disabled={isCompleting}
                          onClick={handleReactivate}
                        >
                          {isCompleting ? 'Reactivating...' : 'Reopen Project'}
                        </button>
                      )}
                    </div>
                  ) : pendingRequest ? (
                    <div className="po-qa-complete-box box-pending">
                      <div className="po-qa-complete-status-info">
                        <ClockIcon size={18} className="po-qa-status-icon pending" />
                        <div>
                          <div className="po-qa-status-title">Completion Request Pending</div>
                          <div className="po-qa-status-desc">
                            Requested by <strong>{pendingRequest.requestedByName}</strong>
                          </div>
                          {pendingRequest.reason && (
                            <div className="po-qa-pending-reason">&quot;{pendingRequest.reason}&quot;</div>
                          )}
                        </div>
                      </div>
                      {isWsLeader ? (
                        <div className="po-qa-status-actions">
                          <button
                            type="button"
                            className="po-qa-approve-btn"
                            disabled={isCompleting}
                            onClick={() => handleApproveRequest(pendingRequest.id)}
                          >
                            <CheckSquareIcon size={14} />
                            <span>{isCompleting ? 'Approving...' : 'Approve'}</span>
                          </button>
                          <button
                            type="button"
                            className="po-qa-decline-btn"
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
                            className="po-qa-cancel-req-btn"
                            onClick={() => handleCancelRequest(pendingRequest.id)}
                          >
                            Cancel Request
                          </button>
                        )
                      )}
                    </div>
                  ) : (
                    <div className="po-qa-active-complete-box">
                      <div className="po-qa-active-complete-text">
                        <div className="po-qa-active-complete-title-row">
                          <CheckSquareIcon size={14} className="po-qa-complete-icon" />
                          <span className="po-qa-active-complete-title">Complete Project</span>
                        </div>
                        <p className="po-qa-active-complete-desc">
                          {isWsOwner
                            ? 'As workspace owner, your action immediately moves this project to the Completed section.'
                            : isWsAdmin
                              ? 'As workspace administrator, your action immediately moves this project to the Completed section.'
                              : isProjectAdmin
                                ? 'As project admin, your request will be routed to workspace leaders for approval.'
                                : 'Submit a completion request for workspace leaders to finalize.'}
                        </p>
                      </div>

                      <div className="po-qa-active-complete-action">
                        {canDirectlyComplete ? (
                          <button
                            type="button"
                            className="po-qa-complete-btn"
                            disabled={isCompleting}
                            onClick={() => {
                              setCompletionModalMode('direct');
                              setCompletionReasonModalOpen(true);
                            }}
                          >
                            <CheckSquareIcon size={15} />
                            <span>{isCompleting ? 'Completing...' : 'Mark Project as Complete'}</span>
                          </button>
                        ) : canRequestComplete ? (
                          <button
                            type="button"
                            className="po-qa-request-btn"
                            disabled={isCompleting}
                            onClick={() => {
                              setCompletionModalMode('request');
                              setCompletionReasonModalOpen(true);
                            }}
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
                  project.members.map((m) => {
                    const roleTag = getMemberRoleTag(m);
                    return (
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
                          <span className={roleTag.badgeClass}>
                            {roleTag.label}
                          </span>
                          <span className="po-member-active-green-dot" />
                        </div>
                      </div>
                    );
                  })
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

      {/* Complete Project / Request Project Completion Modal */}
      <Modal
        isOpen={completionReasonModalOpen}
        onClose={() => !isSubmittingRequest && !isCompleting && setCompletionReasonModalOpen(false)}
        maxWidth="md"
        className="po-completion-modal"
      >
        <form
          onSubmit={completionModalMode === 'direct' ? handleDirectComplete : handleRequestComplete}
          className="po-cm-container"
        >
          {/* Header matching Image 1: Left badge + Title/Subtitle + Right Illustration */}
          <div className="po-cm-header">
            <div className="po-cm-header-badge">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="3" y="3" width="18" height="18" rx="5" stroke="#1E40AF" strokeWidth="2" fill="none" />
                <path d="M8.5 12.5L11 15L16 9.5" stroke="#1E40AF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="po-cm-header-meta">
              <h2 className="po-cm-title">
                {completionModalMode === 'direct' ? 'Mark Project as Complete' : 'Request Project Completion'}
              </h2>
              <p className="po-cm-subtitle">
                {completionModalMode === 'direct'
                  ? 'Finalize “' + (project?.name || 'Project') + '” and preserve deliverables in read-only mode.'
                  : 'Submit a completion request for “' + (project?.name || 'Project') + '” for workspace leadership review.'}
              </p>
            </div>
            <div className="po-cm-illustration-wrap" aria-hidden="true">
              <svg width="124" height="74" viewBox="0 0 124 74" fill="none" xmlns="http://www.w3.org/2000/svg">
                {/* Soft backdrop clouds */}
                <ellipse cx="68" cy="40" rx="36" ry="24" fill="#EEF4FF" />
                <ellipse cx="94" cy="36" rx="22" ry="18" fill="#F0F5FF" />
                <ellipse cx="48" cy="46" rx="20" ry="14" fill="#F0F5FF" />

                {/* Tilted Checklist Document Sheet */}
                <g transform="rotate(6 66 32)">
                  <rect x="42" y="4" width="46" height="54" rx="7" fill="#FFFFFF" stroke="#DCE7FD" strokeWidth="1.5" />

                  {/* Item 1 */}
                  <rect x="48" y="14" width="9" height="9" rx="2.5" fill="#EFF6FF" stroke="#3B82F6" strokeWidth="1.2" />
                  <path d="M50.5 18.5L52 20L55 16.5" stroke="#2563EB" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                  <rect x="61" y="16.5" width="21" height="4" rx="2" fill="#DBEAFE" />

                  {/* Item 2 */}
                  <rect x="48" y="27" width="9" height="9" rx="2.5" fill="#EFF6FF" stroke="#3B82F6" strokeWidth="1.2" />
                  <path d="M50.5 31.5L52 33L55 29.5" stroke="#2563EB" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                  <rect x="61" y="29.5" width="16" height="4" rx="2" fill="#DBEAFE" />

                  {/* Item 3 placeholder lines */}
                  <rect x="48" y="40" width="18" height="3" rx="1.5" fill="#EFF6FF" />
                </g>

                {/* Blue Award Rosette / Medal on sheet's bottom-right */}
                <g transform="translate(86, 38)">
                  {/* Ribbon tails */}
                  <path d="M7 16L4 27L10 24L16 27L13 16" fill="#2563EB" />
                  <path d="M10 16L13 28L17 25L21 28L18 16" fill="#1D4ED8" />
                  {/* Rosette medallion */}
                  <circle cx="12" cy="11" r="10" fill="#3B82F6" stroke="#2563EB" strokeWidth="1" />
                  <circle cx="12" cy="11" r="7.5" fill="#2563EB" />
                  {/* Star in medal */}
                  <path d="M12 6.5L13.3 9.3L16.2 9.7L14.1 11.6L14.7 14.5L12 13L9.3 14.5L9.9 11.6L7.8 9.7L10.7 9.3L12 6.5Z" fill="#FFFFFF" />
                </g>
              </svg>
            </div>
          </div>

          {/* Deliverables Health Card */}
          <div className="po-cm-health-card">
            <div className="po-cm-health-header">
              <div className="po-cm-health-title-flex">
                <LayersIcon size={16} className="po-cm-health-icon" />
                <span className="po-cm-health-title">Deliverables Health</span>
              </div>
              <span className={'po-cm-health-pill ' + (completionPercent === 100 ? 'pill-done' : 'pill-pending')}>
                <CheckCircleIcon size={13} />
                <span>{completionPercent}% Completed</span>
              </span>
            </div>
            <div className="po-cm-progress-track">
              <div className="po-cm-progress-fill" style={{ width: completionPercent + '%' }} />
            </div>
            <div className="po-cm-stats-grid">
              <div className="po-cm-stat-box">
                <div className="po-cm-stat-icon-wrap icon-tasks">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="4" y="4" width="16" height="16" rx="4" />
                    <path d="M9 12l2 2 4-4" />
                  </svg>
                </div>
                <div className="po-cm-stat-meta">
                  <span className="po-cm-stat-num">{totalTasksCount}</span>
                  <span className="po-cm-stat-label">Total Tasks</span>
                </div>
              </div>
              <div className="po-cm-stat-box">
                <div className="po-cm-stat-icon-wrap icon-completed">
                  <CheckIcon size={16} strokeWidth={2.5} />
                </div>
                <div className="po-cm-stat-meta">
                  <span className="po-cm-stat-num">{completedTasksCount}</span>
                  <span className="po-cm-stat-label">Completed</span>
                </div>
              </div>
              <div className="po-cm-stat-box">
                <div className="po-cm-stat-icon-wrap icon-remaining">
                  <CircleDotIcon size={16} />
                </div>
                <div className="po-cm-stat-meta">
                  <span className={'po-cm-stat-num ' + (openTasksCount > 0 ? 'num-amber' : '')}>{openTasksCount}</span>
                  <span className="po-cm-stat-label">Remaining Open</span>
                </div>
              </div>
            </div>
          </div>

          {/* Deliverables Status Notice */}
          {openTasksCount > 0 ? (
            <div className="po-cm-alert-box alert-amber">
              <AlertCircleIcon size={20} className="po-cm-alert-icon" />
              <div className="po-cm-alert-body">
                <div className="po-cm-alert-heading">
                  {openTasksCount} unfinished task{openTasksCount > 1 ? 's' : ''} remaining
                </div>
                <p className="po-cm-alert-desc">
                  {completionModalMode === 'direct'
                    ? 'There are still active tasks in To Do, In Progress, or In Review.'
                    : 'Workspace leadership will review open tasks as part of this completion request.'}
                </p>
                {completionModalMode === 'direct' && (
                  <label className="po-cm-resolve-checkbox-label">
                    <input
                      type="checkbox"
                      checked={autoResolveOpenTasks}
                      onChange={(e) => setAutoResolveOpenTasks(e.target.checked)}
                      className="po-cm-checkbox"
                    />
                    <span>Automatically mark all {openTasksCount} remaining task{openTasksCount > 1 ? 's' : ''} as Completed</span>
                  </label>
                )}
              </div>
            </div>
          ) : (
            <div className="po-cm-alert-box alert-finished">
              <CheckCircleIcon size={20} className="po-cm-alert-icon" />
              <div className="po-cm-alert-body">
                <div className="po-cm-alert-heading">All deliverables finished (100%)</div>
                <p className="po-cm-alert-desc">
                  Every task on this project has been resolved. You are ready to close and archive deliverables.
                </p>
              </div>
            </div>
          )}

          {/* Notes Field */}
          <div className="po-cm-field-group">
            <div className="po-cm-field-header">
              <FileTextIcon size={16} className="po-cm-field-icon" />
              <label htmlFor="completionReason" className="po-cm-field-label">
                {completionModalMode === 'direct'
                  ? 'Completion Summary & Release Notes (Optional)'
                  : 'Completion Notes for Leadership (Recommended)'}
              </label>
            </div>
            <textarea
              id="completionReason"
              rows={3}
              value={completionReason}
              onChange={(e) => setCompletionReason(e.target.value)}
              placeholder={
                completionModalMode === 'direct'
                  ? 'Summarize accomplishments, final deliverables, or sign-off notes...'
                  : 'Describe key deliverables, milestones completed, and notes for workspace administrators...'
              }
              className="po-cm-textarea"
            />
          </div>

          {/* Read-Only Safeguard Notice */}
          <div className="po-cm-safeguard-card">
            <ShieldIcon size={18} className="po-cm-safeguard-icon" />
            <span>
              <strong>Read-Only Protection:</strong> Completing this project locks all tasks, milestones, and boards to preserve the historical record. Workspace Owners or Admins can reactivate at any time.
            </span>
          </div>

          {completionError && (
            <div style={{ color: '#DC2626', fontSize: '0.8125rem', marginTop: '-0.25rem' }}>
              {completionError}
            </div>
          )}

          {/* Footer Actions */}
          <div className="po-cm-footer">
            <button
              type="button"
              className="po-cm-btn-cancel"
              onClick={() => setCompletionReasonModalOpen(false)}
              disabled={isCompleting || isSubmittingRequest}
            >
              Cancel
            </button>
            {completionModalMode === 'direct' ? (
              <button
                type="submit"
                className="po-cm-btn-submit"
                disabled={isCompleting}
              >
                <CheckSquareIcon size={16} />
                <span>{isCompleting ? 'Finalizing Project...' : 'Confirm & Complete Project'}</span>
              </button>
            ) : (
              <button
                type="submit"
                className="po-cm-btn-submit"
                disabled={isSubmittingRequest}
              >
                <CheckSquareIcon size={16} />
                <span>{isSubmittingRequest ? 'Submitting...' : 'Submit Completion Request'}</span>
              </button>
            )}
          </div>

          {/* Decorative bottom waves matching screenshot */}
          <div className="po-cm-bottom-waves" aria-hidden="true">
            <svg viewBox="0 0 600 70" preserveAspectRatio="none" className="po-cm-waves-svg">
              <path
                d="M0 45 C150 15, 300 65, 450 35 C520 20, 570 30, 600 38 L600 70 L0 70 Z"
                fill="rgba(224, 231, 255, 0.45)"
              />
              <path
                d="M0 55 C120 35, 260 68, 420 48 C510 38, 560 50, 600 52 L600 70 L0 70 Z"
                fill="rgba(238, 242, 255, 0.75)"
              />
            </svg>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default ProjectOverviewPage;
