import React, { useState, useRef, useEffect } from 'react';
import type { Project, UpdateProjectInput } from '../../api/projects.api';
import { projectsApi } from '../../api/projects.api';
import { ProjectAvatar } from '../ui/ProjectAvatar';
import { ApplicationCategoryIcon } from '../common/ApplicationCategoryIcon';
import {
  SettingsIcon,
  CloseIcon,
  TrashIcon,
  CheckIcon,
  PlusIcon,
  CalendarIcon,
  FileTextIcon,
  LayersIcon,
  AlertCircleIcon,
} from '../ui/Icons';

interface ProjectSettingsModalProps {
  project: Project;
  isOpen: boolean;
  onClose: () => void;
  onUpdated: (updatedProject: Project) => void;
  onDeleted?: () => void;
}

type TabKey = 'general' | 'branding' | 'tech' | 'danger';

const CATEGORY_OPTIONS = [
  'Web Application',
  'Mobile Application',
  'API / Backend',
  'Desktop Software',
  'UI/UX Design System',
  'AI / Machine Learning',
  'DevOps & Infrastructure',
  'Open Source Library',
  'Other',
];

const SUGGESTED_TECH = [
  'React',
  'TypeScript',
  'Node.js',
  'PostgreSQL',
  'TailwindCSS',
  'Docker',
  'Python',
  'Next.js',
  'Prisma',
  'GraphQL',
  'Go',
  'Redis',
  'AWS',
  'MongoDB',
];

/**
 * Illustrated header atmosphere art matching the reference design:
 * Slider panel, yellow cog wheel, pine trees, rolling green landscape
 */
const ProjectSettingsHeaderArt: React.FC = () => (
  <div className="psm-art-wrapper" aria-hidden="true">
    <svg
      width="175"
      height="75"
      viewBox="0 0 175 75"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="psm-header-svg-art"
    >
      {/* Soft rolling green hills in background */}
      <ellipse cx="140" cy="78" rx="80" ry="34" fill="#DCFCE7" />
      <ellipse cx="50" cy="80" rx="70" ry="32" fill="#E8F9EE" />

      {/* Yellow/Orange Cog Wheel on left */}
      <g transform="translate(10, 26)">
        <circle cx="15" cy="15" r="9.5" fill="#FBBF24" />
        <circle cx="15" cy="15" r="4.2" fill="#FEF3C7" />
        <rect x="13.5" y="1" width="3" height="5" rx="1.5" fill="#F59E0B" />
        <rect x="13.5" y="24" width="3" height="5" rx="1.5" fill="#F59E0B" />
        <rect x="1" y="13.5" width="5" height="3" rx="1.5" fill="#F59E0B" />
        <rect x="24" y="13.5" width="5" height="3" rx="1.5" fill="#F59E0B" />
        <rect x="4.5" y="4.5" width="4" height="3" rx="1" transform="rotate(45 4.5 4.5)" fill="#F59E0B" />
        <rect x="21" y="21" width="4" height="3" rx="1" transform="rotate(45 21 21)" fill="#F59E0B" />
        <rect x="4.5" y="22.5" width="4" height="3" rx="1" transform="rotate(-45 4.5 22.5)" fill="#F59E0B" />
        <rect x="21" y="6" width="4" height="3" rx="1" transform="rotate(-45 21 6)" fill="#F59E0B" />
      </g>

      {/* White window panel card with sliders in center */}
      <g transform="translate(42, 10)">
        <rect
          width="80"
          height="50"
          rx="7"
          fill="#FFFFFF"
          stroke="#E2E8F0"
          strokeWidth="1"
          filter="drop-shadow(0 2px 6px rgba(0,0,0,0.06))"
        />
        {/* Top title bar */}
        <rect width="80" height="11" rx="7" fill="#F8FAFC" />
        <circle cx="8" cy="5.5" r="1.75" fill="#CBD5E1" />
        <circle cx="13" cy="5.5" r="1.75" fill="#CBD5E1" />
        <circle cx="18" cy="5.5" r="1.75" fill="#CBD5E1" />

        {/* Top Slider */}
        <line x1="12" y1="24" x2="68" y2="24" stroke="#E2E8F0" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="12" y1="24" x2="50" y2="24" stroke="#38BDF8" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="50" cy="24" r="4" fill="#FFFFFF" stroke="#38BDF8" strokeWidth="2.5" />

        {/* Bottom Slider */}
        <line x1="12" y1="38" x2="68" y2="38" stroke="#E2E8F0" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="12" y1="38" x2="32" y2="38" stroke="#38BDF8" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="32" cy="38" r="4" fill="#FFFFFF" stroke="#38BDF8" strokeWidth="2.5" />
      </g>

      {/* Trees on the right */}
      <g transform="translate(132, 14)">
        {/* Tall green tree */}
        <ellipse cx="14" cy="28" rx="8" ry="17" fill="#10B981" />
        <rect x="12.5" y="44" width="3" height="12" rx="1.5" fill="#92400E" />

        {/* Small green pine */}
        <ellipse cx="28" cy="34" rx="5.5" ry="11" fill="#059669" />
        <rect x="27" y="44" width="2" height="11" rx="1" fill="#92400E" />
      </g>

      {/* Sparkles / Sun dots */}
      <path d="M34 6L35 9L38 10L35 11L34 14L33 11L30 10L33 9Z" fill="#FCD34D" />
      <circle cx="142" cy="6" r="1.5" fill="#FBBF24" />
    </svg>
  </div>
);

