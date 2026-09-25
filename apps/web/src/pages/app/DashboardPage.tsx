import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from '../../router/Router';
import { useAuth } from '../../context/AuthContext';
import { dashboardApi, type DashboardData } from '../../api/dashboard.api';
import { invitationsApi, type ProjectInvitation } from '../../api/invitations.api';
import { activityApi, type ActivityItem } from '../../api/activity.api';
import type { Project } from '../../api/projects.api';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { ChooseUsernameModal } from '../../components/modals/ChooseUsernameModal';
import { LearnMoreModal } from '../../components/modals/LearnMoreModal';
import { ProjectAvatar } from '../../components/ui/ProjectAvatar';
import { HeroAtmosphere } from '../../components/dashboard/HeroAtmosphere';
import { getRandomQuote, type Quote } from '../../utils/quotes';
import {
  PlusIcon,
  FolderIcon,
  UsersIcon,
  CalendarIcon,
  ArrowRightIcon,
  FolderPlusIcon,
  CheckIcon,
  SearchIcon,
  CloseIcon,
  GridIcon,
  ListIcon,
  ActivityIcon,
  CheckSquareIcon,
  FileTextIcon,
  ExternalLinkIcon,
  LayersIcon,
  ZapIcon,
  MoreHorizontalIcon,
  MessageSquareIcon,
} from '../../components/ui/Icons';

const truncateDescription = (text?: string | null, maxLength = 80): string => {
  if (!text || !text.trim()) return 'No description provided.';
  const trimmed = text.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return trimmed.slice(0, maxLength).trim() + '...';
};

const formatCategory = (cat?: string | null): string => {
  if (!cat) return 'General Workspace';
  const clean = cat.replace(/_/g, ' ').toLowerCase();
  return clean.replace(/\b\w/g, (c) => c.toUpperCase());
};

