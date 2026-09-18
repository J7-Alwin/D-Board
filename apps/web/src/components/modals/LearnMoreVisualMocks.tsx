import React from 'react';

// Hand-drawn arrow pointing down-left toward dragged card
export const HandDrawnArrow: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg
    width="52"
    height="42"
    viewBox="0 0 52 42"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`wm-handdrawn-arrow ${className}`}
    aria-hidden="true"
  >
    <path
      d="M 44 4 C 32 10, 16 16, 12 34"
      stroke="#2563EB"
      strokeWidth="2.2"
      strokeLinecap="round"
      fill="none"
    />
    <path
      d="M 6 27 L 11 36 L 20 31"
      stroke="#2563EB"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  </svg>
);

// Hand-drawn underline under "Ship together."
export const HandDrawnUnderline: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg
    width="74"
    height="10"
    viewBox="0 0 74 10"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`wm-handdrawn-underline ${className}`}
    aria-hidden="true"
  >
    <path
      d="M 3 7 C 24 2, 52 2, 71 6"
      stroke="#2563EB"
      strokeWidth="2.2"
      strokeLinecap="round"
      fill="none"
    />
  </svg>
);

// Grabbing Hand Cursor icon
export const GrabbingHandCursor: React.FC = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="wm-grabbing-hand"
    aria-hidden="true"
  >
    <path
      d="M18 11V6a2 2 0 0 0-2-2 2 2 0 0 0-2 2v3M14 10V4a2 2 0 0 0-2-2 2 2 0 0 0-2 2v6M10 10.5V6a2 2 0 0 0-2-2 2 2 0 0 0-2 2v8a5 5 0 0 0 5 5h3a5 5 0 0 0 5-5v-4.5a2 2 0 0 0-2-2 2 2 0 0 0-2 2"
      stroke="#0F172A"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="#FFFFFF"
    />
  </svg>
);