export const ProjectSettingsModal: React.FC<ProjectSettingsModalProps> = ({
  project,
  isOpen,
  onClose,
  onUpdated,
  onDeleted,
}) => {
  const [activeTab, setActiveTab] = useState<TabKey>('general');

  // Form states
  const [name, setName] = useState(project.name || '');
  const [key, setKey] = useState(project.key || '');
  const [category, setCategory] = useState(project.category || 'Web Application');
  const [description, setDescription] = useState(project.description || '');
  const [avatarUrl, setAvatarUrl] = useState(project.avatarUrl || '');
  const [technologyStack, setTechnologyStack] = useState<string[]>(project.technologyStack || []);
  const [newTechInput, setNewTechInput] = useState('');
  const [repositoryUrl, setRepositoryUrl] = useState(project.repositoryUrl || '');
  const [liveUrl, setLiveUrl] = useState(project.liveUrl || '');
  const [startDate, setStartDate] = useState(
    project.startDate ? project.startDate.split('T')[0] : ''
  );
  const [endDate, setEndDate] = useState(
    project.endDate ? project.endDate.split('T')[0] : ''
  );

  // Status & loading states
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteInputName, setDeleteInputName] = useState('');

  // Category custom dropdown state
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const categoryDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(e.target as Node)) {
        setIsCategoryOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!isOpen) return null;

  const projectInitial = (name.trim()[0] || 'P').toUpperCase();

  const handleAddTech = (techToAdd?: string) => {
    const tech = (techToAdd || newTechInput).trim();
    if (!tech) return;
    if (!technologyStack.includes(tech)) {
      setTechnologyStack([...technologyStack, tech]);
    }
    setNewTechInput('');
  };

  const handleRemoveTech = (techToRemove: string) => {
    setTechnologyStack(technologyStack.filter((t) => t !== techToRemove));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2.5 * 1024 * 1024) {
      setError('Logo image must be under 2.5MB');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        setAvatarUrl(reader.result);
        setError(null);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Project name is required');
      setActiveTab('general');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const payload: Partial<UpdateProjectInput> = {
        name: name.trim(),
        key: key.trim() ? key.trim().toUpperCase() : null,
        category: category.trim() || null,
        description: description.trim(),
        avatarUrl: avatarUrl.trim() || null,
        technologyStack,
        repositoryUrl: repositoryUrl.trim() || null,
        liveUrl: liveUrl.trim() || null,
        startDate: startDate ? new Date(startDate).toISOString() : null,
        endDate: endDate ? new Date(endDate).toISOString() : null,
      };

      const res = await projectsApi.updateProject(project.id, payload);
      if (res.success && res.data.project) {
        onUpdated(res.data.project);
        onClose();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to update project settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteProject = async () => {
    if (deleteInputName.trim() !== project.name.trim()) {
      setError('Confirmation project name does not match');
      return;
    }

    setIsDeleting(true);
    setError(null);

    try {
      const res = await projectsApi.deleteProject(project.id);
      if (res.success) {
        if (onDeleted) {
          onDeleted();
        } else {
          window.location.href = '/app/dashboard';
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to delete project');
      setIsDeleting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="modal-container psm-luxury-container"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header Banner with illustrated artwork */}
        <div className="psm-header-hero-banner">
          <div className="psm-header-hero-content">
            <div className="psm-header-icon-box">
              <SettingsIcon size={22} className="psm-settings-icon" />
            </div>
            <div className="psm-header-text-block">
              <h2 className="psm-title">Project Settings</h2>
              <p className="psm-subtitle">
                Configure details, branding, links, and workspace preferences for {project.name}.
              </p>
            </div>
          </div>

          {/* Right Header Illustration */}
          <ProjectSettingsHeaderArt />

          {/* Circular close button in top-right */}
          <button
            type="button"
            className="psm-circular-close-btn"
            onClick={onClose}
            aria-label="Close settings"
          >
            <CloseIcon size={16} />
          </button>
        </div>

        {/* Tab Navigation Bar */}
        <div className="psm-tabs-nav-bar">
          <button
            type="button"
            className={`psm-nav-pill ${activeTab === 'general' ? 'active' : ''}`}
            onClick={() => setActiveTab('general')}
          >
            <FileTextIcon size={15} />
            <span>General</span>
          </button>

          <button
            type="button"
            className={`psm-nav-pill ${activeTab === 'branding' ? 'active' : ''}`}
            onClick={() => setActiveTab('branding')}
          >
            <span style={{ fontSize: '0.85rem' }}>🎨</span>
            <span>Logo & Branding</span>
          </button>

          <button
            type="button"
            className={`psm-nav-pill ${activeTab === 'tech' ? 'active' : ''}`}
            onClick={() => setActiveTab('tech')}
          >
            <LayersIcon size={15} />
            <span>Links & Tech Stack</span>
          </button>

          <button
            type="button"
            className={`psm-nav-pill psm-nav-danger ${activeTab === 'danger' ? 'active' : ''}`}
            onClick={() => setActiveTab('danger')}
          >
            <TrashIcon size={15} />
            <span>Delete Project</span>
          </button>
        </div>

        {error && (
          <div className="form-error-banner" style={{ margin: '0.75rem 1.75rem 0 1.75rem' }}>
            <AlertCircleIcon size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSave} className="psm-body-form">
          {/* TAB 1: GENERAL */}
          {activeTab === 'general' && (
            <div className="psm-tab-content">
              <div className="psm-grid-2col">
                {/* Project Name */}
                <div className="psm-form-group">
                  <label htmlFor="psm-project-name" className="psm-field-label">
                    Project Name *
                  </label>
                  <div className="psm-input-with-badge">
                    <div className="psm-field-badge">
                      <span>{projectInitial}</span>
                    </div>
                    <input
                      id="psm-project-name"
                      type="text"
                      className="psm-bare-input"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Acme Web Platform"
                      required
                    />
                  </div>
                  <span className="psm-field-helper">The primary name for your workspace.</span>
                </div>

                {/* Project Key */}
                <div className="psm-form-group">
                  <label htmlFor="psm-project-key" className="psm-field-label">
                    Project Key
                  </label>
                  <div className="psm-input-with-badge">
                    <div className="psm-field-badge">
                      <span>#</span>
                    </div>
                    <input
                      id="psm-project-key"
                      type="text"
                      className="psm-bare-input"
                      value={key}
                      maxLength={10}
                      onChange={(e) => setKey(e.target.value.toUpperCase())}
                      placeholder="e.g. ACM"
                    />
                  </div>
                  <span className="psm-field-helper">
                    Prefix for work item identifiers (e.g. ACM-12).
                  </span>
                </div>
              </div>

              {/* Category Dropdown */}
              <div className="psm-form-group">
                <label className="psm-field-label">Category</label>
                <div className="psm-custom-dropdown-container" ref={categoryDropdownRef}>
                  <button
                    type="button"
                    className="psm-category-dropdown-trigger"
                    onClick={() => setIsCategoryOpen((prev) => !prev)}
                    aria-haspopup="listbox"
                    aria-expanded={isCategoryOpen}
                  >
                    <div className="psm-dropdown-left-box">
                      <div className="psm-field-badge">
                        <ApplicationCategoryIcon category={category} size={15} />
                      </div>
                      <span className="psm-dropdown-value-text">{category}</span>
                    </div>
                    <span className={`psm-chevron-icon ${isCategoryOpen ? 'open' : ''}`}>▾</span>
                  </button>

                  {isCategoryOpen && (
                    <div className="psm-custom-dropdown-menu" role="listbox">
                      {CATEGORY_OPTIONS.map((cat) => {
                        const isSelected = category === cat;
                        return (
                          <button
                            key={cat}
                            type="button"
                            className={`psm-dropdown-option ${isSelected ? 'selected' : ''}`}
                            onClick={() => {
                              setCategory(cat);
                              setIsCategoryOpen(false);
                            }}
                            role="option"
                            aria-selected={isSelected}
                          >
                            <div className="psm-option-icon-box">
                              <ApplicationCategoryIcon category={cat} size={15} />
                            </div>
                            <span className="psm-option-label">{cat}</span>
                            {isSelected && (
                              <span className="psm-option-check">
                                <CheckIcon size={14} />
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
                <span className="psm-field-helper">Categorizes your project across the organization.</span>
              </div>

              {/* Description */}
              <div className="psm-form-group">
                <label htmlFor="psm-project-desc" className="psm-field-label">
                  Description
                </label>
                <div className="psm-textarea-with-badge">
                  <div className="psm-field-badge" style={{ alignSelf: 'flex-start' }}>
                    <FileTextIcon size={15} />
                  </div>
                  <textarea
                    id="psm-project-desc"
                    className="psm-bare-textarea"
                    rows={4}
                    maxLength={1000}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Outline the core vision, architecture, and goals of this project..."
                  />
                </div>
                <div className="psm-counter-row">
                  <span className="psm-field-helper">Supports concise markdown or plain text.</span>
                  <span className="psm-char-counter">{description.length}/1000</span>
                </div>
              </div>

              {/* Dates */}
              <div className="psm-grid-2col">
                <div className="psm-form-group">
                  <label htmlFor="psm-start-date" className="psm-field-label">
                    Start Date
                  </label>
                  <div className="psm-input-with-badge psm-date-box">
                    <div className="psm-field-badge">
                      <CalendarIcon size={15} />
                    </div>
                    <input
                      id="psm-start-date"
                      type="date"
                      className="psm-bare-date-input"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </div>
                </div>

                <div className="psm-form-group">
                  <label htmlFor="psm-end-date" className="psm-field-label">
                    Target End Date
                  </label>
                  <div className="psm-input-with-badge psm-date-box">
                    <div className="psm-field-badge">
                      <CalendarIcon size={15} />
                    </div>
                    <input
                      id="psm-end-date"
                      type="date"
                      className="psm-bare-date-input"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: BRANDING & LOGO - ONLY UPLOAD LOGO */}
          {activeTab === 'branding' && (
            <div className="psm-tab-content">
              <div className="psm-logo-upload-card">
                <div className="psm-logo-preview-box">
                  <ProjectAvatar
                    project={{ name, avatarUrl }}
                    size="lg"
                    style={{ width: '80px', height: '80px', borderRadius: '18px', fontSize: '2rem' }}
                  />
                </div>

                <div className="psm-logo-upload-content">
                  <h4 className="psm-avatar-title">{name || 'Project'} Logo</h4>
                  <p className="psm-avatar-subtitle">
                    Upload an image file to represent your project across the workspace, project cards, and team listings.
                  </p>

                  <div className="psm-avatar-actions-row">
                    <label className="psm-upload-file-btn">
                      <span>Upload Logo</span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/svg+xml"
                        style={{ display: 'none' }}
                        onChange={handleFileUpload}
                      />
                    </label>

                    {avatarUrl && (
                      <button
                        type="button"
                        className="psm-clear-logo-btn"
                        onClick={() => setAvatarUrl('')}
                      >
                        Remove Logo
                      </button>
                    )}
                  </div>

                  <span className="psm-field-helper" style={{ marginTop: '0.65rem' }}>
                    Recommended: Square PNG, SVG, or JPG (max 2.5MB).
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: LINKS & TECH STACK */}
          {activeTab === 'tech' && (
            <div className="psm-tab-content">
              <div className="psm-grid-2col">
                <div className="psm-form-group">
                  <label htmlFor="psm-repo-url" className="psm-field-label">
                    Repository URL
                  </label>
                  <div className="psm-input-with-badge">
                    <div className="psm-field-badge">
                      <span>Git</span>
                    </div>
                    <input
                      id="psm-repo-url"
                      type="url"
                      className="psm-bare-input"
                      value={repositoryUrl}
                      onChange={(e) => setRepositoryUrl(e.target.value)}
                      placeholder="https://github.com/org/repo"
                    />
                  </div>
                </div>

                <div className="psm-form-group">
                  <label htmlFor="psm-live-url" className="psm-field-label">
                    Live Application URL
                  </label>
                  <div className="psm-input-with-badge">
                    <div className="psm-field-badge">
                      <span>URL</span>
                    </div>
                    <input
                      id="psm-live-url"
                      type="url"
                      className="psm-bare-input"
                      value={liveUrl}
                      onChange={(e) => setLiveUrl(e.target.value)}
                      placeholder="https://myproject.app"
                    />
                  </div>
                </div>
              </div>

              <div className="psm-form-group">
                <label className="psm-field-label">Technology Stack</label>
                <div className="psm-tech-chips-box">
                  {technologyStack.map((tech) => (
                    <span key={tech} className="psm-tech-tag">
                      <span>{tech}</span>
                      <button
                        type="button"
                        className="psm-tech-remove-btn"
                        onClick={() => handleRemoveTech(tech)}
                        aria-label={`Remove ${tech}`}
                      >
                        <CloseIcon size={12} />
                      </button>
                    </span>
                  ))}
                  <div className="psm-tech-add-inline">
                    <input
                      type="text"
                      className="psm-tech-add-input"
                      value={newTechInput}
                      onChange={(e) => setNewTechInput(e.target.value)}
                      placeholder="Add tech..."
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddTech();
                        }
                      }}
                    />
                    <button
                      type="button"
                      className="psm-tech-add-btn"
                      onClick={() => handleAddTech()}
                    >
                      <PlusIcon size={14} />
                    </button>
                  </div>
                </div>
                <span className="psm-field-helper">Technologies and frameworks powering this project.</span>
              </div>

              <div className="psm-form-group">
                <label className="psm-field-label" style={{ fontSize: '0.8125rem' }}>
                  Quick Add Suggestions
                </label>
                <div className="psm-suggested-chips-row">
                  {SUGGESTED_TECH.filter((t) => !technologyStack.includes(t)).map((tech) => (
                    <button
                      key={tech}
                      type="button"
                      className="psm-suggestion-chip"
                      onClick={() => handleAddTech(tech)}
                    >
                      + {tech}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: DELETE PROJECT (Renamed from Danger Zone) */}
          {activeTab === 'danger' && (
            <div className="psm-tab-content">
              <div className="psm-danger-box">
                <div className="psm-danger-head">
                  <div className="psm-danger-icon-badge">
                    <TrashIcon size={18} />
                  </div>
                  <div>
                    <h4 className="psm-danger-title">Delete this Project</h4>
                    <p className="psm-danger-desc">
                      Once deleted, all work items, tasks, sprints, calendar events, notes, and
                      uploaded files belonging to <strong>{project.name}</strong> will be permanently deleted.
                      This action cannot be undone.
                    </p>
                  </div>
                </div>

                {!deleteConfirmOpen ? (
                  <button
                    type="button"
                    className="psm-danger-delete-trigger-btn"
                    onClick={() => setDeleteConfirmOpen(true)}
                  >
                    <TrashIcon size={14} />
                    <span>Delete Project...</span>
                  </button>
                ) : (
                  <div className="psm-delete-confirm-pane">
                    <p className="psm-confirm-prompt">
                      Please type <strong>{project.name}</strong> to confirm deletion:
                    </p>
                    <input
                      type="text"
                      className="psm-delete-verify-input"
                      placeholder={project.name}
                      value={deleteInputName}
                      onChange={(e) => setDeleteInputName(e.target.value)}
                    />
                    <div className="psm-delete-confirm-actions">
                      <button
                        type="button"
                        className="psm-delete-cancel-btn"
                        onClick={() => {
                          setDeleteConfirmOpen(false);
                          setDeleteInputName('');
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="psm-delete-confirm-btn"
                        disabled={deleteInputName.trim() !== project.name.trim() || isDeleting}
                        onClick={handleDeleteProject}
                      >
                        <TrashIcon size={14} />
                        <span>{isDeleting ? 'Deleting...' : 'I understand, delete this project'}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Footer Actions */}
          {activeTab !== 'danger' && (
            <div className="psm-footer-row">
              <button
                type="button"
                className="psm-footer-cancel-btn"
                onClick={onClose}
                disabled={isSaving}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="psm-footer-save-btn"
                disabled={isSaving}
              >
                <FileTextIcon size={15} />
                <span>{isSaving ? 'Saving Changes...' : 'Save Changes'}</span>
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};
export default ProjectSettingsModal;
