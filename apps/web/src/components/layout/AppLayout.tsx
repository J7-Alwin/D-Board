import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link, useRouter } from '../../router/Router';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { projectsApi, type Project } from '../../api/projects.api';
import { invitationsApi } from '../../api/invitations.api';
import { notificationsApi } from '../../api/notifications.api';
import { searchApi, type SearchResultItem } from '../../api/search.api';
import { NotificationDropdown } from '../notifications/NotificationDropdown';
import {
  LayersIcon,
  CheckSquareIcon,
  CalendarIcon,
  FolderIcon,
  FileTextIcon,
  ActivityIcon,
  BellIcon,
  SearchIcon,
  PlusIcon,
  MailIcon,
  MenuIcon,
  CloseIcon,
  UserIcon,
} from '../ui/Icons';
import { Button } from '../ui/Button';
import { ProjectAvatar } from '../ui/ProjectAvatar';
import { Logo } from '../ui/Logo';

export interface AppLayoutProps {
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const { user, isLoading, logout } = useAuth();
  const { socket, isConnected } = useSocket();
  const { path, navigate } = useRouter();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
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

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setProfileDropdownOpen(false);
      }
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setSearchOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
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
        const res = await searchApi.searchGlobal(q);
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
  }, [searchQuery]);

  const refreshCountsAndProjects = () => {
    if (!user) return;
    projectsApi
      .getUserProjects()
      .then((res) => {
        if (res.success && res.data) {
          setProjects({
            owned: res.data.owned || [],
            joined: res.data.joined || [],
          });
        }
      })
      .catch(() => {});

    invitationsApi
      .getPendingCount()
      .then((res) => {
        if (res.success && res.data) {
          setPendingInviteCount(res.data.count || 0);
        }
      })
      .catch(() => {});

    notificationsApi
      .getUnreadCount()
      .then((res) => {
        if (res.success && res.data) {
          setUnreadNotificationCount(res.data.count || 0);
        }
      })
      .catch(() => {});
  };

  // Initial fetch and on route change
  useEffect(() => {
    refreshCountsAndProjects();
  }, [user, path]);

  // Real-time socket listeners for global user state
  useEffect(() => {
    if (!socket || !isConnected) return;

    const handleNotificationCreated = () => {
      setUnreadNotificationCount((prev) => prev + 1);
    };

    const handleNotificationRead = () => {
      notificationsApi.getUnreadCount().then((res) => {
        if (res.success && res.data) setUnreadNotificationCount(res.data.count || 0);
      });
    };

    const handleInvitationCreated = () => {
      setPendingInviteCount((prev) => prev + 1);
    };

    const handleMemberUpdated = () => {
      projectsApi.getUserProjects().then((res) => {
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
    socket.on('MEMBER_ADDED', handleMemberUpdated);
    socket.on('MEMBER_REMOVED', handleMemberUpdated);

    return () => {
      socket.off('NOTIFICATION_CREATED', handleNotificationCreated);
      socket.off('NOTIFICATION_READ', handleNotificationRead);
      socket.off('INVITATION_CREATED', handleInvitationCreated);
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

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

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
            to="/app/my-work"
            className={`workspace-nav-item ${path === '/app/my-work' || path === '/app/work' ? 'active' : ''}`}
            onClick={() => setSidebarOpen(false)}
          >
            <CheckSquareIcon size={18} />
            <span>My Work</span>
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
          <Link
            to="/app/activity"
            className={`workspace-nav-item ${path === '/app/activity' ? 'active' : ''}`}
            onClick={() => setSidebarOpen(false)}
          >
            <ActivityIcon size={18} />
            <span>Activity</span>
          </Link>
          <Link
            to="/app/notifications"
            className={`workspace-nav-item ${path === '/app/notifications' ? 'active' : ''}`}
            onClick={() => setSidebarOpen(false)}
          >
            <BellIcon size={18} />
            <span>Notifications</span>
            {unreadNotificationCount > 0 && (
              <span className="sidebar-invites-badge">{unreadNotificationCount}</span>
            )}
          </Link>
        </nav>

        {/* Project Navigation Area */}
        <div className="workspace-projects-list">
          <div className="projects-header-row">
            <span className="projects-label">MY PROJECTS</span>
            <Link
              to="/app/projects/create"
              className="projects-add-btn"
              title="Create new project"
              onClick={() => setSidebarOpen(false)}
            >
              <PlusIcon size={14} />
            </Link>
          </div>

          {projects.owned.length === 0 ? (
            <div className="sidebar-empty-projects">No owned projects</div>
          ) : (
            projects.owned.map((p) => {
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

          {projects.joined.length > 0 && (
            <>
              <div className="projects-header-row" style={{ marginTop: '1rem' }}>
                <span className="projects-label">JOINED PROJECTS</span>
              </div>
              {projects.joined.map((p) => {
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
              })}
            </>
          )}
        </div>

        {/* Action Area */}
        <div className="workspace-action-area">
          <Button
            variant="primary"
            size="sm"
            fullWidth
            leftIcon={<PlusIcon size={16} />}
            onClick={() => {
              setSidebarOpen(false);
              navigate('/app/projects/create');
            }}
          >
            Create Project
          </Button>
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
            <span>Invitations</span>
            {pendingInviteCount > 0 && (
              <span className="sidebar-invites-badge">{pendingInviteCount}</span>
            )}
          </Button>
        </div>


        {/* Sidebar Footer / User Row */}
        <div className="workspace-sidebar-footer">
          <div className="sidebar-user-card" onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}>
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
                onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                aria-expanded={profileDropdownOpen}
                aria-haspopup="true"
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

              {/* Profile Dropdown Menu */}
              {profileDropdownOpen && (
                <div className="profile-dropdown-menu" role="menu">
                  <div className="dropdown-header">
                    <div className="dropdown-name">{user.fullName || user.username}</div>
                    <div className="dropdown-email">{user.email}</div>
                  </div>
                  <div className="dropdown-divider" />
                  <button
                    type="button"
                    className="dropdown-item"
                    role="menuitem"
                    onClick={() => {
                      setProfileDropdownOpen(false);
                      navigate('/app/settings/profile');
                    }}
                  >
                    <UserIcon size={16} />
                    <span>Account Settings</span>
                  </button>
                  <button
                    type="button"
                    className="dropdown-item"
                    role="menuitem"
                    onClick={() => {
                      setProfileDropdownOpen(false);
                      navigate('/app/invitations');
                    }}
                  >
                    <MailIcon size={16} />
                    <span>Pending Invitations</span>
                  </button>
                  <div className="dropdown-divider" />
                  <button
                    type="button"
                    className="dropdown-item dropdown-item-danger"
                    role="menuitem"
                    onClick={handleLogout}
                  >
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page Content View */}
        <main className="workspace-content-body">
          {children}
        </main>
      </div>
    </div>
  );
};