// Tab 2: Projects & Kanban Boards Visual Mock (Matching Screenshot)
export const ProjectsKanbanVisualMock: React.FC = () => {
  return (
    <div className="wm-visual-column-container">
      {/* Pastel Atmospheric Organic Aura */}
      <div className="wm-organic-aura aura-kanban" aria-hidden="true" />

      {/* Top Right Handwritten Annotation & Arrow */}
      <div className="wm-handwritten-annotation-box">
        <HandDrawnArrow />
        <div className="wm-annotation-text">
          <span>Drag.</span>
          <span>Drop.</span>
          <span>Get things done.</span>
        </div>
      </div>

      {/* Main Kanban Board Card */}
      <div className="wm-board-mock-card">
        {/* Board Header */}
        <div className="wm-board-card-header">
          <div className="wm-board-title-group">
            <div className="wm-board-icon-squircle">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
                <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
              </svg>
            </div>
            <span className="wm-board-title-text">Product Launch</span>
          </div>

          <div className="wm-board-header-right">
            {/* Team Avatars Cluster */}
            <div className="wm-avatars-cluster">
              <div className="wm-mini-avatar av-1">
                <img
                  src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=64&h=64&fit=crop&crop=faces"
                  alt="Team member"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </div>
              <div className="wm-mini-avatar av-2">
                <img
                  src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=64&h=64&fit=crop&crop=faces"
                  alt="Team member"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </div>
              <div className="wm-mini-avatar av-3">
                <img
                  src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=64&h=64&fit=crop&crop=faces"
                  alt="Team member"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </div>
              <div className="wm-mini-avatar av-more">
                <span>+4</span>
              </div>
            </div>

            <button type="button" className="wm-board-dots-btn" aria-label="Board options">
              •••
            </button>
          </div>
        </div>

        {/* 3 Kanban Columns */}
        <div className="wm-board-columns-row">
          {/* Column 1: To Do */}
          <div className="wm-board-col">
            <div className="wm-col-header">
              <span className="wm-col-dot dot-blue" />
              <span className="wm-col-name">To Do</span>
              <span className="wm-col-count">3</span>
            </div>

            <div className="wm-cards-stack">
              {/* Card 1 with badges */}
              <div className="wm-mini-card">
                <div className="wm-card-top-row">
                  <div className="wm-card-thumb thumb-blue" />
                  <div className="wm-card-skeleton-lines">
                    <span className="wm-skel-line w-long" />
                    <span className="wm-skel-line w-med" />
                  </div>
                </div>
                <div className="wm-card-meta-row">
                  <span className="wm-meta-chip">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                    2
                  </span>
                  <span className="wm-meta-chip">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                      <line x1="16" y1="2" x2="16" y2="6" />
                      <line x1="8" y1="2" x2="8" y2="6" />
                      <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                    Sep 12
                  </span>
                </div>
              </div>

              {/* Card 2 */}
              <div className="wm-mini-card">
                <div className="wm-card-top-row">
                  <div className="wm-card-thumb thumb-purple" />
                  <div className="wm-card-skeleton-lines">
                    <span className="wm-skel-line w-long" />
                    <span className="wm-skel-line w-short" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Column 2: In Progress (with Dragging Card & Hand) */}
          <div className="wm-board-col">
            <div className="wm-col-header">
              <span className="wm-col-dot dot-yellow" />
              <span className="wm-col-name">In Progress</span>
              <span className="wm-col-count">2</span>
            </div>

            <div className="wm-cards-stack in-progress-stack">
              {/* Dashed Target Placeholder */}
              <div className="wm-drop-target-dashed" />

              {/* Active Dragged Card with Grabbing Hand */}
              <div className="wm-dragged-card">
                <div className="wm-card-top-row">
                  <div className="wm-card-thumb thumb-solid-blue" />
                  <div className="wm-card-skeleton-lines">
                    <span className="wm-skel-line w-med" />
                    <span className="wm-skel-line w-short" />
                  </div>
                </div>
                <div className="wm-card-hand-wrapper">
                  <GrabbingHandCursor />
                </div>
              </div>
            </div>
          </div>

          {/* Column 3: Done */}
          <div className="wm-board-col">
            <div className="wm-col-header">
              <span className="wm-col-dot dot-green" />
              <span className="wm-col-name">Done</span>
              <span className="wm-col-count">4</span>
            </div>

            <div className="wm-cards-stack">
              <div className="wm-mini-card">
                <div className="wm-card-top-row">
                  <div className="wm-card-thumb thumb-blue" />
                  <div className="wm-card-skeleton-lines">
                    <span className="wm-skel-line w-long" />
                    <span className="wm-skel-line w-short" />
                  </div>
                </div>
              </div>

              <div className="wm-mini-card">
                <div className="wm-card-top-row">
                  <div className="wm-card-thumb thumb-amber" />
                  <div className="wm-card-skeleton-lines">
                    <span className="wm-skel-line w-long" />
                    <span className="wm-skel-line w-med" />
                  </div>
                </div>
              </div>

              <div className="wm-mini-card">
                <div className="wm-card-top-row">
                  <div className="wm-card-thumb thumb-green" />
                  <div className="wm-card-skeleton-lines">
                    <span className="wm-skel-line w-med" />
                    <span className="wm-skel-line w-short" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Quote Pill */}
      <div className="wm-quote-pill-badge">
        <span className="wm-quote-bubble-icon">❝</span>
        <span className="wm-quote-pill-text">"Organized teams build amazing things."</span>
      </div>
    </div>
  );
};

