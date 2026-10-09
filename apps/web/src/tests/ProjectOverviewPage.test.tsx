import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { ProjectOverviewPage } from '../pages/app/ProjectOverviewPage';
import type { Project } from '../api/projects.api';

const mockProject: Project = {
  id: 'test-proj-1',
  name: 'd-board',
  key: 'DBOARD',
  description: 'this is the project dboard where we work',
  category: 'Web Application',
  technologyStack: ['React'],
  startDate: '2026-10-09T00:00:00.000Z',
  endDate: '2026-10-15T00:00:00.000Z',
  repositoryUrl: null,
  liveUrl: null,
  avatarUrl: null,
  status: 'ACTIVE',
  userRole: 'PROJECT_ADMIN',
  createdById: 'u1',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'u1', username: 'testuser', email: 'test@example.com' },
  }),
}));

vi.mock('../api/projects.api', () => ({
  projectsApi: {
    getProjectById: vi.fn().mockResolvedValue({
      success: true,
      data: {
        project: {
          id: 'test-proj-1',
          name: 'd-board',
          key: 'DBOARD',
          description: 'this is the project dboard where we work',
          category: 'Web Application',
          technologyStack: ['React'],
          startDate: '2026-10-09T00:00:00.000Z',
          endDate: '2026-10-15T00:00:00.000Z',
          status: 'ACTIVE',
          userRole: 'PROJECT_ADMIN',
          createdById: 'u1',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      },
    }),
  },
}));

vi.mock('../api/work.api', () => ({
  workApi: {
    getProjectWorkItems: vi.fn().mockResolvedValue({
      success: true,
      data: {
        workItems: [],
        stats: {
          total: 2,
          inProgress: 0,
          completed: 0,
          overdue: 0,
          completionPercentage: 0,
        },
      },
    }),
  },
}));

vi.mock('../api/activity.api', () => ({
  activityApi: {
    getProjectActivities: vi.fn().mockResolvedValue({
      success: true,
      data: {
        activities: [],
      },
    }),
  },
}));

vi.mock('../router/Router', () => ({
  useRouter: () => ({
    path: '/app/projects/test-proj-1',
    navigate: vi.fn(),
  }),
  Link: ({ children, to, className }: any) => <a href={to} className={className}>{children}</a>,
}));

describe('ProjectOverviewPage Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders embedded ProjectOverviewPage with ApplicationCategoryIcon and metrics without errors', async () => {
    render(
      <ProjectOverviewPage
        project={mockProject}
        hideHeader={true}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Total Work Items')).toBeInTheDocument();
      expect(screen.getByText('In Progress')).toBeInTheDocument();
      expect(screen.getByText('Completed')).toBeInTheDocument();
      expect(screen.getByText('Project Timeline')).toBeInTheDocument();
    });

    // Check category rendering with ApplicationCategoryIcon
    expect(screen.getByText('Web Application')).toBeInTheDocument();
  });

  it('renders standalone ProjectOverviewPage with ProjectWorkspaceHeader when hideHeader is false', async () => {
    render(
      <ProjectOverviewPage
        project={mockProject}
        hideHeader={false}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('d-board')).toBeInTheDocument();
      expect(screen.getByText('ACTIVE')).toBeInTheDocument();
      expect(screen.getByText('Create Work Item')).toBeInTheDocument();
      expect(screen.getByText('Project Timeline')).toBeInTheDocument();
    });
  });
});
