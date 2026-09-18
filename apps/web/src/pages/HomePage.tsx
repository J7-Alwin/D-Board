import React from 'react';
import { HeroSection } from '../components/landing/HeroSection';
import { FeatureStrip } from '../components/landing/FeatureStrip';
import { Button } from '../components/ui/Button';
import { useRouter } from '../router/Router';
import { ArrowRightIcon, CheckSquareIcon } from '../components/ui/Icons';

export const HomePage: React.FC = () => {
  const { navigate } = useRouter();

  return (
    <div className="home-page">
      {/* 1. Hero Section */}
      <HeroSection />

      {/* 2. 4-Column Feature Strip */}
      <FeatureStrip />

      {/* 3. Core Capabilities Section */}
      <section className="product-deep-dive-section">
        <div className="container">
          <div className="section-header text-center">
            <div className="eyebrow core-capabilities-eyebrow">CORE CAPABILITIES</div>
            <h2 className="heading-section core-capabilities-heading">Everything your team needs, in one place.</h2>
            <p className="body-large section-subheading core-capabilities-subheading">
              From planning to shipping, D-Board brings the essential tools together so developers can focus on what matters — building great software.
            </p>
          </div>

          <div className="highlights-grid">
            {/* Card 1: Project-Scoped Roles */}
            <div className="capability-card">
              <div className="card-sparkle" aria-hidden="true">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M12 2v6" />
                  <path d="M4 8l5 4" />
                  <path d="M20 8l-5 4" />
                </svg>
              </div>
              <div className="capability-content">
                <div className="capability-top-row">
                  <div className="capability-icon-box">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                  </div>
                  <span className="capability-badge badge-green">ROLES &amp; ACCESS</span>
                </div>
                <h3 className="capability-title">Project-Scoped Roles</h3>
                <p className="capability-desc">
                  Granular permissions tailored per project. Be a PROJECT_ADMIN in your core repo and a PROJECT_MEMBER in shared tools.
                </p>
                <button
                  type="button"
                  className="capability-link"
                  onClick={() => navigate('/how-it-works')}
                >
                  Learn more <ArrowRightIcon size={16} />
                </button>
              </div>

              {/* Right Widget: Member Roles Dropdown List */}
              <div className="capability-widget">
                <div className="widget-roles-card">
                  <div className="widget-role-row">
                    <div className="widget-role-avatar avatar-black">A</div>
                    <span className="widget-role-name">Project Admin</span>
                    <svg className="widget-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </div>
                  <div className="widget-role-row">
                    <div className="widget-role-avatar avatar-green">S</div>
                    <span className="widget-role-name">Project Member</span>
                    <svg className="widget-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </div>
                  <div className="widget-role-row">
                    <div className="widget-role-avatar avatar-gray">T</div>
                    <span className="widget-role-name">Viewer</span>
                    <svg className="widget-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            {/* Card 2: Task & Bug Tracking */}
            <div className="capability-card">
              <div className="card-sparkle" aria-hidden="true">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M12 2v6" />
                  <path d="M4 8l5 4" />
                  <path d="M20 8l-5 4" />
                </svg>
              </div>
              <div className="capability-content">
                <div className="capability-top-row">
                  <div className="capability-icon-box">
                    <CheckSquareIcon size={22} />
                  </div>
                  <span className="capability-badge badge-amber">WORK TYPES</span>
                </div>
                <h3 className="capability-title">Task &amp; Bug Tracking</h3>
                <p className="capability-desc">
                  Organize work with structured types: Tasks, Bugs, Features, Improvements, and Research with clear statuses from To Do to Completed.
                </p>
                <button
                  type="button"
                  className="capability-link"
                  onClick={() => navigate('/how-it-works')}
                >
                  Explore tracking <ArrowRightIcon size={16} />
                </button>
              </div>

              {/* Right Widget: Mini Kanban with Drag Action */}
              <div className="capability-widget">
                <div className="widget-kanban-board">
                  <div className="kanban-mini-col">
                    <div className="kanban-mini-header">
                      <span className="kanban-col-title">To Do</span>
                      <span className="kanban-col-count">3</span>
                    </div>
                    <div className="kanban-mini-items">
                      <div className="kanban-mini-card">
                        <span className="kanban-dot dot-red" />
                        <span>Fix login bug</span>
                      </div>
                      <div className="kanban-mini-card">
                        <span className="kanban-dot dot-purple" />
                        <span>Design API</span>
                      </div>
                      <div className="kanban-mini-card">
                        <span className="kanban-dot dot-green" />
                        <span>Write tests</span>
                      </div>
                    </div>
                  </div>

                  <div className="kanban-mini-col col-in-progress">
                    <div className="kanban-mini-header">
                      <span className="kanban-col-title">In Progress</span>
                      <span className="kanban-col-count">2</span>
                    </div>
                    <div className="kanban-in-progress-area">
                      <div className="kanban-drop-slot" />
                      {/* Curved hand-drawn arrow */}
                      <svg className="kanban-curve-arrow" width="38" height="28" viewBox="0 0 38 28" fill="none">
                        <path d="M2 24 C14 26, 24 16, 32 4" stroke="#111827" strokeWidth="1.8" strokeLinecap="round" />
                        <path d="M27 4 H32 V9" stroke="#111827" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <div className="kanban-floating-card">
                        <span className="kanban-dot dot-amber" />
                        <span>Implement auth</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Card 3: Centralized Project Notes */}
            <div className="capability-card">
              <div className="card-sparkle" aria-hidden="true">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M12 2v6" />
                  <path d="M4 8l5 4" />
                  <path d="M20 8l-5 4" />
                </svg>
              </div>
              <div className="capability-content">
                <div className="capability-top-row">
                  <div className="capability-icon-box icon-box-purple">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="16" y1="13" x2="8" y2="13" />
                      <line x1="16" y1="17" x2="8" y2="17" />
                      <polyline points="10 9 9 9 8 9" />
                    </svg>
                  </div>
                  <span className="capability-badge badge-purple">DOCUMENTATION</span>
                </div>
                <h3 className="capability-title">Centralized Project Notes</h3>
                <p className="capability-desc">
                  Keep architecture decisions, release checklists, and meeting notes right next to the code and tasks they describe.
                </p>
                <button
                  type="button"
                  className="capability-link"
                  onClick={() => navigate('/how-it-works')}
                >
                  Open notes <ArrowRightIcon size={16} />
                </button>
              </div>

              {/* Right Widget: Note Document Card */}
              <div className="capability-widget">
                <div className="widget-note-card">
                  <div className="widget-note-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="16" y1="13" x2="8" y2="13" />
                      <line x1="16" y1="17" x2="8" y2="17" />
                      <polyline points="10 9 9 9 8 9" />
                    </svg>
                  </div>
                  <h4 className="widget-note-title">Design Decision</h4>
                  <div className="widget-note-skeleton line-full" />
                  <div className="widget-note-skeleton line-half" />
                  <div className="widget-note-tag">
                    <span>#architecture</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Card 4: Audit & Activity Log */}
            <div className="capability-card">
              <div className="card-sparkle" aria-hidden="true">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M12 2v6" />
                  <path d="M4 8l5 4" />
                  <path d="M20 8l-5 4" />
                </svg>
              </div>
              <div className="capability-content">
                <div className="capability-top-row">
                  <div className="capability-icon-box">
                    {/* Activity pulse / waveform */}
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                    </svg>
                  </div>
                  <span className="capability-badge badge-green-subtle">TRANSPARENCY</span>
                </div>
                <h3 className="capability-title">Audit &amp; Activity Log</h3>
                <p className="capability-desc">
                  Stay updated on team progress without constant status meetings. Every update, assignment, and milestone is logged.
                </p>
                <button
                  type="button"
                  className="capability-link"
                  onClick={() => navigate('/how-it-works')}
                >
                  View activity <ArrowRightIcon size={16} />
                </button>
              </div>

              {/* Right Widget: Activity Timeline */}
              <div className="capability-widget">
                <div className="widget-activity-timeline">
                  <div className="timeline-item">
                    <div className="timeline-axis">
                      <div className="timeline-node-circle" />
                      <div className="timeline-line" />
                    </div>
                    <div className="timeline-content-row">
                      <div className="timeline-avatar avatar-black">A</div>
                      <div className="timeline-text">
                        <p className="timeline-title">Alwin created a new task</p>
                        <span className="timeline-time">2 hours ago</span>
                      </div>
                    </div>
                  </div>

                  <div className="timeline-item item-active">
                    <div className="timeline-axis">
                      <div className="timeline-node-dot dot-green" />
                      <div className="timeline-line" />
                    </div>
                    <div className="timeline-content-box box-highlighted">
                      <div className="timeline-avatar avatar-green">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </div>
                      <div className="timeline-text">
                        <p className="timeline-title">Task marked as completed</p>
                        <span className="timeline-time">4 hours ago</span>
                      </div>
                    </div>
                  </div>

                  <div className="timeline-item">
                    <div className="timeline-axis">
                      <div className="timeline-node-circle" />
                    </div>
                    <div className="timeline-content-row">
                      <div className="timeline-avatar avatar-white-icon">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                        </svg>
                      </div>
                      <div className="timeline-text">
                        <p className="timeline-title">Architecture note updated</p>
                        <span className="timeline-time">1 day ago</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. Bottom CTA Banner */}
      <section className="cta-banner-section">
        <div className="container">
          <div className="cta-banner-card">
            <div className="cta-content">
              <div className="eyebrow cta-eyebrow">READY TO BUILD?</div>
              <h2 className="cta-heading">Join the focused workspace for development teams.</h2>
              <p className="cta-desc">
                Free to start. No credit card required. Create your first project in seconds.
              </p>
              <div className="cta-actions">
                <Button
                  variant="primary"
                  size="lg"
                  rightIcon={<ArrowRightIcon size={18} />}
                  onClick={() => navigate('/register')}
                >
                  Get started for free
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => navigate('/how-it-works')}
                >
                  Explore how it works
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
