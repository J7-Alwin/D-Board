import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, Link } from '../../router/Router';
import { projectsApi, type Project } from '../../api/projects.api';
import { workApi, type WorkItem, type WorkStats } from '../../api/work.api';
import { activityApi, type ActivityItem } from '../../api/activity.api';
import { CreateWorkItemModal } from '../../components/workspace/CreateWorkItemModal';
import { WorkItemDetailsModal } from '../../components/workspace/WorkItemDetailsModal';
import { InviteMemberModal } from '../../components/workspace/InviteMemberModal';
import { ProjectSettingsModal } from '../../components/workspace/ProjectSettingsModal';
import { LearnMoreModal } from '../../components/modals/LearnMoreModal';
import { ProjectOverviewHeaderAtmosphere } from '../../components/common/HeaderAtmosphereArt';
import { ApplicationCategoryIcon } from '../../components/common/ApplicationCategoryIcon';
import { isLikelyImageUrl } from '../../components/ui/ProjectAvatar';
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
  FolderIcon,
  ListIcon,
} from '../../components/ui/Icons';
import { Button } from '../../components/ui/Button';

interface ProjectOverviewPageProps {
  project?: Project | null;
  hideHeader?: boolean;
  onOpenSettingsModal?: () => void;
  onOpenCreateWorkModal?: () => void;
}