// Tab 1: Overview Visual Mock
export const OverviewVisualMock: React.FC = () => {
  return (
    <div className="wm-visual-column-container">
      <div className="wm-organic-aura aura-overview" aria-hidden="true" />

      <div className="wm-handwritten-annotation-box">
        <div className="wm-annotation-text">
          <span>Plan.</span>
          <span>Track.</span>
          <span>Ship together.</span>
        </div>
        <HandDrawnArrow />
      </div>

      <div className="wm-board-mock-card">
        <div className="wm-board-card-header">
          <div className="wm-board-title-group">
            <div className="wm-board-icon-squircle icon-blue">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.4">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
            </div>
            <span className="wm-board-title-text">Sprint Momentum</span>
          </div>

          <span className="wm-status-badge-ontrack">● On Track</span>
        </div>

        {/* 3 Metric Pills */}
        <div className="wm-overview-metrics-grid">
          <div className="wm-ov-metric-cell">
            <span className="wm-ov-metric-num">24</span>
            <span className="wm-ov-metric-label">Work Items</span>
          </div>
          <div className="wm-ov-metric-cell">
            <span className="wm-ov-metric-num text-amber">8</span>
            <span className="wm-ov-metric-label">In Progress</span>
          </div>
          <div className="wm-ov-metric-cell">
            <span className="wm-ov-metric-num text-green">16</span>
            <span className="wm-ov-metric-label">Completed</span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="wm-ov-progress-bar-wrap">
          <div className="wm-ov-progress-header">
            <span>Sprint Goal Velocity</span>
            <strong>67%</strong>
          </div>
          <div className="wm-ov-progress-track">
            <div className="wm-ov-progress-fill" style={{ width: '67%' }} />
          </div>
        </div>

        {/* Recent Work Preview Row */}
        <div className="wm-ov-recent-preview">
          <span className="wm-ov-tag-bug">BUG</span>
          <span className="wm-ov-recent-title">Fix responsive navigation menu</span>
          <span className="wm-ov-status-pill">✓ Done</span>
        </div>
      </div>

      <div className="wm-quote-pill-badge">
        <span className="wm-quote-bubble-icon">❝</span>
        <span className="wm-quote-pill-text">"The secret to shipping is staying in sync."</span>
      </div>
    </div>
  );
};

// Purple burst rays above pinned sticky note
export const PurpleBurstSparkle: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`wm-purple-sparkle ${className}`}
    aria-hidden="true"
  >
    <path d="M12 2V8" stroke="#9333EA" strokeWidth="2" strokeLinecap="round" />
    <path d="M4.93 4.93L9.17 9.17" stroke="#9333EA" strokeWidth="2" strokeLinecap="round" />
    <path d="M19.07 4.93L14.83 9.17" stroke="#9333EA" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

// Hand-drawn arrow curving up-right toward sticky note
export const CurvedUpArrow: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg
    width="48"
    height="36"
    viewBox="0 0 48 36"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`wm-curved-up-arrow ${className}`}
    aria-hidden="true"
  >
    <path
      d="M6 30 C 18 34, 34 26, 42 10"
      stroke="#2563EB"
      strokeWidth="2.2"
      strokeLinecap="round"
      fill="none"
    />
    <path
      d="M34 14 L 43 9 L 45 19"
      stroke="#2563EB"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  </svg>
);

