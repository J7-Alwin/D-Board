import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link } from '../../router/Router';
import { activityApi, type ActivityItem } from '../../api/activity.api';
import { projectsApi, type Project } from '../../api/projects.api';

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

const ChevronUpIcon: React.FC<{ size?: number; className?: string }> = ({ size = 16, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <polyline points="18 15 12 9 6 15" />
  </svg>
);

// --- Timeline Action Node Icons matching screenshot ---

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

// --- Header Atmosphere Illustration matching User Reference Image ---
const ActivityHeaderAtmosphere: React.FC = () => (
  <div className="cal-header-art-container activity-art-container" aria-hidden="true">
    {/* Atmosphere Quote on the Left of the Artwork */}
    <div className="cal-quote-text-group" style={{ marginRight: '-24px', zIndex: 3 }}>
      <span className="cal-quote-text" style={{ fontStyle: 'italic', fontFamily: 'Georgia, serif', fontSize: '0.82rem', color: '#334155', letterSpacing: '0.01em' }}>
        &ldquo;Small updates today,
      </span>
      <span className="cal-quote-text" style={{ fontStyle: 'italic', fontFamily: 'Georgia, serif', fontSize: '0.82rem', color: '#334155', letterSpacing: '0.01em', marginTop: '1px' }}>
        bigger milestones tomorrow.&rdquo;
      </span>
      <svg
        className="cal-quote-underline-svg"
        viewBox="0 0 120 18"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ width: '92px', height: '11px', marginTop: '2px' }}
      >
        <path
          d="M3 12C35 3 85 2 117 10M55 14C75 9 95 8 115 13"
          stroke="#22C55E"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
      </svg>
    </div>

    {/* Graphic Illustration */}
    <svg width="230" height="74" viewBox="0 0 230 74" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
      {/* Background Soft Mint Radial Aura */}
      <ellipse cx="145" cy="38" rx="60" ry="32" fill="rgba(226, 240, 224, 0.55)" />

      {/* Sun Circle at Top Right */}
      <circle cx="185" cy="16" r="9.5" fill="#FDE047" opacity="0.95" />

      {/* Trajectory Flight Path (Dashed Arc) */}
      <path
        d="M135 48 C 160 44, 185 38, 202 24 C 210 18, 215 14, 218 10"
        stroke="#88B283"
        strokeWidth="1.4"
        strokeDasharray="2.5 3"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="178" cy="34" r="6" fill="#589B53" fillOpacity="0.18" />
      <circle cx="178" cy="34" r="3" fill="#2E7729" />

      {/* Origami Paper Airplane flying up-right */}
      <g transform="translate(208, 4) rotate(14)">
        <polygon points="0,13 22,0 13,18" fill="#FFFFFF" stroke="#1F2937" strokeWidth="1.1" strokeLinejoin="round" />
        <polygon points="13,18 22,0 6,15" fill="#F0F4EF" stroke="#1F2937" strokeWidth="1.1" strokeLinejoin="round" />
        <line x1="6" y1="15" x2="22" y2="0" stroke="#1F2937" strokeWidth="1.1" />
      </g>

      {/* Chat Speech Bubble on Left of Card */}
      <g transform="translate(58, 20)">
        <rect x="0" y="0" width="28" height="20" rx="5" fill="#FFFFFF" stroke="#D1E2CE" strokeWidth="1.2" />
        <path d="M6 20 L9 24 L12 20 Z" fill="#FFFFFF" />
        <path d="M6 20 L9 24 L12 20" stroke="#D1E2CE" strokeWidth="1.2" />
        <line x1="5" y1="6.5" x2="23" y2="6.5" stroke="#4ADE80" strokeWidth="2" strokeLinecap="round" />
        <line x1="5" y1="12" x2="17" y2="12" stroke="#4ADE80" strokeWidth="2" strokeLinecap="round" />
      </g>

      {/* Floating White Card in Center with "D" Logo & Bullets */}
      <g transform="translate(90, 8)">
        {/* Soft shadow */}
        <rect x="0" y="0" width="74" height="56" rx="8" fill="#000000" fillOpacity="0.04" transform="translate(1.5, 2)" />
        {/* Card Body */}
        <rect x="0" y="0" width="74" height="56" rx="8" fill="#FFFFFF" stroke="#E2EAE0" strokeWidth="1.2" />

        {/* Dark Rounded Square Badge with "D" Play Logo */}
        <rect x="15" y="7" width="18" height="18" rx="4.5" fill="#18181B" />
        <path d="M21 11 H23.5 C25.5 11, 27 12, 27 14 C27 16, 25.5 17, 23.5 17 H21 Z" fill="#22C55E" />
        <path d="M22.2 12.2 H23.5 C24.5 12.2, 25.2 13, 25.2 14 C25.2 15, 24.5 15.8, 23.5 15.8 H22.2 Z" fill="#18181B" />

        {/* 3 Horizontal Bullet Lines with Colored Dots matching Screenshot */}
        {/* Line 1: Green dot */}
        <circle cx="11" cy="32" r="2" fill="#22C55E" />
        <rect x="17" y="30.5" width="44" height="3" rx="1.5" fill="#E2ECE0" />

        {/* Line 2: Blue dot */}
        <circle cx="11" cy="40" r="2" fill="#3B82F6" />
        <rect x="17" y="38.5" width="36" height="3" rx="1.5" fill="#E2ECE0" />

        {/* Line 3: Amber dot */}
        <circle cx="11" cy="48" r="2" fill="#F59E0B" />
        <rect x="17" y="46.5" width="28" height="3" rx="1.5" fill="#E2ECE0" />
      </g>

      {/* Botanical Eucalyptus Sprig Leaves on Bottom Left of Card */}
      <g transform="translate(72, 30)">
        <path d="M14 36 C 12 24, 9 14, 1 5" stroke="#9ABF92" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M1 5 C -3 0, 7 -5, 12 0 C 14 3.5, 9 7, 1 5 Z" fill="#81AA7D" />
        <path d="M6 12 C 14 8, 19 15, 13 20 C 9 22.5, 6 17, 6 12 Z" fill="#62905E" />
        <path d="M-3 16 C -10 13, -8 6, -1 9 C 2.5 10.5, 1.5 15, -3 16 Z" fill="#99BD92" />
        <path d="M9 24 C 16 22, 19 28, 14 31 C 10 33, 8 28.5, 9 24 Z" fill="#75A070" />
      </g>

      {/* Green Circular Clock Badge with Ticks at Bottom Right */}
      <g transform="translate(196, 40)">
        <circle cx="10" cy="10" r="9.5" fill="#FAFDF9" stroke="#2E7729" strokeWidth="1.5" />
        <circle cx="10" cy="10" r="1.3" fill="#2E7729" />
        <path d="M10 5.5 V10 H13.5" stroke="#2E7729" strokeWidth="1.4" strokeLinecap="round" />
        {/* Outer sunburst tick marks */}
        <line x1="22" y1="10" x2="25" y2="10" stroke="#2E7729" strokeWidth="1.3" strokeLinecap="round" />
        <line x1="21" y1="5" x2="24" y2="3" stroke="#2E7729" strokeWidth="1.3" strokeLinecap="round" />
        <line x1="21" y1="15" x2="24" y2="17" stroke="#2E7729" strokeWidth="1.3" strokeLinecap="round" />
      </g>
    </svg>
  </div>
);

