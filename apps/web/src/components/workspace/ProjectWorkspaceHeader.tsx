import React from 'react';
import { Link } from '../../router/Router';
import type { Project } from '../../api/projects.api';
import {
  PlusIcon,
  CheckSquareIcon,
  FolderIcon,
  FileTextIcon,
  UsersIcon,
  LayersIcon,
  CalendarIcon,
  ListIcon,
  SettingsIcon,
} from '../ui/Icons';
import { ProjectOverviewHeaderAtmosphere } from '../common/HeaderAtmosphereArt';
import { ApplicationCategoryIcon } from '../common/ApplicationCategoryIcon';
import { isLikelyImageUrl } from '../ui/ProjectAvatar';

interface ProjectWorkspaceHeaderProps {
  project: Project;
  currentTab: 'overview' | 'board' | 'activity' | 'files' | 'notes' | 'members' | 'settings' | 'calendar' | 'list';
  onOpenCreateWorkModal?: () => void;
  onOpenSettingsModal?: () => void;
  showHeroCard?: boolean;
}

export const ProjectWorkspaceHeader: React.FC<ProjectWorkspaceHeaderProps> = ({
  project,
  currentTab,
  onOpenCreateWorkModal,
  onOpenSettingsModal,
  showHeroCard,
}) => {
  const monogram = project.name ? project.name.trim()[0].toUpperCase() : 'P';
  const roleLabel = project.userRole === 'PROJECT_ADMIN' ? 'Admin' : 'Member';
  const memberCount = project.memberCount || (project.members ? project.members.length : 1);

  const [heroImgError, setHeroImgError] = React.useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = React.useState(false);
  const avatarUrl = (project.avatarUrl || '').trim();
  const isImg = !heroImgError && Boolean(avatarUrl && isLikelyImageUrl(avatarUrl));
  const isEmojiOrPreset = !heroImgError && !isImg && avatarUrl.length > 0 && avatarUrl.length <= 8;
  const shouldRenderHero = showHeroCard !== false;

  return (
    <div className="project-workspace-header-container">
      {/* Top Back Navigation Link */}
      <div className="po-top-nav-bar">
        <Link to="/app/dashboard" className="po-back-to-projects-link">
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
            <div className="project-hero-title-row">
              <h1 className="project-hero-title">{project.name}</h1>
              <span className={`project-hero-status-pill status-${project.status?.toLowerCase() || 'active'}`}>
                {project.status || 'ACTIVE'}
              </span>
              <span className="project-hero-role-pill">{roleLabel}</span>
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
          <div className="po-more-menu-container">
            <button
              type="button"
              className="po-more-btn"
              onClick={() => setMoreMenuOpen((prev) => !prev)}
            >
              <span>••• More</span>
              <span className="po-caret-down">▾</span>
            </button>

            {moreMenuOpen && (
              <div className="po-more-dropdown-menu">
                {onOpenSettingsModal && (
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
                <Link
                  to={`/app/projects/${project.id}/members`}
                  className="po-more-dropdown-item"
                  onClick={() => setMoreMenuOpen(false)}
                >
                  <UsersIcon size={14} />
                  <span>Team Members</span>
                </Link>
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
            <span>Create Work Item</span>
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
          to={`/app/projects/${project.id}/activity`}
          className={`project-tab-btn ${currentTab === 'activity' || currentTab === 'list' ? 'active' : ''}`}
          role="tab"
          aria-selected={currentTab === 'activity' || currentTab === 'list'}
        >
          <ListIcon size={15} />
          <span>List</span>
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
      </div>
    </div>
  );
};