// Tab 3: Smart Notes Visual Mock (Exact Match to User Reference Image)
export const SmartNotesVisualMock: React.FC = () => {
  return (
    <div className="wm-visual-column-container wm-notes-mock-column">
      <div className="wm-organic-aura aura-notes" aria-hidden="true" />

      {/* Main Notes Workspace Window Card */}
      <div className="wm-notes-window-card">
        {/* Header Bar */}
        <div className="wm-notes-window-header">
          <div className="wm-notes-header-left">
            <div className="wm-notes-header-icon-box">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
            </div>
            <span className="wm-notes-window-title">Project Notes</span>
          </div>

          <div className="wm-notes-header-right">
            {/* 3 Circular Avatars A, K, R */}
            <div className="wm-notes-avatars-group">
              <span className="wm-notes-avatar av-blue">A</span>
              <span className="wm-notes-avatar av-orange">K</span>
              <span className="wm-notes-avatar av-teal">R</span>
            </div>

            {/* Blue Share Pill Button */}
            <button type="button" className="wm-notes-share-btn">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="8.5" cy="7" r="4" />
                <line x1="20" y1="8" x2="20" y2="14" />
                <line x1="23" y1="11" x2="17" y2="11" />
              </svg>
              <span>Share</span>
            </button>
          </div>
        </div>

        {/* Notes Window Body: Mini Sidebar + Editor */}
        <div className="wm-notes-window-body">
          {/* Mini Sidebar */}
          <div className="wm-notes-mini-sidebar">
            <div className="wm-notes-nav-item active">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              </svg>
              <span>My Notes</span>
            </div>
            <div className="wm-notes-nav-item">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
              </svg>
              <span>Shared with me</span>
            </div>
            <div className="wm-notes-nav-item">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
              <span>Starred</span>
            </div>
            <div className="wm-notes-nav-item tag-item">
              <span className="hash-symbol">#</span>
              <span>Architecture</span>
            </div>
            <div className="wm-notes-nav-item tag-item">
              <span className="hash-symbol">#</span>
              <span>Ideas</span>
            </div>
            <div className="wm-notes-nav-item tag-item">
              <span className="hash-symbol">#</span>
              <span>Bugs</span>
            </div>
            <div className="wm-notes-nav-item tag-item">
              <span className="hash-symbol">#</span>
              <span>Meetings</span>
            </div>
            <div className="wm-notes-nav-item">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="21 8 21 21 3 21 3 8" />
                <rect x="1" y="3" width="22" height="5" />
                <line x1="10" y1="12" x2="14" y2="12" />
              </svg>
              <span>Archive</span>
            </div>
          </div>

          {/* Main Note Editor View */}
          <div className="wm-notes-editor-pane">
            <h4 className="wm-note-editor-title">API Design Ideas</h4>

            {/* Rich Text Toolbar */}
            <div className="wm-notes-toolbar-row">
              <span className="wm-tb-btn font-bold">B</span>
              <span className="wm-tb-btn font-italic">I</span>
              <span className="wm-tb-btn">&lt;/&gt;</span>
              <span className="wm-tb-btn">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                </svg>
              </span>
              <span className="wm-tb-btn">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="8" y1="6" x2="21" y2="6" />
                  <line x1="8" y1="12" x2="21" y2="12" />
                  <line x1="8" y1="18" x2="21" y2="18" />
                  <line x1="3" y1="6" x2="3.01" y2="6" />
                  <line x1="3" y1="12" x2="3.01" y2="12" />
                  <line x1="3" y1="18" x2="3.01" y2="18" />
                </svg>
              </span>
              <span className="wm-tb-btn">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="10" y1="6" x2="21" y2="6" />
                  <line x1="10" y1="12" x2="21" y2="12" />
                  <line x1="10" y1="18" x2="21" y2="18" />
                  <path d="M4 6h1v4" />
                </svg>
              </span>
              <span className="wm-tb-btn">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 11l3 3L22 4" />
                  <rect x="2" y="5" width="4" height="14" rx="1" />
                </svg>
              </span>
            </div>

            {/* Note Content */}
            <div className="wm-note-content-preview">
              <div className="wm-note-h3">### Endpoints</div>
              <div className="wm-note-list-item">- /auth/login</div>
              <div className="wm-note-list-item">- /projects</div>
              <div className="wm-note-list-item">- /notes</div>
              <div className="wm-note-skel-line w-full" />
              <div className="wm-note-skel-line w-2-3" />
            </div>

            {/* Attachment Pill */}
            <div className="wm-note-attachment-pill">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
              </svg>
              <span>api_spec.md</span>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Sticky Note with Pinned Checklist */}
      <div className="wm-floating-sticky-note">
        {/* Sparkles / Burst rays at top right */}
        <div className="wm-sticky-sparkles" aria-hidden="true">
          <PurpleBurstSparkle />
        </div>

        <div className="wm-sticky-header">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="17" x2="12" y2="22" />
            <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6a3 3 0 0 0-6 0v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V17z" />
          </svg>
          <span>Pinned</span>
        </div>

        <h5 className="wm-sticky-title">Release checklist before staging deploy</h5>

        <div className="wm-sticky-checklist">
          <div className="wm-sticky-check-row">
            <span className="wm-custom-checkbox" />
            <span>Run tests</span>
          </div>
          <div className="wm-sticky-check-row">
            <span className="wm-custom-checkbox" />
            <span>Update docs</span>
          </div>
          <div className="wm-sticky-check-row">
            <span className="wm-custom-checkbox" />
            <span>Notify team</span>
          </div>
        </div>
      </div>

      {/* Hand-drawn Arrow & Slogan Annotation */}
      <div className="wm-notes-handdrawn-annotation">
        <CurvedUpArrow />
        <span className="wm-notes-handdrawn-text">Turn thoughts into progress.</span>
      </div>
    </div>
  );
};

