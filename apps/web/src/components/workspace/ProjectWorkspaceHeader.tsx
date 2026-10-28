import React from 'react';
import { Link } from '../../router/Router';
import type { Project } from '../../api/projects.api';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useAuth } from '../../context/AuthContext';
import {
  PlusIcon,
  CheckSquareIcon,
  FolderIcon,
  FileTextIcon,
  UsersIcon,
  LayersIcon,
  CalendarIcon,
  ActivityIcon,
  SettingsIcon,
  ArrowRightIcon,
  GlobeIcon,
  LockIcon,
} from '../ui/Icons';
import { ProjectOverviewHeaderAtmosphere } from '../common/HeaderAtmosphereArt';
import { ApplicationCategoryIcon } from '../common/ApplicationCategoryIcon';
import { isLikelyImageUrl } from '../ui/ProjectAvatar';

const WorkspaceBadgeIcon: React.FC<{ size?: number; className?: string }> = ({ size = 11, className = '' }) => (
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

interface ProjectWorkspaceHeaderProps {
  project: Project;
  currentTab: 'overview' | 'board' | 'activity' | 'files' | 'notes' | 'members' | 'settings' | 'calendar' | 'list';
  onOpenCreateWorkModal?: () => void;
  onOpenSettingsModal?: () => void;
  onOpenInviteModal?: () => void;
  onOpenTransferModal?: () => void;
  showHeroCard?: boolean;
}

export const ProjectWorkspaceHeader: React.FC<ProjectWorkspaceHeaderProps> = ({
  project,
  currentTab,
  onOpenCreateWorkModal,
  onOpenSettingsModal,
  onOpenInviteModal,
  onOpenTransferModal,
  showHeroCard,
}) => {
  const { activeWorkspace, activeRole } = useWorkspace();
  const { user } = useAuth();

  const isWsOwner = Boolean(
    activeRole === 'OWNER' ||
    (activeRole as string)?.toUpperCase() === 'OWNER' ||
    activeWorkspace?.isOwner ||
    (activeWorkspace?.ownerId && user?.id && activeWorkspace.ownerId === user.id)
  );
  const isWsAdmin = Boolean(
    activeRole === 'WORKSPACE_ADMIN' ||
    (activeRole as string)?.toUpperCase() === 'WORKSPACE_ADMIN' ||
    (activeRole as string)?.toUpperCase() === 'ADMIN' ||
    activeWorkspace?.userRole === 'WORKSPACE_ADMIN' ||
    (activeWorkspace?.userRole as string)?.toUpperCase() === 'WORKSPACE_ADMIN' ||
    (activeWorkspace as any)?.role === 'WORKSPACE_ADMIN'
  );
  const isWsLeader = isWsOwner || isWsAdmin;
  const isAdmin = Boolean(
    isWsLeader ||
    project.userRole === 'PROJECT_ADMIN' ||
    (project.createdById && user?.id && project.createdById === user.id)
  );
  const monogram = project.name ? project.name.trim()[0].toUpperCase() : 'P';
  const roleLabel = isAdmin ? 'Admin' : 'Member';
  const memberCount = project.memberCount || (project.members ? project.members.length : 1);
  const isWorkspaceVisible = (project.visibility || 'WORKSPACE').toUpperCase() === 'WORKSPACE';
  const visibilityLabel = isWorkspaceVisible ? 'Workspace' : 'Restricted';
  const workspaceName = project.workspace?.name;

  const [heroImgError, setHeroImgError] = React.useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = React.useState(false);
  const moreMenuRef = React.useRef<HTMLDivElement>(null);

  const avatarUrl = (project.avatarUrl || '').trim();
  const isImg = !heroImgError && Boolean(avatarUrl && isLikelyImageUrl(avatarUrl));
  const isEmojiOrPreset = !heroImgError && !isImg && avatarUrl.length > 0 && avatarUrl.length <= 8;
  const shouldRenderHero = showHeroCard !== false;

  // Close more menu on outside click or Escape key
  React.useEffect(() => {
    if (!moreMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setMoreMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMoreMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [moreMenuOpen]);

  return (
    <div className="project-workspace-header-container">
      {/* Top Back Navigation Link */}
      <div className="po-top-nav-bar">
        <Link to="/app/projects" className="po-back-to-projects-link">
          <span className="po-back-arrow">←</span>
          <span>Back to Projects</span>
        </Link>
      </div>

      {/* Main Header Hero Card (shown when shouldRenderHero is true) */}
      {shouldRenderHero && (
        <div className="project-hero-card">
        {/* Left Side: Identity, Name, Status, Role, Description, Category */}
        <div className="project-hero-left">
          <div className="project-hero-logo-box">
            {isImg ? (
              <img
                src={avatarUrl}
                alt={project.name}
                className="project-hero-img"
                onError={() => setHeroImgError(true)}
              />
            ) : isEmojiOrPreset ? (
              <span className="project-hero-emoji">{avatarUrl}</span>
            ) : (
              <span className="project-hero-monogram">{monogram}</span>
            )}
          </div>

          <div className="project-hero-info">
            <div className="project-hero-title-row" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <h1 className="project-hero-title">{project.name}</h1>
              <span className={`project-hero-status-pill status-${project.status?.toLowerCase() || 'active'}`}>
                {project.status || 'ACTIVE'}
              </span>
              <span className="project-hero-role-pill">{roleLabel}</span>

              {/* Visibility badge */}
              <span
                className={`proj-visibility-pill ${
                  isWorkspaceVisible ? 'visibility-workspace' : 'visibility-restricted'
                }`}
                title={
                  isWorkspaceVisible
                    ? 'Visible to all Workspace Members'
                    : 'Restricted: Accessible only to assigned project members'
                }
              >
                {isWorkspaceVisible ? <GlobeIcon size={11} /> : <LockIcon size={11} />}
                <span>{visibilityLabel}</span>
              </span>

              {/* Parent Workspace attribution badge */}
              {workspaceName && (
                <span className="proj-workspace-attribution-pill" title={`Workspace: ${workspaceName}`}>
                  <WorkspaceBadgeIcon size={11} />
                  <span>{workspaceName}</span>
                </span>
              )}
            </div>

            {project.description && (
              <p className="project-hero-desc">{project.description}</p>
            )}

            {project.category && (
              <div className="project-hero-category-badge">
                <ApplicationCategoryIcon category={project.category} size={13} className="project-cat-icon" />
                <span>{project.category}</span>
              </div>
            )}
          </div>
        </div>

        {/* Center: Atmosphere Landscape Art with Focused Team Quote */}
        <div className="project-hero-center">
          <ProjectOverviewHeaderAtmosphere />
        </div>

        {/* Right Actions */}
        <div className="project-hero-right" style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <div className="po-more-menu-container" ref={moreMenuRef}>
            <button
              type="button"
              className="po-more-btn"
              onClick={() => setMoreMenuOpen((prev) => !prev)}
              aria-haspopup="true"
              aria-expanded={moreMenuOpen}
              aria-label="More project options"
            >
              <span>••• More</span>
              <span className="po-caret-down">▾</span>
            </button>

            {moreMenuOpen && (
              <div className="po-more-dropdown-menu">
                {isAdmin && onOpenSettingsModal && (
                  <button
                    type="button"
                    className="po-more-dropdown-item"
                    onClick={() => {
                      setMoreMenuOpen(false);
                      onOpenSettingsModal();
                    }}
                  >
                    <SettingsIcon size={14} />
                    <span>Project Settings</span>
                  </button>
                )}
                {isAdmin && onOpenInviteModal && (
                  <button
                    type="button"
                    className="po-more-dropdown-item"
                    onClick={() => {
                      setMoreMenuOpen(false);
                      onOpenInviteModal();
                    }}
                  >
                    <UsersIcon size={14} />
                    <span>Invite Members</span>
                  </button>
                )}
                <Link
                  to={`/app/projects/${project.id}/members`}
                  className="po-more-dropdown-item"
                  onClick={() => setMoreMenuOpen(false)}
                >
                  <UsersIcon size={14} />
                  <span>Team Members</span>
                </Link>
                {isAdmin && onOpenTransferModal && (
                  <button
                    type="button"
                    className="po-more-dropdown-item"
                    onClick={() => {
                      setMoreMenuOpen(false);
                      onOpenTransferModal();
                    }}
                  >
                    <ArrowRightIcon size={14} />
                    <span>Transfer Project</span>
                  </button>
                )}
                <Link
                  to={`/app/projects/${project.id}/board`}
                  className="po-more-dropdown-item"
                  onClick={() => setMoreMenuOpen(false)}
                >
                  <CheckSquareIcon size={14} />
                  <span>Project Board</span>
                </Link>
              </div>
            )}
          </div>

          <button
            type="button"
            className="po-create-work-btn"
            onClick={onOpenCreateWorkModal}
          >
            <PlusIcon size={15} />
            <span>Create Task</span>
          </button>
        </div>
      </div>
      )}

      {/* Navigation Tabs Bar */}
      <div className="project-workspace-tabs-bar" role="tablist">
        <Link
          to={`/app/projects/${project.id}`}
          className={`project-tab-btn ${currentTab === 'overview' ? 'active' : ''}`}
          role="tab"
          aria-selected={currentTab === 'overview'}
        >
          <LayersIcon size={15} />
          <span>Overview</span>
        </Link>

        <Link
          to={`/app/projects/${project.id}/board`}
          className={`project-tab-btn ${currentTab === 'board' ? 'active' : ''}`}
          role="tab"
          aria-selected={currentTab === 'board'}
        >
          <CheckSquareIcon size={15} />
          <span>Board</span>
        </Link>

        <Link
          to={`/app/projects/${project.id}/members`}
          className={`project-tab-btn ${currentTab === 'members' ? 'active' : ''}`}
          role="tab"
          aria-selected={currentTab === 'members'}
        >
          <UsersIcon size={15} />
          <span>Team ({memberCount})</span>
        </Link>

        <Link
          to={`/app/projects/${project.id}/calendar`}
          className={`project-tab-btn ${currentTab === 'calendar' ? 'active' : ''}`}
          role="tab"
          aria-selected={currentTab === 'calendar'}
        >
          <CalendarIcon size={15} />
          <span>Calendar</span>
        </Link>

        <Link
          to={`/app/projects/${project.id}/notes`}
          className={`project-tab-btn ${currentTab === 'notes' ? 'active' : ''}`}
          role="tab"
          aria-selected={currentTab === 'notes'}
        >
          <FileTextIcon size={15} />
          <span>Notes</span>
        </Link>

        <Link
          to={`/app/projects/${project.id}/files`}
          className={`project-tab-btn ${currentTab === 'files' ? 'active' : ''}`}
          role="tab"
          aria-selected={currentTab === 'files'}
        >
          <FolderIcon size={15} />
          <span>Files</span>
        </Link>

        <Link
          to={`/app/projects/${project.id}/activity`}
          className={`project-tab-btn ${currentTab === 'activity' || currentTab === 'list' ? 'active' : ''}`}
          role="tab"
          aria-selected={currentTab === 'activity' || currentTab === 'list'}
        >
          <ActivityIcon size={15} />
          <span>Activity</span>
        </Link>
      </div>
    </div>
  );
};


