import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useRouter } from '../../router/Router';
import { useWorkspace } from '../../context/WorkspaceContext';
import { type WorkspaceSummary } from '../../api/workspaces.api';
import { CreateWorkspaceModal } from '../../components/workspace/CreateWorkspaceModal';
import {
  LayersIcon,
  SearchIcon,
  PlusIcon,
  UsersIcon,
  FolderIcon,
  ArrowRightIcon,
  SettingsIcon,
  ChevronDownIcon,
  GridIcon,
  ListIcon,
} from '../../components/ui/Icons';
import './AllWorkspacesPage.css';

// Dedicated 3-dot overflow icon
const MoreVerticalIcon: React.FC<{ size?: number; className?: string }> = ({ size = 16, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="12" cy="12" r="1.5" fill="currentColor" />
    <circle cx="12" cy="5" r="1.5" fill="currentColor" />
    <circle cx="12" cy="19" r="1.5" fill="currentColor" />
  </svg>
);

// High-Fidelity Atmosphere Illustration matching User Reference Design
const AllWorkspacesHeaderIllustration: React.FC = () => (
  <svg
    viewBox="0 0 260 90"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="all-ws-header-art-svg"
    aria-hidden="true"
  >
    <defs>
      <filter id="ws-art-shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="#0F172A" floodOpacity="0.08" />
      </filter>
    </defs>

    {/* Soft subtle aura */}
    <ellipse cx="130" cy="52" rx="90" ry="32" fill="#EFF6FF" opacity="0.6" />

    {/* Green Botanical Sprig / Leaves on the left */}
    <g>
      <path
        d="M48 72 C46 58 52 45 64 36 C61 48 57 60 48 72 Z"
        fill="#059669"
      />
      <path
        d="M64 36 C71 39 74 46 70 53 C65 48 61 43 64 36 Z"
        fill="#10B981"
      />
      <path
        d="M55 52 C48 50 44 43 47 36 C52 40 55 45 55 52 Z"
        fill="#34D399"
      />
      <path
        d="M46 68 C39 66 36 59 39 53 C43 57 46 62 46 68 Z"
        fill="#047857"
      />
    </g>

    {/* Document / Task Checklist Sheet */}
    <g filter="url(#ws-art-shadow)">
      <rect x="62" y="16" width="54" height="66" rx="6" fill="#FFFFFF" stroke="#E2E8F0" strokeWidth="1.2" />
      {/* Top blue bar */}
      <rect x="62" y="16" width="54" height="10" rx="3" fill="#3B82F6" />
      {/* Bullet checks & lines */}
      <circle cx="71" cy="36" r="2.2" fill="#3B82F6" />
      <rect x="77" y="34.5" width="30" height="3" rx="1.5" fill="#CBD5E1" />

      <circle cx="71" cy="46" r="2.2" fill="#10B981" />
      <rect x="77" y="44.5" width="24" height="3" rx="1.5" fill="#CBD5E1" />

      <circle cx="71" cy="56" r="2.2" fill="#6366F1" />
      <rect x="77" y="54.5" width="28" height="3" rx="1.5" fill="#CBD5E1" />

      <circle cx="71" cy="66" r="2.2" fill="#F59E0B" />
      <rect x="77" y="64.5" width="20" height="3" rx="1.5" fill="#CBD5E1" />
    </g>

    {/* Manila Folder in Front */}
    <g filter="url(#ws-art-shadow)">
      {/* Folder Tab */}
      <path
        d="M84 38 L84 33 C84 31 86 29 88 29 L104 29 C106 29 108 31 110 33 L114 38 Z"
        fill="#F59E0B"
      />
      {/* Folder Body */}
      <rect x="84" y="38" width="58" height="42" rx="5" fill="#FDE047" stroke="#F59E0B" strokeWidth="1" />
      <path d="M84 48 Q113 54 142 48 L142 75 C142 78 139 80 136 80 L89 80 C86 80 84 78 84 75 Z" fill="#FBBF24" opacity="0.4" />
    </g>

    {/* Blue Avatar Bubble (top) */}
    <g filter="url(#ws-art-shadow)">
      <circle cx="138" cy="24" r="13" fill="#3B82F6" />
      {/* Silhouette User inside */}
      <circle cx="138" cy="20.5" r="3.6" fill="#FFFFFF" />
      <path d="M130.5 31.5 C130.5 28 133.5 26 138 26 C142.5 26 145.5 28 145.5 31.5 Z" fill="#FFFFFF" />
    </g>

    {/* Green Avatar Bubble (bottom right) */}
    <g filter="url(#ws-art-shadow)">
      <circle cx="160" cy="58" r="12" fill="#10B981" />
      {/* Silhouette User inside */}
      <circle cx="160" cy="55" r="3.3" fill="#FFFFFF" />
      <path d="M153 65 C153 61.8 155.8 60 160 60 C164.2 60 167 61.8 167 65 Z" fill="#FFFFFF" />
    </g>

    {/* Paper Airplane Flying to Right */}
    <g filter="url(#ws-art-shadow)">
      <path
        d="M188 28 L216 19 L203 43 L197 34 Z"
        fill="#3B82F6"
      />
      <path
        d="M216 19 L197 34 L199 40 Z"
        fill="#1D4ED8"
      />
    </g>

    {/* Dotted Airplane Trail */}
    <path
      d="M174 46 C180 40 186 36 191 40 C194 44 191 51 183 51 C172 51 167 36 181 27 C186 24 194 24 202 27"
      stroke="#94A3B8"
      strokeWidth="1.4"
      strokeDasharray="3 3"
      fill="none"
    />

    {/* Floating Decorative Sparkles & Diamonds */}
    <path d="M168 15 L169.2 18.5 L172.5 19.7 L169.2 21 L168 24.5 L166.8 21 L163.5 19.7 L166.8 18.5 Z" fill="#10B981" />
    <circle cx="210" cy="48" r="1.8" fill="#F59E0B" />
    <circle cx="155" cy="14" r="1.5" fill="#3B82F6" />
    <circle cx="56" cy="28" r="1.8" fill="#10B981" />
  </svg>
);

export const AllWorkspacesPage: React.FC = () => {
  const { navigate } = useRouter();
  const {
    workspaces,
    activeWorkspace,
    setActiveWorkspaceId,
  } = useWorkspace();

  const [searchQuery, setSearchQuery] = useState('');
  const [modalOpen, setModalOpen] = useState(false);

  // Sorting & View mode states
  const [sortBy, setSortBy] = useState<'updated' | 'name' | 'projects' | 'members'>('updated');
  const [sortOpen, setSortOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [activeMenuWsId, setActiveMenuWsId] = useState<string | null>(null);

  const sortMenuRef = useRef<HTMLDivElement>(null);

  // Close menus on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (sortMenuRef.current && !sortMenuRef.current.contains(target)) {
        setSortOpen(false);
      }
      if (!target.closest('.all-ws-more-btn-wrap')) {
        setActiveMenuWsId(null);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // Combine and deduplicate owned and joined workspaces
  const allWorkspacesList = useMemo(() => {
    const combined = [...workspaces.owned, ...workspaces.joined];
    const seen = new Set<string>();
    return combined.filter((w) => {
      if (seen.has(w.id)) return false;
      seen.add(w.id);
      return true;
    });
  }, [workspaces.owned, workspaces.joined]);

  // Separate into Personal and Team workspaces
  const personalWorkspaces = useMemo(() => {
    return allWorkspacesList.filter((w) => w.isPersonal);
  }, [allWorkspacesList]);

  const teamWorkspaces = useMemo(() => {
    return allWorkspacesList.filter((w) => !w.isPersonal);
  }, [allWorkspacesList]);

  // Sorting helper
  const sortWorkspaces = (list: WorkspaceSummary[]) => {
    return [...list].sort((a, b) => {
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name);
      }
      if (sortBy === 'projects') {
        return (b.projectCount || 0) - (a.projectCount || 0);
      }
      if (sortBy === 'members') {
        return (b.memberCount || 0) - (a.memberCount || 0);
      }
      // 'updated' default
      const aDate = new Date(a.updatedAt || 0).getTime();
      const bDate = new Date(b.updatedAt || 0).getTime();
      return bDate - aDate;
    });
  };

  // Filter based on search query and sort
  const filteredPersonal = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const base = !q
      ? personalWorkspaces
      : personalWorkspaces.filter(
          (w) => w.name.toLowerCase().includes(q) || w.slug.toLowerCase().includes(q)
        );
    return sortWorkspaces(base);
  }, [personalWorkspaces, searchQuery, sortBy]);

  const filteredTeam = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const base = !q
      ? teamWorkspaces
      : teamWorkspaces.filter(
          (w) =>
            w.name.toLowerCase().includes(q) ||
            w.slug.toLowerCase().includes(q) ||
            (w.owner?.username && w.owner.username.toLowerCase().includes(q))
        );
    return sortWorkspaces(base);
  }, [teamWorkspaces, searchQuery, sortBy]);

  const handleSelectWorkspace = (ws: WorkspaceSummary) => {
    try {
      if (ws.isPersonal) {
        if (!ws.isDefault) {
          localStorage.setItem('dboard_recent_personal_ws', ws.id);
        }
      } else {
        localStorage.setItem('dboard_recent_team_ws', ws.id);
      }
    } catch {
      // ignore
    }

    setActiveWorkspaceId(ws.id);
    navigate('/app/dashboard');
  };

  const handleOpenSettings = (e: React.MouseEvent, ws: WorkspaceSummary) => {
    e.stopPropagation();
    setActiveWorkspaceId(ws.id);
    navigate('/app/workspace/settings');
  };



  const getWorkspaceInitials = (name: string) => {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const getRoleBadge = (ws: WorkspaceSummary) => {
    if (ws.isPersonal) {
      return null;
    }
    if (ws.isOwner || ws.userRole === 'OWNER') {
      return <span className="all-ws-badge badge-owner">OWNER</span>;
    }
    if (ws.userRole === 'WORKSPACE_ADMIN') {
      return <span className="all-ws-badge badge-admin">ADMIN</span>;
    }
    if (ws.userRole === 'PROJECT_ADMIN') {
      return <span className="all-ws-badge badge-projadmin">PROJECT ADMIN</span>;
    }
    return <span className="all-ws-badge badge-member">MEMBER</span>;
  };

  const sortLabels: Record<string, string> = {
    updated: 'Recently Updated',
    name: 'Name (A - Z)',
    projects: 'Most Projects',
    members: 'Most Members',
  };

  return (
    <div className="all-workspaces-page">
      {/* ==========================================================================
          HEADER BANNER (MATCHING REFERENCE DESIGN)
          ========================================================================== */}
      <div className="all-ws-header-card">
        <div className="all-ws-header-left">
          <div className="all-ws-header-icon-squircle">
            <LayersIcon size={28} />
          </div>
          <div className="all-ws-header-titles">
            <h1 className="all-ws-header-title">All Workspaces</h1>
            <p className="all-ws-header-subtitle">
              Browse, access, and manage all your personal and team workspaces.
            </p>
          </div>
        </div>

        {/* Center Atmosphere Artwork with Quote & Illustration */}
        <div className="all-ws-header-center-wrap">
          <div className="all-ws-quote-block">
            <span>&ldquo;Different workspaces,</span>
            <span className="all-ws-quote-second-line">
              endless possibilities.&rdquo;
              <svg
                className="all-ws-green-swoosh"
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

          <div className="all-ws-header-illustration-box">
            <AllWorkspacesHeaderIllustration />
          </div>
        </div>

        {/* Far Right Action */}
        <div className="all-ws-header-right">
          <button
            type="button"
            className="all-ws-create-btn"
            onClick={() => setModalOpen(true)}
            id="all-workspaces-create-btn"
          >
            <PlusIcon size={16} />
            <span>Create Workspace</span>
          </button>
        </div>
      </div>

      {/* ==========================================================================
          TOOLBAR: SEARCH BOX, SORT SELECT & VIEW TOGGLE
          ========================================================================== */}
      <div className="all-ws-toolbar">
        {/* Search input */}
        <div className="all-ws-search-box">
          <SearchIcon size={18} />
          <input
            type="text"
            placeholder="Search workspaces by name or slug..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            id="all-workspaces-search-input"
          />
        </div>

        <div className="all-ws-toolbar-right">
          {/* Sort Dropdown */}
          <div className="all-ws-sort-dropdown-wrap" ref={sortMenuRef}>
            <button
              type="button"
              className="all-ws-sort-btn"
              onClick={() => setSortOpen(!sortOpen)}
              aria-expanded={sortOpen}
            >
              <span>{sortLabels[sortBy]}</span>
              <ChevronDownIcon size={15} />
            </button>

            {sortOpen && (
              <div className="all-ws-sort-menu">
                <button
                  type="button"
                  className={`all-ws-sort-item ${sortBy === 'updated' ? 'active' : ''}`}
                  onClick={() => {
                    setSortBy('updated');
                    setSortOpen(false);
                  }}
                >
                  Recently Updated
                </button>
                <button
                  type="button"
                  className={`all-ws-sort-item ${sortBy === 'name' ? 'active' : ''}`}
                  onClick={() => {
                    setSortBy('name');
                    setSortOpen(false);
                  }}
                >
                  Name (A - Z)
                </button>
                <button
                  type="button"
                  className={`all-ws-sort-item ${sortBy === 'projects' ? 'active' : ''}`}
                  onClick={() => {
                    setSortBy('projects');
                    setSortOpen(false);
                  }}
                >
                  Most Projects
                </button>
                <button
                  type="button"
                  className={`all-ws-sort-item ${sortBy === 'members' ? 'active' : ''}`}
                  onClick={() => {
                    setSortBy('members');
                    setSortOpen(false);
                  }}
                >
                  Most Members
                </button>
              </div>
            )}
          </div>

          {/* View mode toggle */}
          <div className="all-ws-view-toggle">
            <button
              type="button"
              className={`all-ws-view-btn ${viewMode === 'grid' ? 'active' : ''}`}
              onClick={() => setViewMode('grid')}
              title="Grid view"
              aria-label="Grid view"
            >
              <GridIcon size={16} />
            </button>
            <button
              type="button"
              className={`all-ws-view-btn ${viewMode === 'list' ? 'active' : ''}`}
              onClick={() => setViewMode('list')}
              title="List view"
              aria-label="List view"
            >
              <ListIcon size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* ==========================================================================
          SECTION 1: PERSONAL WORKSPACES
          ========================================================================== */}
      <section className="all-workspaces-section">
        <div className="all-workspaces-section-header">
          <div className="all-workspaces-section-title-row">
            <h2 className="all-workspaces-section-title">Personal Workspaces</h2>
            <span className="all-workspaces-section-count">{personalWorkspaces.length}</span>
          </div>
          <p className="all-workspaces-section-desc">
            Your private environments for individual projects and tasks.
          </p>
        </div>

        {filteredPersonal.length === 0 ? (
          <div className="all-workspace-empty">
            <LayersIcon size={32} style={{ opacity: 0.5 }} />
            <p>No personal workspaces found matching your search.</p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="all-ws-grid">
            {filteredPersonal.map((ws) => {
              const isActive = activeWorkspace?.id === ws.id;
              return (
                <div
                  key={ws.id}
                  className={`all-ws-card ${isActive ? 'is-active' : ''}`}
                >
                  <div className="all-ws-card-top">
                    <div className="all-ws-card-top-left">
                      <div className="all-ws-avatar personal-avatar">
                        {ws.avatarUrl ? (
                          <img src={ws.avatarUrl} alt={ws.name} />
                        ) : (
                          <span>{getWorkspaceInitials(ws.name)}</span>
                        )}
                      </div>
                      <div className="all-ws-card-info">
                        <div className="all-ws-title-row">
                          <span className="all-ws-name" title={ws.name}>
                            {ws.name}
                          </span>
                          {ws.isDefault && (
                            <span className="all-ws-badge badge-default">DEFAULT</span>
                          )}
                        </div>
                        <div className="all-ws-type-pill">
                          <UsersIcon size={12} />
                          <span>Personal</span>
                        </div>
                      </div>
                    </div>

                    <div className="all-ws-more-btn-wrap" style={{ position: 'relative' }}>
                      <button
                        type="button"
                        className="all-ws-more-btn"
                        title="Workspace options"
                        aria-label="Workspace options"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenuWsId(activeMenuWsId === ws.id ? null : ws.id);
                        }}
                      >
                        <MoreVerticalIcon size={16} />
                      </button>

                      {activeMenuWsId === ws.id && (
                        <div className="all-ws-menu-dropdown" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            className="all-ws-menu-item"
                            onClick={() => {
                              setActiveMenuWsId(null);
                              handleSelectWorkspace(ws);
                            }}
                          >
                            <ArrowRightIcon size={14} />
                            <span>Open Workspace</span>
                          </button>
                          <button
                            type="button"
                            className="all-ws-menu-item"
                            onClick={(e) => {
                              setActiveMenuWsId(null);
                              handleOpenSettings(e, ws);
                            }}
                          >
                            <SettingsIcon size={14} />
                            <span>Workspace Settings</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Middle Stats Row */}
                  <div className="all-ws-meta-row">
                    <div className="all-ws-meta-item">
                      <FolderIcon size={15} />
                      <span>
                        {ws.projectCount || 0} {(ws.projectCount === 1) ? 'project' : 'projects'}
                      </span>
                    </div>
                    <div className="all-ws-meta-item">
                      <UsersIcon size={15} />
                      <span>
                        {ws.memberCount || 1} {(ws.memberCount === 1) ? 'member' : 'members'}
                      </span>
                    </div>
                  </div>

                  {/* Footer Actions Row */}
                  <div className="all-ws-card-footer">
                    <button
                      type="button"
                      className="all-ws-open-btn"
                      onClick={() => handleSelectWorkspace(ws)}
                    >
                      <span>Open Workspace</span>
                      <ArrowRightIcon size={14} />
                    </button>
                    <button
                      type="button"
                      className="all-ws-settings-btn"
                      onClick={(e) => handleOpenSettings(e, ws)}
                      title="Workspace Settings"
                    >
                      <SettingsIcon size={14} />
                      <span>Settings</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* List View */
          <div className="all-ws-list">
            {filteredPersonal.map((ws) => (
              <div
                key={ws.id}
                className="all-ws-list-item"
                onClick={() => handleSelectWorkspace(ws)}
              >
                <div className="all-ws-list-left">
                  <div className="all-ws-avatar personal-avatar" style={{ width: '40px', height: '40px', fontSize: '0.95rem' }}>
                    {ws.avatarUrl ? <img src={ws.avatarUrl} alt={ws.name} /> : <span>{getWorkspaceInitials(ws.name)}</span>}
                  </div>
                  <div className="all-ws-card-info">
                    <div className="all-ws-title-row">
                      <span className="all-ws-name" title={ws.name}>{ws.name}</span>
                      {ws.isDefault && <span className="all-ws-badge badge-default">DEFAULT</span>}
                    </div>
                    <div className="all-ws-type-pill" style={{ fontSize: '0.7rem' }}>
                      <UsersIcon size={11} />
                      <span>Personal</span>
                    </div>
                  </div>
                </div>

                <div className="all-ws-list-right">
                  <div className="all-ws-meta-item">
                    <FolderIcon size={14} />
                    <span>{ws.projectCount || 0} projects</span>
                  </div>
                  <div className="all-ws-meta-item">
                    <UsersIcon size={14} />
                    <span>{ws.memberCount || 1} member</span>
                  </div>
                  <button
                    type="button"
                    className="all-ws-open-btn"
                    style={{ padding: '0.45rem 1rem', fontSize: '0.78125rem' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelectWorkspace(ws);
                    }}
                  >
                    <span>Open</span>
                    <ArrowRightIcon size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ==========================================================================
          SECTION 2: TEAM WORKSPACES
          ========================================================================== */}
      <section className="all-workspaces-section">
        <div className="all-workspaces-section-header">
          <div className="all-workspaces-section-title-row">
            <h2 className="all-workspaces-section-title">Team Workspaces</h2>
            <span className="all-workspaces-section-count">{teamWorkspaces.length}</span>
          </div>
          <p className="all-workspaces-section-desc">
            Collaborative workspaces shared with teammates and assigned roles.
          </p>
        </div>

        {filteredTeam.length === 0 ? (
          <div className="all-workspace-empty">
            <UsersIcon size={32} style={{ opacity: 0.5 }} />
            <p>No team workspaces found matching your search.</p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="all-ws-grid">
            {filteredTeam.map((ws) => {
              const isActive = activeWorkspace?.id === ws.id;
              const canAccessSettings = ws.isOwner || ws.userRole === 'OWNER' || ws.userRole === 'WORKSPACE_ADMIN';
              return (
                <div
                  key={ws.id}
                  className={`all-ws-card ${isActive ? 'is-active' : ''}`}
                >
                  <div className="all-ws-card-top">
                    <div className="all-ws-card-top-left">
                      <div className="all-ws-avatar team-avatar">
                        {ws.avatarUrl ? (
                          <img src={ws.avatarUrl} alt={ws.name} />
                        ) : (
                          <span>{getWorkspaceInitials(ws.name)}</span>
                        )}
                      </div>
                      <div className="all-ws-card-info">
                        <div className="all-ws-title-row">
                          <span className="all-ws-name" title={ws.name}>
                            {ws.name}
                          </span>
                          {getRoleBadge(ws)}
                        </div>
                        <div className="all-ws-type-pill">
                          <UsersIcon size={12} />
                          <span>Team</span>
                        </div>
                      </div>
                    </div>

                    <div className="all-ws-more-btn-wrap" style={{ position: 'relative' }}>
                      <button
                        type="button"
                        className="all-ws-more-btn"
                        title="Workspace options"
                        aria-label="Workspace options"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenuWsId(activeMenuWsId === ws.id ? null : ws.id);
                        }}
                      >
                        <MoreVerticalIcon size={16} />
                      </button>

                      {activeMenuWsId === ws.id && (
                        <div className="all-ws-menu-dropdown" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            className="all-ws-menu-item"
                            onClick={() => {
                              setActiveMenuWsId(null);
                              handleSelectWorkspace(ws);
                            }}
                          >
                            <ArrowRightIcon size={14} />
                            <span>Open Workspace</span>
                          </button>
                          {canAccessSettings && (
                            <button
                              type="button"
                              className="all-ws-menu-item"
                              onClick={(e) => {
                                setActiveMenuWsId(null);
                                handleOpenSettings(e, ws);
                              }}
                            >
                              <SettingsIcon size={14} />
                              <span>Workspace Settings</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Middle Stats Row */}
                  <div className="all-ws-meta-row">
                    <div className="all-ws-meta-item">
                      <FolderIcon size={15} />
                      <span>
                        {ws.projectCount || 0} {(ws.projectCount === 1) ? 'project' : 'projects'}
                      </span>
                    </div>
                    <div className="all-ws-meta-item">
                      <UsersIcon size={15} />
                      <span>
                        {ws.memberCount || 1} {(ws.memberCount === 1) ? 'member' : 'members'}
                      </span>
                    </div>
                  </div>

                  {/* Footer Actions Row */}
                  <div className="all-ws-card-footer">
                    <button
                      type="button"
                      className="all-ws-open-btn"
                      onClick={() => handleSelectWorkspace(ws)}
                    >
                      <span>Open Workspace</span>
                      <ArrowRightIcon size={14} />
                    </button>
                    {canAccessSettings && (
                      <button
                        type="button"
                        className="all-ws-settings-btn"
                        onClick={(e) => handleOpenSettings(e, ws)}
                        title="Workspace Settings"
                      >
                        <SettingsIcon size={14} />
                        <span>Settings</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* List View */
          <div className="all-ws-list">
            {filteredTeam.map((ws) => {
              const canAccessSettings = ws.isOwner || ws.userRole === 'OWNER' || ws.userRole === 'WORKSPACE_ADMIN';
              return (
                <div
                  key={ws.id}
                  className="all-ws-list-item"
                  onClick={() => handleSelectWorkspace(ws)}
                >
                  <div className="all-ws-list-left">
                    <div className="all-ws-avatar team-avatar" style={{ width: '40px', height: '40px', fontSize: '0.95rem' }}>
                      {ws.avatarUrl ? <img src={ws.avatarUrl} alt={ws.name} /> : <span>{getWorkspaceInitials(ws.name)}</span>}
                    </div>
                    <div className="all-ws-card-info">
                      <div className="all-ws-title-row">
                        <span className="all-ws-name" title={ws.name}>{ws.name}</span>
                        {getRoleBadge(ws)}
                      </div>
                      <div className="all-ws-type-pill" style={{ fontSize: '0.7rem' }}>
                        <UsersIcon size={11} />
                        <span>Team</span>
                      </div>
                    </div>
                  </div>

                  <div className="all-ws-list-right">
                    <div className="all-ws-meta-item">
                      <FolderIcon size={14} />
                      <span>{ws.projectCount || 0} projects</span>
                    </div>
                    <div className="all-ws-meta-item">
                      <UsersIcon size={14} />
                      <span>{ws.memberCount || 1} members</span>
                    </div>
                    <button
                      type="button"
                      className="all-ws-open-btn"
                      style={{ padding: '0.45rem 1rem', fontSize: '0.78125rem' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectWorkspace(ws);
                      }}
                    >
                      <span>Open</span>
                      <ArrowRightIcon size={13} />
                    </button>
                    {canAccessSettings && (
                      <button
                        type="button"
                        className="all-ws-settings-btn"
                        style={{ padding: '0.45rem 0.85rem', fontSize: '0.78125rem' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenSettings(e, ws);
                        }}
                      >
                        <SettingsIcon size={13} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ==========================================================================
          CREATE WORKSPACE MODAL
          ========================================================================== */}
      {/* Create Workspace Modal */}
      <CreateWorkspaceModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={(created) => {
          setActiveWorkspaceId(created.id);
          navigate('/app/dashboard');
        }}
      />
    </div>
  );
};