// Radiating Sparkle Rays for Calendar Sticker
export const StickerSparkleRays: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg
    width="26"
    height="26"
    viewBox="0 0 26 26"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    <path d="M 6 18 L 1 14" stroke="#F59E0B" strokeWidth="2.2" strokeLinecap="round" />
    <path d="M 12 14 L 14 3" stroke="#F59E0B" strokeWidth="2.2" strokeLinecap="round" />
    <path d="M 18 16 L 25 11" stroke="#F59E0B" strokeWidth="2.2" strokeLinecap="round" />
  </svg>
);

// Tab 4: Calendar Visual Mock (Matching Pic 1)
export const CalendarVisualMock: React.FC = () => {
  return (
    <div className="wm-visual-column-container wm-cal-mock-column">
      <div className="wm-organic-aura aura-calendar" aria-hidden="true" />

      {/* Main Calendar Card */}
      <div className="wm-cal-main-card">
        {/* Top Controls Header */}
        <div className="wm-cal-header-row">
          <div className="wm-cal-month-nav">
            <button type="button" className="wm-cal-chevron-btn" aria-label="Previous month">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="m15 18-6-6 6-6" />
              </svg>
            </button>
            <span className="wm-cal-month-title">October 2026</span>
            <button type="button" className="wm-cal-chevron-btn" aria-label="Next month">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="m9 18 6-6-6-6" />
              </svg>
            </button>
          </div>

          <div className="wm-cal-view-segmented">
            <button type="button" className="wm-cal-seg-pill active">Month</button>
            <button type="button" className="wm-cal-seg-pill">Week</button>
            <button type="button" className="wm-cal-seg-pill">Day</button>
          </div>

          <button type="button" className="wm-cal-add-btn">
            <span className="plus-sign">+</span>
            <span>Add Event</span>
          </button>
        </div>

        {/* Calendar Grid & Floating Sticker */}
        <div className="wm-cal-grid-wrapper">
          <div className="wm-cal-weekdays-row">
            <span>Sun</span>
            <span>Mon</span>
            <span>Tue</span>
            <span>Wed</span>
            <span>Thu</span>
            <span>Fri</span>
            <span>Sat</span>
          </div>

          <div className="wm-cal-dates-grid">
            {/* Row 1 */}
            <div className="wm-cal-day-cell muted"><span>28</span></div>
            <div className="wm-cal-day-cell muted"><span>29</span></div>
            <div className="wm-cal-day-cell muted"><span>30</span></div>
            <div className="wm-cal-day-cell"><span>1</span></div>
            <div className="wm-cal-day-cell has-event">
              <span className="wm-cal-date-num">2</span>
              <div className="wm-cal-chip chip-blue">
                <div className="wm-cal-chip-line">
                  <span className="wm-cal-dot dot-blue" />
                  <span className="wm-cal-chip-title">UI Review</span>
                </div>
                <span className="wm-cal-chip-sub">10:00 AM</span>
              </div>
            </div>
            <div className="wm-cal-day-cell"><span>3</span></div>
            <div className="wm-cal-day-cell"><span>4</span></div>

            {/* Row 2 */}
            <div className="wm-cal-day-cell"><span>5</span></div>
            <div className="wm-cal-day-cell"><span>6</span></div>
            <div className="wm-cal-day-cell"><span>7</span></div>
            <div className="wm-cal-day-cell has-event">
              <span className="wm-cal-date-num">8</span>
              <div className="wm-cal-chip chip-purple">
                <div className="wm-cal-chip-line">
                  <span className="wm-cal-dot dot-purple" />
                  <span className="wm-cal-chip-title">Sprint Deadline</span>
                </div>
              </div>
            </div>
            <div className="wm-cal-day-cell"><span>9</span></div>
            <div className="wm-cal-day-cell"><span>10</span></div>
            <div className="wm-cal-day-cell"><span></span></div>

            {/* Row 3 */}
            <div className="wm-cal-day-cell"><span>11</span></div>
            <div className="wm-cal-day-cell"><span>12</span></div>
            <div className="wm-cal-day-cell"><span></span></div>
            <div className="wm-cal-day-cell has-event">
              <span className="wm-cal-date-num">14</span>
              <div className="wm-cal-chip chip-green">
                <div className="wm-cal-chip-line">
                  <span className="wm-cal-dot dot-green" />
                  <span className="wm-cal-chip-title">Client Meeting</span>
                </div>
                <span className="wm-cal-chip-sub">3:00 PM</span>
              </div>
            </div>
            <div className="wm-cal-day-cell"><span>14</span></div>
            <div className="wm-cal-day-cell"><span>16</span></div>
            <div className="wm-cal-day-cell"><span></span></div>

            {/* Row 4 */}
            <div className="wm-cal-day-cell has-event">
              <span className="wm-cal-date-num">18</span>
              <div className="wm-cal-chip chip-amber">
                <div className="wm-cal-chip-line">
                  <span className="wm-cal-dot dot-amber" />
                  <span className="wm-cal-chip-title">Release v1.2</span>
                </div>
              </div>
            </div>
            <div className="wm-cal-day-cell"><span>20</span></div>
            <div className="wm-cal-day-cell"><span>21</span></div>
            <div className="wm-cal-day-cell"><span>22</span></div>
            <div className="wm-cal-day-cell"><span>23</span></div>
            <div className="wm-cal-day-cell"><span>24</span></div>
            <div className="wm-cal-day-cell"><span>25</span></div>

            {/* Row 5 */}
            <div className="wm-cal-day-cell"><span>26</span></div>
            <div className="wm-cal-day-cell"><span>27</span></div>
            <div className="wm-cal-day-cell"><span>28</span></div>
            <div className="wm-cal-day-cell"><span>29</span></div>
            <div className="wm-cal-day-cell"><span>30</span></div>
            <div className="wm-cal-day-cell"><span>31</span></div>
            <div className="wm-cal-day-cell muted"><span>1</span></div>
          </div>

          {/* Overlapping Floating Sticker Card */}
          <div className="wm-cal-floating-sticker">
            <div className="wm-cal-sticker-rays-box" aria-hidden="true">
              <StickerSparkleRays />
            </div>
            <div className="wm-cal-sticker-inner">
              <div className="wm-cal-sticker-icon">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8z" />
                  <circle cx="12" cy="10" r="2.5" fill="#FFFFFF" />
                </svg>
              </div>
              <div className="wm-cal-sticker-text">
                <span>Turn plans</span>
                <span>into progress.</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Timelines Pill */}
      <div className="wm-cal-bottom-timeline-pill">
        <div className="wm-cal-timeline-icon-circle">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        </div>
        <span className="wm-cal-timeline-text">All your project timelines, in one place.</span>
      </div>
    </div>
  );
};


