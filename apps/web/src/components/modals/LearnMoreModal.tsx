import React, { useState } from 'react';
import { useRouter } from '../../router/Router';
import {
  CloseIcon,
  LayersIcon,
  CheckSquareIcon,
  FileTextIcon,
  CalendarIcon,
  FolderIcon,
  PlusIcon,
  ArrowRightIcon,
  UsersIcon,
  HelpCircleIcon,
  RocketIcon,
  CheckIcon,
  ZapIcon,
  GridIcon,
  MoveIcon,
  ListIcon,
  LockIcon,
  Edit3Icon,
  TagIcon,
  BellIcon,
  TargetIcon,
  FilterIcon,
  EyeIcon,
  LinkIcon,
} from '../ui/Icons';
import { WelcomeModalVisualArt } from '../common/HeaderAtmosphereArt';
import {
  ProjectsKanbanVisualMock,
  SmartNotesVisualMock,
  CalendarVisualMock,
  FilesStorageVisualMock,
} from './LearnMoreVisualMocks';



export interface LearnMoreModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export type TabType = 'overview' | 'projects' | 'notes' | 'calendar' | 'files';

export const TAB_ORDER: TabType[] = ['overview', 'projects', 'notes', 'calendar', 'files'];

export const LearnMoreModal: React.FC<LearnMoreModalProps> = ({ isOpen, onClose }) => {
  const { navigate } = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  if (!isOpen) return null;

  const handleAction = (path: string) => {
    onClose();
    navigate(path);
  };

  const handleGotIt = () => {
    onClose();
    navigate('/app/dashboard');
  };

  return (
    <div className="modal-backdrop learn-more-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-container learn-more-modal-container" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="learn-more-modal-header">
          <div className="learn-more-header-badge">
            <div className="learn-more-logo-box">
              <span className="learn-more-logo-d">D</span>
            </div>
            <div className="learn-more-header-text">
              <h2 className="learn-more-title">
                Welcome to D-Board <span className="learn-more-wave">👋</span>
              </h2>
              <p className="learn-more-subtitle">
                Your all-in-one workspace for software projects, team notes, and engineering momentum.
              </p>
            </div>
          </div>

          <div className="learn-more-header-right">
            <div className="learn-more-handwritten-quote">
              <span>Build together,</span>
              <span>go further.</span>
            </div>

            <button
              type="button"
              className="learn-more-close-btn"
              onClick={onClose}
              aria-label="Close modal"
            >
              <CloseIcon size={16} />
            </button>
          </div>
        </div>

        {/* Feature Navigation Tabs Bar */}
        <div className="learn-more-tabs-wrapper">
          <div className="learn-more-tabs-bar" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'overview'}
              className={`learn-tab-pill ${activeTab === 'overview' ? 'active' : ''}`}
              onClick={() => setActiveTab('overview')}
            >
              <LayersIcon size={15} />
              <span>Overview</span>
            </button>

            <span className="learn-tab-divider" aria-hidden="true" />

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'projects'}
              className={`learn-tab-pill ${activeTab === 'projects' ? 'active' : ''}`}
              onClick={() => setActiveTab('projects')}
            >
              <CheckSquareIcon size={15} />
              <span>Projects &amp; Boards</span>
            </button>

            <span className="learn-tab-divider" aria-hidden="true" />

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'notes'}
              className={`learn-tab-pill ${activeTab === 'notes' ? 'active' : ''}`}
              onClick={() => setActiveTab('notes')}
            >
              <FileTextIcon size={15} />
              <span>Smart Notes</span>
            </button>

            <span className="learn-tab-divider" aria-hidden="true" />

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'calendar'}
              className={`learn-tab-pill ${activeTab === 'calendar' ? 'active' : ''}`}
              onClick={() => setActiveTab('calendar')}
            >
              <CalendarIcon size={15} />
              <span>Calendar</span>
            </button>

            <span className="learn-tab-divider" aria-hidden="true" />

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'files'}
              className={`learn-tab-pill ${activeTab === 'files' ? 'active' : ''}`}
              onClick={() => setActiveTab('files')}
            >
              <FolderIcon size={15} />
              <span>Files &amp; Storage</span>
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="learn-more-body">
          {/* TAB 1: OVERVIEW (EXACT MATCH TO PIC 1) */}
          {activeTab === 'overview' && (
            <div className="learn-overview-grid">
              {/* Left Column: Badge, Heading, Paragraph, 2x2 Cards Grid */}
              <div className="learn-overview-main">
                <div className="learn-hero-badge">
                  <RocketIcon size={14} />
                  <span>Unified Workflow</span>
                </div>

                <h3 className="learn-overview-heading">
                  Everything your team needs<br className="heading-br" />
                  to build, document, and ship.
                </h3>

                <p className="learn-overview-sub">
                  D-Board bridges the gap between task management, developer notes, file sharing, and team collaboration into a cohesive, distraction-free environment.
                </p>

                <div className="learn-features-grid">
                  {/* Card 1: Projects & Kanban Boards */}
                  <div
                    className="learn-feature-card"
                    onClick={() => setActiveTab('projects')}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && setActiveTab('projects')}
                  >
                    <div className="feature-card-icon icon-projects">
                      <LayersIcon size={20} />
                    </div>
                    <div className="feature-card-content">
                      <div className="feature-card-title-row">
                        <h4>Projects &amp; Kanban Boards</h4>
                        <span className="feature-card-arrow">&gt;</span>
                      </div>
                      <p>Track issues, features, and bugs with drag-and-drop boards and custom priorities.</p>
                    </div>
                  </div>

                  {/* Card 2: Live Rich Notes */}
                  <div
                    className="learn-feature-card"
                    onClick={() => setActiveTab('notes')}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && setActiveTab('notes')}
                  >
                    <div className="feature-card-icon icon-notes">
                      <FileTextIcon size={20} />
                    </div>
                    <div className="feature-card-content">
                      <div className="feature-card-title-row">
                        <h4>Live Rich Notes</h4>
                        <span className="feature-card-arrow">→</span>
                      </div>
                      <p>Sticky notes, markdown formatting, private &apos;@username&apos; scoping, and &apos;@team&apos; sharing.</p>
                    </div>
                  </div>

                  {/* Card 3: Milestone Calendar */}
                  <div
                    className="learn-feature-card"
                    onClick={() => setActiveTab('calendar')}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && setActiveTab('calendar')}
                  >
                    <div className="feature-card-icon icon-calendar">
                      <CalendarIcon size={20} />
                    </div>
                    <div className="feature-card-content">
                      <div className="feature-card-title-row">
                        <h4>Milestone Calendar</h4>
                        <span className="feature-card-arrow">→</span>
                      </div>
                      <p>Visualize deadlines, release schedules, and important events all in one place.</p>
                    </div>
                  </div>

                  {/* Card 4: Files & Asset Management */}
                  <div
                    className="learn-feature-card"
                    onClick={() => setActiveTab('files')}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && setActiveTab('files')}
                  >
                    <div className="feature-card-icon icon-files">
                      <FolderIcon size={20} />
                    </div>
                    <div className="feature-card-content">
                      <div className="feature-card-title-row">
                        <h4>Files &amp; Asset Management</h4>
                        <span className="feature-card-arrow">→</span>
                      </div>
                      <p>Store, preview, and link files directly to tasks, notes, and discussions.</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Visual Art Illustration + 3 Benefits List */}
              <div className="learn-overview-side">
                <div className="overview-side-graphic-box">
                  <WelcomeModalVisualArt />
                </div>

                <div className="overview-benefits-list">
                  <div className="overview-benefit-row">
                    <div className="benefit-icon-circle icon-green">
                      <CheckIcon size={14} />
                    </div>
                    <div className="benefit-text">
                      <strong>Organize your work</strong>
                      <span>Create projects and track progress</span>
                    </div>
                  </div>

                  <div className="overview-benefit-row">
                    <div className="benefit-icon-circle icon-purple">
                      <UsersIcon size={14} />
                    </div>
                    <div className="benefit-text">
                      <strong>Collaborate with your team</strong>
                      <span>Share notes, assign tasks, and stay aligned</span>
                    </div>
                  </div>

                  <div className="overview-benefit-row">
                    <div className="benefit-icon-circle icon-blue">
                      <ZapIcon size={14} />
                    </div>
                    <div className="benefit-text">
                      <strong>Stay productive</strong>
                      <span>Focus on what matters, all in one place</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: PROJECTS & BOARDS (EXACT MATCH TO PIC 1) */}
          {activeTab === 'projects' && (
            <div className="learn-overview-grid">
              {/* Left Column: Badge, Title, Subtitle, 3 Features with squircles, 2 Action buttons */}
              <div className="learn-overview-main">
                <div className="learn-hero-badge">
                  <GridIcon size={14} />
                  <span>Build &amp; Track</span>
                </div>

                <h3 className="learn-overview-heading">
                  Projects &amp; Kanban Boards
                </h3>

                <p className="learn-overview-sub">
                  Structure your engineering cycles with clarity and velocity.
                </p>

                <div className="learn-features-vertical-list">
                  {/* Item 1: Mint Green Squircle with ListIcon */}
                  <div className="learn-feature-item-row">
                    <div className="learn-feature-squircle icon-green">
                      <ListIcon size={18} />
                    </div>
                    <div className="learn-feature-info">
                      <h4>Agile Work Items</h4>
                      <p>Create tasks, bugs, features, and milestones with rich markdown descriptions.</p>
                    </div>
                  </div>

                  {/* Item 2: Purple Squircle with MoveIcon */}
                  <div className="learn-feature-item-row">
                    <div className="learn-feature-squircle icon-purple">
                      <MoveIcon size={18} />
                    </div>
                    <div className="learn-feature-info">
                      <h4>Interactive Drag &amp; Drop</h4>
                      <p>Move items between To Do, In Progress, In Review, and Done.</p>
                    </div>
                  </div>

                  {/* Item 3: Peach / Orange Squircle with UsersIcon */}
                  <div className="learn-feature-item-row">
                    <div className="learn-feature-squircle icon-orange">
                      <UsersIcon size={18} />
                    </div>
                    <div className="learn-feature-info">
                      <h4>Team Collaboration</h4>
                      <p>Assign work items, set due dates, and track discussions with comments.</p>
                    </div>
                  </div>
                </div>

                <div className="learn-cta-buttons-row">
                  <button
                    type="button"
                    className="learn-btn-primary-dark-pill"
                    onClick={() => handleAction('/app/projects/create')}
                  >
                    <PlusIcon size={15} />
                    <span>Create New Project</span>
                  </button>

                  <button
                    type="button"
                    className="learn-btn-secondary-white-pill"
                    onClick={() => handleAction('/app/my-work')}
                  >
                    <span>Go to My Work</span>
                    <ArrowRightIcon size={14} />
                  </button>
                </div>
              </div>

              {/* Right Column: Visual Kanban Mock matching Pic 1 */}
              <div className="learn-overview-side">
                <ProjectsKanbanVisualMock />
              </div>
            </div>
          )}

          {/* TAB 3: SMART NOTES (EXACT MATCH TO PIC 1) */}
          {activeTab === 'notes' && (
            <div className="learn-overview-grid">
              {/* Left Column: Badge, Title, Subtitle, 3 Features with squircles, 1 Action button */}
              <div className="learn-overview-main">
                <div className="learn-hero-badge badge-purple">
                  <FileTextIcon size={14} />
                  <span>Capture &amp; Organize</span>
                </div>

                <h3 className="learn-overview-heading">
                  Smart Developer Notes
                </h3>

                <p className="learn-overview-sub">
                  Capture ideas, meeting notes, snippets, and architectural decisions &mdash; all in one place.
                </p>

                <div className="learn-features-vertical-list">
                  {/* Item 1: Mint Green Squircle with LockIcon */}
                  <div className="learn-feature-item-row">
                    <div className="learn-feature-squircle icon-green">
                      <LockIcon size={18} />
                    </div>
                    <div className="learn-feature-info">
                      <h4>Privacy &amp; Scope Control</h4>
                      <p>
                        Use <strong>@team</strong> for workspace-wide visibility, or<br />
                        <strong>@username</strong> for private teammate notes.
                      </p>
                    </div>
                  </div>

                  {/* Item 2: Purple Squircle with Edit3Icon */}
                  <div className="learn-feature-item-row">
                    <div className="learn-feature-squircle icon-purple">
                      <Edit3Icon size={18} />
                    </div>
                    <div className="learn-feature-info">
                      <h4>Rich Formatting &amp; Live Preview</h4>
                      <p>Bold, italics, numbered/bulleted lists, clickable links, and file attachments.</p>
                    </div>
                  </div>

                  {/* Item 3: Amber Squircle with TagIcon */}
                  <div className="learn-feature-item-row">
                    <div className="learn-feature-squircle icon-amber">
                      <TagIcon size={18} />
                    </div>
                    <div className="learn-feature-info">
                      <h4>Sticky Pinning &amp; Tag Filtering</h4>
                      <p>Pin vital notes to the top and organize with searchable #tags.</p>
                    </div>
                  </div>
                </div>

                <div className="learn-cta-buttons-row">
                  <button
                    type="button"
                    className="learn-btn-primary-dark-pill"
                    onClick={() => handleAction('/app/notes')}
                  >
                    <FileTextIcon size={15} />
                    <span>Open Notes Workspace</span>
                    <ArrowRightIcon size={14} />
                  </button>
                </div>
              </div>

              {/* Right Column: Visual Smart Notes Mock matching Pic 1 */}
              <div className="learn-overview-side">
                <SmartNotesVisualMock />
              </div>
            </div>
          )}

          {/* TAB 4: CALENDAR & MILESTONES (EXACT MATCH TO PIC 1) */}
          {activeTab === 'calendar' && (
            <div className="learn-overview-grid">
              {/* Left Column: Badge, Heading, Subtitle, 3 Features with squircles, 1 Action button */}
              <div className="learn-overview-main">
                <div className="learn-hero-badge badge-purple">
                  <CalendarIcon size={14} />
                  <span>Stay on Track</span>
                </div>

                <h3 className="learn-overview-heading">
                  Calendar &amp; Milestones
                </h3>

                <p className="learn-overview-sub">
                  Never miss a sprint deadline or deployment milestone.<br />
                  Keep your team aligned and ship on time.
                </p>

                <div className="learn-features-vertical-list">
                  {/* Item 1: Mint Green Squircle with TargetIcon */}
                  <div className="learn-feature-item-row">
                    <div className="learn-feature-squircle icon-green">
                      <TargetIcon size={18} />
                    </div>
                    <div className="learn-feature-info">
                      <h4>Project Milestones</h4>
                      <p>Track deadlines and schedules with monthly, weekly, and daily views.</p>
                    </div>
                  </div>

                  {/* Item 2: Purple Squircle with FilterIcon */}
                  <div className="learn-feature-item-row">
                    <div className="learn-feature-squircle icon-purple">
                      <FilterIcon size={18} />
                    </div>
                    <div className="learn-feature-info">
                      <h4>Unified Global &amp; Project Filters</h4>
                      <p>Filter events by specific projects or view all deadlines concurrently.</p>
                    </div>
                  </div>

                  {/* Item 3: Soft Blue Squircle with BellIcon */}
                  <div className="learn-feature-item-row">
                    <div className="learn-feature-squircle icon-blue">
                      <BellIcon size={18} />
                    </div>
                    <div className="learn-feature-info">
                      <h4>Stay Notified</h4>
                      <p>Get reminders for upcoming deadlines and important events.</p>
                    </div>
                  </div>
                </div>

                <div className="learn-cta-buttons-row">
                  <button
                    type="button"
                    className="learn-btn-primary-dark-pill"
                    onClick={() => handleAction('/app/calendar')}
                  >
                    <CalendarIcon size={15} />
                    <span>View Calendar</span>
                    <ArrowRightIcon size={14} />
                  </button>
                </div>
              </div>

              {/* Right Column: Visual Calendar Mock matching Pic 1 */}
              <div className="learn-overview-side">
                <CalendarVisualMock />
              </div>
            </div>
          )}


          {/* TAB 5: FILES & STORAGE (EXACT MATCH TO PIC 1) */}
          {activeTab === 'files' && (
            <div className="learn-overview-grid">
              {/* Left Column: Badge, Heading, Subtitle, 3 Features with squircles, 1 Action button */}
              <div className="learn-overview-main">
                <div className="learn-hero-badge badge-blue">
                  <FolderIcon size={14} />
                  <span>Store &bull; Share &bull; Collaborate</span>
                </div>

                <h3 className="learn-overview-heading">
                  Files &amp; Asset Management
                </h3>

                <p className="learn-overview-sub">
                  Centralized cloud storage for architecture diagrams, specs, and builds.
                </p>

                <div className="learn-features-vertical-list">
                  {/* Item 1: Mint Green Squircle with EyeIcon */}
                  <div className="learn-feature-item-row">
                    <div className="learn-feature-squircle icon-green">
                      <EyeIcon size={18} />
                    </div>
                    <div className="learn-feature-info">
                      <h4>Instant File Previews</h4>
                      <p>In-browser previews for PDFs, images, text files, and code snippets.</p>
                    </div>
                  </div>

                  {/* Item 2: Purple Squircle with LinkIcon */}
                  <div className="learn-feature-item-row">
                    <div className="learn-feature-squircle icon-purple">
                      <LinkIcon size={18} />
                    </div>
                    <div className="learn-feature-info">
                      <h4>Linked Attachments</h4>
                      <p>Link files across notes, tasks, and project workspace directories.</p>
                    </div>
                  </div>

                  {/* Item 3: Warm Amber Squircle with UsersIcon */}
                  <div className="learn-feature-item-row">
                    <div className="learn-feature-squircle icon-amber">
                      <UsersIcon size={18} />
                    </div>
                    <div className="learn-feature-info">
                      <h4>Organized &amp; Searchable</h4>
                      <p>Use folders, tags, and powerful search to find what you need instantly.</p>
                    </div>
                  </div>
                </div>

                <div className="learn-cta-buttons-row">
                  <button
                    type="button"
                    className="learn-btn-primary-dark-pill"
                    onClick={() => handleAction('/app/files')}
                  >
                    <FolderIcon size={15} />
                    <span>Explore Files</span>
                    <ArrowRightIcon size={14} />
                  </button>
                </div>
              </div>

              {/* Right Column: Visual Files Mock matching Pic 1 */}
              <div className="learn-overview-side">
                <FilesStorageVisualMock />
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="learn-more-modal-footer">
          {/* Left: Help text */}
          <div className="learn-footer-help">
            <div className="learn-help-circle">
              <HelpCircleIcon size={18} />
            </div>
            <div className="learn-footer-help-text">
              <span className="learn-footer-help-title">Need help?</span>
              <span className="learn-footer-help-sub">Explore your active projects or create a new workspace.</span>
            </div>
          </div>

          {/* Center: 5 Pagination Dots */}
          <div className="learn-footer-dots" role="tablist" aria-label="Modal tabs pagination">
            {TAB_ORDER.map((tab) => (
              <button
                key={tab}
                type="button"
                className={`learn-footer-dot ${activeTab === tab ? 'active' : ''}`}
                onClick={() => setActiveTab(tab)}
                aria-label={`Go to ${tab} tab`}
              />
            ))}
          </div>

          {/* Right: Black Pill Button "Got it, Let's Build! →" */}
          <button
            type="button"
            className="learn-footer-submit-btn"
            onClick={handleGotIt}
          >
            <span>Got it, Let&apos;s Build!</span>
            <ArrowRightIcon size={15} />
          </button>
        </div>
      </div>
    </div>
  );
};
