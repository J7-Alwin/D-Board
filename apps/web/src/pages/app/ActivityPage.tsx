import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link } from '../../router/Router';
import { activityApi, type ActivityItem } from '../../api/activity.api';

// --- Custom SVGs for Pixel-Perfect Design ---

const LayersIcon: React.FC<{ size?: number; className?: string }> = ({ size = 15, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <polygon points="12 2 2 7 12 12 22 7 12 2" />
    <polyline points="2 17 12 22 22 17" />
    <polyline points="2 12 12 17 22 12" />
  </svg>
);

const TaskCheckIcon: React.FC<{ size?: number; className?: string }> = ({ size = 15, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <polyline points="9 11 12 14 22 4" />
    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
  </svg>
);

const CommentBubbleIcon: React.FC<{ size?: number; className?: string }> = ({ size = 15, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
  </svg>
);

const NoteDocIcon: React.FC<{ size?: number; className?: string }> = ({ size = 15, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </svg>
);

const CalIcon: React.FC<{ size?: number; className?: string }> = ({ size = 15, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

const FolderPillIcon: React.FC<{ size?: number; className?: string }> = ({ size = 15, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
  </svg>
);

const TeamGroupIcon: React.FC<{ size?: number; className?: string }> = ({ size = 15, className = '' }) => (
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

const MoreOptionsIcon: React.FC<{ size?: number; className?: string }> = ({ size = 16, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
    <circle cx="12" cy="5" r="2.2" />
    <circle cx="12" cy="12" r="2.2" />
    <circle cx="12" cy="19" r="2.2" />
  </svg>
);

// Timeline Node Icons
const RefreshStatusIcon: React.FC<{ size?: number }> = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 2v6h6" />
    <path d="M21 12A9 9 0 0 0 6 5.3L3 8" />
    <path d="M21 22v-6h-6" />
    <path d="M3 12a9 9 0 0 0 15 6.7l3-2.7" />
  </svg>
);

const DoneCheckIcon: React.FC<{ size?: number }> = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9.5" />
    <path d="m8.5 12 2.5 2.5 4.5-5" />
  </svg>
);

const BubbleCommentIcon: React.FC<{ size?: number }> = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
  </svg>
);

const DefaultNodeIcon: React.FC<{ size?: number }> = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

// --- Top Banner Artwork SVG matching reference illustration ---
const BannerArt: React.FC = () => (
  <div className="wap-banner-art-wrap" aria-hidden="true">
    <svg width="290" height="110" viewBox="0 0 290 110" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Background Soft Sage Radial Aura */}
      <ellipse cx="230" cy="55" rx="75" ry="48" fill="rgba(226, 240, 224, 0.55)" />

      {/* Botanical Sprig / Eucalyptus Foliage on Left */}
      <g opacity="0.9">
        <path d="M46 95 C 43 72, 38 48, 26 30" stroke="#9ABF92" strokeWidth="2.2" strokeLinecap="round" />
        <path d="M26 30 C 21 21, 33 13, 40 22 C 43 27, 36 33, 26 30 Z" fill="#81AA7D" />
        <path d="M34 42 C 45 37, 52 46, 43 54 C 37 58, 33 50, 34 42 Z" fill="#62905E" />
        <path d="M18 48 C 8 44, 10 34, 20 38 C 24 40, 23 46, 18 48 Z" fill="#99BD92" />
        <path d="M38 66 C 48 64, 52 72, 44 78 C 38 80, 36 73, 38 66 Z" fill="#75A070" />
        <path d="M26 70 C 16 68, 18 58, 28 62 C 31 64, 30 69, 26 70 Z" fill="#88B283" />
      </g>

      {/* Floating Tilted Workspace Card */}
      <g transform="matrix(0.99 0.05 -0.05 0.99 76 13)">
        {/* Soft shadow */}
        <rect x="0" y="0" width="114" height="80" rx="12" fill="#000000" fillOpacity="0.04" transform="translate(2, 3)" />
        {/* White Card Body */}
        <rect x="0" y="0" width="114" height="80" rx="12" fill="#FFFFFF" stroke="#E3EAE0" strokeWidth="1.2" />

        {/* Top-left plus icon */}
        <path d="M12 14 H18 M15 11 V17" stroke="#CBD8C7" strokeWidth="1.5" strokeLinecap="round" />

        {/* D-Board Mini Brand Badge on top right */}
        <rect x="80" y="8" width="22" height="22" rx="5" fill="#111827" />
        <path d="M86 13 H89.5 C92.5 13, 94.5 15, 94.5 19 C94.5 23, 92.5 25, 89.5 25 H86 Z" fill="#22C55E" />
        <path d="M88 15 H89.5 C91 15, 92 16.5, 92 19 C92 21.5, 91 23, 89.5 23 H88 Z" fill="#111827" />

        {/* Document Skeleton Lines */}
        <circle cx="16" cy="34" r="2.5" fill="#9FC298" />
        <rect x="24" y="32" width="70" height="4" rx="2" fill="#E8F0E5" />

        <circle cx="16" cy="46" r="2.5" fill="#9FC298" />
        <rect x="24" y="44" width="58" height="4" rx="2" fill="#E8F0E5" />

        <circle cx="16" cy="58" r="2.5" fill="#9FC298" />
        <rect x="24" y="56" width="44" height="4" rx="2" fill="#E8F0E5" />
      </g>

      {/* Trajectory Flight Path (Dashed Arc) */}
      <path d="M192 78 C 215 62, 230 40, 252 24" stroke="#9EBE99" strokeWidth="1.6" strokeDasharray="3 3.5" strokeLinecap="round" fill="none" />

      {/* Circular green indicator dot on trajectory */}
      <circle cx="218" cy="42" r="10" fill="#589B53" fillOpacity="0.22" />
      <circle cx="218" cy="42" r="5" fill="#2E7729" />

      {/* Origami Paper Airplane */}
      <g transform="translate(244, 12) rotate(10)">
        <polygon points="0,16 28,0 16,24" fill="#FFFFFF" stroke="#1F2937" strokeWidth="1.2" strokeLinejoin="round" />
        <polygon points="16,24 28,0 8,19" fill="#F0F4EF" stroke="#1F2937" strokeWidth="1.2" strokeLinejoin="round" />
        <line x1="8" y1="19" x2="28" y2="0" stroke="#1F2937" strokeWidth="1.2" />
      </g>

      {/* Floating Clock Badge */}
      <g transform="translate(228, 62)">
        <circle cx="16" cy="16" r="15" fill="#FAFDF9" stroke="#9EBE99" strokeWidth="1.5" />
        <circle cx="16" cy="16" r="1.5" fill="#3D5F38" />
        <path d="M16 9 V16 H21" stroke="#3D5F38" strokeWidth="1.5" strokeLinecap="round" />
      </g>
    </svg>
  </div>
);

// --- Component Main ---

export const ActivityPage: React.FC = () => {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [category, setCategory] = useState<'all' | 'work' | 'comments' | 'notes' | 'calendar' | 'files' | 'members'>('all');
  const [dateRange, setDateRange] = useState<'7D' | '30D' | '90D' | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const menuRef = useRef<HTMLDivElement | null>(null);

  // Close dropdown menu on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuId(null);
      }
    };
    if (openMenuId) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [openMenuId]);

  const loadActivities = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await activityApi.getGlobalActivities({
        category,
        limit: 100,
      });
      if (res.success && res.data) {
        setActivities(res.data.activities);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load workspace activity');
    } finally {
      setLoading(false);
    }
  }, [category]);

  useEffect(() => {
    loadActivities();
  }, [loadActivities]);

  // Client-side date and search filtering
  const filteredActivities = useMemo(() => {
    let list = [...activities];

    // Date range filter
    if (dateRange !== 'ALL') {
      const now = Date.now();
      const days = dateRange === '7D' ? 7 : dateRange === '30D' ? 30 : 90;
      const cutoff = now - days * 24 * 60 * 60 * 1000;
      list = list.filter((act) => new Date(act.createdAt).getTime() >= cutoff);
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((act) => {
        const actor = (act.actor?.fullName || act.actor?.username || '').toLowerCase();
        const workTitle = (act.workItem?.title || '').toLowerCase();
        const projName = (act.project?.name || '').toLowerCase();
        const preview = (act.metadata?.preview || act.metadata?.title || act.metadata?.name || '').toLowerCase();
        return actor.includes(q) || workTitle.includes(q) || projName.includes(q) || preview.includes(q);
      });
    }

    return list;
  }, [activities, dateRange, searchQuery]);

  // Group activities chronologically by day
  const groupedActivities = useMemo(() => {
    const groups: { [key: string]: ActivityItem[] } = {};

    filteredActivities.forEach((item) => {
      const itemDate = new Date(item.createdAt);
      const today = new Date();
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      let key = 'Earlier';
      if (itemDate.toDateString() === today.toDateString()) {
        key = 'Today';
      } else if (itemDate.toDateString() === yesterday.toDateString()) {
        key = 'Yesterday';
      } else {
        key = itemDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
      }

      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(item);
    });

    return Object.entries(groups).map(([dateLabel, items]) => ({
      dateLabel,
      items,
    }));
  }, [filteredActivities]);

  const formatRelativeTime = (iso: string): string => {
    const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getActorShortName = (act: ActivityItem): string => {
    if (act.actor?.fullName) {
      return act.actor.fullName.split(' ')[0];
    }
    return act.actor?.username || 'Alwin';
  };

  const renderActivityText = (act: ActivityItem) => {
    const actorName = act.actor?.fullName || act.actor?.username || 'Team member';
    const targetTitle = act.workItem?.title || act.metadata?.title || act.metadata?.name || act.project?.name || 'task';

    switch (act.type) {
      case 'PROJECT_CREATED':
        return (
          <>
            <span className="wap-actor-name">{actorName}</span> created project{' '}
            <span className="wap-target-title">&ldquo;{act.project?.name || targetTitle}&rdquo;</span>
          </>
        );
      case 'WORK_CREATED':
        return (
          <>
            <span className="wap-actor-name">{actorName}</span> created task{' '}
            <span className="wap-target-title">&ldquo;{targetTitle}&rdquo;</span>
          </>
        );
      case 'WORK_STATUS_CHANGED':
        return (
          <>
            <span className="wap-actor-name">{actorName}</span> changed status of{' '}
            <span className="wap-target-title">&ldquo;{targetTitle}&rdquo;</span>
          </>
        );
      case 'WORK_COMPLETED':
        return (
          <>
            <span className="wap-actor-name">{actorName}</span> completed task{' '}
            <span className="wap-target-title">&ldquo;{targetTitle}&rdquo;</span>
          </>
        );
      case 'COMMENT_ADDED':
        return (
          <>
            <span className="wap-actor-name">{actorName}</span> added a comment on{' '}
            <span className="wap-target-title">&ldquo;{targetTitle}&rdquo;</span>
          </>
        );
      case 'MEMBER_ADDED':
        return (
          <>
            <span className="wap-actor-name">{actorName}</span> joined the project team
          </>
        );
      case 'NOTE_CREATED':
        return (
          <>
            <span className="wap-actor-name">{actorName}</span> published note{' '}
            <span className="wap-target-title">&ldquo;{targetTitle}&rdquo;</span>
          </>
        );
      case 'CALENDAR_EVENT_CREATED':
        return (
          <>
            <span className="wap-actor-name">{actorName}</span> scheduled calendar event{' '}
            <span className="wap-target-title">&ldquo;{targetTitle}&rdquo;</span>
          </>
        );
      case 'FILE_UPLOADED':
        return (
          <>
            <span className="wap-actor-name">{actorName}</span> uploaded file{' '}
            <span className="wap-target-title">&ldquo;{targetTitle}&rdquo;</span>
          </>
        );
      case 'FOLDER_CREATED':
        return (
          <>
            <span className="wap-actor-name">{actorName}</span> created folder{' '}
            <span className="wap-target-title">&ldquo;{targetTitle}&rdquo;</span>
          </>
        );
      default:
        return (
          <>
            <span className="wap-actor-name">{actorName}</span> updated{' '}
            <span className="wap-target-title">&ldquo;{targetTitle}&rdquo;</span>
          </>
        );
    }
  };

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
    if (type.includes('MEMBER')) {
      return { className: 'wap-node-member', icon: <TeamGroupIcon size={14} /> };
    }
    if (type.includes('FILE') || type.includes('FOLDER')) {
      return { className: 'wap-node-file', icon: <FolderPillIcon size={14} /> };
    }
    if (type.includes('NOTE')) {
      return { className: 'wap-node-note', icon: <NoteDocIcon size={14} /> };
    }
    if (type.includes('CALENDAR')) {
      return { className: 'wap-node-calendar', icon: <CalIcon size={14} /> };
    }
    return { className: 'wap-node-default', icon: <DefaultNodeIcon /> };
  };

  const getBadgeElement = (type: string) => {
    if (type.includes('COMPLETED')) {
      return (
        <span className="wap-badge-pill wap-badge-completed">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={{ marginRight: 2 }}>
            <polyline points="20 6 9 17 4 12" />
          </svg>
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
    if (type.includes('MEMBER')) {
      return (
        <span className="wap-badge-pill wap-badge-member">
          <span className="wap-badge-dot" />
          Member joined
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
    return (
      <span className="wap-badge-pill wap-badge-status">
        <span className="wap-badge-dot" />
        Status changed
      </span>
    );
  };

  const filterCategories = [
    { id: 'all', label: 'All', icon: <LayersIcon size={14} /> },
    { id: 'work', label: 'Tasks', icon: <TaskCheckIcon size={14} /> },
    { id: 'comments', label: 'Comments', icon: <CommentBubbleIcon size={14} /> },
    { id: 'notes', label: 'Notes', icon: <NoteDocIcon size={14} /> },
    { id: 'calendar', label: 'Calendar', icon: <CalIcon size={14} /> },
    { id: 'files', label: 'Files', icon: <FolderPillIcon size={14} /> },
    { id: 'members', label: 'Team', icon: <TeamGroupIcon size={14} /> },
  ] as const;

  return (
    <div className="wap-page-container">
      {/* 1. Top Banner Card */}
      <div className="wap-banner">
        <div className="wap-banner-left">
          <div className="wap-banner-icon-badge">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2D6A4F" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
          </div>
          <div className="wap-banner-text-block">
            <h1 className="wap-banner-title">Workspace Activity</h1>
            <p className="wap-banner-subtitle">
              Real-time chronological stream of events across all projects you collaborate on.
            </p>
          </div>
        </div>

        {/* Artistic Banner Graphic */}
        <BannerArt />
      </div>

      {/* 2. Filter Pills and Controls Bar */}
      <div className="wap-toolbar">
        {/* Categories Pills */}
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

        {/* Date Ranges & Search */}
        <div className="wap-toolbar-right">
          <div className="wap-daterange-pills">
            {(['7D', '30D', '90D', 'ALL'] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setDateRange(r)}
                className={`wap-daterange-btn ${dateRange === r ? 'active' : ''}`}
              >
                {r}
              </button>
            ))}
          </div>

          <div className="wap-search-pill-box">
            <SearchMagnifierIcon className="wap-search-icon" />
            <input
              type="text"
              placeholder="Filter activity..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="wap-search-input"
            />
          </div>
        </div>
      </div>

      {/* 3. Feed Timeline Card */}
      <div className="wap-timeline-card">
        {loading ? (
          <div style={{ padding: '64px 20px', textAlign: 'center', color: '#9CA3AF' }}>
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
        ) : error ? (
          <div style={{ padding: '48px 20px', textAlign: 'center', color: '#EF4444' }}>
            <p style={{ fontSize: '14px', fontWeight: 600, margin: '0 0 12px' }}>{error}</p>
            <button
              type="button"
              onClick={loadActivities}
              style={{
                padding: '6px 16px',
                fontSize: '13px',
                fontWeight: 600,
                borderRadius: '8px',
                border: '1px solid #E5E7EB',
                background: '#FFFFFF',
                cursor: 'pointer',
              }}
            >
              Retry
            </button>
          </div>
        ) : filteredActivities.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: '#6B7280' }}>
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
              {searchQuery || category !== 'all' || dateRange !== 'ALL'
                ? 'Try adjusting your search filters or date range.'
                : 'Project updates, task assignments, and comments will show up here.'}
            </p>
            {(searchQuery || category !== 'all' || dateRange !== 'ALL') && (
              <button
                type="button"
                onClick={() => {
                  setCategory('all');
                  setDateRange('ALL');
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
          <div>
            {groupedActivities.map((group) => (
              <div key={group.dateLabel} style={{ marginBottom: '24px' }}>
                <h2 className="wap-group-header">{group.dateLabel}</h2>

                <div className="wap-timeline-list">
                  {group.items.map((act) => {
                    const node = getNodeInfo(act.type);
                    const targetProject = act.project;
                    const actorInitial = (act.actor?.fullName || act.actor?.username || 'U')[0].toUpperCase();
                    const shortName = getActorShortName(act);
                    const isMenuOpen = openMenuId === act.id;

                    return (
                      <div key={act.id} className="wap-timeline-row">
                        {/* Continuous Vertical Timeline Line */}
                        <div className="wap-timeline-line" />

                        {/* Circular Action Node Icon */}
                        <div className={`wap-timeline-node ${node.className}`}>
                          {node.icon}
                        </div>

                        {/* Content Block */}
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
                            <div className="wap-main-text">
                              {renderActivityText(act)}
                            </div>

                            <div className="wap-sub-meta">
                              <span className="wap-meta-actor">{shortName}</span>
                              <span>•</span>
                              <span className="wap-meta-time">{formatRelativeTime(act.createdAt)}</span>
                              <span>•</span>
                              {targetProject ? (
                                <Link to={`/app/projects/${targetProject.id}`} className="wap-meta-project">
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 2 }}>
                                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                                  </svg>
                                  <span>{act.workItem?.title || targetProject.name}</span>
                                </Link>
                              ) : (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                                  </svg>
                                  <span>{act.workItem?.title || 'Workspace'}</span>
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Right Status Badge & Menu */}
                        <div className="wap-row-right">
                          {getBadgeElement(act.type)}

                          <div className="wap-action-menu-wrap" ref={isMenuOpen ? menuRef : undefined}>
                            <button
                              type="button"
                              className="wap-more-btn"
                              aria-label="Activity options"
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenMenuId(isMenuOpen ? null : act.id);
                              }}
                            >
                              <MoreOptionsIcon />
                            </button>

                            {isMenuOpen && (
                              <div className="wap-dropdown-menu">
                                {targetProject && (
                                  <Link
                                    to={`/app/projects/${targetProject.id}`}
                                    className="wap-dropdown-item"
                                    onClick={() => setOpenMenuId(null)}
                                  >
                                    <FolderPillIcon size={14} />
                                    <span>Go to Project</span>
                                  </Link>
                                )}
                                <button
                                  type="button"
                                  className="wap-dropdown-item"
                                  onClick={() => {
                                    navigator.clipboard?.writeText(window.location.href);
                                    setOpenMenuId(null);
                                  }}
                                >
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                                  </svg>
                                  <span>Copy Link</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