// Hand-drawn arrow pointing up-left from sticker toward file list
export const FilesCurvedArrow: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg
    width="38"
    height="42"
    viewBox="0 0 38 42"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    <path
      d="M 32 38 C 36 24, 26 12, 10 5"
      stroke="#3B82F6"
      strokeWidth="2.2"
      strokeLinecap="round"
      fill="none"
    />
    <path
      d="M 6 15 L 8 4 L 19 6"
      stroke="#3B82F6"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  </svg>
);

// Tab 5: Files & Storage Visual Mock (Matching Pic 1)
export const FilesStorageVisualMock: React.FC = () => {
  return (
    <div className="wm-visual-column-container wm-files-mock-column">
      {/* Cyan/Blue Atmospheric Organic Aura */}
      <div className="wm-organic-aura aura-files" aria-hidden="true" />

      {/* Main Files Window Card */}
      <div className="wm-files-window-card">
        {/* Top Navigation Bar */}
        <div className="wm-files-top-bar">
          <div className="wm-files-top-left">
            <div className="wm-files-top-folder-icon">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="#FFFFFF">
                <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
              </svg>
            </div>
            <span className="wm-files-top-title">Project Files</span>
          </div>

          <div className="wm-files-top-right">
            <div className="wm-files-search-box">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              <span>Search files...</span>
            </div>

            <div className="wm-files-view-toggles">
              <button type="button" className="wm-files-view-btn" aria-label="Grid view">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="7" height="7" rx="1" />
                  <rect x="14" y="3" width="7" height="7" rx="1" />
                  <rect x="14" y="14" width="7" height="7" rx="1" />
                  <rect x="3" y="14" width="7" height="7" rx="1" />
                </svg>
              </button>
              <button type="button" className="wm-files-view-btn active" aria-label="List view">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="8" y1="6" x2="21" y2="6" />
                  <line x1="8" y1="12" x2="21" y2="12" />
                  <line x1="8" y1="18" x2="21" y2="18" />
                  <line x1="3" y1="6" x2="3.01" y2="6" />
                  <line x1="3" y1="12" x2="3.01" y2="12" />
                  <line x1="3" y1="18" x2="3.01" y2="18" />
                </svg>
              </button>
            </div>

            <button type="button" className="wm-files-upload-btn">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              <span>Upload +</span>
            </button>
          </div>
        </div>

        {/* 2-Column Body: Sidebar & File Explorer */}
        <div className="wm-files-window-body">
          {/* Left Mini Sidebar */}
          <div className="wm-files-sidebar">
            <div className="wm-files-nav-list">
              <div className="wm-files-nav-item active">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
                </svg>
                <span>All Files</span>
              </div>
              <div className="wm-files-nav-item">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
                <span>Shared with Me</span>
              </div>
              <div className="wm-files-nav-item">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                <span>Recent</span>
              </div>
              <div className="wm-files-nav-item">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
                <span>Starred</span>
              </div>
              <div className="wm-files-nav-item">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
                <span>Trash</span>
              </div>
            </div>

            <div className="wm-files-folders-section">
              <div className="wm-files-folders-header">
                <span>FOLDERS</span>
                <span className="wm-files-plus-btn">+</span>
              </div>
              <div className="wm-files-folders-list">
                <div className="wm-files-folder-item">
                  <span className="folder-icon-amber">📁</span>
                  <span>Design</span>
                </div>
                <div className="wm-files-folder-item">
                  <span className="folder-icon-amber">📁</span>
                  <span>Development</span>
                </div>
                <div className="wm-files-folder-item">
                  <span className="folder-icon-amber">📁</span>
                  <span>Documentation</span>
                </div>
                <div className="wm-files-folder-item">
                  <span className="folder-icon-amber">📁</span>
                  <span>Assets</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right File Browser Area */}
          <div className="wm-files-main-pane">
            {/* Breadcrumb row */}
            <div className="wm-files-breadcrumbs">
              <span className="crumb-chevron">&lt;</span>
              <span className="crumb-link">Development</span>
              <span className="crumb-sep">&gt;</span>
              <span className="crumb-active">Frontend</span>
            </div>

            {/* Table Header */}
            <div className="wm-files-table-header">
              <span className="col-name">Name ↑</span>
              <span className="col-type">Type</span>
              <span className="col-size">Size</span>
              <span className="col-modified">Modified</span>
              <span className="col-actions"></span>
            </div>

            {/* Table Rows List */}
            <div className="wm-files-table-rows">
              {/* Row 1: ui-components.fig */}
              <div className="wm-files-row">
                <div className="col-name file-name-cell">
                  <div className="wm-file-icon-box figma">
                    <svg width="10" height="14" viewBox="0 0 38 57" fill="none">
                      <path d="M19 28.5A9.5 9.5 0 1 1 28.5 19 9.5 9.5 0 0 1 19 28.5z" fill="#1ABCFE"/>
                      <path d="M0 47.5A9.5 9.5 0 0 1 9.5 38H19v9.5a9.5 9.5 0 1 1-19 0z" fill="#0ACF83"/>
                      <path d="M19 0v19h9.5a9.5 9.5 0 1 0 0-19H19z" fill="#FF7262"/>
                      <path d="M0 9.5A9.5 9.5 0 0 0 9.5 19H19V0H9.5A9.5 9.5 0 0 0 0 9.5z" fill="#F24E1E"/>
                      <path d="M0 28.5A9.5 9.5 0 0 0 9.5 38H19V19H9.5A9.5 9.5 0 0 0 0 28.5z" fill="#A259FF"/>
                    </svg>
                  </div>
                  <span className="file-name-text">ui-components.fig</span>
                </div>
                <span className="col-type">Figma</span>
                <span className="col-size">2.4 MB</span>
                <span className="col-modified">2h ago</span>
                <span className="col-actions">•••</span>
              </div>

              {/* Row 2: dashboard.tsx */}
              <div className="wm-files-row">
                <div className="col-name file-name-cell">
                  <div className="wm-file-icon-box code">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2.5">
                      <polyline points="16 18 22 12 16 6" />
                      <polyline points="8 6 2 12 8 18" />
                    </svg>
                  </div>
                  <span className="file-name-text">dashboard.tsx</span>
                </div>
                <span className="col-type">TSX</span>
                <span className="col-size">12 KB</span>
                <span className="col-modified">5h ago</span>
                <span className="col-actions">•••</span>
              </div>

              {/* Row 3: styles.css */}
              <div className="wm-files-row">
                <div className="col-name file-name-cell">
                  <div className="wm-file-icon-box css">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#0284C7" strokeWidth="2">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <path d="M14 2v6h6" />
                    </svg>
                  </div>
                  <span className="file-name-text">styles.css</span>
                </div>
                <span className="col-type">CSS</span>
                <span className="col-size">8 KB</span>
                <span className="col-modified">1 day ago</span>
                <span className="col-actions">•••</span>
              </div>

              {/* Row 4: architecture.pdf */}
              <div className="wm-files-row">
                <div className="col-name file-name-cell">
                  <div className="wm-file-icon-box pdf">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <path d="M14 2v6h6" />
                    </svg>
                  </div>
                  <span className="file-name-text">architecture.pdf</span>
                </div>
                <span className="col-type">PDF</span>
                <span className="col-size">1.2 MB</span>
                <span className="col-modified">2 days ago</span>
                <span className="col-actions">•••</span>
              </div>

              {/* Row 5: preview.png */}
              <div className="wm-files-row">
                <div className="col-name file-name-cell">
                  <div className="wm-file-icon-box png">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#06B6D4" strokeWidth="2">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <polyline points="21 15 16 10 5 21" />
                    </svg>
                  </div>
                  <span className="file-name-text">preview.png</span>
                </div>
                <span className="col-type">PNG</span>
                <span className="col-size">320 KB</span>
                <span className="col-modified">3 days ago</span>
                <span className="col-actions">•••</span>
              </div>
            </div>

            {/* Drag & Drop Upload Zone at Bottom */}
            <div className="wm-files-dropzone">
              <div className="wm-files-drop-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
              </div>
              <div className="wm-files-drop-text">
                <strong>Drag &amp; drop files here</strong>
                <span>or click to upload</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Sticker Card on Bottom Right */}
      <div className="wm-files-floating-sticker-wrapper">
        <FilesCurvedArrow className="wm-files-curved-arrow" />
        <div className="wm-files-floating-sticker">
          <div className="wm-files-sticker-cloud">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
              <path d="M12 11v6" />
              <path d="M9 14h6" />
            </svg>
          </div>
          <div className="wm-files-sticker-text">
            <span>All your assets,</span>
            <span>in one place.</span>
          </div>
        </div>
      </div>
    </div>
  );
};

