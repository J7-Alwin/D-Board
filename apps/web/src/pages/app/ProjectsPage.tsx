import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from '../../router/Router';
import { useAuth } from '../../context/AuthContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { projectsApi, type Project, type ProjectCompletionRequestItem } from '../../api/projects.api';
import { EmptyState } from '../../components/ui/EmptyState';
import { ProjectAvatar } from '../../components/ui/ProjectAvatar';
import { CustomSelect } from '../../components/ui/CustomSelect';
import { Modal } from '../../components/ui/Modal';
import { ProjectSettingsModal } from '../../components/workspace/ProjectSettingsModal';
import { ProjectTransferModal } from '../../components/workspace/ProjectTransferModal';
import {
  PlusIcon,
  FolderIcon,
  UsersIcon,
  CalendarIcon,
  ArrowRightIcon,
  FolderPlusIcon,
  SearchIcon,
  CloseIcon,
  GridIcon,
  ListIcon,
  CheckSquareIcon,
  LayersIcon,
  LockIcon,
  GlobeIcon,
  SettingsIcon,
  CheckCircleIcon,
  TrashIcon,
  ClockIcon,
  ChevronRightIcon,
} from '../../components/ui/Icons';

const WorkspaceBadgeIcon: React.FC<{ size?: number; className?: string }> = ({ size = 12, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M3 21h18" />
    <path d="M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16" />
    <path d="M9 8h2" />
    <path d="M9 12h2" />
    <path d="M9 16h2" />
    <path d="M13 8h2" />
    <path d="M13 12h2" />
    <path d="M13 16h2" />
  </svg>
);

const MoreVerticalIcon: React.FC<{ size?: number; className?: string }> = ({ size = 16, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="12" cy="12" r="1.5" fill="currentColor" />
    <circle cx="12" cy="5" r="1.5" fill="currentColor" />
    <circle cx="12" cy="19" r="1.5" fill="currentColor" />
  </svg>
);

const ArchiveBoxIcon: React.FC<{ size?: number; className?: string }> = ({ size = 14, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect width="20" height="5" x="2" y="3" rx="1" />
    <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" />
    <path d="M10 12h4" />
  </svg>
);

const ProjectsFolderBannerIcon: React.FC<{ size?: number; className?: string }> = ({ size = 28, className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
  </svg>
);

const ProjectsHeaderIllustration: React.FC = () => (
  <svg
    viewBox="0 0 240 85"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="projects-header-landscape-svg"
    aria-hidden="true"
  >
    <defs>
      <filter id="hero-card-shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="#0F172A" floodOpacity="0.08" />
      </filter>
      <filter id="hero-folder-shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#064E3B" floodOpacity="0.14" />
      </filter>
    </defs>

    {/* Background soft cloud aura */}
    <path
      d="M 35 60 C 35 38 52 24 80 24 C 92 24 104 28 112 34 C 122 28 138 28 148 34 C 160 30 178 35 185 44 C 196 46 208 55 208 68 C 208 80 192 85 178 85 L 50 85 C 40 85 35 76 35 60 Z"
      fill="#F1F5F9"
      opacity="0.9"
    />

    {/* Sprouting leafy plant on left */}
    <g>
      {/* Main stem curving upward */}
      <path
        d="M 18 85 C 24 64 34 44 44 30"
        stroke="#10B981"
        strokeWidth="2.8"
        strokeLinecap="round"
      />
      {/* Leaf 1 (top) */}
      <path
        d="M 44 30 C 45 18 56 18 54 26 C 52 33 46 34 44 30 Z"
        fill="#10B981"
      />
      {/* Leaf 2 (upper left) */}
      <path
        d="M 35 42 C 24 36 26 24 37 26 C 42 31 39 38 35 42 Z"
        fill="#34D399"
      />
      {/* Leaf 3 (middle right) */}
      <path
        d="M 32 56 C 42 50 49 56 46 65 C 40 67 33 61 32 56 Z"
        fill="#10B981"
      />
      {/* Leaf 4 (lower left) */}
      <path
        d="M 23 65 C 13 60 15 48 25 51 C 30 54 28 62 23 65 Z"
        fill="#34D399"
      />
      {/* Leaf 5 (bottom) */}
      <path
        d="M 17 76 C 8 72 10 63 19 65 C 23 67 22 74 17 76 Z"
        fill="#10B981"
      />
    </g>

    {/* Golden Sun Circle */}
    <circle cx="172" cy="28" r="14" fill="#FDE047" opacity="0.95" />

    {/* White Task Card / Tablet */}
    <g filter="url(#hero-card-shadow)">
      <rect
        x="78"
        y="16"
        width="90"
        height="68"
        rx="8"
        fill="#FFFFFF"
        stroke="#E2E8F0"
        strokeWidth="1.2"
      />
    </g>

    {/* App Logo Square badge with 'D' inside */}
    <rect x="113" y="22" width="20" height="20" rx="4.5" fill="#0F172A" />
    <text
      x="123"
      y="36.5"
      fill="#FFFFFF"
      fontSize="12"
      fontWeight="800"
      fontFamily="Inter, system-ui, -apple-system, sans-serif"
      textAnchor="middle"
    >
      D
    </text>

    {/* Checklist items with green dots and gray lines */}
    <circle cx="92" cy="51" r="3" fill="#22C55E" />
    <rect x="100" y="49" width="42" height="4" rx="2" fill="#E2E8F0" />

    <circle cx="92" cy="61" r="3" fill="#22C55E" />
    <rect x="100" y="59" width="34" height="4" rx="2" fill="#E2E8F0" />

    <circle cx="92" cy="71" r="3" fill="#22C55E" />
    <rect x="100" y="69" width="48" height="4" rx="2" fill="#E2E8F0" />

    {/* Mint Green Open Folder in Foreground */}
    <g filter="url(#hero-folder-shadow)">
      {/* Back folder body & tab */}
      <path
        d="M 152 44 L 165 44 L 170 48 L 196 48 C 198.5 48 200 49.5 200 52 L 200 78 C 200 80.5 198.5 82 196 82 L 148 82 C 145.5 82 144 78.5 144 78 L 144 52 C 144 49.5 145.5 48 148 48 L 152 44 Z"
        fill="#10B981"
      />
      {/* Paper peek inside */}
      <rect x="150" y="47" width="44" height="24" rx="3" fill="#FFFFFF" opacity="0.95" />
      <rect x="155" y="52" width="28" height="3" rx="1.5" fill="#A7F3D0" />
      {/* Front folder flap */}
      <path
        d="M 144 54 L 204 54 C 206.5 54 208 55.5 207.5 58 L 202.5 78.5 C 202 80.5 200.2 82 198 82 L 148 82 C 145.8 82 144 80.5 143.5 78.5 L 140.5 58 C 140 55.5 141.5 54 144 54 Z"
        fill="#6EE7B7"
      />
    </g>
  </svg>
);

const TotalCardDecor: React.FC = () => (
  <svg
    viewBox="0 0 140 100"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="proj-stat-decor-svg"
    aria-hidden="true"
  >
    <path
      d="M 140 34 C 124 34, 96 46, 80 62 C 64 78, 36 94, 0 100 L 140 100 Z"
      fill="#EFF6FF"
      opacity="0.95"
    />
    <path
      d="M 140 60 C 124 60, 104 70, 90 82 C 76 92, 54 97, 28 100 L 140 100 Z"
      fill="#DBEAFE"
      opacity="0.6"
    />
    {/* Trend Line with Arrow on the far right */}
    <g transform="translate(100, 38)">
      <path
        d="M 2 18 L 10 10 L 16 15 L 26 4"
        stroke="#3B82F6"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M 19 4 H 26 V 11"
        stroke="#3B82F6"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
  </svg>
);

const ActiveCardDecor: React.FC = () => (
  <svg
    viewBox="0 0 140 100"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="proj-stat-decor-svg"
    aria-hidden="true"
  >
    <path
      d="M 140 34 C 124 34, 96 46, 80 62 C 64 78, 36 94, 0 100 L 140 100 Z"
      fill="#ECFDF5"
      opacity="0.95"
    />
    <path
      d="M 140 60 C 124 60, 104 70, 90 82 C 76 92, 54 97, 28 100 L 140 100 Z"
      fill="#D1FAE5"
      opacity="0.6"
    />
    {/* 3 Bar Chart Bars on the far right */}
    <g transform="translate(104, 38)">
      <rect x="0" y="7" width="4.5" height="15" rx="2.25" stroke="#10B981" strokeWidth="2.2" fill="none" />
      <rect x="7" y="0" width="4.5" height="22" rx="2.25" stroke="#10B981" strokeWidth="2.2" fill="none" />
      <rect x="14" y="4" width="4.5" height="18" rx="2.25" stroke="#10B981" strokeWidth="2.2" fill="none" />
    </g>
  </svg>
);

const CompletedCardDecor: React.FC = () => (
  <svg
    viewBox="0 0 140 100"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="proj-stat-decor-svg"
    aria-hidden="true"
  >
    <path
      d="M 140 34 C 124 34, 96 46, 80 62 C 64 78, 36 94, 0 100 L 140 100 Z"
      fill="#FFFBEB"
      opacity="0.95"
    />
    <path
      d="M 140 60 C 124 60, 104 70, 90 82 C 76 92, 54 97, 28 100 L 140 100 Z"
      fill="#FEF3C7"
      opacity="0.65"
    />
    {/* Trophy Cup on the far right */}
    <g transform="translate(102, 38)">
      <path
        d="M 4 2 H 18 V 8 C 18 12.4 14.9 15 11 15 C 7.1 15 4 12.4 4 8 V 2 Z"
        fill="#F59E0B"
      />
      <path
        d="M 4 4 H 1.5 C 0.7 4 0 4.7 0 5.5 C 0 7 1.2 8 2.5 8 H 4"
        stroke="#F59E0B"
        strokeWidth="1.8"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M 18 4 H 20.5 C 21.3 4 22 4.7 22 5.5 C 22 7 20.8 8 19.5 8 H 18"
        stroke="#F59E0B"
        strokeWidth="1.8"
        strokeLinecap="round"
        fill="none"
      />
      <path d="M 11 15 V 19" stroke="#F59E0B" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M 6.5 19 H 15.5" stroke="#F59E0B" strokeWidth="2.2" strokeLinecap="round" />
    </g>
  </svg>
);

const ArchivedCardDecor: React.FC = () => (
  <svg
    viewBox="0 0 140 100"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="proj-stat-decor-svg"
    aria-hidden="true"
  >
    <path
      d="M 140 34 C 124 34, 96 46, 80 62 C 64 78, 36 94, 0 100 L 140 100 Z"
      fill="#FEF2F2"
      opacity="0.95"
    />
    <path
      d="M 140 60 C 124 60, 104 70, 90 82 C 76 92, 54 97, 28 100 L 140 100 Z"
      fill="#FEE2E2"
      opacity="0.65"
    />
    {/* Red Archive Filing Box on the far right */}
    <g transform="translate(102, 38)">
      <rect x="0" y="4" width="20" height="16" rx="2.5" fill="#EF4444" opacity="0.9" />
      <path d="M -2 4 H 22 V 6.5 C 22 7.1 21.5 7.5 21 7.5 H -1 C -1.6 7.5 -2 7.1 -2 6.5 V 4 Z" fill="#DC2626" />
      <rect x="6" y="9.5" width="8" height="4.5" rx="1.2" stroke="#FFFFFF" strokeWidth="1.3" fill="none" />
    </g>
  </svg>
);

const CATEGORY_OPTIONS = [
  { value: 'ALL', label: 'All Categories' },
  { value: 'Web Application', label: 'Web Application' },
  { value: 'Mobile App', label: 'Mobile App' },
  { value: 'Backend & API', label: 'Backend & API' },
  { value: 'Cloud Infrastructure', label: 'Cloud Infrastructure' },
  { value: 'Data Science & AI', label: 'Data Science & AI' },
  { value: 'Tooling & Library', label: 'Tooling & Library' },
  { value: 'Product & Design', label: 'Product & Design' },
  { value: 'Other', label: 'Other' },
];

const VISIBILITY_OPTIONS = [
  { value: 'ALL', label: 'All Visibilities' },
  { value: 'Workspace', label: 'Workspace' },
  { value: 'Restricted', label: 'Restricted' },
];

const SORT_OPTIONS = [
  { value: 'updated', label: 'Recently Updated' },
  { value: 'created', label: 'Recently Created' },
  { value: 'name_asc', label: 'Name (A to Z)' },
  { value: 'name_desc', label: 'Name (Z to A)' },
  { value: 'tasks_high', label: 'Most Tasks' },
  { value: 'progress_high', label: 'Highest Progress' },
  { value: 'deadline', label: 'Earliest Deadline' },
];

const formatCategory = (cat?: string | null): string => {
  if (!cat) return 'General';
  const clean = cat.replace(/_/g, ' ').toLowerCase();
  return clean.replace(/\b\w/g, (c) => c.toUpperCase());
};

const formatDate = (dateStr?: string | null): string => {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return '';
  }
};

const formatTimeAgo = (dateStr?: string | null): string => {
  if (!dateStr) return 'recently';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return 'recently';
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    if (diffInMs < 0) return 'recently';
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
    if (diffInHours < 1) return 'just now';
    if (diffInHours < 24) return `${diffInHours}h ago`;
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
    if (diffInDays === 1) return 'yesterday';
    if (diffInDays < 30) return `${diffInDays} days ago`;
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return 'recently';
  }
};

export const ProjectsPage: React.FC = () => {
  const { user } = useAuth();
  const { navigate } = useRouter();
  const { activeWorkspace, activeRole, isLoading: wsLoading } = useWorkspace();
  const activeWsId = activeWorkspace?.id;

  // Distinguish Workspace Owner and Workspace Admin from Project Member
  const isWorkspaceOwner = Boolean(
    activeRole === 'OWNER' ||
    (activeRole as string)?.toUpperCase() === 'OWNER' ||
    activeWorkspace?.isOwner ||
    (activeWorkspace?.ownerId && user?.id && activeWorkspace.ownerId === user.id)
  );
  const isWorkspaceAdmin = Boolean(
    activeRole === 'WORKSPACE_ADMIN' ||
    (activeRole as string)?.toUpperCase() === 'WORKSPACE_ADMIN' ||
    (activeRole as string)?.toUpperCase() === 'ADMIN' ||
    activeWorkspace?.userRole === 'WORKSPACE_ADMIN' ||
    (activeWorkspace?.userRole as string)?.toUpperCase() === 'WORKSPACE_ADMIN' ||
    (activeWorkspace as any)?.role === 'WORKSPACE_ADMIN'
  );
  const isWorkspaceLeader = isWorkspaceOwner || isWorkspaceAdmin;

  const canCreateProject = useMemo(() => {
    if (isWorkspaceOwner) return true;
    if (activeWorkspace?.isPersonal) return true;
    const role = (activeRole as string)?.toUpperCase();
    const adminPerms = activeWorkspace?.adminPermissions;
    if (role === 'WORKSPACE_ADMIN' || role === 'ADMIN') {
      if (adminPerms?.workspaceAdmin?.canCreateProjects !== undefined) {
        return Boolean(adminPerms.workspaceAdmin.canCreateProjects);
      }
      if (adminPerms?.canCreateProjects !== undefined) {
        return Boolean(adminPerms.canCreateProjects);
      }
      return true;
    }
    if (role === 'PROJECT_ADMIN') {
      if (adminPerms?.projectAdmin?.canCreateProjects !== undefined) {
        return Boolean(adminPerms.projectAdmin.canCreateProjects);
      }
      return false;
    }
    if (role === 'WORKSPACE_MEMBER' || role === 'MEMBER') {
      if (adminPerms?.workspaceMember?.canCreateProjects !== undefined) {
        return Boolean(adminPerms.workspaceMember.canCreateProjects);
      }
      return false;
    }
    return false;
  }, [isWorkspaceOwner, activeRole, activeWorkspace]);

  const canArchiveProjects = useMemo(() => {
    if (isWorkspaceOwner) return true;
    if (isWorkspaceAdmin) {
      const adminPerms = activeWorkspace?.adminPermissions;
      if (adminPerms?.workspaceAdmin?.canArchiveProjects !== undefined) {
        return Boolean(adminPerms.workspaceAdmin.canArchiveProjects);
      }
      if (adminPerms?.canArchiveProjects !== undefined) {
        return Boolean(adminPerms.canArchiveProjects);
      }
      return true;
    }
    return false;
  }, [isWorkspaceOwner, isWorkspaceAdmin, activeWorkspace]);

  // Data states
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter & Search states
  const [activeTab, setActiveTab] = useState<'all' | 'owned' | 'joined' | 'active' | 'completed' | 'archived'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedVisibility, setSelectedVisibility] = useState('ALL');
  const [selectedSort, setSelectedSort] = useState('updated');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = viewMode === 'grid' ? 6 : 8;

  // Active 3-dot dropdown menu project id
  const [activeMenuProjectId, setActiveMenuProjectId] = useState<string | null>(null);

  // Action & Modal states
  const [archiveTarget, setArchiveTarget] = useState<Project | null>(null);
  const [isArchiving, setIsArchiving] = useState(false);
  const [unarchiveTarget, setUnarchiveTarget] = useState<Project | null>(null);
  const [isUnarchiving, setIsUnarchiving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [settingsModalProject, setSettingsModalProject] = useState<Project | null>(null);
  const [transferModalProject, setTransferModalProject] = useState<Project | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Completion requests state for Workspace Owner / Admin
  const [completionRequests, setCompletionRequests] = useState<ProjectCompletionRequestItem[]>([]);
  const [processingRequestId, setProcessingRequestId] = useState<string | null>(null);

  const fetchCompletionRequests = useCallback(async () => {
    if (!activeWsId || !isWorkspaceLeader) {
      setCompletionRequests([]);
      return;
    }
    try {
      const res = await projectsApi.getWorkspaceCompletionRequests(activeWsId);
      if (res.success && res.data) {
        setCompletionRequests(res.data.requests || []);
      }
    } catch {
      // Ignore
    }
  }, [activeWsId, isWorkspaceLeader]);

  useEffect(() => {
    fetchCompletionRequests();
  }, [fetchCompletionRequests]);

  const handleApproveCompletionRequest = async (requestId: string) => {
    if (!activeWsId) return;
    setProcessingRequestId(requestId);
    try {
      const res = await projectsApi.approveCompletionRequest(activeWsId, requestId);
      if (res.success) {
        await Promise.all([fetchProjects(), fetchCompletionRequests()]);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to approve completion request');
    } finally {
      setProcessingRequestId(null);
    }
  };

  const handleDeclineCompletionRequest = async (requestId: string) => {
    if (!activeWsId) return;
    const reason = window.prompt('Please enter a reason for declining (optional):');
    setProcessingRequestId(requestId);
    try {
      const res = await projectsApi.rejectCompletionRequest(activeWsId, requestId, reason || undefined);
      if (res.success) {
        await Promise.all([fetchProjects(), fetchCompletionRequests()]);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to decline completion request');
    } finally {
      setProcessingRequestId(null);
    }
  };

  // Close menus on outside click and Escape key
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.closest('.proj-more-btn') || target.closest('.proj-card-menu-dropdown'))) {
        return;
      }
      setActiveMenuProjectId(null);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveMenuProjectId(null);
      }
    };
    window.addEventListener('click', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('click', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Fetch projects scoped to active workspace with cancellation guard
  const fetchProjects = useCallback(async (targetWsId?: string) => {
    const wsId = targetWsId !== undefined ? targetWsId : activeWsId;
    if (wsLoading) return;

    setProjects([]);
    setLoading(true);
    setError(null);

    try {
      const res = await projectsApi.getUserProjects(wsId);
      if (res.success && res.data) {
        setProjects(res.data.all || []);
      }
    } catch (err: any) {
      setProjects([]);
      setError(err?.message || 'Failed to load projects');
    } finally {
      setLoading(false);
    }
  }, [activeWsId, wsLoading]);

  useEffect(() => {
    if (wsLoading) return;
    let isCancelled = false;
    const currentWsId = activeWsId;

    // Reset modals and active menu when switching workspaces
    setActiveMenuProjectId(null);
    setArchiveTarget(null);
    setUnarchiveTarget(null);
    setDeleteTarget(null);
    setSettingsModalProject(null);
    setTransferModalProject(null);
    setActionError(null);

    const load = async () => {
      setProjects([]);
      setLoading(true);
      setError(null);
      try {
        const res = await projectsApi.getUserProjects(currentWsId);
        if (!isCancelled && res.success && res.data) {
          setProjects(res.data.all || []);
          setCurrentPage(1);
        }
      } catch (err: any) {
        if (!isCancelled) {
          setProjects([]);
          setError(err?.message || 'Failed to load projects');
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      isCancelled = true;
    };
  }, [activeWsId, wsLoading]);

  // Reset tab if current tab is not applicable
  useEffect(() => {
    if (activeTab === 'owned' || activeTab === 'joined') {
      setActiveTab('all');
    }
  }, [activeTab]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, searchQuery, selectedCategory, selectedVisibility, selectedSort]);

  // Derived filtered & sorted projects
  const filteredProjects = useMemo(() => {
    let result = [...projects];

    // Tab filter
    if (activeTab === 'all') {
      // All non-archived projects
      result = result.filter((p) => p.status !== 'ARCHIVED');
    } else if (activeTab === 'active') {
      result = result.filter((p) => (p.status || 'ACTIVE') === 'ACTIVE');
    } else if (activeTab === 'completed') {
      result = result.filter((p) => p.status === 'COMPLETED');
    } else if (activeTab === 'archived') {
      result = result.filter((p) => p.status === 'ARCHIVED');
    }

    // Category filter
    if (selectedCategory !== 'ALL') {
      result = result.filter(
        (p) => p.category?.toLowerCase() === selectedCategory.toLowerCase()
      );
    }

    // Visibility filter
    if (selectedVisibility !== 'ALL') {
      result = result.filter((p) => (p.visibility || 'Workspace') === selectedVisibility);
    }

    // Search query
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      result = result.filter((p) => {
        const matchName = p.name.toLowerCase().includes(q);
        const matchKey = p.key?.toLowerCase().includes(q);
        const matchDesc = p.description?.toLowerCase().includes(q);
        const matchTech = p.technologyStack?.some((t) => t.toLowerCase().includes(q));
        const matchCat = p.category?.toLowerCase().includes(q);
        const matchWs = (p.workspace?.name || activeWorkspace?.name || '').toLowerCase().includes(q);
        return matchName || matchKey || matchDesc || matchTech || matchCat || matchWs;
      });
    }

    // Sorting
    result.sort((a, b) => {
      if (selectedSort === 'created') {
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      }
      if (selectedSort === 'name_asc') {
        return a.name.localeCompare(b.name);
      }
      if (selectedSort === 'name_desc') {
        return b.name.localeCompare(a.name);
      }
      if (selectedSort === 'tasks_high') {
        return (b.taskCount || 0) - (a.taskCount || 0);
      }
      if (selectedSort === 'progress_high') {
        return (b.progress || 0) - (a.progress || 0);
      }
      if (selectedSort === 'deadline') {
        if (!a.endDate) return 1;
        if (!b.endDate) return -1;
        return new Date(a.endDate).getTime() - new Date(b.endDate).getTime();
      }
      // default: updated
      return new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime();
    });

    return result;
  }, [projects, activeTab, isWorkspaceLeader, searchQuery, selectedCategory, selectedVisibility, selectedSort, user?.id, activeWorkspace?.name]);

  // Summary Metrics
  const metrics = useMemo(() => {
    const total = projects.length;
    const owned = projects.filter((p) => p.createdById === user?.id).length;
    const joined = total - owned;
    const active = projects.filter((p) => (p.status || 'ACTIVE') === 'ACTIVE').length;
    const completed = projects.filter((p) => p.status === 'COMPLETED').length;
    const archived = projects.filter((p) => p.status === 'ARCHIVED').length;
    const nonArchived = total - archived;
    const totalTasks = projects.reduce((acc, p) => acc + (p.taskCount || 0), 0);
    const completedTasks = projects.reduce((acc, p) => acc + (p.completedTaskCount || 0), 0);
    const avgProgress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    return { total, owned, joined, active, completed, archived, nonArchived, totalTasks, completedTasks, avgProgress };
  }, [projects, user?.id]);

  // Archive & Unarchive Handlers
  const handleConfirmArchive = async () => {
    if (!archiveTarget) return;
    setIsArchiving(true);
    setActionError(null);
    try {
      const res = await projectsApi.archiveProject(archiveTarget.id);
      if (res.success) {
        setArchiveTarget(null);
        await fetchProjects();
      } else {
        setActionError('Failed to archive project');
      }
    } catch (err: any) {
      setActionError(err?.message || 'Failed to archive project');
    } finally {
      setIsArchiving(false);
    }
  };

  const handleConfirmUnarchive = async () => {
    if (!unarchiveTarget) return;
    setIsUnarchiving(true);
    setActionError(null);
    try {
      const res = await projectsApi.unarchiveProject(unarchiveTarget.id);
      if (res.success) {
        setUnarchiveTarget(null);
        await fetchProjects();
      } else {
        setActionError('Failed to unarchive project');
      }
    } catch (err: any) {
      setActionError(err?.message || 'Failed to unarchive project');
    } finally {
      setIsUnarchiving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    setActionError(null);
    try {
      const res = await projectsApi.deleteProject(deleteTarget.id);
      if (res.success) {
        setDeleteTarget(null);
        await fetchProjects();
      } else {
        setActionError('Failed to delete project');
      }
    } catch (err: any) {
      setActionError(err?.message || 'Failed to delete project');
    } finally {
      setIsDeleting(false);
    }
  };

  // Pagination calculation
  const totalItems = filteredProjects.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedProjects = filteredProjects.slice(startIndex, startIndex + pageSize);

  const clearAllFilters = () => {
    setActiveTab('all');
    setSearchQuery('');
    setSelectedCategory('ALL');
    setSelectedVisibility('ALL');
    setSelectedSort('updated');
  };

  const isFiltering =
    activeTab !== 'all' ||
    searchQuery.trim() !== '' ||
    selectedCategory !== 'ALL' ||
    selectedVisibility !== 'ALL';

  return (
    <div className="mywork-page-container projects-page-container">
      {/* Scoped CSS for Projects Top Banner & 4-card Grid */}
      <style>{`
        /* Projects Header Banner matching reference design Pic 2 */
        .projects-page-container .projects-header-card,
        .projects-page-container .mywork-header {
          display: flex !important;
          flex-direction: row !important;
          align-items: center !important;
          justify-content: space-between !important;
          flex-wrap: nowrap !important;
          background: #FFFFFF !important;
          border: 1px solid #EAECEF !important;
          border-radius: 20px !important;
          padding: 1.1rem 1.85rem !important;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03) !important;
          position: relative !important;
          overflow: hidden !important;
          gap: 1rem !important;
          min-height: 88px !important;
          box-sizing: border-box !important;
          width: 100% !important;
        }
        @media (max-width: 1200px) {
          .projects-page-container .projects-header-card,
          .projects-page-container .mywork-header {
            padding: 1rem 1.25rem !important;
            gap: 0.75rem !important;
          }
        }
        .projects-page-container .projects-header-left {
          display: flex !important;
          flex-direction: row !important;
          align-items: center !important;
          gap: 1.15rem !important;
          flex-shrink: 0 !important;
        }
        .projects-page-container .projects-banner-icon-squircle {
          width: 58px !important;
          height: 58px !important;
          min-width: 58px !important;
          border-radius: 16px !important;
          background: #EFF6FF !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          color: #1E293B !important;
          flex-shrink: 0 !important;
        }
        .projects-page-container .projects-banner-titles {
          display: flex !important;
          flex-direction: column !important;
          align-items: flex-start !important;
          justify-content: center !important;
          gap: 0.2rem !important;
        }
        .projects-page-container .projects-header-title {
          font-size: 1.75rem !important;
          font-weight: 800 !important;
          letter-spacing: -0.03em !important;
          color: #0F172A !important;
          margin: 0 !important;
          line-height: 1.15 !important;
          text-align: left !important;
        }
        .projects-page-container .projects-header-subtitle {
          font-size: 0.875rem !important;
          color: #64748B !important;
          margin: 0 !important;
          font-weight: 400 !important;
          line-height: 1.35 !important;
          text-align: left !important;
          white-space: nowrap !important;
        }
        .projects-page-container .projects-header-center-wrap {
          display: flex !important;
          flex-direction: row !important;
          align-items: center !important;
          gap: 1.15rem !important;
          margin: 0 auto !important;
          flex-shrink: 1 !important;
          min-width: 0 !important;
        }
        @media (max-width: 1100px) {
          .projects-page-container .projects-header-center-wrap {
            display: none !important;
          }
        }
        .projects-page-container .projects-header-quote-block {
          display: flex !important;
          flex-direction: column !important;
          align-items: center !important;
          text-align: center !important;
          font-family: Georgia, 'Playfair Display', serif !important;
          font-style: italic !important;
          font-size: 1.05rem !important;
          font-weight: 500 !important;
          color: #1E293B !important;
          line-height: 1.35 !important;
          white-space: nowrap !important;
          flex-shrink: 0 !important;
        }
        .projects-page-container .quote-second-line {
          position: relative !important;
          display: inline-flex !important;
          flex-direction: column !important;
          align-items: center !important;
        }
        .projects-page-container .quote-green-swoosh {
          width: 70px !important;
          height: 8px !important;
          margin-top: 2px !important;
        }
        .projects-page-container .projects-header-illustration-box {
          width: 235px !important;
          height: 75px !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          flex-shrink: 0 !important;
        }
        .projects-page-container .projects-header-landscape-svg {
          width: 100% !important;
          height: 100% !important;
          overflow: visible !important;
        }
        .projects-page-container .projects-header-right {
          display: flex !important;
          align-items: center !important;
          flex-shrink: 0 !important;
        }
        .projects-page-container .projects-create-project-btn {
          display: inline-flex !important;
          align-items: center !important;
          gap: 0.45rem !important;
          background: #0B0F19 !important;
          color: #FFFFFF !important;
          border: none !important;
          border-radius: 9999px !important;
          padding: 0.65rem 1.25rem !important;
          font-size: 0.84rem !important;
          font-weight: 600 !important;
          cursor: pointer !important;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12) !important;
          transition: all 0.15s ease !important;
          white-space: nowrap !important;
          flex-shrink: 0 !important;
        }
        .projects-page-container .projects-create-project-btn:hover {
          background: #1E293B !important;
          transform: translateY(-1px) !important;
          box-shadow: 0 4px 10px rgba(0, 0, 0, 0.18) !important;
        }

        /* 4 Stat Cards Row matching reference design */
        .projects-stats-grid {
          display: grid !important;
          grid-template-columns: repeat(4, 1fr) !important;
          gap: 1.15rem !important;
          margin-bottom: 0 !important;
        }
        @media (max-width: 1024px) {
          .projects-stats-grid {
            grid-template-columns: repeat(2, 1fr) !important;
          }
        }
        @media (max-width: 640px) {
          .projects-stats-grid {
            grid-template-columns: 1fr !important;
          }
        }
        .projects-page-container .project-stat-card {
          background: #FFFFFF !important;
          border: 1px solid #EAECEF !important;
          border-radius: 16px !important;
          padding: 1.15rem 1.35rem 1.15rem 1.35rem !important;
          min-height: 124px !important;
          display: flex !important;
          flex-direction: column !important;
          justify-content: space-between !important;
          position: relative !important;
          overflow: hidden !important;
          cursor: pointer !important;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03) !important;
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1) !important;
          box-sizing: border-box !important;
        }
        .projects-page-container .project-stat-card:hover {
          transform: translateY(-2px) !important;
          box-shadow: 0 6px 16px rgba(0, 0, 0, 0.06) !important;
        }
        .projects-page-container .project-stat-card.active-metric-card {
          border-color: #CBD5E1 !important;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04) !important;
        }
        .projects-page-container .stat-card-head {
          display: flex !important;
          flex-direction: row !important;
          align-items: center !important;
          gap: 0.65rem !important;
          position: relative !important;
          z-index: 2 !important;
        }
        .projects-page-container .stat-icon-pill {
          width: 38px !important;
          height: 38px !important;
          min-width: 38px !important;
          border-radius: 11px !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          transition: transform 0.15s ease !important;
          flex-shrink: 0 !important;
        }
        .projects-page-container .project-stat-card:hover .stat-icon-pill {
          transform: scale(1.05) !important;
        }
        .projects-page-container .stat-icon-pill.icon-blue {
          background: #EFF6FF !important;
          color: #3B82F6 !important;
        }
        .projects-page-container .stat-icon-pill.icon-green {
          background: #ECFDF5 !important;
          color: #10B981 !important;
        }
        .projects-page-container .stat-icon-pill.icon-amber {
          background: #FFFBEB !important;
          color: #F59E0B !important;
        }
        .projects-page-container .stat-icon-pill.icon-rose {
          background: #FEF2F2 !important;
          color: #EF4444 !important;
        }
        .projects-page-container .stat-card-title {
          font-size: 0.875rem !important;
          font-weight: 700 !important;
          color: #1E293B !important;
          letter-spacing: -0.01em !important;
          white-space: nowrap !important;
        }
        .projects-page-container .stat-card-body {
          display: flex !important;
          flex-direction: row !important;
          align-items: flex-end !important;
          justify-content: flex-start !important;
          margin-top: 0.65rem !important;
          position: relative !important;
          z-index: 2 !important;
        }
        .projects-page-container .stat-card-info {
          display: flex !important;
          flex-direction: column !important;
          align-items: flex-start !important;
          text-align: left !important;
          max-width: 65% !important;
          z-index: 2 !important;
        }
        .projects-page-container .stat-card-number {
          font-size: 1.95rem !important;
          font-weight: 800 !important;
          line-height: 1.1 !important;
          letter-spacing: -0.02em !important;
          color: #0F172A !important;
          text-align: left !important;
        }
        .projects-page-container .stat-card-number.number-green {
          color: #059669 !important;
        }
        .projects-page-container .stat-card-number.number-purple {
          color: #7C3AED !important;
        }
        .projects-page-container .stat-card-desc {
          font-size: 0.78125rem !important;
          font-weight: 500 !important;
          color: #64748B !important;
          margin-top: 0.25rem !important;
          white-space: nowrap !important;
          text-align: left !important;
        }
        .projects-page-container .proj-stat-decor-svg {
          position: absolute !important;
          bottom: 0 !important;
          right: 0 !important;
          width: 140px !important;
          height: 100px !important;
          pointer-events: none !important;
          z-index: 1 !important;
        }
        .proj-card-menu-dropdown {
          position: absolute;
          top: calc(100% + 4px);
          right: 0;
          min-width: 180px;
          background: #FFFFFF;
          border: 1px solid #E2E8F0;
          border-radius: 8px;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05);
          z-index: 50;
          padding: 0.35rem;
          display: flex;
          flex-direction: column;
          animation: fadeIn 0.12s ease-out;
        }
        .proj-menu-item {
          display: flex;
          align-items: center;
          gap: 0.55rem;
          padding: 0.5rem 0.65rem;
          font-size: 0.8125rem;
          font-weight: 500;
          color: #334155;
          background: transparent;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          width: 100%;
          text-align: left;
          transition: all 0.12s ease;
        }
        .proj-menu-item:hover {
          background: #F8FAFC;
          color: #0F172A;
        }
        .proj-menu-item.danger-item {
          color: #EF4444;
        }
        .proj-menu-item.danger-item:hover {
          background: #FEF2F2;
          color: #DC2626;
        }
        .proj-menu-divider {
          height: 1px;
          background: #F1F5F9;
          margin: 0.3rem 0;
        }
        /* Project Card Design matching Reference Image */
        .projects-grid-3-col {
          display: grid !important;
          grid-template-columns: repeat(auto-fill, minmax(360px, 1fr)) !important;
          gap: 1.35rem !important;
          margin-bottom: 2rem !important;
        }
        @media (max-width: 768px) {
          .projects-grid-3-col {
            grid-template-columns: 1fr !important;
          }
        }
        .proj-card {
          background: #FFFFFF !important;
          border: 1px solid #EAECEF !important;
          border-radius: 18px !important;
          padding: 1.35rem 1.45rem !important;
          display: flex !important;
          flex-direction: column !important;
          cursor: pointer !important;
          transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease !important;
          min-width: 0 !important;
          box-sizing: border-box !important;
          position: relative !important;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03) !important;
        }
        .proj-card:hover {
          transform: translateY(-2px) !important;
          border-color: #CBD5E1 !important;
          box-shadow: 0 8px 20px -4px rgba(15, 23, 42, 0.06) !important;
        }
        .proj-card-top {
          display: flex !important;
          align-items: center !important;
          justify-content: space-between !important;
          gap: 0.75rem !important;
          margin-bottom: 0.85rem !important;
        }
        .proj-card-header-left {
          display: flex !important;
          align-items: center !important;
          gap: 0.85rem !important;
          min-width: 0 !important;
          flex: 1 !important;
        }
        .proj-card .project-avatar-badge {
          width: 44px !important;
          height: 44px !important;
          border-radius: 12px !important;
          background-color: #18181B !important;
          color: #FFFFFF !important;
          font-size: 1.15rem !important;
          font-weight: 700 !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          flex-shrink: 0 !important;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.12) !important;
        }
        .proj-card-title-group {
          display: flex !important;
          align-items: center !important;
          gap: 0.55rem !important;
          min-width: 0 !important;
          flex-wrap: wrap !important;
        }
        .proj-card-title-text {
          font-size: 1.125rem !important;
          font-weight: 700 !important;
          color: #0F172A !important;
          line-height: 1.25 !important;
          margin: 0 !important;
          white-space: nowrap !important;
          overflow: hidden !important;
          text-overflow: ellipsis !important;
          max-width: 220px !important;
        }
        .proj-workspace-attribution-pill {
          display: inline-flex !important;
          align-items: center !important;
          gap: 0.35rem !important;
          font-size: 0.75rem !important;
          font-weight: 500 !important;
          color: #475569 !important;
          background: #F8FAFC !important;
          border: 1px solid #E2E8F0 !important;
          border-radius: 6px !important;
          padding: 0.2rem 0.55rem !important;
          white-space: nowrap !important;
          max-width: 160px !important;
          overflow: hidden !important;
          text-overflow: ellipsis !important;
          line-height: 1.2 !important;
        }
        .proj-card-top-right {
          display: flex !important;
          align-items: center !important;
          gap: 0.5rem !important;
          flex-shrink: 0 !important;
        }
        .proj-status-pill {
          font-size: 0.75rem !important;
          font-weight: 600 !important;
          padding: 0.25rem 0.75rem !important;
          border-radius: 9999px !important;
          display: inline-flex !important;
          align-items: center !important;
          gap: 0.35rem !important;
          letter-spacing: 0.01em !important;
        }
        .proj-status-pill.status-active {
          background: #ECFDF5 !important;
          color: #10B981 !important;
          border: 1px solid #A7F3D0 !important;
        }
        .proj-status-pill.status-completed {
          background: #EFF6FF !important;
          color: #2563EB !important;
          border: 1px solid #BFDBFE !important;
        }
        .proj-status-pill.status-archived {
          background: #FEF3C7 !important;
          color: #B45309 !important;
          border: 1px solid #FCD34D !important;
        }
        .proj-card-category-row {
          display: flex !important;
          align-items: center !important;
          margin-bottom: 0.75rem !important;
        }
        .proj-card-category-pill {
          display: inline-flex !important;
          align-items: center !important;
          background: #FEF3C7 !important;
          color: #B45309 !important;
          font-size: 0.75rem !important;
          font-weight: 600 !important;
          padding: 0.28rem 0.85rem !important;
          border-radius: 9999px !important;
          line-height: 1.2 !important;
          letter-spacing: 0.01em !important;
        }
        .proj-card-desc {
          font-size: 0.875rem !important;
          color: #475569 !important;
          line-height: 1.45 !important;
          margin: 0 0 1.15rem 0 !important;
          display: -webkit-box !important;
          -webkit-line-clamp: 2 !important;
          line-clamp: 2 !important;
          -webkit-box-orient: vertical !important;
          overflow: hidden !important;
          text-overflow: ellipsis !important;
          word-break: break-all !important;
          overflow-wrap: anywhere !important;
          min-height: 2.6rem !important;
        }
        .proj-progress-section {
          margin-bottom: 0.5rem !important;
        }
        .proj-progress-labels {
          display: flex !important;
          align-items: center !important;
          justify-content: space-between !important;
          margin-bottom: 0.5rem !important;
        }
        .proj-progress-task-count {
          font-size: 0.84375rem !important;
          color: #64748B !important;
          font-weight: 500 !important;
        }
        .proj-progress-percentage {
          font-size: 0.875rem !important;
          color: #0F172A !important;
          font-weight: 700 !important;
        }
        .proj-progress-bar-track {
          height: 7px !important;
          background: #EEF2F6 !important;
          border-radius: 9999px !important;
          overflow: hidden !important;
          width: 100% !important;
        }
        .proj-progress-bar-fill {
          height: 100% !important;
          border-radius: 9999px !important;
          background: #10B981 !important;
          transition: width 0.25s ease !important;
        }
        .proj-card-foot {
          display: flex !important;
          align-items: center !important;
          justify-content: space-between !important;
          gap: 0.75rem !important;
          margin-top: auto !important;
          padding-top: 1.25rem !important;
          border-top: none !important;
        }
        .proj-card-foot-left {
          display: flex !important;
          align-items: center !important;
          gap: 0.45rem !important;
          font-size: 0.8125rem !important;
          color: #64748B !important;
          font-weight: 500 !important;
        }
        .proj-card-foot-right {
          display: flex !important;
          align-items: center !important;
          gap: 0.85rem !important;
        }
        .proj-card-members {
          display: flex !important;
          align-items: center !important;
          gap: 0.4rem !important;
          font-size: 0.8125rem !important;
          color: #64748B !important;
          font-weight: 500 !important;
        }
        .proj-card-arrow-btn {
          width: 32px !important;
          height: 32px !important;
          border-radius: 50% !important;
          background: #F1F5F9 !important;
          color: #475569 !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          border: none !important;
          cursor: pointer !important;
          transition: all 0.15s ease !important;
          flex-shrink: 0 !important;
          padding: 0 !important;
        }
        .proj-card-arrow-btn:hover {
          background: #E2E8F0 !important;
          color: #0F172A !important;
          transform: scale(1.05) !important;
        }
        .sr-only {
          position: absolute !important;
          width: 1px !important;
          height: 1px !important;
          padding: 0 !important;
          margin: -1px !important;
          overflow: hidden !important;
          clip: rect(0, 0, 0, 0) !important;
          white-space: nowrap !important;
          border-width: 0 !important;
        }
        /* PIC 1 NAVIGATION TABS DESIGN: Underline border, icons, transparent background */
        .projects-tabs-nav-bar {
          display: flex !important;
          align-items: center !important;
          gap: 0.5rem !important;
          border-bottom: 1px solid #E2E8F0 !important;
          margin-bottom: 1.25rem !important;
          overflow-x: auto !important;
          overflow-y: hidden !important;
          scrollbar-width: none !important;
          -ms-overflow-style: none !important;
          padding-bottom: 0 !important;
          background: transparent !important;
        }
        .projects-tabs-nav-bar::-webkit-scrollbar {
          display: none !important;
          width: 0 !important;
          height: 0 !important;
        }
        .projects-nav-tab-btn {
          display: inline-flex !important;
          align-items: center !important;
          gap: 0.5rem !important;
          padding: 0.65rem 1rem !important;
          font-size: 0.84375rem !important;
          font-weight: 600 !important;
          color: #64748B !important;
          background: transparent !important;
          border: none !important;
          border-radius: 0 !important;
          border-bottom: 2px solid transparent !important;
          cursor: pointer !important;
          transition: all 0.15s ease !important;
          white-space: nowrap !important;
          text-decoration: none !important;
          margin-bottom: -1px !important;
          box-shadow: none !important;
        }
        .projects-nav-tab-btn:hover {
          color: #0F172A !important;
          background: transparent !important;
        }
        .projects-nav-tab-btn.active {
          color: #0F172A !important;
          font-weight: 700 !important;
          background: transparent !important;
          border-bottom-color: #0F172A !important;
          border-radius: 0 !important;
          box-shadow: none !important;
        }
        /* Completion requests review panel */
        .proj-completion-requests-panel {
          background: #FFFBEB;
          border: 1px solid #FDE68A;
          border-radius: 12px;
          padding: 1.25rem;
          margin-bottom: 1.5rem;
        }
        .proj-cr-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 0.75rem;
        }
        .proj-cr-title-row {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.9375rem;
          font-weight: 700;
          color: #92400E;
        }
        .proj-cr-list {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }
        .proj-cr-card {
          background: #FFFFFF;
          border: 1px solid #FCD34D;
          border-radius: 8px;
          padding: 0.875rem 1rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          flex-wrap: wrap;
        }
        .proj-cr-info {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }
        .proj-cr-name {
          font-size: 0.875rem;
          font-weight: 700;
          color: #0F172A;
        }
        .proj-cr-meta {
          font-size: 0.75rem;
          color: #64748B;
        }
        .proj-cr-reason {
          font-size: 0.8125rem;
          color: #475569;
          font-style: italic;
          background: #F8FAFC;
          padding: 0.25rem 0.5rem;
          border-radius: 4px;
          margin-top: 0.25rem;
        }
        .proj-cr-actions {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        .proj-cr-approve-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          background: #059669;
          color: #FFFFFF;
          border: none;
          border-radius: 6px;
          padding: 0.45rem 0.85rem;
          font-size: 0.8125rem;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.15s ease;
        }
        .proj-cr-approve-btn:hover {
          background: #047857;
        }
        .proj-cr-decline-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          background: #FFFFFF;
          color: #DC2626;
          border: 1px solid #FCA5A5;
          border-radius: 6px;
          padding: 0.45rem 0.85rem;
          font-size: 0.8125rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .proj-cr-decline-btn:hover {
          background: #FEF2F2;
          border-color: #EF4444;
        }
      `}</style>

      {/* ==========================================================================
          HEADER: MATCHING REFERENCE DESIGN PIC 2
          ========================================================================== */}
      <div className="projects-header-card mywork-header">
        <div className="projects-header-left">
          <div className="projects-banner-icon-squircle">
            <ProjectsFolderBannerIcon size={28} />
          </div>
          <div className="projects-banner-titles">
            <h1 className="projects-header-title">Projects</h1>
            <p className="projects-header-subtitle">
              Manage, monitor, and oversee the entire project portfolio.
            </p>
          </div>
        </div>

        {/* Center Atmosphere Artwork with Quote & Illustration */}
        <div className="projects-header-center-wrap mywork-header-art-wrap">
          <div className="projects-header-quote-block">
            <span>“Big ideas start with</span>
            <span className="quote-second-line">
              a focused team.”
              <svg
                className="quote-green-swoosh"
                viewBox="0 0 76 9"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <path
                  d="M3 6.5C26 3 52 2.5 73 5.5"
                  stroke="#22C55E"
                  strokeWidth="3.2"
                  strokeLinecap="round"
                />
              </svg>
            </span>
          </div>

          <div className="projects-header-illustration-box mywork-header-illustration">
            <ProjectsHeaderIllustration />
          </div>
        </div>

        {/* Far Right Create Project Action */}
        <div className="projects-header-right mywork-header-right">
          {canCreateProject && (
            <button
              type="button"
              className="projects-create-project-btn mywork-create-btn"
              onClick={() => navigate('/app/projects/create')}
            >
              <PlusIcon size={16} />
              <span>Create Project</span>
            </button>
          )}
        </div>
      </div>

      {/* Error alert with retry */}
      {error && !loading && (
        <div
          className="form-error-banner"
          style={{
            marginBottom: '1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span>{error}</span>
          <button
            type="button"
            style={{
              background: '#FFFFFF',
              border: '1px solid #CBD5E1',
              borderRadius: '6px',
              padding: '0.25rem 0.65rem',
              cursor: 'pointer',
              fontSize: '0.75rem',
            }}
            onClick={() => fetchProjects()}
          >
            Retry
          </button>
        </div>
      )}

      {/* ==========================================================================
          METRICS STATS ROW: EXACTLY 4 METRIC CARDS (Total, Active, Completed, Archived)
          ========================================================================== */}
      {!loading && projects.length > 0 && (
        <div className="mywork-summary-grid projects-stats-row owner-four-cards projects-stats-grid">
          {/* 1. Total Projects */}
          <div
            className={`project-stat-card mywork-summary-card card-total cursor-pointer ${activeTab === 'all' ? 'active-metric-card' : ''}`}
            onClick={() => setActiveTab('all')}
            role="button"
            tabIndex={0}
          >
            <div className="stat-card-head summary-card-top">
              <div className="stat-icon-pill icon-blue summary-icon-pill icon-total">
                <LayersIcon size={20} />
              </div>
              <span className="stat-card-title summary-label">Total Projects</span>
            </div>
            <div className="stat-card-body summary-card-bottom">
              <div className="stat-card-info">
                <div className="stat-card-number summary-value">{metrics.total}</div>
                <div className="stat-card-desc summary-sub">
                  {isWorkspaceLeader ? 'In workspace portfolio' : 'Projects you are part of'}
                </div>
              </div>
            </div>
            <TotalCardDecor />
          </div>

          {/* 2. Active Projects */}
          <div
            className={`project-stat-card mywork-summary-card card-completed card-active cursor-pointer ${activeTab === 'active' ? 'active-metric-card' : ''}`}
            onClick={() => setActiveTab('active')}
            role="button"
            tabIndex={0}
          >
            <div className="stat-card-head summary-card-top">
              <div className="stat-icon-pill icon-green summary-icon-pill icon-completed">
                <CheckCircleIcon size={20} />
              </div>
              <span className="stat-card-title summary-label">Active Projects</span>
            </div>
            <div className="stat-card-body summary-card-bottom">
              <div className="stat-card-info">
                <div className="stat-card-number number-green summary-value text-success">{metrics.active}</div>
                <div className="stat-card-desc summary-sub">Currently in progress</div>
              </div>
            </div>
            <ActiveCardDecor />
          </div>

          {/* 3. Completed Projects */}
          <div
            className={`project-stat-card mywork-summary-card card-due-soon card-completed cursor-pointer ${activeTab === 'completed' ? 'active-metric-card' : ''}`}
            onClick={() => setActiveTab('completed')}
            role="button"
            tabIndex={0}
          >
            <div className="stat-card-head summary-card-top">
              <div className="stat-icon-pill icon-amber summary-icon-pill icon-due-soon">
                <CheckSquareIcon size={20} />
              </div>
              <span className="stat-card-title summary-label">Completed Projects</span>
            </div>
            <div className="stat-card-body summary-card-bottom">
              <div className="stat-card-info">
                <div className="stat-card-number number-purple summary-value text-purple">{metrics.completed}</div>
                <div className="stat-card-desc summary-sub">Successfully finalized</div>
              </div>
            </div>
            <CompletedCardDecor />
          </div>

          {/* 4. Archived Projects */}
          <div
            className={`project-stat-card mywork-summary-card card-overdue card-archived cursor-pointer ${activeTab === 'archived' ? 'active-metric-card' : ''}`}
            onClick={() => setActiveTab('archived')}
            role="button"
            tabIndex={0}
          >
            <div className="stat-card-head summary-card-top">
              <div className="stat-icon-pill icon-rose summary-icon-pill icon-overdue">
                <FolderIcon size={20} />
              </div>
              <span className="stat-card-title summary-label">Archived Projects</span>
            </div>
            <div className="stat-card-body summary-card-bottom">
              <div className="stat-card-info">
                <div className="stat-card-number summary-value text-danger-neutral">{metrics.archived}</div>
                <div className="stat-card-desc summary-sub">Archived & preserved</div>
              </div>
            </div>
            <ArchivedCardDecor />
          </div>
        </div>
      )}

      {/* ==========================================================================
          PENDING COMPLETION REQUESTS SECTION (WORKSPACE OWNER & WORKSPACE ADMIN)
          ========================================================================== */}
      {isWorkspaceLeader && completionRequests.length > 0 && (
        <div className="proj-completion-requests-panel">
          <div className="proj-cr-head">
            <div className="proj-cr-title-row">
              <CheckCircleIcon size={18} />
              <span>Pending Project Completion Requests ({completionRequests.length})</span>
            </div>
            <span style={{ fontSize: '0.75rem', color: '#B45309', fontWeight: 600 }}>
              Action Required
            </span>
          </div>
          <div className="proj-cr-list">
            {completionRequests.map((req) => (
              <div key={req.id} className="proj-cr-card">
                <div className="proj-cr-info">
                  <div className="proj-cr-name">
                    {req.projectName} {req.projectKey && <span style={{ color: '#64748B', fontWeight: 500 }}>({req.projectKey})</span>}
                  </div>
                  <div className="proj-cr-meta">
                    Requested by <strong>{req.requestedByName}</strong> • {new Date(req.requestedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </div>
                  {req.reason && (
                    <div className="proj-cr-reason">
                      &quot;{req.reason}&quot;
                    </div>
                  )}
                </div>
                <div className="proj-cr-actions">
                  <button
                    type="button"
                    className="proj-cr-approve-btn"
                    disabled={processingRequestId === req.id}
                    onClick={() => handleApproveCompletionRequest(req.id)}
                  >
                    <CheckSquareIcon size={14} />
                    <span>{processingRequestId === req.id ? 'Approving...' : 'Approve & Complete'}</span>
                  </button>
                  <button
                    type="button"
                    className="proj-cr-decline-btn"
                    disabled={processingRequestId === req.id}
                    onClick={() => handleDeclineCompletionRequest(req.id)}
                  >
                    <span>Decline</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ==========================================================================
          TABS ROW - 4 PRIMARY FILTERS (All Projects, Active, Completed, Archived)
          ========================================================================== */}
      <div className="mywork-tabs-bar projects-tabs-nav-bar">
        <button
          type="button"
          className={`mywork-tab dash-tab-btn projects-nav-tab-btn ${activeTab === 'all' ? 'active' : ''}`}
          onClick={() => setActiveTab('all')}
        >
          <LayersIcon size={15} />
          <span>All Projects ({metrics.nonArchived})</span>
        </button>
        <button
          type="button"
          className={`mywork-tab dash-tab-btn projects-nav-tab-btn ${activeTab === 'active' ? 'active' : ''}`}
          onClick={() => setActiveTab('active')}
        >
          <CheckCircleIcon size={15} />
          <span>Active ({metrics.active})</span>
        </button>
        <button
          type="button"
          className={`mywork-tab dash-tab-btn projects-nav-tab-btn ${activeTab === 'completed' ? 'active' : ''}`}
          onClick={() => setActiveTab('completed')}
        >
          <CheckSquareIcon size={15} />
          <span>Completed ({metrics.completed})</span>
        </button>
        <button
          type="button"
          className={`mywork-tab dash-tab-btn projects-nav-tab-btn ${activeTab === 'archived' ? 'active' : ''}`}
          onClick={() => setActiveTab('archived')}
        >
          <FolderIcon size={15} />
          <span>Archived ({metrics.archived})</span>
        </button>
      </div>

      {/* ==========================================================================
          FILTER TOOLBAR: SEARCH BOX & SELECTS
          ========================================================================== */}
      <div className="mywork-filters-row">
        {/* Left: Search Box */}
        <div className="mywork-search-box" style={{ maxWidth: '22rem' }}>
          <SearchIcon size={16} />
          <input
            type="text"
            placeholder="Search by name, key, tech, workspace..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="mywork-search-input dash-filter-input"
          />
          {searchQuery && (
            <button
              type="button"
              style={{
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                padding: 0,
                color: '#94A3B8',
                display: 'flex',
                alignItems: 'center',
              }}
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
            >
              <CloseIcon size={14} />
            </button>
          )}
        </div>

        {/* Right: Dropdowns & View Toggle */}
        <div className="mywork-filter-selects" style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
          <CustomSelect
            compact
            fullWidth={false}
            options={CATEGORY_OPTIONS}
            value={selectedCategory}
            onChange={(val) => setSelectedCategory(val)}
            placeholder="Category"
          />

          <CustomSelect
            compact
            fullWidth={false}
            options={VISIBILITY_OPTIONS}
            value={selectedVisibility}
            onChange={(val) => setSelectedVisibility(val)}
            placeholder="Visibility"
          />

          <CustomSelect
            compact
            fullWidth={false}
            options={SORT_OPTIONS}
            value={selectedSort}
            onChange={(val) => setSelectedSort(val)}
            placeholder="Sort by"
          />

          {/* Grid / List Toggle */}
          <div className="dash-view-toggle">
            <button
              type="button"
              className={`view-toggle-btn ${viewMode === 'grid' ? 'active' : ''}`}
              onClick={() => setViewMode('grid')}
              title="Grid View"
              aria-label="Grid View"
            >
              <GridIcon size={15} />
            </button>
            <button
              type="button"
              className={`view-toggle-btn ${viewMode === 'list' ? 'active' : ''}`}
              onClick={() => setViewMode('list')}
              title="List View"
              aria-label="List View"
            >
              <ListIcon size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* ==========================================================================
          CONTENT SECTION: GRID OR LIST VIEW
          ========================================================================== */}
      {loading ? (
        <div className="projects-grid-3-col">
          {[1, 2, 3, 4, 5, 6].map((idx) => (
            <div key={idx} className="proj-card skeleton-card" style={{ height: '220px' }}>
              <div className="skeleton-line" style={{ width: '50%', height: '20px' }} />
              <div className="skeleton-line" style={{ width: '90%', height: '14px', marginTop: '0.75rem' }} />
              <div className="skeleton-line" style={{ width: '70%', height: '14px', marginTop: '0.5rem' }} />
              <div className="skeleton-line" style={{ width: '100%', height: '6px', marginTop: 'auto' }} />
            </div>
          ))}
        </div>
      ) : projects.length === 0 ? (
        <EmptyState
          icon={<FolderPlusIcon size={48} />}
          title="No projects in this workspace"
          description="Projects represent collaborative codebases, task boards, architectural notes, and repositories. Create your first project to get started!"
          actionText={canCreateProject ? "+ Create Project" : undefined}
          onAction={canCreateProject ? () => navigate('/app/projects/create') : undefined}
        />
      ) : filteredProjects.length === 0 ? (
        <EmptyState
          icon={<FolderIcon size={40} />}
          title="No matching projects found"
          description={
            isFiltering
              ? 'No projects matched your active filters or search terms. Try clearing filters to see all workspace projects.'
              : 'No projects available.'
          }
          actionText="Clear Filters"
          onAction={clearAllFilters}
        />
      ) : viewMode === 'grid' ? (
        /* ===================== GRID VIEW (3 COLUMNS) ===================== */
        <div className="projects-grid-3-col">
          {paginatedProjects.map((project) => {
            const isOwner = project.createdById === user?.id;
            const userRole = project.userRole || (isOwner ? 'PROJECT_ADMIN' : 'PROJECT_MEMBER');
            const isAdmin = userRole === 'PROJECT_ADMIN';
            const memberCount = project.memberCount || project.members?.length || 1;
            const totalTasks = project.taskCount || 0;
            const completedTasks = project.completedTaskCount || 0;
            const progress = project.progress !== undefined ? project.progress : 0;
            const workspaceName = project.workspace?.name || activeWorkspace?.name || 'Workspace';

            return (
              <div
                key={project.id}
                className="proj-card"
                onClick={() => navigate(`/app/projects/${project.id}`)}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    navigate(`/app/projects/${project.id}`);
                  }
                }}
              >
                {/* Top Row: Avatar & Badges (Matching Image Row 1) */}
                <div className="proj-card-top">
                  <div className="proj-card-header-left">
                    <ProjectAvatar project={project} size="md" />
                    <div className="proj-card-title-group">
                      <span className="proj-card-title-text" title={project.name}>
                        {project.name}
                      </span>
                      {project.key && (
                        <span className="proj-key-pill" title={`Project Key: ${project.key}`}>
                          {project.key}
                        </span>
                      )}
                      {/* Workspace Attribution Badge (with workspace building icon instead of folder icon) */}
                      <span className="proj-workspace-attribution-pill" title={`Workspace: ${workspaceName}`}>
                        <WorkspaceBadgeIcon size={12} />
                        <span>{workspaceName}</span>
                      </span>
                    </div>
                  </div>

                  {/* Top-Right Badges & Actions */}
                  <div className="proj-card-top-right">
                    <span className={`proj-status-pill status-${(project.status || 'ACTIVE').toLowerCase()}`}>
                      {project.status === 'COMPLETED' ? 'Completed' : project.status === 'ARCHIVED' ? 'Archived' : 'Active'}
                    </span>

                    {/* Three-dot dropdown menu */}
                    <div style={{ position: 'relative' }}>
                      <button
                        type="button"
                        className="proj-more-btn"
                        title="Project options"
                        aria-label="Project options"
                        aria-expanded={activeMenuProjectId === project.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenuProjectId(activeMenuProjectId === project.id ? null : project.id);
                        }}
                      >
                        <MoreVerticalIcon size={16} />
                      </button>

                      {activeMenuProjectId === project.id && (
                        <div className="proj-card-menu-dropdown" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            className="proj-menu-item"
                            onClick={() => {
                              setActiveMenuProjectId(null);
                              navigate(`/app/projects/${project.id}`);
                            }}
                          >
                            <ArrowRightIcon size={14} />
                            <span>Open Project</span>
                          </button>

                          {(isWorkspaceLeader || isAdmin) && (
                            <button
                              type="button"
                              className="proj-menu-item"
                              onClick={() => {
                                setActiveMenuProjectId(null);
                                setSettingsModalProject(project);
                              }}
                            >
                              <SettingsIcon size={14} />
                              <span>Project Settings</span>
                            </button>
                          )}

                          {project.status !== 'ARCHIVED' ? (
                            <>
                              {(isWorkspaceLeader || isAdmin) && (
                                <button
                                  type="button"
                                  className="proj-menu-item"
                                  onClick={() => {
                                    setActiveMenuProjectId(null);
                                    navigate(`/app/projects/${project.id}/members`);
                                  }}
                                >
                                  <UsersIcon size={14} />
                                  <span>Manage Members</span>
                                </button>
                              )}

                              {isWorkspaceLeader && (
                                <button
                                  type="button"
                                  className="proj-menu-item"
                                  onClick={() => {
                                    setActiveMenuProjectId(null);
                                    setTransferModalProject(project);
                                  }}
                                >
                                  <ArrowRightIcon size={14} />
                                  <span>Transfer Project</span>
                                </button>
                              )}

                              {(isWorkspaceLeader || (isAdmin && canArchiveProjects)) && (
                                <button
                                  type="button"
                                  className="proj-menu-item"
                                  onClick={() => {
                                    setActiveMenuProjectId(null);
                                    setActionError(null);
                                    setArchiveTarget(project);
                                  }}
                                >
                                  <ArchiveBoxIcon size={14} />
                                  <span>Archive Project</span>
                                </button>
                              )}
                            </>
                          ) : (
                            (isWorkspaceLeader || (isAdmin && canArchiveProjects)) && (
                              <button
                                type="button"
                                className="proj-menu-item"
                                onClick={() => {
                                  setActiveMenuProjectId(null);
                                  setActionError(null);
                                  setUnarchiveTarget(project);
                                }}
                              >
                                <ArchiveBoxIcon size={14} />
                                <span>Unarchive Project</span>
                              </button>
                            )
                          )}

                          {isWorkspaceLeader && (
                            <>
                              <div className="proj-menu-divider" />
                              <button
                                type="button"
                                className="proj-menu-item danger-item"
                                onClick={() => {
                                  setActiveMenuProjectId(null);
                                  setActionError(null);
                                  setDeleteTarget(project);
                                }}
                              >
                                <TrashIcon size={14} />
                                <span>Delete Project</span>
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Category Pill Row (Matching Image Row 2) */}
                <div className="proj-card-category-row">
                  <span className="proj-card-category-pill">
                    {project.category ? formatCategory(project.category) : (project.technologyStack?.[0] || 'General')}
                  </span>
                </div>

                {/* Project Description (Matching Image Row 3) */}
                <p className="proj-card-desc" title={project.description || undefined}>
                  {project.description || 'No description provided.'}
                </p>

                {/* Task Count & Progress Bar (Matching Image Row 4) */}
                <div className="proj-progress-section">
                  <div className="proj-progress-labels">
                    <span className="proj-progress-task-count">
                      {totalTasks > 0 ? `${completedTasks} of ${totalTasks} tasks completed` : '0 of 0 tasks completed'}
                    </span>
                    <span className="proj-progress-percentage">{progress}%</span>
                  </div>
                  <div className="proj-progress-bar-track">
                    <div
                      className="proj-progress-bar-fill"
                      style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
                    />
                  </div>
                </div>

                {/* Card Footer: Updated time, Members & Circular Action Button (Matching Image Row 5) */}
                <div className="proj-card-foot">
                  <div className="proj-card-foot-left">
                    <CalendarIcon size={16} />
                    <span>Updated {formatTimeAgo(project.updatedAt)}</span>
                  </div>

                  <div className="proj-card-foot-right">
                    <div className="proj-card-members">
                      <UsersIcon size={16} />
                      <span>
                        {memberCount} {memberCount === 1 ? 'member' : 'members'}
                      </span>
                    </div>

                    <button
                      type="button"
                      className="proj-card-arrow-btn"
                      title="Open Project"
                      aria-label="Open Project"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/app/projects/${project.id}`);
                      }}
                    >
                      <span className="sr-only">Open Project</span>
                      <ChevronRightIcon size={16} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ===================== LIST VIEW ===================== */
        <div className="workspace-list-view" style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          {paginatedProjects.map((project) => {
            const isOwner = project.createdById === user?.id;
            const userRole = project.userRole || (isOwner ? 'PROJECT_ADMIN' : 'PROJECT_MEMBER');
            const isAdmin = userRole === 'PROJECT_ADMIN';
            const memberCount = project.memberCount || project.members?.length || 1;
            const isWorkspaceVisible = (project.visibility || 'Workspace') === 'Workspace';
            const totalTasks = project.taskCount || 0;
            const completedTasks = project.completedTaskCount || 0;
            const progress = project.progress !== undefined ? project.progress : 0;
            const deadlineFormatted = formatDate(project.endDate);
            const updatedFormatted = formatDate(project.updatedAt);
            const workspaceName = project.workspace?.name || activeWorkspace?.name || 'Workspace';

            return (
              <div
                key={project.id}
                className="proj-list-item"
                onClick={() => navigate(`/app/projects/${project.id}`)}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    navigate(`/app/projects/${project.id}`);
                  }
                }}
              >
                <div className="proj-list-left">
                  <ProjectAvatar project={project} size="sm" />
                  <div className="proj-list-info">
                    <div className="proj-list-title-row">
                      <span className="proj-list-name">{project.name}</span>
                      {project.key && <span className="proj-key-pill">{project.key}</span>}
                      {/* Workspace badge in list */}
                      <span className="proj-workspace-attribution-pill" title={`Workspace: ${workspaceName}`}>
                        <WorkspaceBadgeIcon size={11} />
                        <span>{workspaceName}</span>
                      </span>

                      {isWorkspaceLeader ? (
                        <span className={`proj-status-pill status-${(project.status || 'ACTIVE').toLowerCase()}`}>
                          {project.status === 'COMPLETED' ? 'Completed' : project.status === 'ARCHIVED' ? 'Archived' : 'Active'}
                        </span>
                      ) : (
                        <>
                          <span
                            className={`proj-visibility-pill ${
                              isWorkspaceVisible ? 'visibility-workspace' : 'visibility-restricted'
                            }`}
                          >
                            {isWorkspaceVisible ? <GlobeIcon size={11} /> : <LockIcon size={11} />}
                            <span>{project.visibility || 'Workspace'}</span>
                          </span>
                          <span className={`proj-role-badge ${isAdmin ? 'role-admin' : 'role-member'}`}>
                            {isAdmin ? 'ADMIN' : 'MEMBER'}
                          </span>
                        </>
                      )}
                    </div>
                    <p className="proj-list-desc" title={project.description || undefined}>
                      {project.description || 'No description provided.'}
                    </p>
                  </div>
                </div>

                <div className="proj-list-right" style={{ gap: '1.25rem', alignItems: 'center' }}>
                  {/* Progress info in list */}
                  <div className="proj-list-progress-box">
                    <span className="proj-list-progress-txt">
                      {totalTasks > 0 ? `${completedTasks} of ${totalTasks} completed` : '0 completed'}
                    </span>
                    <div className="proj-progress-bar-track" style={{ width: '80px', height: '4px' }}>
                      <div
                        className="proj-progress-bar-fill"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>

                  {updatedFormatted ? (
                    <div className="proj-meta-item" title="Last Updated">
                      <ClockIcon size={13} />
                      <span style={{ fontSize: '0.75rem' }}>{updatedFormatted}</span>
                    </div>
                  ) : deadlineFormatted && (
                    <div className="proj-meta-item" title="Target Deadline">
                      <CalendarIcon size={13} />
                      <span style={{ fontSize: '0.75rem' }}>{deadlineFormatted}</span>
                    </div>
                  )}

                  <div className="proj-meta-item">
                    <UsersIcon size={14} />
                    <span>{memberCount}</span>
                  </div>

                  {/* Three-dot menu in list view */}
                  <div style={{ position: 'relative' }}>
                    <button
                      type="button"
                      className="proj-more-btn"
                      title="Project options"
                      aria-label="Project options"
                      aria-expanded={activeMenuProjectId === project.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveMenuProjectId(activeMenuProjectId === project.id ? null : project.id);
                      }}
                    >
                      <MoreVerticalIcon size={16} />
                    </button>

                    {activeMenuProjectId === project.id && (
                      <div className="proj-card-menu-dropdown" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          className="proj-menu-item"
                          onClick={() => {
                            setActiveMenuProjectId(null);
                            navigate(`/app/projects/${project.id}`);
                          }}
                        >
                          <ArrowRightIcon size={14} />
                          <span>Open Project</span>
                        </button>

                        {(isWorkspaceLeader || isAdmin) && (
                          <button
                            type="button"
                            className="proj-menu-item"
                            onClick={() => {
                              setActiveMenuProjectId(null);
                              setSettingsModalProject(project);
                            }}
                          >
                            <SettingsIcon size={14} />
                            <span>Project Settings</span>
                          </button>
                        )}

                        {project.status !== 'ARCHIVED' ? (
                          <>
                            {(isWorkspaceLeader || isAdmin) && (
                              <button
                                type="button"
                                className="proj-menu-item"
                                onClick={() => {
                                  setActiveMenuProjectId(null);
                                  navigate(`/app/projects/${project.id}/members`);
                                }}
                              >
                                <UsersIcon size={14} />
                                <span>Manage Members</span>
                              </button>
                            )}

                            {isWorkspaceLeader && (
                              <button
                                type="button"
                                className="proj-menu-item"
                                onClick={() => {
                                  setActiveMenuProjectId(null);
                                  setTransferModalProject(project);
                                }}
                              >
                                <ArrowRightIcon size={14} />
                                <span>Transfer Project</span>
                              </button>
                            )}

                            {(isWorkspaceLeader || (isAdmin && canArchiveProjects)) && (
                              <button
                                type="button"
                                className="proj-menu-item"
                                onClick={() => {
                                  setActiveMenuProjectId(null);
                                  setActionError(null);
                                  setArchiveTarget(project);
                                }}
                              >
                                <ArchiveBoxIcon size={14} />
                                <span>Archive Project</span>
                              </button>
                            )}
                          </>
                        ) : (
                          (isWorkspaceLeader || (isAdmin && canArchiveProjects)) && (
                            <button
                              type="button"
                              className="proj-menu-item"
                              onClick={() => {
                                setActiveMenuProjectId(null);
                                setActionError(null);
                                setUnarchiveTarget(project);
                              }}
                            >
                              <ArchiveBoxIcon size={14} />
                              <span>Unarchive Project</span>
                            </button>
                          )
                        )}

                        {isWorkspaceLeader && (
                          <>
                            <div className="proj-menu-divider" />
                            <button
                              type="button"
                              className="proj-menu-item danger-item"
                              onClick={() => {
                                setActiveMenuProjectId(null);
                                setActionError(null);
                                setDeleteTarget(project);
                              }}
                            >
                              <TrashIcon size={14} />
                              <span>Delete Project</span>
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  <ArrowRightIcon size={15} className="proj-list-arrow" />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ==========================================================================
          PAGINATION BAR
          ========================================================================== */}
      {!loading && totalItems > pageSize && (
        <div className="projects-pagination-container">
          <span className="projects-pagination-info">
            Showing <strong>{startIndex + 1}</strong> to{' '}
            <strong>{Math.min(startIndex + pageSize, totalItems)}</strong> of{' '}
            <strong>{totalItems}</strong> projects
          </span>

          <div className="projects-pagination-buttons">
            <button
              type="button"
              className="projects-page-number-btn"
              disabled={currentPage === 1}
              style={{ padding: '0 0.75rem', opacity: currentPage === 1 ? 0.5 : 1, cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
              <button
                key={pageNum}
                type="button"
                className={`projects-page-number-btn ${
                  currentPage === pageNum ? 'active' : ''
                }`}
                onClick={() => setCurrentPage(pageNum)}
              >
                {pageNum}
              </button>
            ))}

            <button
              type="button"
              className="projects-page-number-btn"
              disabled={currentPage === totalPages}
              style={{ padding: '0 0.75rem', opacity: currentPage === totalPages ? 0.5 : 1, cursor: currentPage === totalPages ? 'not-allowed' : 'pointer' }}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* ==========================================================================
          MODALS FOR WORKSPACE OWNER ACTIONS
          ========================================================================== */}
      {/* 1. Archive Confirmation Modal */}
      {archiveTarget && (
        <Modal
          isOpen={!!archiveTarget}
          onClose={() => !isArchiving && setArchiveTarget(null)}
          title="Archive Project"
          maxWidth="sm"
        >
          <div style={{ padding: '0.5rem 0' }}>
            <div
              style={{
                backgroundColor: '#FFFBEB',
                border: '1px solid #FDE68A',
                borderRadius: '8px',
                padding: '0.85rem',
                marginBottom: '1rem',
                color: '#92400E',
                fontSize: '0.875rem',
                lineHeight: '1.45',
              }}
            >
              <strong>Preserve project records:</strong> Archiving moves this project to the Archived tab. All tasks, files, notes, members, and historical records remain preserved.
            </div>
            <p style={{ color: '#334155', fontSize: '0.9rem', marginBottom: '1.25rem' }}>
              Are you sure you want to archive <strong>{archiveTarget.name}</strong>? You can unarchive it at any time.
            </p>
            {actionError && (
              <div style={{ color: '#DC2626', fontSize: '0.8125rem', marginBottom: '0.75rem' }}>
                {actionError}
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setArchiveTarget(null)}
                disabled={isArchiving}
                style={{ padding: '0.45rem 1rem', borderRadius: '6px', border: '1px solid #CBD5E1', background: '#FFFFFF', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleConfirmArchive}
                disabled={isArchiving}
                style={{
                  padding: '0.45rem 1rem',
                  borderRadius: '6px',
                  border: 'none',
                  background: '#D97706',
                  color: '#FFFFFF',
                  fontWeight: 600,
                  cursor: isArchiving ? 'not-allowed' : 'pointer',
                }}
              >
                {isArchiving ? 'Archiving...' : 'Archive Project'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* 2. Unarchive Confirmation Modal */}
      {unarchiveTarget && (
        <Modal
          isOpen={!!unarchiveTarget}
          onClose={() => !isUnarchiving && setUnarchiveTarget(null)}
          title="Unarchive Project"
          maxWidth="sm"
        >
          <div style={{ padding: '0.5rem 0' }}>
            <div
              style={{
                backgroundColor: '#F0FDF4',
                border: '1px solid #BBF7D0',
                borderRadius: '8px',
                padding: '0.85rem',
                marginBottom: '1rem',
                color: '#166534',
                fontSize: '0.875rem',
                lineHeight: '1.45',
              }}
            >
              <strong>Restore project:</strong> This project will be restored to the active workspace project list with all its tasks and data intact.
            </div>
            <p style={{ color: '#334155', fontSize: '0.9rem', marginBottom: '1.25rem' }}>
              Are you sure you want to restore <strong>{unarchiveTarget.name}</strong> to the active workspace project list?
            </p>
            {actionError && (
              <div style={{ color: '#DC2626', fontSize: '0.8125rem', marginBottom: '0.75rem' }}>
                {actionError}
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setUnarchiveTarget(null)}
                disabled={isUnarchiving}
                style={{ padding: '0.45rem 1rem', borderRadius: '6px', border: '1px solid #CBD5E1', background: '#FFFFFF', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleConfirmUnarchive}
                disabled={isUnarchiving}
                style={{
                  padding: '0.45rem 1rem',
                  borderRadius: '6px',
                  border: 'none',
                  background: '#059669',
                  color: '#FFFFFF',
                  fontWeight: 600,
                  cursor: isUnarchiving ? 'not-allowed' : 'pointer',
                }}
              >
                {isUnarchiving ? 'Unarchiving...' : 'Unarchive Project'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* 3. Delete Confirmation Modal */}
      {deleteTarget && (
        <Modal
          isOpen={!!deleteTarget}
          onClose={() => !isDeleting && setDeleteTarget(null)}
          title="Delete Project Permanently"
          maxWidth="sm"
        >
          <div style={{ padding: '0.5rem 0' }}>
            <div
              style={{
                backgroundColor: '#FEF2F2',
                border: '1px solid #FECACA',
                borderRadius: '8px',
                padding: '0.85rem',
                marginBottom: '1rem',
                color: '#991B1B',
                fontSize: '0.875rem',
                lineHeight: '1.45',
              }}
            >
              <strong>Warning:</strong> This action cannot be undone. Permanent deletion removes this project and all associated tasks, files, notes, and activity.
            </div>
            <p style={{ color: '#334155', fontSize: '0.9rem', marginBottom: '1.25rem' }}>
              Are you sure you want to permanently delete <strong>{deleteTarget.name}</strong>?
            </p>
            {actionError && (
              <div style={{ color: '#DC2626', fontSize: '0.8125rem', marginBottom: '0.75rem' }}>
                {actionError}
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setDeleteTarget(null)}
                disabled={isDeleting}
                style={{ padding: '0.45rem 1rem', borderRadius: '6px', border: '1px solid #CBD5E1', background: '#FFFFFF', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                style={{
                  padding: '0.45rem 1rem',
                  borderRadius: '6px',
                  border: 'none',
                  background: '#DC2626',
                  color: '#FFFFFF',
                  fontWeight: 600,
                  cursor: isDeleting ? 'not-allowed' : 'pointer',
                }}
              >
                {isDeleting ? 'Deleting...' : 'Delete Project'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* 4. Project Settings Modal */}
      {settingsModalProject && (
        <ProjectSettingsModal
          project={settingsModalProject}
          isOpen={!!settingsModalProject}
          onClose={() => setSettingsModalProject(null)}
          onUpdated={() => {
            setSettingsModalProject(null);
            fetchProjects();
          }}
          onDeleted={() => {
            setSettingsModalProject(null);
            fetchProjects();
          }}
        />
      )}

      {/* 5. Project Transfer Modal */}
      {transferModalProject && (
        <ProjectTransferModal
          isOpen={!!transferModalProject}
          onClose={() => setTransferModalProject(null)}
          project={transferModalProject}
          onTransferred={() => {
            setTransferModalProject(null);
            fetchProjects();
          }}
        />
      )}
    </div>
  );
};

export default ProjectsPage;
