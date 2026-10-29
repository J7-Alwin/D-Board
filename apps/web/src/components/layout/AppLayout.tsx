import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link, useRouter } from '../../router/Router';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { projectsApi, type Project } from '../../api/projects.api';
import { invitationsApi } from '../../api/invitations.api';
import { workspacesApi } from '../../api/workspaces.api';
import { notificationsApi } from '../../api/notifications.api';
import { searchApi, type SearchResultItem } from '../../api/search.api';
import { NotificationDropdown } from '../notifications/NotificationDropdown';
import {
  LayersIcon,
  CheckSquareIcon,
  CalendarIcon,
  FolderIcon,
  FileTextIcon,
  SearchIcon,
  PlusIcon,
  MailIcon,
  MenuIcon,
  CloseIcon,
} from '../ui/Icons';
import { Button } from '../ui/Button';
import { ProjectAvatar } from '../ui/ProjectAvatar';
import { Logo } from '../ui/Logo';
import { useWorkspace } from '../../context/WorkspaceContext';
import { WorkspaceSwitcher } from '../workspace/WorkspaceSwitcher';
import { FloatingTimerModal } from '../common/FloatingTimerModal';
import { TimerConflictModal } from '../common/TimerConflictModal';

export interface AppLayoutProps {
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const { user, isLoading } = useAuth();
  const { activeWorkspace, activeRole } = useWorkspace();
  const { socket, isConnected } = useSocket();
  const { path, navigate } = useRouter();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [pendingInviteCount, setPendingInviteCount] = useState<number>(0);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState<number>(0);
  const [projects, setProjects] = useState<{ owned: Project[]; joined: Project[] }>({
    owned: [],
    joined: [],
  });

  // Global Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResultItem | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Ensure 90% scaled density is active while inside AppLayout
  useEffect(() => {
    document.documentElement.classList.add('app-authenticated-mode');
    return () => {
      if (!window.location.pathname.startsWith('/app')) {
        document.documentElement.classList.remove('app-authenticated-mode');
      }
    };
  }, []);