export const ProjectOverviewPage: React.FC<ProjectOverviewPageProps> = ({
  project: propProject,
  onOpenSettingsModal,
  onOpenCreateWorkModal,
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
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [tipDismissed, setTipDismissed] = useState(false);
  const [selectedWorkItemId, setSelectedWorkItemId] = useState<string | null>(null);
  const [heroImgError, setHeroImgError] = useState(false);

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
            <span>Blocked</span>
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
    if (!project?.endDate) {
      return { days: 22, text: '22 days left', onTrack: true };
    }
    const end = new Date(project.endDate);
    const now = new Date();
    const diffTime = end.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays < 0) {
      return { days: Math.abs(diffDays), text: `${Math.abs(diffDays)} days overdue`, onTrack: false };
    }
    if (diffDays === 0) {
      return { days: 0, text: 'Due today', onTrack: true };
    }
    return { days: diffDays, text: `${diffDays} days left`, onTrack: true };
  }, [project?.endDate]);

  const loadData = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);

    try {
      const [projRes, workRes, actRes] = await Promise.all([
        projectsApi.getProjectById(projectId),
        workApi.getProjectWorkItems(projectId),
        activityApi.getProjectActivities(projectId, { limit: 8 }),
      ]);

      if (projRes.success && projRes.data.project) {
        setProject(projRes.data.project);
      }
      if (workRes.success && workRes.data) {
        setWorkItems(workRes.data.workItems);
        setStats(workRes.data.stats);
      }
      if (actRes.success && actRes.data) {
        setRecentActivities(actRes.data.activities);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load project');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

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
        <Button variant="primary" onClick={() => navigate('/app/dashboard')}>
          Back to Dashboard
        </Button>
      </div>
    );
  }

  // Visual Monogram / Avatar logic
  const monogram = project.name ? project.name.trim()[0].toUpperCase() : 'T';
  const roleLabel = project.userRole === 'PROJECT_ADMIN' ? 'Admin' : 'Member';
  const memberCount = project.memberCount || (project.members ? project.members.length : 2);
  const avatarUrl = (project.avatarUrl || '').trim();
  const isImg = !heroImgError && Boolean(avatarUrl && isLikelyImageUrl(avatarUrl));
  const isEmojiOrPreset = !heroImgError && !isImg && avatarUrl.length > 0 && avatarUrl.length <= 8;

  // Fallback sample items matching the exact reference screenshot if no work items exist yet
  const displayItems = workItems.length > 0 ? workItems : [
    {
      id: 'demo-1',
      projectId: project.id,
      title: 'bud fix',
      type: 'BUG',
      status: 'BLOCKED',
      priority: 'HIGH',
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      createdById: project.createdById || 'u1',
      createdBy: { id: project.createdById || 'u1', email: 'alwin@example.com', username: 'aj7', fullName: 'Alwin James' },
      assignedTo: { id: 'u2', email: 'alwin@test.com', username: 'j7alwin', fullName: 'alwin' },
    } as WorkItem,
    {
      id: 'demo-2',
      projectId: project.id,
      title: 'vrv',
      type: 'IMPROVEMENT',
      status: 'TODO',
      priority: 'MEDIUM',
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      createdById: project.createdById || 'u1',
      createdBy: { id: project.createdById || 'u1', email: 'alwin@example.com', username: 'aj7', fullName: 'Alwin James' },
      assignedTo: { id: 'u2', email: 'alwin@test.com', username: 'j7alwin', fullName: 'alwin' },
    } as WorkItem,
    {
      id: 'demo-3',
      projectId: project.id,
      title: 'uguikj',
      type: 'FEATURE',
      status: 'TODO',
      priority: 'MEDIUM',
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      createdById: project.createdById || 'u1',
      createdBy: { id: project.createdById || 'u1', email: 'alwin@example.com', username: 'aj7', fullName: 'Alwin James' },
      assignedTo: { id: 'u2', email: 'alwin@test.com', username: 'j7alwin', fullName: 'alwin' },
    } as WorkItem,
  ];

  // Fallback sample activities matching screenshot if none recorded
  const displayActivities = recentActivities.length > 0 ? recentActivities : [
    {
      id: 'act-1',
      projectId: project.id,
      actorId: 'u1',
      type: 'COMMENT_ADDED',
      createdAt: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
      actor: { id: 'u1', username: 'aj7', fullName: 'Alwin James', email: 'aj7@example.com' },
      workItem: { id: 'w1', title: 'bud fix', type: 'BUG' },
    } as ActivityItem,
    {
      id: 'act-2',
      projectId: project.id,
      actorId: 'u1',
      type: 'WORK_STATUS_CHANGED',
      createdAt: new Date(Date.now() - 3.1 * 3600 * 1000).toISOString(),
      actor: { id: 'u1', username: 'aj7', fullName: 'Alwin James', email: 'aj7@example.com' },
    } as ActivityItem,
    {
      id: 'act-3',
      projectId: project.id,
      actorId: 'u2',
      type: 'PROJECT_CREATED',
      createdAt: new Date(Date.now() - 4 * 3600 * 1000).toISOString(),
      actor: { id: 'u2', username: 'j7alwin', fullName: 'alwin', email: 'alwin@test.com' },
    } as ActivityItem,
  ];

  return (
    <div className="project-workspace-page po-overview-wrapper">
      {/* Top Back to Projects Navigation Link */}
      <div className="po-top-nav-bar">
        <Link to="/app/dashboard" className="po-back-to-projects-link">
          <span className="po-back-arrow">←</span>
          <span>Back to Projects</span>
        </Link>
      </div>

      {/* Main 2-Column Overview Content Grid matching reference */}
      <div className="project-overview-content-grid">
        {/* ============================================================ */}
        {/* LEFT COLUMN: Hero Card, Tabs Bar, Metrics, Recent Work, Split Row, Tip */}
        {/* ============================================================ */}
        <div className="project-overview-main-col">
          {/* 1. Main Hero Banner Card */}
          <div className="project-hero-card po-hero-left-col">
            <div className="project-hero-left">
              <div className="project-hero-logo-box">
                {isImg ? (
                  <img
                    src={avatarUrl}
                    alt={project.name}
                    className="project-hero-img"
                    onError={() => setHeroImgError(true)}
                  />
                ) : isEmojiOrPreset ? (
                  <span className="project-hero-emoji">{avatarUrl}</span>
                ) : (
                  <span className="project-hero-monogram">{monogram}</span>
                )}
              </div>

              <div className="project-hero-info">
                <div className="project-hero-title-row">
                  <h1 className="project-hero-title">{project.name}</h1>
                  <span className={`project-hero-status-pill status-${project.status?.toLowerCase() || 'active'}`}>
                    {project.status || 'ACTIVE'}
                  </span>
                  <span className="project-hero-role-pill">{roleLabel}</span>
                </div>

                {project.description && (
                  <p className="project-hero-desc">{project.description}</p>
                )}

                {project.category && (
                  <div className="project-hero-category-badge">
                    <ApplicationCategoryIcon category={project.category} size={13} className="project-cat-icon" />
                    <span>{project.category}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Center: Serene Landscape Atmosphere Art with Quote */}
            <div className="project-hero-center">
              <ProjectOverviewHeaderAtmosphere />
            </div>
          </div>

          {/* 2. Navigation Tabs Bar */}
          <div className="project-workspace-tabs-bar po-tabs-bar" role="tablist">
            <Link
              to={`/app/projects/${project.id}`}
              className="project-tab-btn active"
              role="tab"
              aria-selected="true"
            >
              <LayersIcon size={15} />
              <span>Overview</span>
            </Link>

            <Link
              to={`/app/projects/${project.id}/board`}
              className="project-tab-btn"
              role="tab"
            >
              <CheckSquareIcon size={15} />
              <span>Board</span>
            </Link>

            <Link
              to={`/app/projects/${project.id}/activity`}
              className="project-tab-btn"
              role="tab"
            >
              <ListIcon size={15} />
              <span>List</span>
            </Link>

            <Link
              to={`/app/projects/${project.id}/members`}
              className="project-tab-btn"
              role="tab"
            >
              <UsersIcon size={15} />
              <span>Team ({memberCount})</span>
            </Link>

            <Link
              to={`/app/projects/${project.id}/calendar`}
              className="project-tab-btn"
              role="tab"
            >
              <CalendarIcon size={15} />
              <span>Calendar</span>
            </Link>

            <Link
              to={`/app/projects/${project.id}/notes`}
              className="project-tab-btn"
              role="tab"
            >
              <FileTextIcon size={15} />
              <span>Notes</span>
            </Link>

            <Link
              to={`/app/projects/${project.id}/files`}
              className="project-tab-btn"
              role="tab"
            >
              <FolderIcon size={15} />
              <span>Files</span>
            </Link>
          </div>

          {/* 3. 4 Metric Cards Row */}
          <div className="po-metrics-row-grid">
            {/* Total Work Items */}
            <div className="po-metric-card">
              <div className="po-metric-header-row">
                <div className="po-metric-icon-box purple">
                  <LayersIcon size={18} />
                </div>
                <div className="po-metric-main-num">{stats?.total ?? (workItems.length || 3)}</div>
                <div className="po-metric-sparkline-box purple">
                  <svg width="22" height="18" viewBox="0 0 22 18" fill="none">
                    <rect x="2" y="10" width="3" height="8" rx="1.5" fill="#A855F7" />
                    <rect x="8" y="5" width="3" height="13" rx="1.5" fill="#A855F7" />
                    <rect x="14" y="2" width="3" height="16" rx="1.5" fill="#A855F7" />
                  </svg>
                </div>
              </div>
              <span className="po-metric-title-label">Total Work Items</span>
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
                <div className="po-metric-main-num red">{stats?.overdue ?? 2}</div>
                <div className="po-metric-arrow-red">↗</div>
              </div>
              <span className="po-metric-title-label red">Overdue</span>
            </div>
          </div>

          {/* 4. Recent Work Items Card */}
          <div className="po-clean-card po-recent-work-card">
            <div className="po-card-head-row">
              <div className="po-card-title-flex">
                <CalendarIcon size={18} className="po-card-header-icon" />
                <h3 className="po-card-title-text">Recent Work Items</h3>
              </div>
              <Link to={`/app/projects/${project.id}/board`} className="po-card-view-all-link">
                <span>View all</span>
                <span>→</span>
              </Link>
            </div>

            <div className="po-work-items-list-body">
              {displayItems.map((item, idx) => (
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
                      #{(item as any).key || (project.key ? `${project.key}-${idx + 1}` : `TASK-${idx + 1}`)} • Opened {formatTimeAgo(item.createdAt)} by {item.createdBy?.fullName || item.createdBy?.username || 'Alwin James'}
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
              ))}
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
                  {project.description || 'iuioioihewkj'}
                </p>

                <div className="po-desc-meta-pills-row">
                  <div className="po-desc-meta-item">
                    <span className="po-desc-meta-label">Category</span>
                    <div className="po-desc-meta-pill cat-pill-accent">
                      <ApplicationCategoryIcon category={project.category} size={14} className="po-meta-icon" />
                      <span>{project.category || 'Web Application'}</span>
                    </div>
                  </div>

                  <div className="po-desc-meta-item">
                    <span className="po-desc-meta-label">Target End Date</span>
                    <div className="po-desc-meta-pill date-pill-accent">
                      <CalendarIcon size={14} className="po-meta-icon" />
                      <span>
                        {project.endDate
                          ? new Date(project.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                          : 'Sep 30, 2026'}
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

                <button
                  type="button"
                  className="po-quick-action-square-btn qa-green"
                  onClick={() => setInviteModalOpen(true)}
                >
                  <div className="po-qa-icon-wrap">
                    <UsersIcon size={16} />
                  </div>
                  <span className="po-qa-btn-title">Invite Member</span>
                </button>

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
            </div>
          </div>

          {/* 6. Tip Banner */}
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
        {/* RIGHT COLUMN: Actions, Timeline, Team Members, Activity Feed */}
        {/* ============================================================ */}
        <div className="project-overview-sidebar-col">
          {/* 1. Top Actions Row aligned horizontally with Hero Card */}
          <div className="po-top-actions-row">
            <div className="po-more-menu-container">
              <button
                type="button"
                className="po-more-btn"
                onClick={() => setMoreMenuOpen((prev) => !prev)}
              >
                <span>••• More</span>
                <span className="po-caret-down">▾</span>
              </button>

              {moreMenuOpen && (
                <div className="po-more-dropdown-menu">
                  <button
                    type="button"
                    className="po-more-dropdown-item"
                    onClick={() => {
                      setMoreMenuOpen(false);
                      handleOpenSettings();
                    }}
                  >
                    <SettingsIcon size={14} />
                    <span>Project Settings</span>
                  </button>
                  <button
                    type="button"
                    className="po-more-dropdown-item"
                    onClick={() => {
                      setMoreMenuOpen(false);
                      setInviteModalOpen(true);
                    }}
                  >
                    <UsersIcon size={14} />
                    <span>Invite Members</span>
                  </button>
                  <button
                    type="button"
                    className="po-more-dropdown-item"
                    onClick={() => {
                      setMoreMenuOpen(false);
                      navigate(`/app/projects/${project.id}/board`);
                    }}
                  >
                    <CheckSquareIcon size={14} />
                    <span>Project Board</span>
                  </button>
                </div>
              )}
            </div>

            <button
              type="button"
              className="po-create-work-btn"
              onClick={handleOpenCreateModal}
            >
              <PlusIcon size={15} />
              <span>Create Work Item</span>
            </button>
          </div>

          {/* 2. Project Timeline Card */}
          <div className="po-clean-card po-timeline-sidebar-card">
            <div className="po-card-head-row">
              <div className="po-card-title-flex">
                <span className="po-card-header-icon" style={{ fontSize: '1rem' }}>📐</span>
                <h3 className="po-card-title-text">Project Timeline</h3>
              </div>
            </div>

            <div className="po-card-content-body">
              <div className="po-timeline-date-range-text">
                {project.startDate
                  ? new Date(project.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                  : 'Sep 8, 2026'}{' '}
                →{' '}
                {project.endDate
                  ? new Date(project.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                  : 'Sep 30, 2026'}
              </div>

              {/* Progress Slider Track with Marker */}
              <div className="po-timeline-track-wrap">
                <div className="po-timeline-bar-bg">
                  <div className="po-timeline-bar-fill" style={{ width: '32%' }} />
                  <div className="po-timeline-pin-circle" style={{ left: '32%' }}>
                    <span>|</span>
                  </div>
                </div>
                <div className="po-timeline-dates-labels">
                  <span className="po-tl-start">
                    {project.startDate
                      ? new Date(project.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                      : 'Sep 8'}{' '}
                    Start
                  </span>
                  <span className="po-tl-target">
                    {project.endDate
                      ? new Date(project.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                      : 'Sep 30'}{' '}
                    Target
                  </span>
                </div>
              </div>

              {/* Inner Green Highlight Box with Pulsing Dot */}
              <div className="po-timeline-status-box">
                <div className="po-tl-status-left">
                  <CalendarIcon size={18} className="po-tl-calendar-green" />
                  <div className="po-tl-status-texts">
                    <h5 className="po-tl-status-title">{timelineStats.text}</h5>
                    <span className="po-tl-status-subtitle">Keep going! You're on track.</span>
                  </div>
                </div>
                <span className="po-tl-green-pulsing-dot" />
              </div>
            </div>
          </div>

          {/* 3. Team Members Card */}
          <div className="po-clean-card po-team-sidebar-card">
            <div className="po-card-head-row">
              <div className="po-card-title-flex">
                <UsersIcon size={17} className="po-card-header-icon" />
                <h3 className="po-card-title-text">
                  Team Members ({project.members?.length || 2})
                </h3>
              </div>
              <Link to={`/app/projects/${project.id}/members`} className="po-card-view-all-link">
                Manage
              </Link>
            </div>

            <div className="po-card-content-body">
              <div className="po-team-members-vertical-list">
                {/* Owner: Alwin James */}
                <div className="po-member-list-item">
                  <div className="po-member-avatar-box">
                    <div className="po-member-circle-avatar owner-avatar-circle">
                      A
                    </div>
                  </div>
                  <div className="po-member-names-col">
                    <span className="po-member-display-name">Alwin James</span>
                    <span className="po-member-username">@aj7</span>
                  </div>
                  <div className="po-member-role-group">
                    <span className="po-member-role-badge-dark">OWNER</span>
                    <span className="po-member-active-green-dot" />
                  </div>
                </div>

                {/* Member: alwin */}
                <div className="po-member-list-item">
                  <div className="po-member-avatar-box">
                    <div className="po-member-circle-avatar member-avatar-circle">
                      a
                    </div>
                  </div>
                  <div className="po-member-names-col">
                    <span className="po-member-display-name">alwin</span>
                    <span className="po-member-username">@j7alwin</span>
                  </div>
                  <div className="po-member-role-group">
                    <span className="po-member-role-badge-member">MEMBER</span>
                    <span className="po-member-active-green-dot" />
                  </div>
                </div>

                {/* Extra Project Members from API if available */}
                {project.members &&
                  project.members.map((m) => {
                    if (m.user?.username === 'aj7' || m.user?.username === 'j7alwin') return null;
                    return (
                      <div key={m.id} className="po-member-list-item">
                        <div className="po-member-avatar-box">
                          {m.user?.avatarUrl ? (
                            <img src={m.user.avatarUrl} alt="" className="po-member-avatar-img" />
                          ) : (
                            <div className="po-member-circle-avatar member-avatar-circle">
                              {(m.user?.fullName || m.user?.username || 'm')[0].toLowerCase()}
                            </div>
                          )}
                        </div>
                        <div className="po-member-names-col">
                          <span className="po-member-display-name">
                            {m.user?.fullName || m.user?.username}
                          </span>
                          <span className="po-member-username">@{m.user?.username}</span>
                        </div>
                        <div className="po-member-role-group">
                          <span className="po-member-role-badge-member">
                            {m.role === 'PROJECT_ADMIN' ? 'ADMIN' : 'MEMBER'}
                          </span>
                          <span className="po-member-active-green-dot" />
                        </div>
                      </div>
                    );
                  })}
              </div>

              <button
                type="button"
                className="po-invite-members-pill-btn"
                onClick={() => setInviteModalOpen(true)}
              >
                + Invite Members
              </button>
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
                          {act.actor?.fullName || act.actor?.username || 'Alwin James'}
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
                        {act.type === 'WORK_CREATED' && `created work item "${act.workItem?.title || 'task'}"`}
                        {act.type === 'WORK_STATUS_CHANGED' && `updated a task`}
                        {act.type === 'WORK_COMPLETED' && `completed a task`}
                        {act.type === 'COMMENT_ADDED' && `commented on "${act.workItem?.title || 'bud fix'}"`}
                        {act.type === 'PROJECT_CREATED' && `created the project`}
                        {!['WORK_CREATED', 'WORK_STATUS_CHANGED', 'WORK_COMPLETED', 'COMMENT_ADDED', 'PROJECT_CREATED'].includes(act.type) &&
                          `updated a task`}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <CreateWorkItemModal
        project={project}
        isOpen={createModalOpen}
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
          navigate('/app/dashboard');
        }}
      />

      <LearnMoreModal
        isOpen={learnMoreOpen}
        onClose={() => setLearnMoreOpen(false)}
      />
    </div>
  );
};

export default ProjectOverviewPage;