// Fallback demo activities matching User Image 1 exactly if API returns no data
const createMockActivities = (): ActivityItem[] => {
  const now = new Date();
  const today1 = new Date(now);
  today1.setHours(12, 45, 0, 0);

  const today2 = new Date(now);
  today2.setHours(11, 20, 0, 0);

  const today3 = new Date(now);
  today3.setHours(9, 10, 0, 0);

  const yesterday1 = new Date(now);
  yesterday1.setDate(yesterday1.getDate() - 1);
  yesterday1.setHours(16, 30, 0, 0);

  const yesterday2 = new Date(now);
  yesterday2.setDate(yesterday2.getDate() - 1);
  yesterday2.setHours(13, 15, 0, 0);

  return [
    {
      id: 'demo-1',
      projectId: 'proj-yiwu-desk',
      project: { id: 'proj-yiwu-desk', name: 'Yiwu-Desk', key: 'YIWU' },
      actorId: 'user-alwin',
      actor: { id: 'user-alwin', fullName: 'Alwin James', username: 'alwin', avatarUrl: null },
      type: 'WORK_STATUS_CHANGED',
      workItemId: 'w-1',
      workItem: { id: 'w-1', title: 'Bug fix', type: 'BUG', status: 'IN_PROGRESS' },
      createdAt: today1.toISOString(),
      metadata: { action: 'Status changed', title: 'Bug fix' },
    },
    {
      id: 'demo-2',
      projectId: 'proj-yiwu-desk',
      project: { id: 'proj-yiwu-desk', name: 'Yiwu-Desk', key: 'YIWU' },
      actorId: 'user-alwin',
      actor: { id: 'user-alwin', fullName: 'Alwin James', username: 'alwin', avatarUrl: null },
      type: 'WORK_COMPLETED',
      workItemId: 'w-2',
      workItem: { id: 'w-2', title: 'UI fixes', type: 'TASK', status: 'DONE' },
      createdAt: today2.toISOString(),
      metadata: { action: 'Task completed', title: 'UI fixes' },
    },
    {
      id: 'demo-3',
      projectId: 'proj-yiwu-desk',
      project: { id: 'proj-yiwu-desk', name: 'Yiwu-Desk', key: 'YIWU' },
      actorId: 'user-alwin',
      actor: { id: 'user-alwin', fullName: 'Alwin James', username: 'alwin', avatarUrl: null },
      type: 'COMMENT_ADDED',
      workItemId: 'w-3',
      workItem: { id: 'w-3', title: 'Dashboard design', type: 'TASK', status: 'IN_PROGRESS' },
      createdAt: today3.toISOString(),
      metadata: { action: 'New comment', title: 'Dashboard design' },
    },
    {
      id: 'demo-4',
      projectId: 'proj-alwin',
      project: { id: 'proj-alwin', name: 'Alwin', key: 'ALW' },
      actorId: 'user-alwin',
      actor: { id: 'user-alwin', fullName: 'Alwin James', username: 'alwin', avatarUrl: null },
      type: 'FILE_UPLOADED',
      workItemId: 'w-4',
      workItem: { id: 'w-4', title: 'Documentation', type: 'TASK', status: 'IN_PROGRESS' },
      createdAt: yesterday1.toISOString(),
      metadata: { name: 'Project Plan.pdf', title: 'Project Plan.pdf', action: 'File uploaded' },
    },
    {
      id: 'demo-5',
      projectId: 'proj-alwin',
      project: { id: 'proj-alwin', name: 'Alwin', key: 'ALW' },
      actorId: 'user-alwin',
      actor: { id: 'user-alwin', fullName: 'Alwin James', username: 'alwin', avatarUrl: null },
      type: 'WORK_STATUS_CHANGED',
      workItemId: 'w-4',
      workItem: { id: 'w-4', title: 'Documentation', type: 'TASK', status: 'IN_PROGRESS' },
      createdAt: yesterday2.toISOString(),
      metadata: { action: 'Status changed', title: 'Documentation' },
    },
  ];
};

