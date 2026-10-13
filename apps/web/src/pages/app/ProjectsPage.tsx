import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from '../../router/Router';
import { useAuth } from '../../context/AuthContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { projectsApi, type Project } from '../../api/projects.api';
import { EmptyState } from '../../components/ui/EmptyState';
import { ProjectAvatar } from '../../components/ui/ProjectAvatar';
import { CustomSelect } from '../../components/ui/CustomSelect';
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
  UserIcon,
  CheckCircleIcon,
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
  const { activeWorkspace, isLoading: wsLoading } = useWorkspace();
  const activeWsId = activeWorkspace?.id;

  // Data states
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter & Search states
  const [activeTab, setActiveTab] = useState<'all' | 'owned' | 'joined' | 'active' | 'archived'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedVisibility, setSelectedVisibility] = useState('ALL');
  const [selectedSort, setSelectedSort] = useState('updated');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = viewMode === 'grid' ? 6 : 8;

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

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, searchQuery, selectedCategory, selectedVisibility, selectedSort]);

  // Derived filtered & sorted projects
  const filteredProjects = useMemo(() => {
    let result = [...projects];

    // Tab filter
    if (activeTab === 'owned') {
      result = result.filter((p) => p.createdById === user?.id);
    } else if (activeTab === 'joined') {
      result = result.filter((p) => p.createdById !== user?.id);
    } else if (activeTab === 'active') {
      result = result.filter((p) => (p.status || 'ACTIVE') === 'ACTIVE');
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
  }, [projects, activeTab, searchQuery, selectedCategory, selectedVisibility, selectedSort, user?.id, activeWorkspace?.name]);

  // Summary Metrics
  const metrics = useMemo(() => {
    const total = projects.length;
    const owned = projects.filter((p) => p.createdById === user?.id).length;
    const joined = total - owned;
    const active = projects.filter((p) => (p.status || 'ACTIVE') === 'ACTIVE').length;
    const archived = projects.filter((p) => p.status === 'ARCHIVED').length;
    const totalTasks = projects.reduce((acc, p) => acc + (p.taskCount || 0), 0);
    const completedTasks = projects.reduce((acc, p) => acc + (p.completedTaskCount || 0), 0);
    const avgProgress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    return { total, owned, joined, active, archived, totalTasks, completedTasks, avgProgress };
  }, [projects, user?.id]);

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
            Manage, collaborate, and monitor all authorized projects within{' '}
            <strong>{activeWorkspace?.name || 'the active workspace'}</strong>.
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
          <button
            type="button"
            className="mywork-create-btn"
            onClick={() => navigate('/app/projects/create')}
          >
            <PlusIcon size={16} />
            <span>Create Project</span>
          </button>
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
          METRICS STATS ROW: MATCHING PIC 2 (MyWork) 6-CARD SUMMARY GRID
          ========================================================================== */}
      {!loading && projects.length > 0 && (
        <div className="mywork-summary-grid projects-stats-row">
          {/* 1. Total Projects */}
          <div
            className="mywork-summary-card card-total cursor-pointer"
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
              <div className="summary-sub">In this workspace</div>
            </div>
          </div>

          {/* 2. Owned Projects */}
          <div
            className="mywork-summary-card card-created cursor-pointer"
            onClick={() => setActiveTab('owned')}
            role="button"
            tabIndex={0}
          >
            <div className="summary-card-top">
              <div className="summary-icon-pill icon-created">
                <UserIcon size={16} />
              </div>
              <span className="summary-label">Owned Projects</span>
            </div>
            <div className="summary-card-bottom">
              <div className="summary-value text-purple">{metrics.owned}</div>
              <div className="summary-sub">Admin access</div>
            </div>
          </div>

          {/* 3. Joined Projects */}
          <div
            className="mywork-summary-card card-in-progress cursor-pointer"
            onClick={() => setActiveTab('joined')}
            role="button"
            tabIndex={0}
          >
            <div className="summary-card-top">
              <div className="summary-icon-pill icon-in-progress">
                <UsersIcon size={16} />
              </div>
              <span className="summary-label">Joined Projects</span>
            </div>
            <div className="summary-card-bottom">
              <div className="summary-value text-accent">{metrics.joined}</div>
              <div className="summary-sub">Collaborator access</div>
            </div>
          </div>

          {/* 4. Active Projects */}
          <div
            className="mywork-summary-card card-completed cursor-pointer"
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
              <div className="summary-sub">In development</div>
            </div>
          </div>

          {/* 5. Total Tasks */}
          <div className="mywork-summary-card card-due-soon cursor-pointer">
            <div className="summary-card-top">
              <div className="summary-icon-pill icon-due-soon">
                <CheckSquareIcon size={16} />
              </div>
              <span className="summary-label">Tasks ({metrics.avgProgress}% done)</span>
            </div>
            <div className="summary-card-bottom">
              <div className="summary-value text-amber">{metrics.totalTasks}</div>
              <div className="summary-sub">Progress across projects</div>
            </div>
          </div>

          {/* 6. Archived Projects */}
          <div
            className="mywork-summary-card card-overdue cursor-pointer"
            onClick={() => setActiveTab('archived')}
            role="button"
            tabIndex={0}
          >
            <div className="summary-card-top">
              <div className="summary-icon-pill icon-overdue">
                <FolderIcon size={16} />
              </div>
              <span className="summary-label">Archived</span>
            </div>
            <div className="summary-card-bottom">
              <div className="summary-value text-danger-neutral">{metrics.archived}</div>
              <div className="summary-sub">Completed or frozen</div>
            </div>
          </div>
        </div>
      )}

      {/* ==========================================================================
          TABS ROW: MATCHING PIC 2 (MyWork) UNDERLINE TABS
          ========================================================================== */}
      <div className="mywork-tabs-bar">
        <button
          type="button"
          className={`mywork-tab dash-tab-btn ${activeTab === 'all' ? 'active' : ''}`}
          onClick={() => setActiveTab('all')}
        >
          All Projects ({metrics.total})
        </button>
        <button
          type="button"
          className={`mywork-tab dash-tab-btn ${activeTab === 'owned' ? 'active' : ''}`}
          onClick={() => setActiveTab('owned')}
        >
          Owned ({metrics.owned})
        </button>
        <button
          type="button"
          className={`mywork-tab dash-tab-btn ${activeTab === 'joined' ? 'active' : ''}`}
          onClick={() => setActiveTab('joined')}
        >
          Joined ({metrics.joined})
        </button>
        <button
          type="button"
          className={`mywork-tab dash-tab-btn ${activeTab === 'active' ? 'active' : ''}`}
          onClick={() => setActiveTab('active')}
        >
          Active ({metrics.active})
        </button>
        <button
          type="button"
          className={`mywork-tab dash-tab-btn ${activeTab === 'archived' ? 'active' : ''}`}
          onClick={() => setActiveTab('archived')}
        >
          Archived ({metrics.archived})
        </button>
      </div>

      {/* ==========================================================================
          FILTER TOOLBAR: MATCHING PIC 2 (MyWork) SEARCH BOX & SELECTS
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
          actionText="+ Create Project"
          onAction={() => navigate('/app/projects/create')}
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
            const isWorkspaceVisible = (project.visibility || 'Workspace') === 'Workspace';
            const totalTasks = project.taskCount || 0;
            const completedTasks = project.completedTaskCount || 0;
            const progress = project.progress !== undefined ? project.progress : 0;
            const deadlineFormatted = formatDate(project.endDate);
            const workspaceName = project.workspace?.name || activeWorkspace?.name || 'Workspace';

            return (
              <div
                key={project.id}
                className="proj-card"
                onClick={() => navigate(`/app/projects/${project.id}`)}
                tabIndex={0}
                role="button"
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

                      {/* Workspace Attribution Badge (Requested by user) */}
                      <span className="proj-workspace-attribution-pill" title={`Workspace: ${workspaceName}`}>
                        <WorkspaceBadgeIcon size={11} />
                        <span>{workspaceName}</span>
                      </span>
                    </div>
                  </div>

                  <div className="proj-card-top-right" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    {/* Visibility badge */}
                    <span
                      className={`proj-visibility-pill ${
                        isWorkspaceVisible ? 'visibility-workspace' : 'visibility-restricted'
                      }`}
                      title={
                        isWorkspaceVisible
                          ? 'Visible to all Workspace Members'
                          : 'Restricted: Accessible only to assigned members'
                      }
                    >
                      {isWorkspaceVisible ? <GlobeIcon size={11} /> : <LockIcon size={11} />}
                      <span>{project.visibility || 'Workspace'}</span>
                    </span>

                    {/* Role badge */}
                    <span className={`proj-role-badge ${isAdmin ? 'role-admin' : 'role-member'}`}>
                      {isAdmin ? 'ADMIN' : 'MEMBER'}
                    </span>

                    {/* Manage icon button for admins */}
                    {isAdmin && (
                      <button
                        type="button"
                        className="proj-more-btn"
                        title="Manage Project"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/app/projects/${project.id}`);
                        }}
                        aria-label="Manage project options"
                      >
                        <SettingsIcon size={14} />
                      </button>
                    )}
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
                      {totalTasks > 0
                        ? `${completedTasks}/${totalTasks} tasks`
                        : '0/0 tasks'}
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

                {/* Card Footer: Members & Link */}
                <div className="proj-card-foot">
                  <div className="proj-meta-item">
                    <UsersIcon size={14} />
                    <span>
                      {memberCount} {memberCount === 1 ? 'member' : 'members'}
                    </span>
                  </div>
                  <div className="proj-view-link">
                    <span>Open workspace</span>
                    <ArrowRightIcon size={14} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ===================== LIST VIEW: MATCHING PIC 2 TABLE ===================== */
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
            const workspaceName = project.workspace?.name || activeWorkspace?.name || 'Workspace';

            return (
              <div
                key={project.id}
                className="proj-list-item"
                onClick={() => navigate(`/app/projects/${project.id}`)}
                tabIndex={0}
                role="button"
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
                    </div>
                    <p className="proj-list-desc" title={project.description || undefined}>
                      {project.description || 'No description provided.'}
                    </p>
                  </div>
                </div>

                <div className="proj-list-right" style={{ gap: '1.25rem' }}>
                  {/* Progress info in list */}
                  <div className="proj-list-progress-box">
                    <span className="proj-list-progress-txt">
                      {totalTasks > 0 ? `${completedTasks}/${totalTasks} tasks` : '0 tasks'}
                    </span>
                    <div className="proj-progress-bar-track" style={{ width: '80px', height: '4px' }}>
                      <div
                        className="proj-progress-bar-fill"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>

                  {deadlineFormatted && (
                    <div className="proj-meta-item" title="Target Deadline">
                      <CalendarIcon size={13} />
                      <span style={{ fontSize: '0.75rem' }}>{deadlineFormatted}</span>
                    </div>
                  )}

                  <div className="proj-meta-item">
                    <UsersIcon size={14} />
                    <span>{memberCount}</span>
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
    </div>
  );
};

export default ProjectsPage;
