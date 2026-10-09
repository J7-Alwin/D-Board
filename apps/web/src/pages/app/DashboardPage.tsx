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

const DashboardInviteIllustration: React.FC = () => {
  return (
    <svg
      className="dashboard-invite-svg"
      viewBox="0 0 220 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <filter id="invCardShadow" x="-10%" y="-10%" width="125%" height="130%" filterUnits="userSpaceOnUse">
          <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#18181B" floodOpacity="0.06" />
        </filter>
      </defs>

      {/* Background Soft Organic Circular Aura */}
      <circle cx="85" cy="70" r="50" fill="#EEF2E6" />
      <circle cx="65" cy="65" r="42" fill="#F4F6EE" opacity="0.7" />

      {/* Speed / burst tick marks on left */}
      <g stroke="#8E9480" strokeWidth="1.5" strokeLinecap="round">
        <line x1="48" y1="58" x2="43" y2="54" />
        <line x1="47" y1="67" x2="40" y2="67" />
        <line x1="49" y1="76" x2="44" y2="79" />
      </g>

      {/* Sweeping Dashed Arc Flight Path towards top-right paper airplane */}
      <path
        d="M 125 75 C 135 60, 150 48, 172 32"
        stroke="#88907E"
        strokeWidth="1.2"
        strokeDasharray="3 3"
        strokeLinecap="round"
        fill="none"
      />

      {/* Paper Airplane at Upper Right (flying ↗) */}
      <g transform="translate(170, 18) rotate(18)">
        <polygon points="0,16 20,0 14,18 8,11" fill="#FFFFFF" stroke="#18181B" strokeWidth="1.1" strokeLinejoin="round" />
        <polygon points="20,0 8,11 14,18" fill="#EAEFE2" />
        <line x1="20" y1="0" x2="8" y2="11" stroke="#18181B" strokeWidth="1.1" strokeLinejoin="round" />
        <polygon points="8,11 8,16 11,14" fill="#D6DCD0" stroke="#18181B" strokeWidth="1.1" strokeLinejoin="round" />
      </g>

      {/* Open Envelope Back Flap behind card */}
      <polygon
        points="48,80 95,46 142,80"
        fill="#E7ECE0"
        stroke="#DBE1D2"
        strokeWidth="1"
      />

      {/* Interior Shadow */}
      <polygon points="48,80 142,80 142,112 48,112" fill="#DEE4D6" />

      {/* Sliding Letter Card */}
      <g transform="translate(62, 50) rotate(-6)" filter="url(#invCardShadow)">
        <rect width="66" height="52" rx="8" fill="#FFFFFF" stroke="#E1E6D8" strokeWidth="1" />
        {/* D-Board Squircle Logo Badge */}
        <g transform="translate(23, 7)">
          <rect width="20" height="20" rx="5" fill="#18181B" />
          <g transform="translate(1, 1) scale(0.18)">
            <polygon points="22.44,43.11 43.11,57.95 22.44,75.97" fill="#D2F843" />
            <path
              d="M 29.33 21.38 A 6.89 6.89 0 0 0 29.33 35.16 L 54.24 35.16 C 55.3 35.16 66.43 40.46 66.43 49.47 C 66.43 58.48 53.18 63.25 47.88 59.54 L 33.57 71.73 C 31.45 74.91 31.98 77.56 36.22 77.56 L 55.3 77.56 C 72.26 77.56 80.74 65.9 80.74 49.47 C 80.74 33.04 72.26 21.38 55.3 21.38 Z"
              fill="#FFFFFF"
            />
          </g>
        </g>
        {/* Placeholder Lines */}
        <rect x="13" y="32" width="40" height="3" rx="1.5" fill="#D0D6C6" />
        <rect x="17" y="38" width="32" height="3" rx="1.5" fill="#DEE4D6" />
      </g>

      {/* Envelope Front Pocket */}
      <polygon points="48,80 95,108 48,112" fill="#F4F6EC" stroke="#DBE1D2" strokeWidth="1" />
      <polygon points="142,80 95,108 142,112" fill="#F4F6EC" stroke="#DBE1D2" strokeWidth="1" />
      <path
        d="M 48 112 L 142 112 L 110 88 C 102 82, 88 82, 80 88 Z"
        fill="#FAFBF6"
        stroke="#DBE1D2"
        strokeWidth="1"
      />
    </svg>
  );
};

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

        // Use recent activities already supplied in the dashboard response (0 extra network roundtrips)
        if (Array.isArray(dashRes.data.recentActivities) && dashRes.data.recentActivities.length > 0) {
          setRecentActivities(dashRes.data.recentActivities);
        } else {
          // Fallback only if not pre-computed
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
            <div className="inv-header-icon-box">
              <FolderPlusIcon size={16} />
            </div>
            <h3 className="inv-header-title">
              Project Invitations ({pendingInvitations.length})
            </h3>
            <p className="inv-header-subtitle">
              Accept to collaborate in the workspace
            </p>
          </div>

          <div className="invitations-banner-list">
            {pendingInvitations.map((invite) => {
              const inviterName = invite.invitedBy?.fullName || invite.invitedBy?.username || 'Team Admin';
              const formattedDate = invite.createdAt
                ? new Date(invite.createdAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })
                : 'Sep 29, 2026';

              return (
                <div key={invite.id} className="invitation-banner-card">
                  {/* Left: Project Avatar + Info */}
                  <div className="inv-card-left">
                    <div className="inv-card-avatar-box">
                      {invite.project?.avatarUrl ? (
                        <img
                          src={invite.project.avatarUrl}
                          alt={invite.project?.name || 'Project'}
                          className="inv-card-avatar-img"
                        />
                      ) : (
                        <div className="inv-card-avatar-fallback">
                          {(invite.project?.name || 'PR').slice(0, 2).toUpperCase()}
                        </div>
                      )}
                    </div>

                    <div className="inv-card-info">
                      <h4 className="inv-card-project-name">
                        {invite.project?.name || 'Development Workspace'}
                      </h4>
                      <p className="inv-card-invited-by">
                        Invited by <strong className="inv-card-inviter-name">{inviterName}</strong>
                      </p>

                      <div className="inv-card-meta-row">
                        <span className="inv-card-pill-tag">
                          <UsersIcon size={13} />
                          <span>Project invitation</span>
                        </span>
                        <span className="inv-card-date-tag">
                          <CalendarIcon size={13} />
                          <span>Invited on {formattedDate}</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Center: Envelope / Paper Airplane Illustration */}
                  <div className="inv-card-illustration-wrap" aria-hidden="true">
                    <DashboardInviteIllustration />
                  </div>

                  {/* Right: Actions Stack */}
                  <div className="inv-card-actions">
                    <button
                      type="button"
                      className="inv-btn-accept"
                      disabled={processingInviteId === invite.id}
                      onClick={() => handleAcceptInvite(invite.id)}
                    >
                      <span>{processingInviteId === invite.id ? 'Accepting...' : 'Accept Invitation'}</span>
                      <ArrowRightIcon size={15} />
                    </button>

                    <button
                      type="button"
                      className="inv-btn-decline"
                      disabled={processingInviteId === invite.id}
                      onClick={() => handleDeclineInvite(invite.id)}
                    >
                      Decline
                    </button>
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