  // Close dropdown on outside click or Escape key
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setSearchOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setSearchOpen(false);
        setMobileSearchOpen(false);
        setSidebarOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Debounced search query
  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 2) {
      setSearchResults(null);
      setSearchLoading(false);
      return;
    }

    setSearchLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await searchApi.searchGlobal(q, 8, activeWorkspace?.id);
        if (res.success && res.data) {
          setSearchResults(res.data);
          setSearchOpen(true);
        }
      } catch (err) {
        console.error('Search failed', err);
      } finally {
        setSearchLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery, activeWorkspace?.id]);

  const refreshCountsAndProjects = () => {
    if (!user) return;
    projectsApi
      .getUserProjects(activeWorkspace?.id)
      .then((res) => {
        if (res.success && res.data) {
          setProjects({
            owned: res.data.owned || [],
            joined: res.data.joined || [],
          });
        }
      })
      .catch(() => { });

    Promise.all([
      invitationsApi.getPendingCount().catch(() => ({ success: false, data: { count: 0 } })),
      workspacesApi.getUserPendingInvitations().catch(() => ({ success: false, data: { invitations: [] } })),
    ]).then(([projRes, wsRes]) => {
      const projCount = (projRes && projRes.success && (projRes.data as any)?.count) || 0;
      const wsCount = (wsRes && wsRes.success && (wsRes.data as any)?.invitations?.length) || 0;
      setPendingInviteCount(projCount + wsCount);
    }).catch(() => { });

    notificationsApi
      .getUnreadCount(activeWorkspace?.id)
      .then((res) => {
        if (res.success && res.data) {
          setUnreadNotificationCount(res.data.count || 0);
        }
      })
      .catch(() => { });
  };

  // Initial fetch when authenticated user is loaded
  useEffect(() => {
    refreshCountsAndProjects();

    const handleCustomRefresh = () => refreshCountsAndProjects();
    window.addEventListener('dboard:refresh-projects', handleCustomRefresh);
    return () => {
      window.removeEventListener('dboard:refresh-projects', handleCustomRefresh);
    };
  }, [user?.id, activeWorkspace?.id]);

  // Real-time socket listeners for global user state
  useEffect(() => {
    if (!socket || !isConnected) return;

    const handleNotificationCreated = () => {
      setUnreadNotificationCount((prev) => prev + 1);
    };

    const handleNotificationRead = () => {
      notificationsApi.getUnreadCount(activeWorkspace?.id).then((res) => {
        if (res.success && res.data) setUnreadNotificationCount(res.data.count || 0);
      });
    };

    const handleInvitationCreated = () => {
      setPendingInviteCount((prev) => prev + 1);
    };

    const handleMemberUpdated = () => {
      projectsApi.getUserProjects(activeWorkspace?.id).then((res) => {
        if (res.success && res.data) {
          setProjects({
            owned: res.data.owned || [],
            joined: res.data.joined || [],
          });
        }
      });
    };

    socket.on('NOTIFICATION_CREATED', handleNotificationCreated);
    socket.on('NOTIFICATION_READ', handleNotificationRead);
    socket.on('INVITATION_CREATED', handleInvitationCreated);
    socket.on('WORKSPACE_INVITATION_RECEIVED', handleInvitationCreated);
    socket.on('WORKSPACE_MEMBER_JOINED', handleMemberUpdated);
    socket.on('MEMBER_ADDED', handleMemberUpdated);
    socket.on('MEMBER_REMOVED', handleMemberUpdated);

    return () => {
      socket.off('NOTIFICATION_CREATED', handleNotificationCreated);
      socket.off('NOTIFICATION_READ', handleNotificationRead);
      socket.off('INVITATION_CREATED', handleInvitationCreated);
      socket.off('WORKSPACE_INVITATION_RECEIVED', handleInvitationCreated);
      socket.off('WORKSPACE_MEMBER_JOINED', handleMemberUpdated);
      socket.off('MEMBER_ADDED', handleMemberUpdated);
      socket.off('MEMBER_REMOVED', handleMemberUpdated);
    };
  }, [socket, isConnected]);


  // Auth protection check
  useEffect(() => {
    if (!isLoading && !user) {
      navigate('/login');
    }
  }, [isLoading, user, navigate]);

  const userInitials = useMemo(() => {
    if (!user) return 'U';
    if (user.fullName && user.fullName.trim()) {
      const parts = user.fullName.trim().split(/\s+/);
      if (parts.length >= 2) {
        return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
      }
      return parts[0].slice(0, 2).toUpperCase();
    }
    return user.username.slice(0, 2).toUpperCase();
  }, [user]);

  const canCreateProject = useMemo(() => {
    if (!activeWorkspace) return false;
    if (activeWorkspace.isPersonal) return true;
    if (activeRole === 'OWNER' || activeWorkspace.isOwner) return true;

    const perms = activeWorkspace.adminPermissions;
    if (activeRole === 'WORKSPACE_ADMIN') {
      return perms?.workspaceAdmin?.canCreateProjects ?? perms?.canCreateProjects ?? true;
    }
    if (activeRole === 'PROJECT_ADMIN') {
      return perms?.projectAdmin?.canCreateProjects ?? false;
    }
    if (activeRole === 'WORKSPACE_MEMBER') {
      return perms?.workspaceMember?.canCreateProjects ?? false;
    }
    return false;
  }, [activeWorkspace, activeRole]);

  const allWsProjects = useMemo(() => [...projects.owned, ...projects.joined], [projects.owned, projects.joined]);

  const [recentProjectIds, setRecentProjectIds] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(`dboard_recent_projects_${user?.id}_${activeWorkspace?.id}`);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    if (!user?.id || !activeWorkspace?.id) return;
    try {
      const stored = localStorage.getItem(`dboard_recent_projects_${user.id}_${activeWorkspace.id}`);
      setRecentProjectIds(stored ? JSON.parse(stored) : []);
    } catch {
      setRecentProjectIds([]);
    }
  }, [user?.id, activeWorkspace?.id]);

  useEffect(() => {
    const match = path.match(/^\/app\/projects\/([a-zA-Z0-9_-]+)/);
    if (match && match[1] && match[1] !== 'create' && user?.id && activeWorkspace?.id) {
      const openedId = match[1];
      setRecentProjectIds((prev) => {
        const next = [openedId, ...prev.filter((id) => id !== openedId)].slice(0, 5);
        try {
          localStorage.setItem(`dboard_recent_projects_${user.id}_${activeWorkspace.id}`, JSON.stringify(next));
        } catch {
          // ignore
        }
        return next;
      });
    }
  }, [path, user?.id, activeWorkspace?.id]);

  const recentProjects = useMemo(() => {
    if (allWsProjects.length === 0) return [];
    const recent: typeof allWsProjects = [];
    for (const id of recentProjectIds) {
      const found = allWsProjects.find((p) => p.id === id);
      if (found && !recent.some((p) => p.id === found.id)) {
        recent.push(found);
      }
      if (recent.length >= 3) break;
    }
    if (recent.length < 3) {
      for (const p of allWsProjects) {
        if (!recent.some((r) => r.id === p.id)) {
          recent.push(p);
        }
        if (recent.length >= 3) break;
      }
    }
    return recent.slice(0, 3);
  }, [allWsProjects, recentProjectIds]);

  if (isLoading) {
    return (
      <div className="app-loading-screen">
        <div className="btn-spinner" style={{ width: '2rem', height: '2rem', borderColor: '#1F1F1F', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="app-workspace-layout">
      {/* Mobile Drawer Overlay */}
      {sidebarOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar (Desktop & Mobile Drawer) */}
      <aside className={`app-workspace-sidebar ${sidebarOpen ? 'mobile-open' : ''}`}>
        {/* Brand & Mobile Close */}
        <div className="workspace-brand">
          <Link to="/app/dashboard" className="brand-logo" onClick={() => setSidebarOpen(false)} aria-label="D-Board Dashboard">
            <Logo size="sm" withText />
          </Link>
          <button
            type="button"
            className="mobile-close-btn"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close navigation"
          >
            <CloseIcon size={20} />
          </button>
        </div>

        {/* Workspace Switcher */}
        <WorkspaceSwitcher
          onWorkspaceSwitched={() => {
            refreshCountsAndProjects();
            if (path.startsWith('/app/projects/')) {
              navigate('/app/dashboard');
            }
          }}
        />

        {/* Scrollable Navigation & Projects Area */}
        <div className="workspace-sidebar-scroll">
          {/* Primary Navigation */}
          <nav className="workspace-nav" aria-label="Main Navigation">
            <Link
              to="/app/dashboard"
              className={`workspace-nav-item ${path === '/app/dashboard' ? 'active' : ''}`}
              onClick={() => setSidebarOpen(false)}
            >
              <LayersIcon size={18} />
              <span>Dashboard</span>
            </Link>
            <Link
              to="/app/projects"
              className={`workspace-nav-item ${path === '/app/projects' ? 'active' : ''}`}
              onClick={() => setSidebarOpen(false)}
            >
              <FolderIcon size={18} />
              <span>Projects</span>
            </Link>
            <Link
              to="/app/my-work"
              className={`workspace-nav-item ${path === '/app/my-work' || path === '/app/work' ? 'active' : ''}`}
              onClick={() => setSidebarOpen(false)}
            >
              <CheckSquareIcon size={18} />
              <span>My Tasks</span>
            </Link>
            <Link
              to="/app/calendar"
              className={`workspace-nav-item ${path === '/app/calendar' ? 'active' : ''}`}
              onClick={() => setSidebarOpen(false)}
            >
              <CalendarIcon size={18} />
              <span>Calendar</span>
            </Link>
            <Link
              to="/app/files"
              className={`workspace-nav-item ${path === '/app/files' ? 'active' : ''}`}
              onClick={() => setSidebarOpen(false)}
            >
              <FolderIcon size={18} />
              <span>Files</span>
            </Link>
            <Link
              to="/app/notes"
              className={`workspace-nav-item ${path === '/app/notes' ? 'active' : ''}`}
              onClick={() => setSidebarOpen(false)}
            >
              <FileTextIcon size={18} />
              <span>Notes</span>
            </Link>
          </nav>

          {/* Project Navigation Area - RECENT PROJECTS */}
          <div className="workspace-projects-list">
            <div className="projects-header-row">
              <span className="projects-label">RECENT PROJECTS</span>
              {canCreateProject && (
                <Link
                  to="/app/projects/create"
                  className="projects-add-btn"
                  title="Create new project"
                  onClick={() => setSidebarOpen(false)}
                  id="sidebar-create-project-plus-btn"
                >
                  <PlusIcon size={14} />
                </Link>
              )}
            </div>

            {recentProjects.length === 0 ? (
              <div className="sidebar-empty-projects">No recent projects</div>
            ) : (
              recentProjects.map((p) => {
                const isActive = path === `/app/projects/${p.id}` || path.startsWith(`/app/projects/${p.id}/`);
                return (
                  <Link
                    key={p.id}
                    to={`/app/projects/${p.id}`}
                    className={`workspace-project-pill ${isActive ? 'active' : ''}`}
                    onClick={() => setSidebarOpen(false)}
                  >
                    <ProjectAvatar project={p} size="xs" />
                    <span className="proj-name">{p.name}</span>
                  </Link>
                );
              })
            )}
          </div>
        </div>

        {/* Action Area */}
        <div className="workspace-action-area">
          {canCreateProject && (
            <Button
              variant="primary"
              size="sm"
              fullWidth
              leftIcon={<PlusIcon size={16} />}
              onClick={() => {
                setSidebarOpen(false);
                navigate('/app/projects/create');
              }}
              id="sidebar-create-project-action-btn"
            >
              Create Project
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            fullWidth
            leftIcon={<MailIcon size={16} />}
            onClick={() => {
              setSidebarOpen(false);
              navigate('/app/invitations');
            }}
          >
            <span className="sidebar-invitations-btn-label">
              <span>Invitations</span>
              {pendingInviteCount > 0 && (
                <span className="sidebar-invites-badge">{pendingInviteCount}</span>
              )}
            </span>
          </Button>
        </div>


        {/* Sidebar Footer / User Row */}
        <div className="workspace-sidebar-footer">
          <div
            className="sidebar-user-card"
            onClick={() => {
              setSidebarOpen(false);
              navigate('/app/settings/profile');
            }}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setSidebarOpen(false);
                navigate('/app/settings/profile');
              }
            }}
            title="Account Settings"
          >
            <div className="sidebar-user-avatar">
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt={user.fullName || user.username} />
              ) : (
                <span>{userInitials}</span>
              )}
            </div>
            <div className="sidebar-user-info">
              <span className="sidebar-user-name">{user.fullName || user.username}</span>
              <span className="sidebar-user-sub">@{user.username}</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Workspace Area */}
      <div className="app-workspace-main">
        {/* Topbar */}
        <header className={`workspace-topbar ${mobileSearchOpen ? 'mobile-search-active' : ''}`}>
          <div className="workspace-topbar-left">
            {!mobileSearchOpen && (
              <button
                type="button"
                className="mobile-hamburger-btn"
                onClick={() => setSidebarOpen(true)}
                aria-label="Open navigation drawer"
              >
                <MenuIcon size={22} />
              </button>
            )}
            {!mobileSearchOpen && (
              <button
                type="button"
                className="mobile-search-toggle-btn"
                onClick={() => setMobileSearchOpen(true)}
                aria-label="Open search"
              >
                <SearchIcon size={19} />
              </button>
            )}
            <div className={`workspace-search ${mobileSearchOpen ? 'mobile-search-expanded' : ''}`} ref={searchContainerRef} style={{ position: 'relative' }}>
              <SearchIcon size={16} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  if (e.target.value.trim().length >= 2) setSearchOpen(true);
                }}
                onFocus={() => {
                  if (searchQuery.trim().length >= 2) setSearchOpen(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setSearchOpen(false);
                    setMobileSearchOpen(false);
                  }
                }}
                placeholder="Search projects, tasks, notes..."
                className="topbar-input"
                aria-label="Search workspace"
                autoFocus={mobileSearchOpen}
              />
              {mobileSearchOpen && (
                <button
                  type="button"
                  className="mobile-search-close-btn"
                  onClick={() => {
                    setMobileSearchOpen(false);
                    setSearchOpen(false);
                    setSearchQuery('');
                  }}
                  aria-label="Close search"
                >
                  <CloseIcon size={16} />
                </button>
              )}
              {searchLoading && !mobileSearchOpen && (
                <div style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)' }}>
                  <div className="btn-spinner" style={{ width: '14px', height: '14px', borderColor: '#9CA3AF', borderTopColor: 'transparent' }} />
                </div>
              )}

              {/* Global Search Results Floating Dropdown */}
              {searchOpen && searchQuery.trim().length >= 2 && (
                <div
                  className="workspace-search-results-dropdown"
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 8px)',
                    left: 0,
                    width: 'min(calc(100vw - 2rem), 420px)',
                    maxWidth: 'calc(100vw - 2rem)',
                    maxHeight: '440px',
                    overflowY: 'auto',
                    background: '#FFFFFF',
                    borderRadius: '10px',
                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                    border: '1px solid #E5E7EB',
                    zIndex: 1000,
                    padding: '8px 0',
                  }}
                >
                  {searchLoading && !searchResults ? (
                    <div style={{ padding: '16px', textAlign: 'center', fontSize: '13px', color: '#9CA3AF' }}>
                      Searching workspace...
                    </div>
                  ) : !searchResults ||
                    (searchResults.projects.length === 0 &&
                      searchResults.workItems.length === 0 &&
                      searchResults.notes.length === 0 &&
                      searchResults.files.length === 0) ? (
                    <div style={{ padding: '24px 16px', textAlign: 'center', fontSize: '13px', color: '#6B7280' }}>
                      No results found for &ldquo;{searchQuery}&rdquo;
                    </div>
                  ) : (
                    <div>
                      {/* Projects Section */}
                      {searchResults.projects.length > 0 && (
                        <div>
                          <div style={{ padding: '6px 16px', fontSize: '11px', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Projects ({searchResults.projects.length})
                          </div>
                          {searchResults.projects.map((p) => (
                            <div
                              key={p.id}
                              onClick={() => {
                                setSearchOpen(false);
                                setSearchQuery('');
                                navigate(`/app/projects/${p.id}`);
                              }}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                padding: '8px 16px',
                                cursor: 'pointer',
                                transition: 'background 0.1s ease',
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.background = '#F9FAFB')}
                              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                            >
                              <div style={{ width: '24px', height: '24px', borderRadius: '6px', background: '#EEF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4F46E5', fontSize: '11px', fontWeight: 700 }}>
                                {p.key}
                              </div>
                              <div style={{ overflow: 'hidden' }}>
                                <div style={{ fontSize: '13px', fontWeight: 600, color: '#111827', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{p.name}</div>
                                {p.description && <div style={{ fontSize: '11px', color: '#6B7280', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{p.description}</div>}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Work Items Section */}
                      {searchResults.workItems.length > 0 && (
                        <div style={{ marginTop: '8px', borderTop: '1px solid #F3F4F6', paddingTop: '6px' }}>
                          <div style={{ padding: '6px 16px', fontSize: '11px', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Tasks &amp; Work Items ({searchResults.workItems.length})
                          </div>
                          {searchResults.workItems.map((item) => (
                            <div
                              key={item.id}
                              onClick={() => {
                                setSearchOpen(false);
                                setSearchQuery('');
                                navigate(`/app/projects/${item.projectId}/board`);
                              }}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '8px 16px',
                                cursor: 'pointer',
                                transition: 'background 0.1s ease',
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.background = '#F9FAFB')}
                              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                                <CheckSquareIcon size={14} />
                                <span style={{ fontSize: '13px', color: '#1F2937', fontWeight: 500, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                                  {item.title}
                                </span>
                              </div>
                              <span style={{ fontSize: '11px', color: '#6B7280', background: '#F3F4F6', padding: '2px 6px', borderRadius: '4px', flexShrink: 0 }}>
                                {item.projectName}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Notes Section */}
                      {searchResults.notes.length > 0 && (
                        <div style={{ marginTop: '8px', borderTop: '1px solid #F3F4F6', paddingTop: '6px' }}>
                          <div style={{ padding: '6px 16px', fontSize: '11px', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Notes ({searchResults.notes.length})
                          </div>
                          {searchResults.notes.map((note) => (
                            <div
                              key={note.id}
                              onClick={() => {
                                setSearchOpen(false);
                                setSearchQuery('');
                                navigate(`/app/projects/${note.projectId}/notes`);
                              }}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '8px 16px',
                                cursor: 'pointer',
                                transition: 'background 0.1s ease',
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.background = '#F9FAFB')}
                              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                                <FileTextIcon size={14} />
                                <span style={{ fontSize: '13px', color: '#1F2937', fontWeight: 500, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                                  {note.title}
                                </span>
                              </div>
                              <span style={{ fontSize: '11px', color: '#6B7280', background: '#F3F4F6', padding: '2px 6px', borderRadius: '4px', flexShrink: 0 }}>
                                {note.projectName}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Files Section */}
                      {searchResults.files.length > 0 && (
                        <div style={{ marginTop: '8px', borderTop: '1px solid #F3F4F6', paddingTop: '6px' }}>
                          <div style={{ padding: '6px 16px', fontSize: '11px', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Files ({searchResults.files.length})
                          </div>
                          {searchResults.files.map((file) => (
                            <div
                              key={file.id}
                              onClick={() => {
                                setSearchOpen(false);
                                setSearchQuery('');
                                navigate(`/app/projects/${file.projectId}/files`);
                              }}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '8px 16px',
                                cursor: 'pointer',
                                transition: 'background 0.1s ease',
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.background = '#F9FAFB')}
                              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                                <FolderIcon size={14} />
                                <span style={{ fontSize: '13px', color: '#1F2937', fontWeight: 500, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                                  {file.originalName}
                                </span>
                              </div>
                              <span style={{ fontSize: '11px', color: '#6B7280', background: '#F3F4F6', padding: '2px 6px', borderRadius: '4px', flexShrink: 0 }}>
                                {file.projectName}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="workspace-topbar-actions" ref={dropdownRef}>
            <NotificationDropdown
              unreadCount={unreadNotificationCount}
              onUnreadCountChange={setUnreadNotificationCount}
            />

            <div className="profile-menu-container">
              <button
                type="button"
                className="workspace-avatar-btn"
                onClick={() => navigate('/app/settings/profile')}
                title="Account Settings"
                aria-label="Account Settings"
              >
                <div className="topbar-avatar-circle">
                  {user.avatarUrl ? (
                    <img src={user.avatarUrl} alt={user.fullName || user.username} />
                  ) : (
                    <span>{userInitials}</span>
                  )}
                </div>
                <span className="topbar-username">{user.fullName || user.username}</span>
              </button>
            </div>
          </div>
        </header>

        {/* Page Content View */}
        <main className="workspace-content-body" key={activeWorkspace?.id || 'default'}>
          {children}
        </main>

        {/* Global Floating Active Task Timer Modal & Single-Active Conflict Resolution */}
        <FloatingTimerModal />
        <TimerConflictModal />
      </div>
    </div>
  );
};
