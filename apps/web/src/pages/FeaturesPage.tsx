import React from 'react';
import { useRouter } from '../router/Router';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Primitives';
import {
  CheckSquareIcon,
  UsersIcon,
  CalendarIcon,
  FileTextIcon,
  ActivityIcon,
  BarChartIcon,
  ArrowRightIcon,
} from '../components/ui/Icons';

export const FeaturesPage: React.FC = () => {
  const { navigate } = useRouter();

  const coreFeatures = [
    {
      id: 'project-management',
      title: 'Project Management & Workspaces',
      badge: 'CORE FOUNDATION',
      icon: <BarChartIcon size={28} />,
      description: 'Create independent project workspaces with distinct members, repositories, and progress metrics.',
      details: [
        'Multi-project dashboard with progress percentage indicators',
        'Scoped workspaces to isolate context between products and tools',
        'Clean milestone tracking with live completion statuses',
      ],
    },
    {
      id: 'work-tracking',
      title: 'Work & Task Tracking',
      badge: 'SPEED & CLARITY',
      icon: <CheckSquareIcon size={28} />,
      description: 'Categorize development work into clear, unambiguous types and lifecycle states.',
      details: [
        'Structured types: Task, Bug, Feature, Improvement, Research, Documentation',
        'Lifecycle states: To Do, In Progress, Blocked, In Review, Completed',
        'Instant assignee filters and personal "My Work" dashboard',
      ],
    },
    {
      id: 'collaboration',
      title: 'Project-Scoped Roles & Collaboration',
      badge: 'SECURE RBAC',
      icon: <UsersIcon size={28} />,
      description: 'Security designed from the ground up: permissions are project-scoped rather than global.',
      details: [
        'Granular roles: PROJECT_ADMIN and PROJECT_MEMBER',
        'Secure email-based invitation workflow with explicit acceptance',
        'Zero global admin leaks across independent project boundaries',
      ],
    },
    {
      id: 'calendar',
      title: 'Calendar & Deadlines',
      badge: 'TIMELINES',
      icon: <CalendarIcon size={28} />,
      description: 'Keep track of release dates, sprint milestones, and upcoming deadlines without bloated gantt charts.',
      details: [
        'Unified deadline view across assigned projects',
        'Sprint milestone indicators and due date alerts',
        'Lightweight calendar view designed for developers',
      ],
    },
    {
      id: 'notes-files',
      title: 'Shared Notes & Project Files',
      badge: 'KNOWLEDGE BASE',
      icon: <FileTextIcon size={28} />,
      description: 'Store architecture decision records (ADRs), schemas, and release notes directly alongside the tasks.',
      details: [
        'Markdown-enabled collaborative project documentation',
        'Asset and file attachment storage scoped to each project',
        'Secure deduplication, metadata tracking, and fast text search',
      ],
    },
    {
      id: 'activity-notifications',
      title: 'Activity Feed & Notifications',
      badge: 'AWARENESS',
      icon: <ActivityIcon size={28} />,
      description: 'High-signal notification system and activity stream so you know what happened without unnecessary pings.',
      details: [
        'Chronological audit trail of all project events',
        'In-app notification center for assignments and mentions',
        'Zero noisy spam — only critical updates that impact your work',
      ],
    },
  ];

  return (
    <div className="features-page">
      <section className="page-hero-section">
        <div className="container text-center">
          <div className="eyebrow">D-BOARD CAPABILITIES</div>
          <h1 className="heading-display page-title">Purpose-built features for modern development teams.</h1>
          <p className="body-large page-subtitle">
            Every feature in D-Board is designed to eliminate friction between planning code and shipping it.
          </p>
        </div>
      </section>

      <section className="features-grid-section">
        <div className="container">
          <div className="features-full-grid">
            {coreFeatures.map((feat) => (
              <div key={feat.id} className="feature-full-card">
                <div className="feature-card-top">
                  <div className="feature-card-icon">{feat.icon}</div>
                  <Badge variant="dark" size="sm">{feat.badge}</Badge>
                </div>
                <h2 className="feature-card-title">{feat.title}</h2>
                <p className="feature-card-desc">{feat.description}</p>
                <ul className="feature-card-list">
                  {feat.details.map((d, i) => (
                    <li key={i} className="feature-card-list-item">
                      <span className="check-bullet">✓</span>
                      <span>{d}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="page-bottom-cta">
            <h3 className="heading-card">Ready to try D-Board with your team?</h3>
            <div className="cta-btn-wrap">
              <Button
                variant="primary"
                size="lg"
                rightIcon={<ArrowRightIcon size={18} />}
                onClick={() => navigate('/register')}
              >
                Create free account
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
