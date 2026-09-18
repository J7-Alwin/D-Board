import React from 'react';
import { Link, useRouter } from '../../router/Router';
import { Button } from '../../components/ui/Button';
import {
  LayersIcon,
  CheckSquareIcon,
  CalendarIcon,
  FolderIcon,
  FileTextIcon,
  ActivityIcon,
  SearchIcon,
  BellIcon,
} from '../../components/ui/Icons';
import { authApi } from '../../api/auth.api';
import { Logo } from '../../components/ui/Logo';

export const DashboardPreviewPage: React.FC = () => {
  const { navigate } = useRouter();

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } catch {
      // Ignore
    }
    navigate('/login');
  };

  return (
    <div className="app-workspace-layout">
      {/* Sidebar */}
      <aside className="app-workspace-sidebar">
        <div className="workspace-brand">
          <Link to="/" className="brand-logo" aria-label="D-Board Home">
            <Logo size="sm" withText />
          </Link>
        </div>

        <nav className="workspace-nav">
          <Link to="/app/dashboard" className="workspace-nav-item active">
            <LayersIcon size={18} />
            <span>Dashboard</span>
          </Link>
          <div className="workspace-nav-item">
            <CheckSquareIcon size={18} />
            <span>My Work</span>
          </div>
          <div className="workspace-nav-item">
            <CalendarIcon size={18} />
            <span>Calendar</span>
          </div>
          <div className="workspace-nav-item">
            <FolderIcon size={18} />
            <span>Files</span>
          </div>
          <div className="workspace-nav-item">
            <FileTextIcon size={18} />
            <span>Notes</span>
          </div>
          <div className="workspace-nav-item">
            <ActivityIcon size={18} />
            <span>Activity</span>
          </div>
        </nav>

        <div className="workspace-projects-list">
          <div className="projects-label">MY PROJECTS</div>
          <div className="workspace-project-pill active">
            <span className="proj-dot bullet-d">D</span>
            <span className="proj-name">D-Board</span>
          </div>
          <div className="workspace-project-pill">
            <span className="proj-dot bullet-p">P</span>
            <span className="proj-name">Portfolio</span>
          </div>
          <div className="workspace-project-pill">
            <span className="proj-dot bullet-a">&lt;/&gt;</span>
            <span className="proj-name">API Lab</span>
          </div>
        </div>

        <div className="workspace-sidebar-footer">
          <Button variant="ghost" size="sm" onClick={handleLogout} fullWidth>
            Sign out
          </Button>
        </div>
      </aside>

      {/* Main Area */}
      <div className="app-workspace-main">
        {/* Topbar */}
        <header className="workspace-topbar">
          <div className="workspace-search">
            <SearchIcon size={16} />
            <input type="text" placeholder="Search projects, tasks, notes..." className="topbar-input" />
          </div>
          <div className="workspace-topbar-actions">
            <div className="workspace-bell">
              <BellIcon size={18} />
            </div>
            <div className="workspace-avatar">A</div>
          </div>
        </header>

        {/* Content */}
        <div className="workspace-content container">
          <div className="workspace-header-row">
            <div>
              <h1 className="heading-section">Good morning, Alwin</h1>
              <p className="body-regular">Here's what's happening across your development projects.</p>
            </div>
            <div className="workspace-date-pill">
              Thu, Sep 4, 2026
            </div>
          </div>

          <div className="workspace-stats-row">
            <div className="stat-box">
              <span className="stat-val">3</span>
              <span className="stat-tag">My Projects</span>
            </div>
            <div className="stat-box">
              <span className="stat-val">5</span>
              <span className="stat-tag">Joined Projects</span>
            </div>
            <div className="stat-box">
              <span className="stat-val">8</span>
              <span className="stat-tag">My Open Work</span>
            </div>
            <div className="stat-box">
              <span className="stat-val">2</span>
              <span className="stat-tag">Upcoming Deadlines</span>
            </div>
          </div>

          <div className="workspace-projects-section">
            <div className="sec-title-row">
              <h2 className="heading-card">Your projects</h2>
            </div>
            <div className="workspace-grid">
              <div className="proj-card">
                <div className="proj-card-top">
                  <span className="badge-logo-d">D</span>
                  <span className="proj-status">60% complete</span>
                </div>
                <h3 className="proj-card-title">D-Board</h3>
                <p className="proj-card-desc">Project management for developer teams.</p>
                <div className="proj-card-foot">
                  <span>5 members</span>
                  <span>12 open tasks</span>
                </div>
              </div>

              <div className="proj-card">
                <div className="proj-card-top">
                  <span className="badge-logo-p">⬡</span>
                  <span className="proj-status">30% complete</span>
                </div>
                <h3 className="proj-card-title">Portfolio</h3>
                <p className="proj-card-desc">Personal portfolio and blog platform.</p>
                <div className="proj-card-foot">
                  <span>3 members</span>
                  <span>6 open tasks</span>
                </div>
              </div>

              <div className="proj-card">
                <div className="proj-card-top">
                  <span className="badge-logo-a">&lt;/&gt;</span>
                  <span className="proj-status">45% complete</span>
                </div>
                <h3 className="proj-card-title">API Lab</h3>
                <p className="proj-card-desc">Experiment and learn backend systems.</p>
                <div className="proj-card-foot">
                  <span>4 members</span>
                  <span>8 open tasks</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