const formatRelativeTime = (dateStr: string): string => {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    if (isNaN(diffMs)) return 'Recently';
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 2) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return 'Recently';
  }
};

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const { navigate } = useRouter();

  const [data, setData] = useState<DashboardData | null>(null);
  const [pendingInvitations, setPendingInvitations] = useState<ProjectInvitation[]>([]);
  const [recentActivities, setRecentActivities] = useState<ActivityItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'owned' | 'joined'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [processingInviteId, setProcessingInviteId] = useState<string | null>(null);
  const [isUsernameModalOpen, setIsUsernameModalOpen] = useState(false);
  const [isLearnMoreOpen, setIsLearnMoreOpen] = useState(false);

  // Dynamic Quote State with 1-minute auto-refresh
  const [currentQuote, setCurrentQuote] = useState<Quote>(() => getRandomQuote());
  const [isQuoteRefreshing, setIsQuoteRefreshing] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setIsQuoteRefreshing(true);
      setTimeout(() => {
        setCurrentQuote(getRandomQuote());
        setIsQuoteRefreshing(false);
      }, 250);
    }, 60000); // 1 minute auto-refresh

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('first_login') === 'true') {
      setIsUsernameModalOpen(true);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [dashRes, invitesRes] = await Promise.all([
        dashboardApi.getDashboard(),
        invitationsApi.getUserInvitations('PENDING').catch(() => ({ success: false, data: { invitations: [] } })),
      ]);

      if (dashRes.success && dashRes.data) {
        setData(dashRes.data);

        // Fetch recent activities from available projects
        const allProjs = [...dashRes.data.myProjects, ...dashRes.data.joinedProjects];
        if (allProjs.length > 0) {
          const actPromises = allProjs.slice(0, 3).map((p) =>
            activityApi.getProjectActivities(p.id, { limit: 5 }).catch(() => ({ success: false, data: { activities: [] } }))
          );
          const actResults = await Promise.all(actPromises);
          const collected: ActivityItem[] = [];
          actResults.forEach((r) => {
            if (r.success && r.data?.activities) {
              collected.push(...r.data.activities);
            }
          });
          // Sort latest first
          collected.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          setRecentActivities(collected.slice(0, 5));
        }
      }
      if (invitesRes.success && invitesRes.data?.invitations) {
        setPendingInvitations(invitesRes.data.invitations);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleAcceptInvite = async (invitationId: string) => {
    setProcessingInviteId(invitationId);
    setActionMessage(null);
    try {
      const res = await invitationsApi.acceptInvitation(invitationId);
      if (res.success) {
        setActionMessage(res.message || 'Successfully joined project! Confirmation email sent.');
        setPendingInvitations((prev) => prev.filter((inv) => inv.id !== invitationId));
        const fresh = await dashboardApi.getDashboard();
        if (fresh.success && fresh.data) {
          setData(fresh.data);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to accept invitation');
    } finally {
      setProcessingInviteId(null);
    }
  };

  const handleDeclineInvite = async (invitationId: string) => {
    setProcessingInviteId(invitationId);
    setActionMessage(null);
    try {
      const res = await invitationsApi.declineInvitation(invitationId);
      if (res.success) {
        setActionMessage('Invitation declined.');
        setPendingInvitations((prev) => prev.filter((inv) => inv.id !== invitationId));
      }
    } catch (err: any) {
      setError(err.message || 'Failed to decline invitation');
    } finally {
      setProcessingInviteId(null);
    }
  };

  // Time-of-day greeting (morning, afternoon, evening, night) based strictly on current user time
  const greetingInfo = useMemo(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) {
      return { text: 'Good morning', emoji: '👋', timeOfDay: 'morning' as const };
    }
    if (hour >= 12 && hour < 17) {
      return { text: 'Good afternoon', emoji: '👋', timeOfDay: 'afternoon' as const };
    }
    if (hour >= 17 && hour < 21) {
      return { text: 'Good evening', emoji: '🌙', timeOfDay: 'evening' as const };
    }
    return { text: 'Good night', emoji: '✨', timeOfDay: 'night' as const };
  }, []);

  const formattedDate = useMemo(() => {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date());
  }, []);

  const filteredProjects = useMemo(() => {
    if (!data) return [];
    let list: Project[] = [];
    if (activeTab === 'all') {
      list = [...data.myProjects, ...data.joinedProjects];
    } else if (activeTab === 'owned') {
      list = data.myProjects;
    } else if (activeTab === 'joined') {
      list = data.joinedProjects;
    }

    if (!searchQuery.trim()) return list;

    const q = searchQuery.toLowerCase().trim();
    return list.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q) ||
        (p.technologyStack && p.technologyStack.some((t) => t.toLowerCase().includes(q)))
    );
  }, [data, activeTab, searchQuery]);

  const hasAnyProjects = (data?.myProjects.length || 0) + (data?.joinedProjects.length || 0) > 0;

  return (
    <div className="dashboard-page-container">
      {/* ==========================================================================
         HERO BANNER: GREETING, DYNAMIC QUOTES, STAY FOCUSED & LIVE ATMOSPHERE
         ========================================================================== */}
      <div className={`dashboard-hero-banner ${greetingInfo.timeOfDay === 'night' ? 'is-night' : ''}`}>
        {/* Live-action Time-of-Day Dynamic Atmosphere Background */}
        <HeroAtmosphere timeOfDay={greetingInfo.timeOfDay} />

        <div className="dashboard-hero-content">
          {/* Left Column: Greeting & Dynamic Quotes Engine */}
          <div className="hero-left-col">
            <h1 className="hero-greeting-heading">
              {greetingInfo.text}, {user?.fullName || user?.username || 'Developer'}{' '}
              <span className="hero-wave-emoji">{greetingInfo.emoji}</span>
            </h1>

            {/* Random Inspiring Developer / Engineering Quote (auto-refreshing every 1 min) */}
            <div className="hero-quote-box">
              <div className={`hero-quote-card ${isQuoteRefreshing ? 'is-refreshing' : ''}`}>
                <p className="hero-quote-text">"{currentQuote.text}"</p>
                <div className="hero-quote-author-row">
                  <span className="hero-quote-author">- {currentQuote.author}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Date Pill above Stay Focused Card */}
          <div className="hero-right-col">
            <div className="hero-date-pill">
              <CalendarIcon size={14} className="hero-date-icon" />
              <span>{formattedDate}</span>
            </div>

            <div className="hero-focus-card">
              <div className="hero-focus-text">
                <span className="focus-line-1">Stay focused,</span>
                <span className="focus-line-2">keep building."</span>
              </div>
              <span className="hero-focus-plant" role="img" aria-label="Seedling">
                🌱
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Action Notification Alert */}
      {actionMessage && (
        <div className="auth-alert success-alert" style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: '#E7F6EC', color: '#166534', border: '1px solid #BBF7D0', padding: '0.75rem 1rem', borderRadius: '8px' }}>
          <CheckIcon size={16} />
          <span>{actionMessage}</span>
        </div>
      )}

      {/* Pending Invitations Banner */}
      {pendingInvitations.length > 0 && !isLoading && (
        <div className="dashboard-invitations-banner">
          <div className="invitations-banner-header">
            <div className="inv-header-left">
              <div className="inv-header-icon">
                <FolderPlusIcon size={16} />
              </div>
              <h3 className="inv-header-title">
                Project Invitations ({pendingInvitations.length})
              </h3>
            </div>
            <span className="inv-header-hint">
              Accept to collaborate in the workspace
            </span>
          </div>

          <div className="invitations-banner-list">
            {pendingInvitations.map((invite) => {
              const isAdmin = invite.role === 'PROJECT_ADMIN';
              return (
                <div key={invite.id} className="invitation-banner-item">
                  <div className="inv-item-left">
                    <ProjectAvatar project={invite.project} size="md" />
                    <div>
                      <div className="inv-item-title-row">
                        <span className="inv-project-title">
                          {invite.project?.name || 'Development Workspace'}
                        </span>
                        <span className={`inv-role-tag ${isAdmin ? 'admin' : 'member'}`}>
                          {isAdmin ? 'Admin' : 'Member'}
                        </span>
                      </div>
                      <p className="inv-item-subtitle">
                        Invited by <strong>{invite.invitedBy?.fullName || invite.invitedBy?.username || 'Team Admin'}</strong>
                        {invite.message ? ` — "${invite.message}"` : ''}
                      </p>
                    </div>
                  </div>

                  <div className="inv-item-actions">
                    <Button
                      variant="primary"
                      size="sm"
                      disabled={processingInviteId === invite.id}
                      isLoading={processingInviteId === invite.id}
                      onClick={() => handleAcceptInvite(invite.id)}
                    >
                      Accept Invitation
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={processingInviteId === invite.id}
                      onClick={() => handleDeclineInvite(invite.id)}
                    >
                      Decline
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="dashboard-loading-state">
          <div className="btn-spinner" style={{ width: '2rem', height: '2rem', borderColor: '#1F1F1F', borderTopColor: 'transparent' }} />
          <span>Loading your workspace...</span>
        </div>
      )}

      {/* Error State */}
      {error && !isLoading && (
        <div className="auth-alert error-alert" style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>{error}</span>
          <Button variant="outline" size="sm" onClick={fetchDashboardData}>
            Retry
          </Button>
        </div>
      )}

      {/* ==========================================================================
         TOP ROW: 4 STAT METRICS CARDS + TURN IDEAS INTO PROGRESS PROMO CARD
         ========================================================================== */}
      {data && !isLoading && (
        <div className="dashboard-top-row-flex">
          {/* 4 Stat Cards */}
          <div
            className="stat-box cursor-pointer"
            onClick={() => setActiveTab('owned')}
            tabIndex={0}
            role="button"
            onKeyDown={(e) => e.key === 'Enter' && setActiveTab('owned')}
          >
            <div className="stat-box-top">
              <div className="stat-icon-wrapper icon-blue">
                <LayersIcon size={20} />
              </div>
              <span className="stat-val">{data.stats.myProjectsCount}</span>
            </div>
            <div className="stat-box-bottom">
              <span className="stat-tag">My Projects</span>
              <ArrowRightIcon size={15} className="stat-arrow-indicator" />
            </div>
          </div>

          <div
            className="stat-box cursor-pointer"
            onClick={() => setActiveTab('joined')}
            tabIndex={0}
            role="button"
            onKeyDown={(e) => e.key === 'Enter' && setActiveTab('joined')}
          >
            <div className="stat-box-top">
              <div className="stat-icon-wrapper icon-green">
                <UsersIcon size={20} />
              </div>
              <span className="stat-val">{data.stats.joinedProjectsCount}</span>
            </div>
            <div className="stat-box-bottom">
              <span className="stat-tag">Joined Projects</span>
              <ArrowRightIcon size={15} className="stat-arrow-indicator" />
            </div>
          </div>

          <div
            className="stat-box cursor-pointer"
            onClick={() => navigate('/app/my-work')}
            tabIndex={0}
            role="button"
            onKeyDown={(e) => e.key === 'Enter' && navigate('/app/my-work')}
          >
            <div className="stat-box-top">
              <div className="stat-icon-wrapper icon-orange">
                <CheckSquareIcon size={20} />
              </div>
              <span className="stat-val">{data.stats.myOpenWorkCount}</span>
            </div>
            <div className="stat-box-bottom">
              <span className="stat-tag">My Open Work</span>
              <ArrowRightIcon size={15} className="stat-arrow-indicator" />
            </div>
          </div>

          <div
            className="stat-box cursor-pointer"
            onClick={() => navigate('/app/calendar')}
            tabIndex={0}
            role="button"
            onKeyDown={(e) => e.key === 'Enter' && navigate('/app/calendar')}
          >
            <div className="stat-box-top">
              <div className="stat-icon-wrapper icon-purple">
                <CalendarIcon size={20} />
              </div>
              <span className="stat-val">{data.stats.upcomingDeadlinesCount}</span>
            </div>
            <div className="stat-box-bottom">
              <span className="stat-tag">Upcoming Deadlines</span>
              <ArrowRightIcon size={15} className="stat-arrow-indicator" />
            </div>
          </div>

          {/* Turn ideas into progress Promo Card (in the same row) */}
          <div className="dashboard-promo-card">
            <div className="promo-card-content">
              <h3 className="promo-card-title">Turn ideas into progress</h3>
              <p className="promo-card-desc">
                Create a project, invite your team, and start organizing your work in one place.
              </p>
              <button
                type="button"
                className="promo-learn-more-btn"
                onClick={() => setIsLearnMoreOpen(true)}
              >
                <span>Learn more</span>
                <ExternalLinkIcon size={14} />
              </button>
            </div>

            {/* Illustrated Team Avatars & Kanban Graphic */}
            <div className="promo-card-graphic" aria-hidden="true">
              <div className="promo-graphic-sheet">
                <div className="promo-sheet-line line-1" />
                <div className="promo-sheet-line line-2" />
                <div className="promo-sheet-check">
                  <CheckIcon size={13} />
                </div>
              </div>

              <div className="promo-avatar-pill avatar-top-blue">
                <UsersIcon size={12} />
              </div>
              <div className="promo-avatar-pill avatar-right-green">
                <span className="avatar-dot" />
              </div>
              <div className="promo-avatar-pill avatar-bottom-purple">
                <span className="avatar-dot" />
              </div>
              <div className="promo-avatar-pill avatar-left-check">
                <CheckIcon size={12} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==========================================================================
         MAIN SECTION: PROJECTS (2 CARDS PER ROW) + RECENT ACTIVITY (ALIGNED)
         ========================================================================== */}
      {!isLoading && data && (
        <div className="dashboard-main-grid">
          {/* Left / Main Section: Projects */}
          <div className="workspace-projects-section">
            <div className="workspace-projects-header">
              <div className="workspace-projects-header-text">
                <h2 className="workspace-projects-title">Projects</h2>
              </div>
              <button
                type="button"
                className="workspace-create-project-btn"
                onClick={() => navigate('/app/projects/create')}
              >
                <PlusIcon size={15} />
                <span>Create Project</span>
              </button>
            </div>

            <div className="dashboard-toolbar-row">
              <div className="dashboard-tabs">
                <button
                  type="button"
                  className={`dash-tab-btn ${activeTab === 'all' ? 'active' : ''}`}
                  onClick={() => setActiveTab('all')}
                >
                  <span>All Projects</span>
                  <span className="dash-tab-count">{data.myProjects.length + data.joinedProjects.length}</span>
                </button>
                <button
                  type="button"
                  className={`dash-tab-btn ${activeTab === 'owned' ? 'active' : ''}`}
                  onClick={() => setActiveTab('owned')}
                >
                  <span>Owned</span>
                  <span className="dash-tab-count">{data.myProjects.length}</span>
                </button>
                <button
                  type="button"
                  className={`dash-tab-btn ${activeTab === 'joined' ? 'active' : ''}`}
                  onClick={() => setActiveTab('joined')}
                >
                  <span>Joined</span>
                  <span className="dash-tab-count">{data.joinedProjects.length}</span>
                </button>
              </div>

              <div className="dashboard-actions-group">
                {hasAnyProjects && (
                  <div className="dash-search-wrap">
                    <SearchIcon size={14} className="dash-search-icon" />
                    <input
                      type="text"
                      placeholder="Filter projects..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="dash-filter-input"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        className="dash-search-clear"
                        onClick={() => setSearchQuery('')}
                        aria-label="Clear filter"
                      >
                        <CloseIcon size={13} />
                      </button>
                    )}
                  </div>
                )}

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

            {/* If No Projects At All */}
            {!hasAnyProjects ? (
              <EmptyState
                icon={<FolderPlusIcon size={48} />}
                title="No projects yet"
                description="Create your first development workspace to start organizing tasks, documenting architectural decisions, and inviting team members."
                actionText="+ Create Your First Project"
                onAction={() => navigate('/app/projects/create')}
              />
            ) : filteredProjects.length === 0 ? (
              <EmptyState
                icon={<FolderIcon size={40} />}
                title="No matching projects found"
                description={`No projects matched "${searchQuery}". Try a different search term or clear the filter.`}
                actionText="Clear Filter"
                onAction={() => setSearchQuery('')}
              />
            ) : viewMode === 'grid' ? (
              /* Projects Grid View (Uniform 2 cards per row format) */
              <div className="workspace-grid-two-col">
                {filteredProjects.map((project) => {
                  const isOwner = project.createdById === user?.id;
                  const memberCount = project.memberCount || project.members?.length || 1;

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
                      <div className="proj-card-top">
                        <ProjectAvatar project={project} size="md" />
                        <div className="proj-card-top-right">
                          <span className={`proj-role-badge ${isOwner ? 'role-admin' : 'role-member'}`}>
                            {isOwner ? 'ADMIN' : 'MEMBER'}
                          </span>
                          <button
                            type="button"
                            className="proj-more-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/app/projects/${project.id}`);
                            }}
                            aria-label="More project options"
                          >
                            <MoreHorizontalIcon size={16} />
                          </button>
                        </div>
                      </div>

                      <h3 className="proj-card-title" title={project.name}>{project.name}</h3>
                      <p className="proj-card-desc" title={project.description || undefined}>
                        {truncateDescription(project.description, 100)}
                      </p>

                      {/* Tech stack chips or category badge */}
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
                              <span className="tech-chip-more">+{project.technologyStack.length - 3}</span>
                            )}
                          </>
                        ) : (
                          <span className="tech-chip tech-chip-category">
                            {formatCategory(project.category)}
                          </span>
                        )}
                      </div>

                      <div className="proj-card-foot">
                        <div className="proj-meta-item">
                          <UsersIcon size={14} />
                          <span>{memberCount} {memberCount === 1 ? 'member' : 'members'}</span>
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
              /* Projects List View */
              <div className="workspace-list-view">
                {filteredProjects.map((project) => {
                  const isOwner = project.createdById === user?.id;
                  const memberCount = project.memberCount || project.members?.length || 1;
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
                            <span className={`proj-role-badge ${isOwner ? 'role-admin' : 'role-member'}`}>
                              {isOwner ? 'ADMIN' : 'MEMBER'}
                            </span>
                          </div>
                          <p className="proj-list-desc" title={project.description || undefined}>
                            {truncateDescription(project.description, 80)}
                          </p>
                        </div>
                      </div>

                      <div className="proj-list-right">
                        <div className="proj-meta-item">
                          <UsersIcon size={14} />
                          <span>{memberCount} {memberCount === 1 ? 'member' : 'members'}</span>
                        </div>
                        <ArrowRightIcon size={15} className="proj-list-arrow" />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Column: Balanced Sidebar with Quick Actions + Activity Feed + Best Practice */}
          <div className="dashboard-sidebar-column">
            {/* Quick Actions Card */}
            <div className="dashboard-quick-actions-card">
              <div className="quick-actions-card-header">
                <div className="quick-actions-header-left">
                  <div className="quick-actions-icon-badge">
                    <ZapIcon size={16} />
                  </div>
                  <div>
                    <h4 className="quick-actions-title">Quick Actions</h4>
                    <p className="quick-actions-subtitle">Frequently used workspace tools</p>
                  </div>
                </div>
              </div>

              <div className="quick-actions-grid-2x2">
                <button
                  type="button"
                  className="quick-action-btn"
                  onClick={() => navigate('/app/projects/create')}
                >
                  <div className="qa-btn-icon icon-blue">
                    <PlusIcon size={16} />
                  </div>
                  <div className="qa-btn-text">
                    <span className="qa-btn-label">New Project</span>
                    <span className="qa-btn-sub">Create a workspace</span>
                  </div>
                </button>

                <button
                  type="button"
                  className="quick-action-btn"
                  onClick={() => navigate('/app/my-work')}
                >
                  <div className="qa-btn-icon icon-green">
                    <CheckSquareIcon size={16} />
                  </div>
                  <div className="qa-btn-text">
                    <span className="qa-btn-label">My Work</span>
                    <span className="qa-btn-sub">View assigned items</span>
                  </div>
                </button>

                <button
                  type="button"
                  className="quick-action-btn"
                  onClick={() => navigate('/app/calendar')}
                >
                  <div className="qa-btn-icon icon-orange">
                    <CalendarIcon size={16} />
                  </div>
                  <div className="qa-btn-text">
                    <span className="qa-btn-label">Calendar</span>
                    <span className="qa-btn-sub">See upcoming work</span>
                  </div>
                </button>

                <button
                  type="button"
                  className="quick-action-btn"
                  onClick={() => navigate('/app/activity')}
                >
                  <div className="qa-btn-icon icon-purple">
                    <ActivityIcon size={16} />
                  </div>
                  <div className="qa-btn-text">
                    <span className="qa-btn-label">Activity</span>
                    <span className="qa-btn-sub">Track recent changes</span>
                  </div>
                </button>
              </div>
            </div>

            {/* Recent Activity Card */}
            <div className="dashboard-activity-widget">
              <div className="activity-widget-header">
                <div className="activity-header-left">
                  <div className="activity-icon-badge">
                    <ActivityIcon size={16} />
                  </div>
                  <h4 className="activity-widget-title">Recent Activity</h4>
                </div>
                <button
                  type="button"
                  className="activity-view-all-btn"
                  onClick={() => navigate('/app/activity')}
                >
                  <span>View all</span>
                  <ArrowRightIcon size={13} />
                </button>
              </div>

              <div className="activity-widget-list">
                {recentActivities.length === 0 ? (
                  <div style={{ padding: '28px 16px', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>
                    No recent activity yet. Updates and project events will appear here.
                  </div>
                ) : (
                  recentActivities.slice(0, 5).map((act) => {
                    const isProjectCreated = act.type === 'PROJECT_CREATED' || act.type.includes('CREATE_PROJECT');
                    const isNote = act.type.includes('NOTE');
                    const isComment = act.type.includes('COMMENT');
                    const isFile = act.type.includes('FILE') || act.type.includes('UPLOAD');
                    const relTime = formatRelativeTime(act.createdAt);

                    let titleText = 'Project update';
                    if (isProjectCreated) titleText = 'Project Created';
                    else if (isFile) titleText = 'File Uploaded';
                    else if (isComment) titleText = 'New comment';
                    else if (isNote) titleText = 'New team note';
                    else titleText = act.type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());

                    let subText = act.workItem?.title || act.metadata?.title || act.metadata?.preview || 'Project workspace update';

                    return (
                      <div key={act.id} className="activity-widget-item">
                        <div className={`activity-item-icon-box ${
                          isProjectCreated ? 'icon-purple' :
                          isFile ? 'icon-blue' :
                          isComment ? 'icon-red' :
                          isNote ? 'icon-indigo' : 'icon-work'
                        }`}>
                          {isProjectCreated ? (
                            <FileTextIcon size={15} />
                          ) : isFile ? (
                            <FolderIcon size={15} />
                          ) : isComment ? (
                            <MessageSquareIcon size={15} />
                          ) : isNote ? (
                            <UsersIcon size={15} />
                          ) : (
                            <CheckSquareIcon size={15} />
                          )}
                        </div>

                        <div className="activity-item-details">
                          <span className="activity-item-action">{titleText}</span>
                          <span className="activity-item-meta">{subText}</span>
                        </div>

                        <span className="activity-item-date">{relTime}</span>
                      </div>
                    );
                  })
                )}
              </div>

              {/* View all activity bottom button */}
              <button
                type="button"
                className="activity-widget-view-all-bottom"
                onClick={() => navigate('/app/activity')}
              >
                <span>View all activity</span>
                <ArrowRightIcon size={13} />
              </button>
            </div>

            {/* Productivity Best Practice Card */}
            <div className="dashboard-tip-widget">
              <div className="tip-widget-content-left">
                <div className="tip-widget-top">
                  <span className="tip-bulb-icon">💡</span>
                  <span className="tip-badge">Pro Tip</span>
                </div>
                <p className="tip-widget-text">
                  Break major features into bite-sized work items to boost team delivery velocity.
                </p>
                <button
                  type="button"
                  className="tip-widget-link"
                  onClick={() => setIsLearnMoreOpen(true)}
                >
                  <span>Explore workflows</span>
                  <ArrowRightIcon size={13} />
                </button>
              </div>

              {/* Plant seedling illustration matching Image 1 */}
              <div className="tip-widget-graphic" aria-hidden="true">
                <svg width="76" height="70" viewBox="0 0 76 70" fill="none" xmlns="http://www.w3.org/2000/svg">
                  {/* Sparkle 1 */}
                  <path d="M18 16L19.5 20.5L24 22L19.5 23.5L18 28L16.5 23.5L12 22L16.5 20.5L18 16Z" fill="#F59E0B" />
                  {/* Sparkle 2 */}
                  <path d="M8 32L9 35L12 36L9 37L8 40L7 37L4 36L7 35L8 32Z" fill="#FBBF24" opacity="0.85" />
                  {/* Stem */}
                  <path d="M42 66C42 46 46 32 58 20" stroke="#047857" strokeWidth="3.5" strokeLinecap="round" />
                  {/* Large leaf */}
                  <path d="M58 20C58 20 70 20 72 32C74 44 60 50 50 44C46 40 44 34 58 20Z" fill="#10B981" />
                  {/* Left leaf */}
                  <path d="M48 26C48 26 34 24 30 12C26 0 40 -4 50 2C54 6 56 14 48 26Z" fill="#059669" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Learn More Interactive Modal */}
      <LearnMoreModal
        isOpen={isLearnMoreOpen}
        onClose={() => setIsLearnMoreOpen(false)}
      />

      {/* First-Login Choose Username Modal */}
      <ChooseUsernameModal
        isOpen={isUsernameModalOpen}
        onClose={() => setIsUsernameModalOpen(false)}
        currentUsername={user?.username}
      />
    </div>
  );
};
