import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter, Link } from '../../router/Router';
import { projectsApi, type Project } from '../../api/projects.api';
import { activityApi, type ActivityItem } from '../../api/activity.api';
import { ProjectWorkspaceHeader } from '../../components/workspace/ProjectWorkspaceHeader';
import { CreateWorkItemModal } from '../../components/workspace/CreateWorkItemModal';
import { WorkItemDetailsModal } from '../../components/workspace/WorkItemDetailsModal';
import {
  AlertCircleIcon,
} from '../../components/ui/Icons';
import { Button } from '../../components/ui/Button';
import { ActivityHeaderAtmosphere } from '../../components/common/HeaderAtmosphereArt';

// --- SVGs Matching ActivityPage Pixel-for-Pixel ---

const LayersIcon: React.FC<{ size?: number; className?: string }> = ({ size = 14, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <polygon points="12 2 2 7 12 12 22 7 12 2" />
    <polyline points="2 17 12 22 22 17" />
    <polyline points="2 12 12 17 22 12" />
  </svg>
);

const TaskCheckIcon: React.FC<{ size?: number; className?: string }> = ({ size = 14, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <polyline points="9 11 12 14 22 4" />
    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
  </svg>
);

const CommentBubbleIcon: React.FC<{ size?: number; className?: string }> = ({ size = 14, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
  </svg>
);

const NoteDocIcon: React.FC<{ size?: number; className?: string }> = ({ size = 14, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </svg>
);

const CalIcon: React.FC<{ size?: number; className?: string }> = ({ size = 14, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

const FolderPillIcon: React.FC<{ size?: number; className?: string }> = ({ size = 14, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
  </svg>
);

const TeamGroupIcon: React.FC<{ size?: number; className?: string }> = ({ size = 14, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const SearchMagnifierIcon: React.FC<{ size?: number; className?: string }> = ({ size = 14, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const RefreshStatusIcon: React.FC<{ size?: number }> = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 2v6h6" />
    <path d="M21 12A9 9 0 0 0 6 5.3L3 8" />
    <path d="M21 22v-6h-6" />
    <path d="M3 12a9 9 0 0 0 15 6.7l3-2.7" />
  </svg>
);

const DoneCheckIcon: React.FC<{ size?: number }> = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9.5" />
    <path d="m8.5 12 2.5 2.5 4.5-5" />
  </svg>
);

const BubbleCommentIcon: React.FC<{ size?: number }> = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
  </svg>
);

const FileUploadedNodeIcon: React.FC<{ size?: number }> = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <polygon points="10 11 10 16 14 13.5" fill="currentColor" stroke="none" />
  </svg>
);

const DefaultNodeIcon: React.FC<{ size?: number }> = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

const MoreOptionsIcon: React.FC<{ size?: number; className?: string }> = ({ size = 16, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
    <circle cx="12" cy="5" r="2.2" />
    <circle cx="12" cy="12" r="2.2" />
    <circle cx="12" cy="19" r="2.2" />
  </svg>
);

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
  const [category, setCategory] = useState<'all' | 'work' | 'comments' | 'notes' | 'calendar' | 'files' | 'members'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dropdown & Modal state
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedWorkItemId, setSelectedWorkItemId] = useState<string | null>(null);

  const menuRef = useRef<HTMLDivElement | null>(null);

  // Close menus on outside click or Escape key
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuId(null);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  useEffect(() => {
    if (propProject) {
      setProject(propProject);
    }
  }, [propProject]);

  const loadActivities = useCallback(async (forceProjectRefresh = false) => {
    if (!projectId) return;
    setLoading(true);
    setError(null);

    try {
      const needsProject = forceProjectRefresh || (!propProject && !project);
      const [projRes, actRes] = await Promise.all([
        needsProject ? projectsApi.getProjectById(projectId) : Promise.resolve(null),
        activityApi.getProjectActivities(projectId, { limit: 100 }),
      ]);

      if (projRes && projRes.success && projRes.data?.project) {
        setProject(projRes.data.project);
      }
      if (actRes.success && actRes.data) {
        setActivities(actRes.data.activities || []);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load project activity');
    } finally {
      setLoading(false);
    }
  }, [projectId, propProject, project]);

  useEffect(() => {
    loadActivities();
  }, [projectId]);

  // Filter Categories matching ActivityPage
  const filterCategories: { id: 'all' | 'work' | 'comments' | 'notes' | 'calendar' | 'files' | 'members'; label: string; icon: React.ReactNode }[] = [
    { id: 'all', label: 'All Activity', icon: <LayersIcon size={14} /> },
    { id: 'work', label: 'Work Items', icon: <TaskCheckIcon size={14} /> },
    { id: 'comments', label: 'Comments', icon: <CommentBubbleIcon size={14} /> },
    { id: 'notes', label: 'Notes', icon: <NoteDocIcon size={14} /> },
    { id: 'calendar', label: 'Calendar', icon: <CalIcon size={14} /> },
    { id: 'files', label: 'Files', icon: <FolderPillIcon size={14} /> },
    { id: 'members', label: 'Team', icon: <TeamGroupIcon size={14} /> },
  ];

  // Client-side search and category filtering
  const filteredActivities = useMemo(() => {
    let list = [...activities];

    // Category filtering
    if (category !== 'all') {
      list = list.filter((act) => {
        const type = act.type || '';
        switch (category) {
          case 'work':
            return type.startsWith('WORK_') || type.includes('TASK');
          case 'comments':
            return type.startsWith('COMMENT_');
          case 'notes':
            return type.startsWith('NOTE_');
          case 'calendar':
            return type.startsWith('CALENDAR_');
          case 'files':
            return type.startsWith('FILE_') || type.startsWith('FOLDER_');
          case 'members':
            return type.startsWith('MEMBER_') || type === 'PROJECT_CREATED';
          default:
            return true;
        }
      });
    }

    // Search query filtering
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((act) => {
        const actor = (act.actor?.fullName || act.actor?.username || '').toLowerCase();
        const workTitle = (act.workItem?.title || '').toLowerCase();
        const preview = (act.metadata?.preview || act.metadata?.title || act.metadata?.name || '').toLowerCase();
        return actor.includes(q) || workTitle.includes(q) || preview.includes(q);
      });
    }

    return list;
  }, [activities, category, searchQuery]);

  // Group activities by date (Today, Yesterday, or formatted date string)
  const dateGroups = useMemo(() => {
    const dateMap: { [key: string]: ActivityItem[] } = {};

    filteredActivities.forEach((item) => {
      const itemDate = new Date(item.createdAt);
      const today = new Date();
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      let dateLabel = 'Earlier';
      if (itemDate.toDateString() === today.toDateString()) {
        dateLabel = 'Today';
      } else if (itemDate.toDateString() === yesterday.toDateString()) {
        dateLabel = 'Yesterday';
      } else {
        dateLabel = itemDate.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        });
      }

      if (!dateMap[dateLabel]) {
        dateMap[dateLabel] = [];
      }
      dateMap[dateLabel].push(item);
    });

    return Object.entries(dateMap).map(([dateLabel, items]) => ({
      dateLabel,
      items,
    }));
  }, [filteredActivities]);

  // Format 12-hour AM/PM time matching ActivityPage (e.g., "12:45 PM")
  const formatTimeAMPM = (iso: string): string => {
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return '12:00 PM';
    }
  };

  // Subtext folder / context target title
  const getTargetContextName = (act: ActivityItem): string => {
    if (act.type === 'FILE_UPLOADED') {
      return act.workItem?.title || project?.name || 'Documentation';
    }
    return act.workItem?.title || act.metadata?.title || act.metadata?.name || project?.name || 'Task';
  };

  // Action text renderer matching ActivityPage
  const renderActivityText = (act: ActivityItem) => {
    const actorName = act.actor?.fullName || act.actor?.username || 'Team Member';
    const targetTitle = act.workItem?.title || act.metadata?.title || act.metadata?.name || 'task';

    switch (act.type) {
      case 'WORK_STATUS_CHANGED':
        return (
          <>
            <span className="wap-actor-name">{actorName}</span>{' '}
            <span className="wap-action-phrase">changed status of</span>{' '}
            <span className="wap-target-title">&ldquo;{targetTitle}&rdquo;</span>
          </>
        );
      case 'WORK_COMPLETED':
        return (
          <>
            <span className="wap-actor-name">{actorName}</span>{' '}
            <span className="wap-action-phrase">completed task</span>{' '}
            <span className="wap-target-title">&ldquo;{targetTitle}&rdquo;</span>
          </>
        );
      case 'COMMENT_ADDED':
        return (
          <>
            <span className="wap-actor-name">{actorName}</span>{' '}
            <span className="wap-action-phrase">added a comment on</span>{' '}
            <span className="wap-target-title">&ldquo;{targetTitle}&rdquo;</span>
          </>
        );
      case 'FILE_UPLOADED': {
        const fileName = act.metadata?.name || act.metadata?.title || 'Project Plan.pdf';
        return (
          <>
            <span className="wap-actor-name">{actorName}</span>{' '}
            <span className="wap-action-phrase">uploaded file</span>{' '}
            <span className="wap-target-title">&ldquo;{fileName}&rdquo;</span>
          </>
        );
      }
      case 'PROJECT_CREATED':
        return (
          <>
            <span className="wap-actor-name">{actorName}</span>{' '}
            <span className="wap-action-phrase">created project</span>{' '}
            <span className="wap-target-title">&ldquo;{project?.name || targetTitle}&rdquo;</span>
          </>
        );
      case 'NOTE_CREATED':
        return (
          <>
            <span className="wap-actor-name">{actorName}</span>{' '}
            <span className="wap-action-phrase">published note</span>{' '}
            <span className="wap-target-title">&ldquo;{targetTitle}&rdquo;</span>
          </>
        );
      case 'CALENDAR_EVENT_CREATED':
        return (
          <>
            <span className="wap-actor-name">{actorName}</span>{' '}
            <span className="wap-action-phrase">scheduled calendar event</span>{' '}
            <span className="wap-target-title">&ldquo;{targetTitle}&rdquo;</span>
          </>
        );
      case 'MEMBER_JOINED':
      case 'MEMBER_ADDED':
        return (
          <>
            <span className="wap-actor-name">{actorName}</span>{' '}
            <span className="wap-action-phrase">joined the project team</span>
          </>
        );
      default:
        return (
          <>
            <span className="wap-actor-name">{actorName}</span>{' '}
            <span className="wap-action-phrase">updated</span>{' '}
            <span className="wap-target-title">&ldquo;{targetTitle}&rdquo;</span>
          </>
        );
    }
  };

  // Action node icon
  const getNodeInfo = (type: string) => {
    if (type.includes('COMPLETED')) {
      return { className: 'wap-node-completed', icon: <DoneCheckIcon /> };
    }
    if (type.includes('STATUS')) {
      return { className: 'wap-node-status', icon: <RefreshStatusIcon /> };
    }
    if (type.includes('COMMENT')) {
      return { className: 'wap-node-comment', icon: <BubbleCommentIcon /> };
    }
    if (type.includes('FILE') || type.includes('FOLDER')) {
      return { className: 'wap-node-file', icon: <FileUploadedNodeIcon /> };
    }
    if (type.includes('MEMBER')) {
      return { className: 'wap-node-member', icon: <TeamGroupIcon size={14} /> };
    }
    if (type.includes('NOTE')) {
      return { className: 'wap-node-note', icon: <NoteDocIcon size={14} /> };
    }
    if (type.includes('CALENDAR')) {
      return { className: 'wap-node-calendar', icon: <CalIcon size={14} /> };
    }
    return { className: 'wap-node-default', icon: <DefaultNodeIcon /> };
  };

  // Submeta action label
  const getActionLabel = (type: string): string => {
    if (type.includes('COMPLETED')) return 'Task completed';
    if (type.includes('STATUS')) return 'Status changed';
    if (type.includes('COMMENT')) return 'New comment';
    if (type.includes('FILE') || type.includes('FOLDER')) return 'File uploaded';
    if (type.includes('MEMBER')) return 'Member joined';
    if (type.includes('NOTE')) return 'Note published';
    if (type.includes('CALENDAR')) return 'Calendar event';
    if (type.includes('PROJECT')) return 'Project created';
    return 'Activity updated';
  };

  // Right status pill badge
  const getBadgeElement = (type: string) => {
    if (type.includes('COMPLETED')) {
      return (
        <span className="wap-badge-pill wap-badge-completed">
          <span className="wap-badge-dot" />
          Task completed
        </span>
      );
    }
    if (type.includes('STATUS')) {
      return (
        <span className="wap-badge-pill wap-badge-status">
          <span className="wap-badge-dot" />
          Status changed
        </span>
      );
    }
    if (type.includes('COMMENT')) {
      return (
        <span className="wap-badge-pill wap-badge-comment">
          <BubbleCommentIcon size={12} />
          New comment
        </span>
      );
    }
    if (type.includes('FILE') || type.includes('FOLDER')) {
      return (
        <span className="wap-badge-pill wap-badge-file">
          <span className="wap-badge-dot" />
          File uploaded
        </span>
      );
    }
    if (type.includes('MEMBER')) {
      return (
        <span className="wap-badge-pill wap-badge-member">
          <span className="wap-badge-dot" />
          Member joined
        </span>
      );
    }
    if (type.includes('NOTE')) {
      return (
        <span className="wap-badge-pill wap-badge-note">
          <span className="wap-badge-dot" />
          Note published
        </span>
      );
    }
    if (type.includes('CALENDAR')) {
      return (
        <span className="wap-badge-pill wap-badge-calendar">
          <span className="wap-badge-dot" />
          Calendar event
        </span>
      );
    }
    if (type.includes('UPDATE')) {
      return (
        <span className="wap-badge-pill wap-badge-updated">
          <span className="wap-badge-dot" />
          Updated
        </span>
      );
    }
    return (
      <span className="wap-badge-pill wap-badge-updated">
        <span className="wap-badge-dot" />
        Updated
      </span>
    );
  };

  if (loading && !project) {
    return (
      <div className="workspace-loading-state" style={{ minHeight: '60vh' }}>
        <div className="btn-spinner" />
        <p>Loading project activity...</p>
      </div>
    );
  }

  if (error && !project) {
    return (
      <div className="workspace-error-state" style={{ minHeight: '60vh' }}>
        <AlertCircleIcon size={32} />
        <h2>Unable to load activity</h2>
        <p>{error || 'Project not found'}</p>
        <Button variant="primary" onClick={() => navigate('/app/dashboard')}>
          Back to Dashboard
        </Button>
      </div>
    );
  }

  const projectInitial = (project?.name || 'P').charAt(0).toUpperCase();

  return (
    <div className={hideHeader ? 'activity-feed-embedded' : 'project-workspace-page'}>
      {/* Hero Banner Card on top of standalone page */}
      {!hideHeader && project && (
        <ProjectWorkspaceHeader
          project={project}
          currentTab="activity"
          showHeroCard={true}
          onOpenCreateWorkModal={() => setCreateModalOpen(true)}
        />
      )}

      {/* Top Atmosphere Header Card Matching Pic 4 */}
      <div className="cal-page-header activity-page-top-header" style={{ marginBottom: '1.25rem' }}>
        <div className="cal-header-left">
          <div className="cal-title-row">
            <span className="wap-banner-icon-badge">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0F172A" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
              </svg>
            </span>
            <h1 className="cal-header-title">Project Activity</h1>
          </div>
          <p className="cal-header-subtitle">
            Real-time chronological stream of events for this project.
          </p>
        </div>

        {/* Atmosphere Quote & Art on Right */}
        <ActivityHeaderAtmosphere />
      </div>

      {/* 1. Unified Toolbar Matching ActivityPage (Search Box & Category Filter Pills) */}
      <div className="wap-toolbar" style={{ marginBottom: '1.25rem' }}>
        {/* Search Box on Left */}
        <div className="wap-search-pill-box">
          <SearchMagnifierIcon className="wap-search-icon" />
          <input
            type="text"
            placeholder="Search activity..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="wap-search-input"
          />
        </div>

        {/* Category Pills on the same line */}
        <div className="wap-categories-list">
          {filterCategories.map((t) => {
            const isActive = category === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setCategory(t.id)}
                className={`wap-category-pill ${isActive ? 'active' : ''}`}
              >
                {t.icon}
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Feed Timeline: Division based on Project Card with ActivityPage UX */}
      <div className="wap-feed-container">
        {loading ? (
          <div className="wap-empty-state-card">
            <div
              className="btn-spinner"
              style={{
                width: '32px',
                height: '32px',
                margin: '0 auto 14px',
                borderWidth: '2.5px',
                borderColor: '#10B981',
                borderTopColor: 'transparent',
              }}
            />
            <p style={{ fontSize: '13.5px', fontWeight: 500, margin: 0, color: '#6B7280' }}>
              Loading real-time events...
            </p>
          </div>
        ) : filteredActivities.length === 0 ? (
          <div className="wap-empty-state-card">
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                background: '#F4F7F1',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 14px',
                color: '#2D6A4F',
              }}
            >
              <TaskCheckIcon size={22} />
            </div>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#111827', margin: '0 0 6px' }}>
              No activities found
            </h3>
            <p style={{ fontSize: '13.5px', color: '#9CA3AF', maxWidth: '380px', margin: '0 auto 18px' }}>
              {searchQuery || category !== 'all'
                ? 'Try adjusting your search query or category filters.'
                : 'Project updates, task assignments, and comments will show up here.'}
            </p>
            {(searchQuery || category !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setCategory('all');
                  setSearchQuery('');
                }}
                style={{
                  padding: '6px 16px',
                  fontSize: '13px',
                  fontWeight: 600,
                  borderRadius: '8px',
                  border: '1px solid #E5E7EB',
                  background: '#111827',
                  color: '#FFFFFF',
                  cursor: 'pointer',
                }}
              >
                Clear Filters
              </button>
            )}
          </div>
        ) : (
          <div className="wap-project-card">
            {/* Project Header Row matching Screenshot */}
            <div className="wap-project-card-header">
              <div className="wap-project-header-left">
                {/* Project Badge */}
                {project?.avatarUrl ? (
                  <img src={project.avatarUrl} alt="" className="wap-project-card-avatar-img" />
                ) : (
                  <div className="wap-project-card-avatar">{projectInitial}</div>
                )}

                {/* Project Name Link */}
                <Link to={`/app/projects/${projectId}`} className="wap-project-card-title">
                  {project?.name || 'Project'}
                </Link>

                {/* Activity Count Pill */}
                <span className="wap-project-count-pill">
                  {filteredActivities.length} {filteredActivities.length === 1 ? 'activity' : 'activities'}
                </span>
              </div>
            </div>

            {/* Project Card Body with Connected Vertical Timeline */}
            <div className="wap-project-card-body">
              {dateGroups.map((dateGroup) => (
                <div key={dateGroup.dateLabel} className="wap-timeline-date-section">
                  {/* Date Pill positioned on the vertical timeline */}
                  <div className="wap-timeline-date-wrap">
                    <span className="wap-timeline-date-pill">{dateGroup.dateLabel}</span>
                  </div>

                  {/* Timeline Rows for this date */}
                  <div className="wap-timeline-list">
                    {dateGroup.items.map((act, actIdx) => {
                      const node = getNodeInfo(act.type);
                      const actorInitial = (act.actor?.fullName || act.actor?.username || 'U')[0].toUpperCase();
                      const isMenuOpen = openMenuId === act.id;
                      const isFirst = actIdx === 0;
                      const isLast = actIdx === dateGroup.items.length - 1;

                      // Check if row has any actionable modal or link
                      const hasRowAction = Boolean(
                        act.workItemId ||
                        act.type.startsWith('NOTE') ||
                        act.type.startsWith('FILE') ||
                        act.type.startsWith('CALENDAR') ||
                        act.type.startsWith('MEMBER')
                      );

                      return (
                        <div
                          key={act.id}
                          className={`wap-timeline-row ${isMenuOpen ? 'has-open-menu' : ''}`}
                        >
                          {/* Continuous Vertical Timeline Line */}
                          <div
                            className={`wap-timeline-line ${isFirst ? 'is-first' : ''} ${isLast ? 'is-last' : ''}`}
                          />

                          {/* Circular Action Node */}
                          <div className={`wap-timeline-node ${node.className}`}>
                            {node.icon}
                          </div>

                          {/* Row Left Content */}
                          <div className="wap-row-left">
                            {/* User Avatar */}
                            <div className="wap-avatar-wrap">
                              {act.actor?.avatarUrl ? (
                                <img src={act.actor.avatarUrl} alt="" className="wap-avatar-img" />
                              ) : (
                                <span className="wap-avatar-initials">{actorInitial}</span>
                              )}
                            </div>

                            {/* Text Stack */}
                            <div className="wap-content-stack">
                              <div
                                className="wap-main-text"
                                style={{ cursor: act.workItemId ? 'pointer' : 'default' }}
                                onClick={() => {
                                  if (act.workItemId) setSelectedWorkItemId(act.workItemId);
                                }}
                              >
                                {renderActivityText(act)}
                              </div>

                              <div className="wap-sub-meta">
                                <span className="wap-meta-time">{formatTimeAMPM(act.createdAt)}</span>
                                <span className="wap-meta-sep">•</span>
                                <span className="wap-meta-action-name">{getActionLabel(act.type)}</span>
                                <span className="wap-meta-sep">•</span>
                                <span className="wap-meta-target">
                                  <FolderPillIcon size={12} className="wap-target-folder-icon" />
                                  <span>{getTargetContextName(act)}</span>
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Row Right: Status Badge & Options Menu */}
                          <div className="wap-row-right">
                            {getBadgeElement(act.type)}

                            {hasRowAction && (
                              <div
                                className={`wap-action-menu-wrap ${isMenuOpen ? 'is-open' : ''}`}
                                ref={isMenuOpen ? menuRef : undefined}
                              >
                                <button
                                  type="button"
                                  className="wap-more-btn"
                                  aria-label="Activity options"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOpenMenuId(isMenuOpen ? null : act.id);
                                  }}
                                >
                                  <MoreOptionsIcon size={16} />
                                </button>

                                {isMenuOpen && (
                                  <div className="wap-dropdown-menu">
                                    {act.workItemId && (
                                      <button
                                        type="button"
                                        className="wap-dropdown-item"
                                        onClick={() => {
                                          if (act.workItemId) {
                                            setSelectedWorkItemId(act.workItemId);
                                          }
                                          setOpenMenuId(null);
                                        }}
                                      >
                                        <TaskCheckIcon size={14} />
                                        <span>View Task Details</span>
                                      </button>
                                    )}

                                    {act.type.startsWith('NOTE') && (
                                      <Link
                                        to={`/app/projects/${projectId}/notes`}
                                        className="wap-dropdown-item"
                                        onClick={() => setOpenMenuId(null)}
                                      >
                                        <NoteDocIcon size={14} />
                                        <span>View Notes</span>
                                      </Link>
                                    )}

                                    {act.type.startsWith('FILE') && (
                                      <Link
                                        to={`/app/projects/${projectId}/files`}
                                        className="wap-dropdown-item"
                                        onClick={() => setOpenMenuId(null)}
                                      >
                                        <FolderPillIcon size={14} />
                                        <span>View Files</span>
                                      </Link>
                                    )}

                                    {act.type.startsWith('CALENDAR') && (
                                      <Link
                                        to={`/app/projects/${projectId}/calendar`}
                                        className="wap-dropdown-item"
                                        onClick={() => setOpenMenuId(null)}
                                      >
                                        <CalIcon size={14} />
                                        <span>View Calendar</span>
                                      </Link>
                                    )}

                                    {act.type.startsWith('MEMBER') && (
                                      <Link
                                        to={`/app/projects/${projectId}/members`}
                                        className="wap-dropdown-item"
                                        onClick={() => setOpenMenuId(null)}
                                      >
                                        <TeamGroupIcon size={14} />
                                        <span>View Team</span>
                                      </Link>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {createModalOpen && project && (
        <CreateWorkItemModal
          project={project}
          isOpen={createModalOpen}
          onClose={() => setCreateModalOpen(false)}
          onCreated={() => loadActivities()}
        />
      )}

      {selectedWorkItemId && project && (
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
