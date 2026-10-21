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
} from '../../components/ui/Icons';

const WorkspaceBadgeIcon: React.FC<{ size?: number; className?: string }> = ({ size = 12, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M3 21h18" />
    <path d="M9 8h1" />
    <path d="M9 12h1" />
    <path d="M9 16h1" />
    <path d="M14 8h1" />
    <path d="M14 12h1" />
    <path d="M14 16h1" />
    <path d="M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16" />
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
      {/* Scoped CSS for Owner's 4-card grid, status pills, and 3-dot dropdown */}
      <style>{`
        .projects-stats-row.owner-four-cards {
          grid-template-columns: repeat(4, 1fr) !important;
        }
        @media (max-width: 1024px) {
          .projects-stats-row.owner-four-cards {
            grid-template-columns: repeat(2, 1fr) !important;
          }
        }
        @media (max-width: 640px) {
          .projects-stats-row.owner-four-cards {
            grid-template-columns: 1fr !important;
          }
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
        .proj-status-pill {
          font-size: 0.675rem;
          font-weight: 600;
          padding: 0.2rem 0.55rem;
          border-radius: 9999px;
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          letter-spacing: 0.02em;
        }
        .proj-status-pill.status-active {
          background: #ECFDF5;
          color: #059669;
          border: 1px solid #A7F3D0;
        }
        .proj-status-pill.status-completed {
          background: #EFF6FF;
          color: #2563EB;
          border: 1px solid #BFDBFE;
        }
        .proj-status-pill.status-archived {
          background: #FEF3C7;
          color: #B45309;
          border: 1px solid #FCD34D;
        }
        .proj-updated-row {
          font-size: 0.75rem;
          color: #94A3B8;
          display: flex;
          align-items: center;
          gap: 0.35rem;
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
          HEADER: MATCHING PIC 2 (MyWork) DESIGN SYSTEM
          ========================================================================== */}
      <div className="mywork-header">
        <div className="mywork-header-left">
          <div className="mywork-title-row">
            <span className="mywork-title-icon-box">
              <FolderIcon size={22} />
            </span>
            <h1 className="projects-header-title">Projects</h1>
            <span className="mywork-date-badge">
              {activeWorkspace?.name || 'Active Workspace'}
            </span>
          </div>
          <p className="mywork-subtitle">
            {isWorkspaceLeader
              ? `Manage, monitor, and oversee the entire project portfolio for ${activeWorkspace?.name || 'the active workspace'}.`
              : `Manage, collaborate, and monitor all authorized projects within ${activeWorkspace?.name || 'the active workspace'}.`}
          </p>
        </div>

        {/* Center Atmosphere Artwork with Quote */}
        <div className="mywork-header-art-wrap">
          <span className="mywork-quote-text">Big ideas start with a focused team.</span>
          <div className="mywork-header-illustration">
            <svg viewBox="0 0 160 55" fill="none" xmlns="http://www.w3.org/2000/svg" className="header-landscape-svg">
              <circle cx="120" cy="18" r="8" fill="#FDE047" opacity="0.9" />
              <path d="M135 14 C135 11 140 11 143 13 C145 11 150 12 150 15 C153 15 155 18 153 20 C151 22 135 22 135 20 Z" fill="#E2E8F0" opacity="0.8" />
              <polygon points="100,55 130,22 160,55" fill="#CBD5E1" opacity="0.6" />
              <polygon points="65,55 105,14 145,55" fill="#94A3B8" opacity="0.5" />
              <polygon points="40,55 75,25 110,55" fill="#A7F3D0" opacity="0.75" />
              <polygon points="126,55 130,42 134,55" fill="#10B981" />
              <polygon points="132,55 136,38 140,55" fill="#059669" />
              <polygon points="62,55 65,45 68,55" fill="#34D399" />
            </svg>
          </div>
        </div>

        {/* Far Right Create Project Action */}
        <div className="mywork-header-right">
          {canCreateProject && (
            <button
              type="button"
              className="mywork-create-btn"
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
        <div className="mywork-summary-grid projects-stats-row owner-four-cards">
          {/* 1. Total Projects */}
          <div
            className={`mywork-summary-card card-total cursor-pointer ${activeTab === 'all' ? 'active-metric-card' : ''}`}
            onClick={() => setActiveTab('all')}
            role="button"
            tabIndex={0}
          >
            <div className="summary-card-top">
              <div className="summary-icon-pill icon-total">
                <LayersIcon size={16} />
              </div>
              <span className="summary-label">Total Projects</span>
            </div>
            <div className="summary-card-bottom">
              <div className="summary-value">{metrics.total}</div>
              <div className="summary-sub">{isWorkspaceLeader ? 'In workspace portfolio' : 'Projects you are part of'}</div>
            </div>
          </div>

          {/* 2. Active Projects */}
          <div
            className={`mywork-summary-card card-completed cursor-pointer ${activeTab === 'active' ? 'active-metric-card' : ''}`}
            onClick={() => setActiveTab('active')}
            role="button"
            tabIndex={0}
          >
            <div className="summary-card-top">
              <div className="summary-icon-pill icon-completed">
                <CheckCircleIcon size={16} />
              </div>
              <span className="summary-label">Active Projects</span>
            </div>
            <div className="summary-card-bottom">
              <div className="summary-value text-success">{metrics.active}</div>
              <div className="summary-sub">Currently in progress</div>
            </div>
          </div>

          {/* 3. Completed Projects */}
          <div
            className={`mywork-summary-card card-due-soon cursor-pointer ${activeTab === 'completed' ? 'active-metric-card' : ''}`}
            onClick={() => setActiveTab('completed')}
            role="button"
            tabIndex={0}
          >
            <div className="summary-card-top">
              <div className="summary-icon-pill icon-due-soon">
                <CheckSquareIcon size={16} />
              </div>
              <span className="summary-label">Completed Projects</span>
            </div>
            <div className="summary-card-bottom">
              <div className="summary-value text-purple">{metrics.completed}</div>
              <div className="summary-sub">Successfully finalized</div>
            </div>
          </div>

          {/* 4. Archived Projects */}
          <div
            className={`mywork-summary-card card-overdue cursor-pointer ${activeTab === 'archived' ? 'active-metric-card' : ''}`}
            onClick={() => setActiveTab('archived')}
            role="button"
            tabIndex={0}
          >
            <div className="summary-card-top">
              <div className="summary-icon-pill icon-overdue">
                <FolderIcon size={16} />
              </div>
              <span className="summary-label">Archived Projects</span>
            </div>
            <div className="summary-card-bottom">
              <div className="summary-value text-danger-neutral">{metrics.archived}</div>
              <div className="summary-sub">Archived & preserved</div>
            </div>
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
            const deadlineFormatted = formatDate(project.endDate);
            const updatedFormatted = formatDate(project.updatedAt);
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
                {/* Top Row: Avatar & Badges */}
                <div className="proj-card-top" style={{ alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
                    <ProjectAvatar project={project} size="md" />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                        <span className="proj-card-title-text" style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0F172A' }}>
                          {project.name}
                        </span>
                        {project.key && (
                          <span className="proj-key-pill" title={`Project Key: ${project.key}`}>
                            {project.key}
                          </span>
                        )}
                      </div>

                      {/* Workspace Attribution Badge */}
                      <span className="proj-workspace-attribution-pill" title={`Workspace: ${workspaceName}`}>
                        <WorkspaceBadgeIcon size={11} />
                        <span>{workspaceName}</span>
                      </span>
                    </div>
                  </div>                  {/* Top-Right Badges & Actions */}
                  <div className="proj-card-top-right" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', justifyContent: 'flex-end', position: 'relative' }}>
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

                {/* Project Description */}
                <p className="proj-card-desc" style={{ marginTop: '0.35rem' }} title={project.description || undefined}>
                  {project.description || 'No description provided.'}
                </p>

                {/* Tech Stack Chips or Category */}
                <div className="proj-tech-stack-row">
                  {project.technologyStack && project.technologyStack.length > 0 ? (
                    <>
                      {project.technologyStack.slice(0, 3).map((tech, idx) => {
                        const techLower = tech.toLowerCase().replace(/[^a-z0-9]/g, '');
                        return (
                          <span key={idx} className={`tech-chip tech-chip-${techLower}`}>
                            {tech}
                          </span>
                        );
                      })}
                      {project.technologyStack.length > 3 && (
                        <span className="tech-chip-more">
                          +{project.technologyStack.length - 3}
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="tech-chip tech-chip-category">
                      {formatCategory(project.category)}
                    </span>
                  )}
                </div>

                {/* Task Count & Progress Bar */}
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

                {/* Deadlines if defined */}
                {deadlineFormatted && (
                  <div className="proj-deadline-row">
                    <CalendarIcon size={12} />
                    <span>Target: {deadlineFormatted}</span>
                  </div>
                )}

                {/* Card Footer: Members, Updated time & Link */}
                <div className="proj-card-foot">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <div className="proj-meta-item">
                      <UsersIcon size={14} />
                      <span>
                        {memberCount} {memberCount === 1 ? 'member' : 'members'}
                      </span>
                    </div>

                    {updatedFormatted && (
                      <div className="proj-updated-row" title="Last updated time">
                        <ClockIcon size={12} />
                        <span>Updated {updatedFormatted}</span>
                      </div>
                    )}
                  </div>

                  <div className="proj-view-link">
                    <span>Open Project</span>
                    <ArrowRightIcon size={14} />
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