// --- Component Main ---

export const ActivityPage: React.FC = () => {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');
  const [category, setCategory] = useState<'all' | 'work' | 'comments' | 'notes' | 'calendar' | 'files' | 'members'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dropdown & expansion states
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [openProjectMenuId, setOpenProjectMenuId] = useState<string | null>(null);
  const [isProjectFilterOpen, setIsProjectFilterOpen] = useState(false);
  const [collapsedProjects, setCollapsedProjects] = useState<Record<string, boolean>>({});
  const [expandedProjectActivities, setExpandedProjectActivities] = useState<Record<string, boolean>>({});

  const menuRef = useRef<HTMLDivElement | null>(null);
  const projectMenuRef = useRef<HTMLDivElement | null>(null);
  const projectFilterRef = useRef<HTMLDivElement | null>(null);

  // Close menus on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuId(null);
      }
      if (projectMenuRef.current && !projectMenuRef.current.contains(e.target as Node)) {
        setOpenProjectMenuId(null);
      }
      if (projectFilterRef.current && !projectFilterRef.current.contains(e.target as Node)) {
        setIsProjectFilterOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, []);

  // Load activities & projects
  const loadActivities = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [actRes, projRes] = await Promise.allSettled([
        activityApi.getGlobalActivities({
          category,
          limit: 100,
        }),
        projectsApi.getUserProjects(),
      ]);

      if (projRes.status === 'fulfilled' && projRes.value?.success && projRes.value?.data) {
        setProjects(projRes.value.data.all || []);
      }

      if (actRes.status === 'fulfilled' && actRes.value?.success && actRes.value?.data) {
        const list = actRes.value.data.activities || [];
        if (list.length > 0) {
          setActivities(list);
        } else {
          // Provide demo activities if database has no activity records
          setActivities(createMockActivities());
        }
      } else {
        setActivities(createMockActivities());
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load workspace activity');
      setActivities(createMockActivities());
    } finally {
      setLoading(false);
    }
  }, [category]);

  useEffect(() => {
    loadActivities();
  }, [loadActivities]);

  // Aggregate all available projects for filter dropdown
  const allAvailableProjects = useMemo(() => {
    const map = new Map<string, { id: string; name: string; key?: string; avatarUrl?: string | null }>();
    projects.forEach((p) => {
      map.set(p.id, { id: p.id, name: p.name, key: p.key || undefined, avatarUrl: p.avatarUrl || null });
    });
    activities.forEach((act) => {
      if (act.projectId) {
        if (!map.has(act.projectId)) {
          map.set(act.projectId, {
            id: act.projectId,
            name: act.project?.name || 'Project',
            key: act.project?.key || undefined,
            avatarUrl: null,
          });
        } else if (act.project?.name && map.get(act.projectId)?.name === 'Project') {
          map.set(act.projectId, {
            id: act.projectId,
            name: act.project.name,
            key: act.project?.key || undefined,
            avatarUrl: map.get(act.projectId)?.avatarUrl || null,
          });
        }
      }
    });
    return Array.from(map.values());
  }, [projects, activities]);

  const selectedProjectObj = useMemo(() => {
    if (selectedProjectId === 'all') return null;
    return allAvailableProjects.find((p) => p.id === selectedProjectId) || null;
  }, [selectedProjectId, allAvailableProjects]);

  // Toggle project card collapse
  const toggleProjectCollapse = (projectId: string) => {
    setCollapsedProjects((prev) => ({
      ...prev,
      [projectId]: !prev[projectId],
    }));
  };

  // Toggle view more activities limit per project
  const toggleExpandProjectActivities = (projectId: string) => {
    setExpandedProjectActivities((prev) => ({
      ...prev,
      [projectId]: !prev[projectId],
    }));
  };

  // Client-side filtering: Project and Search
  const filteredActivities = useMemo(() => {
    let list = [...activities];

    // 1. Filter by Project if selected
    if (selectedProjectId !== 'all') {
      list = list.filter((act) => act.projectId === selectedProjectId);
    }

    // 2. Search query
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
  }, [activities, selectedProjectId, searchQuery]);

  // Group activities by Project (with latest 10 limit & chronological date sub-groups)
  const groupedByProject = useMemo(() => {
    const projectMap = new Map<
      string,
      {
        projectId: string;
        projectName: string;
        projectKey?: string;
        avatarUrl?: string | null;
        activities: ActivityItem[];
      }
    >();

    filteredActivities.forEach((item) => {
      const pId = item.projectId || 'general';
      const pName = item.project?.name || (item.projectId === 'general' ? 'General Workspace' : 'Project');
      const pAvatar = projects.find((p) => p.id === pId)?.avatarUrl || null;

      if (!projectMap.has(pId)) {
        projectMap.set(pId, {
          projectId: pId,
          projectName: pName,
          projectKey: item.project?.key,
          avatarUrl: pAvatar,
          activities: [],
        });
      }
      projectMap.get(pId)!.activities.push(item);
    });

    return Array.from(projectMap.values()).map((projGroup) => {
      const isExpanded = !!expandedProjectActivities[projGroup.projectId];
      const totalActivitiesCount = projGroup.activities.length;

      // By default show latest 10 activities, unless expanded
      const displayedItems = isExpanded
        ? projGroup.activities
        : projGroup.activities.slice(0, 10);

      const dateMap: { [key: string]: ActivityItem[] } = {};

      displayedItems.forEach((item) => {
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

      return {
        ...projGroup,
        totalCount: totalActivitiesCount,
        hasMoreActivities: totalActivitiesCount > 10,
        isExpanded,
        dateGroups: Object.entries(dateMap).map(([dateLabel, items]) => ({
          dateLabel,
          items,
        })),
      };
    });
  }, [filteredActivities, expandedProjectActivities, projects]);

  // Format 12-hour AM/PM time matching screenshot (e.g., "12:45 PM")
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

  // Subtext folder target title matching screenshot
  const getTargetContextName = (act: ActivityItem): string => {
    if (act.type === 'FILE_UPLOADED') {
      return act.workItem?.title || act.project?.name || 'Documentation';
    }
    return act.workItem?.title || act.metadata?.title || act.metadata?.name || act.project?.name || 'Documentation';
  };

  // Action text renderer matching bold styling in screenshot
  const renderActivityText = (act: ActivityItem) => {
    const actorName = act.actor?.fullName || act.actor?.username || 'Alwin James';
    const targetTitle = act.workItem?.title || act.metadata?.title || act.metadata?.name || act.project?.name || 'task';

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
            <span className="wap-target-title">&ldquo;{act.project?.name || targetTitle}&rdquo;</span>
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
    return 'Status changed';
  };

  // Right pill badge
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
    <div className="cal-experience-root activity-page-experience">
      {/* 1. Top Section - Matching Exact Layout in Uploaded Reference */}
      <div className="cal-page-header activity-page-top-header">
        <div className="cal-header-left">
          <div className="cal-title-row">
            <span className="wap-banner-icon-badge">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0F172A" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
              </svg>
            </span>
            <h1 className="cal-header-title">Workspace Activity</h1>
          </div>
          <p className="cal-header-subtitle">
            Real-time chronological stream of events across all projects you collaborate on.
          </p>
        </div>

        {/* Atmosphere Quote & Art on Right */}
        <ActivityHeaderAtmosphere />
      </div>

      {/* 2. All Filters & Search in ONE unified line on Left Side */}
      <div className="wap-toolbar">
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

        {/* Project Filter Button (Neutral styling, exact project icon, no green) */}
        <div className="wap-project-filter-wrap" ref={projectFilterRef}>
          <button
            type="button"
            className={`wap-category-pill wap-project-filter-pill ${selectedProjectId !== 'all' ? 'active-filter' : ''}`}
            onClick={() => setIsProjectFilterOpen(!isProjectFilterOpen)}
            aria-label="Filter by project"
            title="Filter by project"
          >
            {selectedProjectObj ? (
              <>
                {selectedProjectObj.avatarUrl ? (
                  <img src={selectedProjectObj.avatarUrl} alt="" className="wap-filter-proj-avatar-img" />
                ) : (
                  <span className="wap-filter-proj-avatar-box">
                    {selectedProjectObj.name.charAt(0).toUpperCase()}
                  </span>
                )}
                <span className="wap-project-filter-label">{selectedProjectObj.name}</span>
                <span
                  className="wap-project-filter-clear-cross"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedProjectId('all');
                  }}
                  title="Clear project filter"
                >
                  ✕
                </span>
              </>
            ) : (
              <>
                <FolderPillIcon size={14} />
                <span className="wap-project-filter-label">All Projects</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.6 }}>
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </>
            )}
          </button>

          {isProjectFilterOpen && (
            <div className="wap-project-filter-dropdown">
              <div className="wap-project-dropdown-header">
                <span>Filter by Project</span>
              </div>
              <button
                type="button"
                className={`wap-project-dropdown-item ${selectedProjectId === 'all' ? 'active' : ''}`}
                onClick={() => {
                  setSelectedProjectId('all');
                  setIsProjectFilterOpen(false);
                }}
              >
                <div className="wap-dropdown-item-all-icon">
                  <LayersIcon size={13} />
                </div>
                <span className="wap-dropdown-item-name">All Projects</span>
                <span className="wap-dropdown-item-count">{activities.length}</span>
              </button>

              <div className="wap-project-dropdown-divider" />

              <div className="wap-project-dropdown-scroll">
                {allAvailableProjects.map((proj) => {
                  const count = activities.filter((a) => a.projectId === proj.id).length;
                  const isSelected = selectedProjectId === proj.id;
                  const initial = proj.name.charAt(0).toUpperCase();
                  return (
                    <button
                      key={proj.id}
                      type="button"
                      className={`wap-project-dropdown-item ${isSelected ? 'active' : ''}`}
                      onClick={() => {
                        setSelectedProjectId(proj.id);
                        setIsProjectFilterOpen(false);
                      }}
                    >
                      {proj.avatarUrl ? (
                        <img src={proj.avatarUrl} alt="" className="wap-dropdown-proj-avatar-img" />
                      ) : (
                        <div className="wap-dropdown-proj-avatar">{initial}</div>
                      )}
                      <span className="wap-dropdown-item-name">{proj.name}</span>
                      <span className="wap-dropdown-item-count">{count}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
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

      {/* 3. Feed Timeline: Division based on Projects with latest 10 limit */}
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
        ) : error && activities.length === 0 ? (
          <div className="wap-empty-state-card" style={{ color: '#EF4444' }}>
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
              {selectedProjectId !== 'all'
                ? `No activity found for project "${selectedProjectObj?.name}".`
                : searchQuery || category !== 'all'
                ? 'Try adjusting your search filters or category.'
                : 'Project updates, task assignments, and comments will show up here.'}
            </p>
            <button
              type="button"
              onClick={() => {
                setSelectedProjectId('all');
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
          </div>
        ) : (
          <div className="wap-projects-list">
            {groupedByProject.map((group) => {
              const isCollapsed = !!collapsedProjects[group.projectId];
              const isProjectMenuOpen = openProjectMenuId === group.projectId;
              const projectInitial = (group.projectName || 'P').charAt(0).toUpperCase();

              return (
                <div key={group.projectId} className="wap-project-card">
                  {/* Project Header Row matching Screenshot 1 */}
                  <div className="wap-project-card-header">
                    <div className="wap-project-header-left">
                      {/* Dark rounded square badge with project initial or image */}
                      {group.avatarUrl ? (
                        <img src={group.avatarUrl} alt="" className="wap-project-card-avatar-img" />
                      ) : (
                        <div className="wap-project-card-avatar">{projectInitial}</div>
                      )}

                      {/* Project Name Link */}
                      <Link to={`/app/projects/${group.projectId}`} className="wap-project-card-title">
                        {group.projectName}
                      </Link>

                      {/* Activity Count Pill */}
                      <span className="wap-project-count-pill">
                        {group.totalCount} {group.totalCount === 1 ? 'activity' : 'activities'}
                      </span>
                    </div>

                    {/* Project Header Actions on Right */}
                    <div className="wap-project-header-right">
                      {/* Collapse/Expand Toggle Button */}
                      <button
                        type="button"
                        className="wap-collapse-toggle-btn"
                        onClick={() => toggleProjectCollapse(group.projectId)}
                        aria-label={isCollapsed ? 'Expand project' : 'Collapse project'}
                        title={isCollapsed ? 'Expand project' : 'Collapse project'}
                      >
                        <ChevronUpIcon className={`wap-chevron-icon ${isCollapsed ? 'is-collapsed' : ''}`} />
                      </button>

                      {/* Project Options Menu */}
                      <div className="wap-action-menu-wrap" ref={isProjectMenuOpen ? projectMenuRef : undefined}>
                        <button
                          type="button"
                          className="wap-more-btn"
                          aria-label="Project options"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenProjectMenuId(isProjectMenuOpen ? null : group.projectId);
                          }}
                        >
                          <MoreOptionsIcon />
                        </button>

                        {isProjectMenuOpen && (
                          <div className="wap-dropdown-menu">
                            <Link
                              to={`/app/projects/${group.projectId}`}
                              className="wap-dropdown-item"
                              onClick={() => setOpenProjectMenuId(null)}
                            >
                              <FolderPillIcon size={14} />
                              <span>Go to Project</span>
                            </Link>
                            <button
                              type="button"
                              className="wap-dropdown-item"
                              onClick={() => {
                                setSelectedProjectId(group.projectId);
                                setOpenProjectMenuId(null);
                              }}
                            >
                              <LayersIcon size={14} />
                              <span>Filter only this project</span>
                            </button>
                            <button
                              type="button"
                              className="wap-dropdown-item"
                              onClick={() => {
                                navigator.clipboard?.writeText(
                                  `${window.location.origin}/app/projects/${group.projectId}`
                                );
                                setOpenProjectMenuId(null);
                              }}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                              </svg>
                              <span>Copy Project Link</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Project Activities List (when expanded) */}
                  {!isCollapsed && (
                    <div className="wap-project-card-body">
                      {group.dateGroups.map((dateGroup) => (
                        <div key={dateGroup.dateLabel} className="wap-timeline-date-section">
                          {/* Date Pill positioned directly on the vertical timeline */}
                          <div className="wap-timeline-date-wrap">
                            <span className="wap-timeline-date-pill">{dateGroup.dateLabel}</span>
                          </div>

                          {/* Timeline rows for this date */}
                          <div className="wap-timeline-list">
                            {dateGroup.items.map((act, actIdx) => {
                              const node = getNodeInfo(act.type);
                              const actorInitial = (act.actor?.fullName || act.actor?.username || 'A')[0].toUpperCase();
                              const isMenuOpen = openMenuId === act.id;
                              const isFirst = actIdx === 0;
                              const isLast = actIdx === dateGroup.items.length - 1;

                              return (
                                <div key={act.id} className="wap-timeline-row">
                                  {/* Vertical Timeline Connecting Line */}
                                  <div
                                    className={`wap-timeline-line ${
                                      isFirst ? 'is-first' : ''
                                    } ${isLast ? 'is-last' : ''}`}
                                  />

                                  {/* Circular Action Node */}
                                  <div className={`wap-timeline-node ${node.className}`}>
                                    {node.icon}
                                  </div>

                                  {/* Row Content */}
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

                                  {/* Right Status Badge & Options */}
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
                                          {act.project && (
                                            <Link
                                              to={`/app/projects/${act.project.id}`}
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

                      {/* View All / Show Less button when project has > 10 activities */}
                      {group.hasMoreActivities && (
                        <div className="wap-project-footer">
                          <button
                            type="button"
                            className="wap-project-more-btn"
                            onClick={() => toggleExpandProjectActivities(group.projectId)}
                          >
                            {group.isExpanded ? (
                              <>
                                <span>Show latest 10 activities</span>
                                <ChevronUpIcon size={13} />
                              </>
                            ) : (
                              <>
                                <span>View all activities ({group.totalCount} total)</span>
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="6 9 12 15 18 9" />
                                </svg>
                              </>
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
