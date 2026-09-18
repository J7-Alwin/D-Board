import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from '../../router/Router';
import { projectsApi, type Project } from '../../api/projects.api';
import { activityApi, type ActivityItem } from '../../api/activity.api';
import { ProjectWorkspaceHeader } from '../../components/workspace/ProjectWorkspaceHeader';
import { CreateWorkItemModal } from '../../components/workspace/CreateWorkItemModal';
import { WorkItemDetailsModal } from '../../components/workspace/WorkItemDetailsModal';
import {
  ActivityIcon,
  CheckSquareIcon,
  MessageSquareIcon,
  UsersIcon,
  UserPlusIcon,
  CircleDotIcon,
  ClockIcon,
  CalendarIcon,
  SearchIcon,
  ListIcon,
  MoreHorizontalIcon,
  AlertCircleIcon,
} from '../../components/ui/Icons';
import { Button } from '../../components/ui/Button';
import { CustomSelect } from '../../components/ui/CustomSelect';

const AVATAR_COLORS = [
  '#3B82F6', // Royal Blue
  '#8B5CF6', // Purple
  '#10B981', // Emerald
  '#F59E0B', // Amber
  '#EC4899', // Pink
  '#06B6D4', // Cyan
];

interface ProjectActivityPageProps {
  project?: Project | null;
  hideHeader?: boolean;
}

