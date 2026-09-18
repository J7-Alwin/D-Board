import React from 'react';
import { useRouter } from '../../router/Router';
import { Button } from '../ui/Button';
import {
  ArrowRightIcon,
  SearchIcon,
  BellIcon,
  FolderIcon,
  CalendarIcon,
  FileTextIcon,
  ActivityIcon,
  CheckSquareIcon,
  LayersIcon,
} from '../ui/Icons';
import { Logo } from '../ui/Logo';

export const HeroSection: React.FC = () => {
  const { navigate } = useRouter();

  return (
    <section className="hero-section">
      {/* Full-bleed dark editorial backdrop on the right */}
      <div className="hero-dark-bg" aria-hidden="true">
        {/* Top-right topographic contour lines */}
        <svg className="contour-svg contour-top" viewBox="0 0 400 400" fill="none" xmlns="http://www.w3.org/2000/svg">
          <ellipse cx="400" cy="0" rx="360" ry="360" stroke="rgba(255,255,255,0.08)" strokeWidth="1.2" />
          <ellipse cx="400" cy="0" rx="310" ry="310" stroke="rgba(255,255,255,0.08)" strokeWidth="1.2" />
          <ellipse cx="400" cy="0" rx="260" ry="260" stroke="rgba(255,255,255,0.08)" strokeWidth="1.2" />
          <ellipse cx="400" cy="0" rx="210" ry="210" stroke="rgba(255,255,255,0.08)" strokeWidth="1.2" />
          <ellipse cx="400" cy="0" rx="160" ry="160" stroke="rgba(255,255,255,0.08)" strokeWidth="1.2" />
          <ellipse cx="400" cy="0" rx="110" ry="110" stroke="rgba(255,255,255,0.08)" strokeWidth="1.2" />
        </svg>

        {/* Bottom-right topographic contour lines */}
        <svg className="contour-svg contour-bottom" viewBox="0 0 400 400" fill="none" xmlns="http://www.w3.org/2000/svg">
          <ellipse cx="380" cy="380" rx="350" ry="350" stroke="rgba(255,255,255,0.08)" strokeWidth="1.2" />
          <ellipse cx="380" cy="380" rx="290" ry="290" stroke="rgba(255,255,255,0.08)" strokeWidth="1.2" />
          <ellipse cx="380" cy="380" rx="230" ry="230" stroke="rgba(255,255,255,0.08)" strokeWidth="1.2" />
          <ellipse cx="380" cy="380" rx="170" ry="170" stroke="rgba(255,255,255,0.08)" strokeWidth="1.2" />
          <ellipse cx="380" cy="380" rx="110" ry="110" stroke="rgba(255,255,255,0.08)" strokeWidth="1.2" />
        </svg>

        {/* Editorial script in the bottom right */}
        <div className="hero-dark-script">
          <span>Build</span>
          <span>Better</span>
          <span>Together</span>
        </div>
      </div>

      <div className="container hero-container">
        {/* Left Column: Editorial Headline & Actions */}
        <div className="hero-left">
          <div className="eyebrow hero-eyebrow">
            <span>PLAN</span>
            <span className="dot">•</span>
            <span>BUILD</span>
            <span className="dot">•</span>
            <span>TRACK</span>
            <span className="dot">•</span>
            <span>TOGETHER</span>
          </div>

          <h1 className="hero-title">
            Projects<br />
            move faster<br />
            with the right<br />
            people.
          </h1>

          <p className="hero-description">
            D-Board is a simple, modern workspace to plan, organize and track your
            development projects — with your team, all in one place.
          </p>

          <div className="hero-cta-group">
            <Button
              variant="primary"
              size="lg"
              rightIcon={<ArrowRightIcon size={18} />}
              onClick={() => navigate('/register')}
            >
              Get started
            </Button>
          </div>

          <p className="hero-microcopy">
            Free to start <span className="separator">•</span> No credit card required
          </p>
        </div>

        {/* Right Column: Application UI Mockup */}
        <div className="hero-right">
          {/* D-Board UI Preview Frame */}
          <div className="app-preview-window">
            {/* Window Chrome */}
            <div className="preview-chrome">
              <div className="chrome-dots">
                <span className="dot dot-close" />
                <span className="dot dot-min" />
                <span className="dot dot-max" />
              </div>
            </div>

            <div className="preview-window-body">
              {/* Preview Sidebar */}
              <aside className="preview-sidebar">
                <div className="preview-brand">
                  <Logo size="xs" withText />
                </div>

                <nav className="preview-nav">
                  <div className="preview-nav-item active">
                    <LayersIcon size={15} />
                    <span>Dashboard</span>
                  </div>
                  <div className="preview-nav-item">
                    <CheckSquareIcon size={15} />
                    <span>My Work</span>
                  </div>
                  <div className="preview-nav-item">
                    <CalendarIcon size={15} />
                    <span>Calendar</span>
                  </div>
                  <div className="preview-nav-item">
                    <FolderIcon size={15} />
                    <span>Files</span>
                  </div>
                  <div className="preview-nav-item">
                    <FileTextIcon size={15} />
                    <span>Notes</span>
                  </div>
                  <div className="preview-nav-item">
                    <ActivityIcon size={15} />
                    <span>Activity</span>
                  </div>
                </nav>

                <div className="preview-sidebar-section">
                  <div className="section-label">MY PROJECTS</div>
                  <div className="project-item">
                    <span className="project-bullet bullet-d">D</span>
                    <span className="project-name">D-Board</span>
                  </div>
                  <div className="project-item">
                    <span className="project-bullet bullet-p">P</span>
                    <span className="project-name">Portfolio</span>
                  </div>
                  <div className="project-item">
                    <span className="project-bullet bullet-a">&lt;/&gt;</span>
                    <span className="project-name">API Lab</span>
                  </div>
                  <div className="project-item">
                    <span className="project-bullet bullet-c">C</span>
                    <span className="project-name">CertiTrack</span>
                  </div>
                  <div className="project-item">
                    <span className="project-bullet bullet-g">G</span>
                    <span className="project-name">Game Engine</span>
                  </div>
                </div>
              </aside>

              {/* Preview Main Workspace */}
              <main className="preview-main-content">
                {/* Topbar */}
                <div className="preview-topbar">
                  <div className="preview-search-bar">
                    <SearchIcon size={14} className="search-icon" />
                    <span className="search-placeholder">Search projects, tasks...</span>
                  </div>
                  <div className="preview-user-actions">
                    <div className="preview-bell-btn">
                      <BellIcon size={16} />
                      <span className="bell-dot" />
                    </div>
                    <div className="preview-user-profile">
                      <div className="preview-avatar">A</div>
                      <span className="preview-username">Alwin</span>
                      <span className="dropdown-caret">▾</span>
                    </div>
                  </div>
                </div>

                {/* Greeting */}
                <div className="preview-greeting-row">
                  <div>
                    <h2 className="preview-greeting-title">Good morning, Alwin</h2>
                    <p className="preview-greeting-sub">Here's what's happening across your projects.</p>
                  </div>
                  <div className="preview-date-badge">
                    Thu, Sep 4, 2026
                  </div>
                </div>

                {/* Stats Grid */}
                <div className="preview-stats-grid">
                  <div className="stat-card">
                    <div className="stat-number">3</div>
                    <div className="stat-label">My Projects</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-number">5</div>
                    <div className="stat-label">Joined Projects</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-number">8</div>
                    <div className="stat-label">My Open Work</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-number">2</div>
                    <div className="stat-label">Upcoming Deadlines</div>
                  </div>
                </div>

                {/* Your Projects Section */}
                <div className="preview-projects-header">
                  <h3 className="section-title">Your projects</h3>
                  <button type="button" className="view-all-link" onClick={() => navigate('/register')}>
                    <span>View all</span>
                    <ArrowRightIcon size={12} />
                  </button>
                </div>

                <div className="preview-project-cards">
                  {/* Project 1 */}
                  <div className="preview-card">
                    <div className="preview-card-header">
                      <span className="card-logo-badge badge-black">D</span>
                    </div>
                    <h4 className="card-project-title">D-Board</h4>
                    <p className="card-project-desc">Project management for developer teams.</p>
                    <div className="progress-bar-container">
                      <div className="progress-bar-fill fill-60" />
                    </div>
                    <div className="card-project-footer">
                      <span className="meta-members">👥 5 members</span>
                      <span className="meta-open-tasks">⏱ 12 open</span>
                      <span className="progress-text">60%</span>
                    </div>
                  </div>

                  {/* Project 2 */}
                  <div className="preview-card">
                    <div className="preview-card-header">
                      <span className="card-logo-badge badge-green">⬡</span>
                    </div>
                    <h4 className="card-project-title">Portfolio</h4>
                    <p className="card-project-desc">Personal portfolio and blog platform.</p>
                    <div className="progress-bar-container">
                      <div className="progress-bar-fill fill-30" />
                    </div>
                    <div className="card-project-footer">
                      <span className="meta-members">👥 3 members</span>
                      <span className="meta-open-tasks">⏱ 6 open</span>
                      <span className="progress-text">30%</span>
                    </div>
                  </div>

                  {/* Project 3 */}
                  <div className="preview-card">
                    <div className="preview-card-header">
                      <span className="card-logo-badge badge-code">&lt;/&gt;</span>
                    </div>
                    <h4 className="card-project-title">API Lab</h4>
                    <p className="card-project-desc">Experiment and learn backend systems.</p>
                    <div className="progress-bar-container">
                      <div className="progress-bar-fill fill-45" />
                    </div>
                    <div className="card-project-footer">
                      <span className="meta-members">👥 4 members</span>
                      <span className="meta-open-tasks">⏱ 8 open</span>
                      <span className="progress-text">45%</span>
                    </div>
                  </div>
                </div>
              </main>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