export const ProjectActivityPage: React.FC<ProjectActivityPageProps> = ({
  project: propProject,
  hideHeader = false,
}) => {
  const { path, navigate } = useRouter();

  // Extract projectId from path e.g. /app/projects/:projectId/activity
  const projectId = path.split('/')[3];

  const [project, setProject] = useState<Project | null>(propProject || null);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [category, setCategory] = useState<'all' | 'work' | 'comments' | 'members'>('all');
  const [dateRange, setDateRange] = useState<'30D' | '7D' | '90D' | 'ALL'>('30D');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedWorkItemId, setSelectedWorkItemId] = useState<string | null>(null);

  const loadActivities = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);

    try {
      const [projRes, actRes] = await Promise.all([
        projectsApi.getProjectById(projectId),
        activityApi.getProjectActivities(projectId, { category, limit: 100 }),
      ]);

      if (projRes.success && projRes.data.project) {
        setProject(projRes.data.project);
      }
      if (actRes.success && actRes.data) {
        setActivities(actRes.data.activities);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load project activity');
    } finally {
      setLoading(false);
    }
  }, [projectId, category]);

  useEffect(() => {
    loadActivities();
  }, [loadActivities]);

  // Client-side date and search filtering
  const filteredActivities = useMemo(() => {
    let list = [...activities];

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((act) => {
        const actor = (act.actor.fullName || act.actor.username || '').toLowerCase();
        const workTitle = (act.workItem?.title || '').toLowerCase();
        const preview = (act.metadata?.preview || '').toLowerCase();
        return actor.includes(q) || workTitle.includes(q) || preview.includes(q);
      });
    }

    // Date range filter
    if (dateRange !== 'ALL') {
      const now = new Date().getTime();
      const days = dateRange === '7D' ? 7 : dateRange === '30D' ? 30 : 90;
      const cutoff = now - days * 24 * 60 * 60 * 1000;
      list = list.filter((act) => new Date(act.createdAt).getTime() >= cutoff);
    }

    return list;
  }, [activities, searchQuery, dateRange]);

  const getActivityTypeCategory = (type: string): { label: string; badgeClass: string } => {
    if (type.startsWith('COMMENT_')) {
      return { label: 'Comment', badgeClass: 'badge-comment' };
    }
    if (type.startsWith('MEMBER_') || type === 'PROJECT_CREATED' || type === 'WORK_ASSIGNED') {
      return { label: 'Team Member', badgeClass: 'badge-member' };
    }
    return { label: 'Work Item', badgeClass: 'badge-work' };
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'WORK_STATUS_CHANGED':
        return <CheckSquareIcon size={15} />;
      case 'COMMENT_ADDED':
      case 'COMMENT_UPDATED':
      case 'COMMENT_DELETED':
        return <MessageSquareIcon size={15} />;
      case 'WORK_ASSIGNED':
        return <UsersIcon size={15} />;
      case 'WORK_CREATED':
        return <CircleDotIcon size={15} />;
      case 'MEMBER_JOINED':
      case 'MEMBER_INVITED':
      case 'MEMBER_ADDED':
        return <UserPlusIcon size={15} />;
      default:
        return <CheckSquareIcon size={15} />;
    }
  };

  const renderActivityText = (act: ActivityItem) => {
    const actorName = act.actor.fullName || act.actor.username;
    const workTitle = act.workItem?.title || 'work item';

    switch (act.type) {
      case 'WORK_STATUS_CHANGED':
        return (
          <div className="af-entry-text-row">
            <span className="af-entry-type-icon">{getActivityIcon(act.type)}</span>
            <span>
              <span className="af-actor-name">{actorName}</span> changed status of{' '}
              <span className="af-item-quote">"{workTitle}"</span> from{' '}
              <strong>{act.metadata?.from || 'TODO'}</strong> to{' '}
              <strong>{act.metadata?.to || 'IN_PROGRESS'}</strong>.
            </span>
          </div>
        );
      case 'COMMENT_ADDED':
        return (
          <>
            <div className="af-entry-text-row">
              <span className="af-entry-type-icon">{getActivityIcon(act.type)}</span>
              <span>
                <span className="af-actor-name">{actorName}</span> commented on{' '}
                <span className="af-item-quote">"{workTitle}"</span>.
              </span>
            </div>
            {act.metadata?.preview && (
              <div className="af-comment-quote-box">
                "{act.metadata.preview}"
              </div>
            )}
          </>
        );
      case 'WORK_ASSIGNED':
        return (
          <div className="af-entry-text-row">
            <span className="af-entry-type-icon">{getActivityIcon(act.type)}</span>
            <span>
              <span className="af-actor-name">{actorName}</span> assigned{' '}
              <span className="af-item-quote">"{workTitle}"</span> to{' '}
              <strong>{act.metadata?.assignedToName || 'Alwin James'}</strong>.
            </span>
          </div>
        );
      case 'WORK_CREATED':
        return (
          <div className="af-entry-text-row">
            <span className="af-entry-type-icon">{getActivityIcon(act.type)}</span>
            <span>
              <span className="af-actor-name">{actorName}</span> created work item{' '}
              <span className="af-item-quote">"{workTitle}"</span>.
            </span>
          </div>
        );
      case 'PROJECT_CREATED':
      case 'MEMBER_JOINED':
        return (
          <div className="af-entry-text-row">
            <span className="af-entry-type-icon">{getActivityIcon(act.type)}</span>
            <span>
              <span className="af-actor-name">{actorName}</span> joined the project.
            </span>
          </div>
        );
      default:
        return (
          <div className="af-entry-text-row">
            <span className="af-entry-type-icon">{getActivityIcon(act.type)}</span>
            <span>
              <span className="af-actor-name">{actorName}</span> updated{' '}
              <span className="af-item-quote">"{workTitle}"</span>.
            </span>
          </div>
        );
    }
  };

  const formatActivityTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return 'Sep 13, 2026, 09:53 AM';
    }
  };

  const getActorColor = (name: string) => {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const idx = Math.abs(hash) % AVATAR_COLORS.length;
    return AVATAR_COLORS[idx];
  };

  if (loading) {
    return (
      <div className="workspace-loading-state">
        <div className="btn-spinner" />
        <p>Loading project activity...</p>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="workspace-error-state">
        <AlertCircleIcon size={32} />
        <h2>Unable to load activity</h2>
        <p>{error || 'Project not found'}</p>
        <Button variant="primary" onClick={() => navigate('/app/dashboard')}>
          Back to Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className={hideHeader ? 'activity-feed-embedded' : 'project-workspace-page'}>
      {/* Hero Banner Card on top of List page */}
      {!hideHeader && project && (
        <ProjectWorkspaceHeader
          project={project}
          currentTab="list"
          showHeroCard={true}
          onOpenCreateWorkModal={() => setCreateModalOpen(true)}
        />
      )}

      <div className="activity-feed-wrapper">
        {/* Top Header Card */}
        <div className="af-header-card">
          <div className="af-header-left">
            <div className="af-header-title-row">
              <ClockIcon size={22} className="af-header-icon" />
              <h1 className="af-header-title">Activity Feed</h1>
            </div>
            <p className="af-header-subtitle">
              Track all updates across work items, comments, and team members.
            </p>
          </div>

          <div className="af-header-right">
            {/* Category Dropdown Filter */}
            <CustomSelect
              value={category}
              onChange={(val) => setCategory(val as any)}
              compact
              fullWidth={false}
              options={[
                { value: 'all', label: 'All Activity' },
                { value: 'work', label: 'Work Items' },
                { value: 'comments', label: 'Comments' },
                { value: 'members', label: 'Team & Members' },
              ]}
            />

            {/* Date Range Dropdown Filter */}
            <CustomSelect
              value={dateRange}
              onChange={(val) => setDateRange(val as any)}
              compact
              fullWidth={false}
              options={[
                {
                  value: '30D',
                  label: 'Last 30 Days',
                  icon: <CalendarIcon size={14} />,
                },
                {
                  value: '7D',
                  label: 'Last 7 Days',
                  icon: <CalendarIcon size={14} />,
                },
                {
                  value: '90D',
                  label: 'Last 90 Days',
                  icon: <CalendarIcon size={14} />,
                },
                {
                  value: 'ALL',
                  label: 'All Time',
                  icon: <CalendarIcon size={14} />,
                },
              ]}
            />

            {/* Search Input Box */}
            <div className="af-search-box">
              <SearchIcon size={15} className="af-search-icon" />
              <input
                type="text"
                placeholder="Search activity..."
                className="af-search-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Category Filter Pills Bar */}
        <div className="af-pills-bar">
          <button
            type="button"
            className={`af-pill-btn ${category === 'all' ? 'active' : ''}`}
            onClick={() => setCategory('all')}
          >
            <ListIcon size={14} />
            <span>All Activity</span>
          </button>
          <button
            type="button"
            className={`af-pill-btn ${category === 'work' ? 'active' : ''}`}
            onClick={() => setCategory('work')}
          >
            <CheckSquareIcon size={14} />
            <span>Work Items</span>
          </button>
          <button
            type="button"
            className={`af-pill-btn ${category === 'comments' ? 'active' : ''}`}
            onClick={() => setCategory('comments')}
          >
            <MessageSquareIcon size={14} />
            <span>Comments</span>
          </button>
          <button
            type="button"
            className={`af-pill-btn ${category === 'members' ? 'active' : ''}`}
            onClick={() => setCategory('members')}
          >
            <UsersIcon size={14} />
            <span>Team & Members</span>
          </button>
        </div>

        {/* Activity Timeline List */}
        <div className="af-timeline-list">
          {filteredActivities.length === 0 ? (
            <div className="af-empty-card">
              <ActivityIcon size={32} />
              <h3>No activity found</h3>
              <p>Actions performed on this project will be recorded here.</p>
            </div>
          ) : (
            filteredActivities.map((act) => {
              const actorName = act.actor.fullName || act.actor.username || 'User';
              const actorInitial = actorName.charAt(0).toLowerCase();
              const { label: catLabel, badgeClass } = getActivityTypeCategory(act.type);
              const isComment = act.type.startsWith('COMMENT_');

              return (
                <div key={act.id} className="af-entry-card">
                  {/* Left Col: Avatar + Content */}
                  <div className="af-entry-left">
                    <div className="af-entry-avatar-wrap">
                      {act.actor.avatarUrl ? (
                        <img
                          src={act.actor.avatarUrl}
                          alt={actorName}
                          className="af-entry-avatar-img"
                        />
                      ) : (
                        <div
                          className="af-entry-avatar-initials"
                          style={{ backgroundColor: getActorColor(actorName) }}
                        >
                          {actorInitial}
                        </div>
                      )}
                    </div>

                    <div className="af-entry-body">
                      {renderActivityText(act)}

                      <div className="af-entry-time-row">
                        <ClockIcon size={13} />
                        <span>{formatActivityTime(act.createdAt)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Right Col: Category Badge + Action Link + More Options */}
                  <div className="af-entry-right">
                    <span className={`af-category-badge ${badgeClass}`}>
                      {catLabel}
                    </span>

                    {act.workItemId && (
                      <button
                        type="button"
                        className="af-view-link-btn"
                        onClick={() => setSelectedWorkItemId(act.workItemId!)}
                      >
                        {isComment ? 'View Comment →' : 'View Work Item →'}
                      </button>
                    )}

                    <button
                      type="button"
                      className="af-more-btn"
                      title="Options"
                      onClick={() => {
                        if (act.workItemId) {
                          setSelectedWorkItemId(act.workItemId);
                        }
                      }}
                    >
                      <MoreHorizontalIcon size={16} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Modals */}
      {createModalOpen && (
        <CreateWorkItemModal
          project={project}
          isOpen={createModalOpen}
          onClose={() => setCreateModalOpen(false)}
          onCreated={() => loadActivities()}
        />
      )}

      {selectedWorkItemId && (
        <WorkItemDetailsModal
          project={project}
          workItemId={selectedWorkItemId}
          onClose={() => setSelectedWorkItemId(null)}
          onUpdated={() => loadActivities()}
          onDeleted={() => {
            setSelectedWorkItemId(null);
            loadActivities();
          }}
        />
      )}
    </div>
  );
};
export default ProjectActivityPage;
