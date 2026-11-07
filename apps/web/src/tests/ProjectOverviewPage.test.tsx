import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom';
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

let mockWorkspaceRole: string = 'OWNER';
let mockIsOwner: boolean = true;

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'u1', username: 'testuser', email: 'test@example.com' },
  }),
}));

vi.mock('../context/WorkspaceContext', () => ({
  useWorkspace: () => ({
    activeWorkspace: {
      id: 'ws-1',
      name: 'Test Workspace',
      isOwner: mockIsOwner,
      userRole: mockWorkspaceRole,
      ownerId: mockIsOwner ? 'u1' : 'owner-other',
    },
    activeRole: mockWorkspaceRole,
    isLoading: false,
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
    getCompletionStatus: vi.fn().mockResolvedValue({
      success: true,
      data: {
        status: 'ACTIVE',
        pendingRequest: null,
        canDirectComplete: true,
        canRequestComplete: true,
      },
    }),
    completeProject: vi.fn().mockResolvedValue({ success: true }),
    reactivateProject: vi.fn().mockResolvedValue({ success: true }),
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
    mockWorkspaceRole = 'OWNER';
    mockIsOwner = true;
  });

  it('renders embedded ProjectOverviewPage with ApplicationCategoryIcon and metrics without errors', async () => {
    render(
      <ProjectOverviewPage
        project={mockProject}
        hideHeader={true}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Total Tasks')).toBeInTheDocument();
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
      expect(screen.getByText('Create Task')).toBeInTheDocument();
      expect(screen.getByText('Project Timeline')).toBeInTheDocument();
    });
  });

  it('renders direct Mark Project as Complete button for Workspace Admin identical to Workspace Owner', async () => {
    mockWorkspaceRole = 'WORKSPACE_ADMIN';
    mockIsOwner = false;

    render(
      <ProjectOverviewPage
        project={{ ...mockProject, userRole: 'PROJECT_MEMBER' }}
        hideHeader={true}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Mark Project as Complete')).toBeInTheDocument();
      expect(screen.getByText(/As workspace administrator, your action immediately moves this project/i)).toBeInTheDocument();
    });
  });

  it('renders direct Mark Project as Complete button for Workspace Owner', async () => {
    mockWorkspaceRole = 'OWNER';
    mockIsOwner = true;

    render(
      <ProjectOverviewPage
        project={mockProject}
        hideHeader={true}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Mark Project as Complete')).toBeInTheDocument();
      expect(screen.getByText(/As workspace owner, your action immediately moves this project/i)).toBeInTheDocument();
    });
  });

  it('renders successfully and does not crash when secondary activityApi fails', async () => {
    const { activityApi } = await import('../api/activity.api');
    vi.mocked(activityApi.getProjectActivities).mockRejectedValueOnce(new Error('Activity service down'));

    render(
      <ProjectOverviewPage
        project={mockProject}
        hideHeader={true}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Total Tasks')).toBeInTheDocument();
      expect(screen.getByText('In Progress')).toBeInTheDocument();
      expect(screen.getByText('Completed')).toBeInTheDocument();
    });

    // Main page renders fine without crashing into error state
    expect(screen.queryByText('Unable to load project')).not.toBeInTheDocument();
  });

  it('opens and renders refined Mark Project as Complete modal for Workspace Owner with editorial UI design', async () => {
    mockWorkspaceRole = 'OWNER';
    mockIsOwner = true;

    render(
      <ProjectOverviewPage
        project={mockProject}
        hideHeader={true}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Mark Project as Complete')).toBeInTheDocument();
    });

    const markCompleteBtn = screen.getByText('Mark Project as Complete');
    fireEvent.click(markCompleteBtn);

    await waitFor(() => {
      const modal = screen.getByRole('dialog');
      expect(within(modal).getByText('Deliverables Health')).toBeInTheDocument();
      expect(within(modal).getByText('Total Tasks')).toBeInTheDocument();
      expect(within(modal).getByText('Remaining Open')).toBeInTheDocument();
      expect(within(modal).getByText('Completion Summary & Release Notes (Optional)')).toBeInTheDocument();
      expect(within(modal).getByText('Read-Only Protection:')).toBeInTheDocument();
      expect(within(modal).getByText('Confirm & Complete Project')).toBeInTheDocument();
    });
  });

  it('opens and renders Request Project Completion modal with leadership notes and dark submit button', async () => {
    mockWorkspaceRole = 'WORKSPACE_MEMBER';
    mockIsOwner = false;

    render(
      <ProjectOverviewPage
        project={{ ...mockProject, userRole: 'PROJECT_MEMBER' }}
        hideHeader={true}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Request Project Completion')).toBeInTheDocument();
    });

    const requestBtn = screen.getByText('Request Project Completion');
    fireEvent.click(requestBtn);

    await waitFor(() => {
      const modal = screen.getByRole('dialog');
      expect(within(modal).getByText('Deliverables Health')).toBeInTheDocument();
      expect(within(modal).getByText('Completion Notes for Leadership (Recommended)')).toBeInTheDocument();
      expect(within(modal).getByText('Submit Completion Request')).toBeInTheDocument();
      expect(within(modal).getByPlaceholderText(/Describe key deliverables, milestones completed/i)).toBeInTheDocument();
    });
  });

    it('correctly displays member role tags: only OWNER, ADMIN, and MEMBER (no P-ADMIN prefix)', async () => {
      const projectWithMembers: Project = {
        ...mockProject,
        workspace: {
          id: 'ws-1',
          ownerId: 'u1',
          members: [
            { userId: 'u1', role: 'OWNER' },
            { userId: 'u2', role: 'WORKSPACE_ADMIN' },
            { userId: 'u3', role: 'WORKSPACE_MEMBER' },
          ],
        } as any,
        members: [
          {
            id: 'pm-1',
            userId: 'u1', // Workspace Owner
            role: 'PROJECT_ADMIN',
            joinedAt: new Date().toISOString(),
            user: { id: 'u1', fullName: 'Alwin James', username: 'aj07', avatarUrl: null },
          },
          {
            id: 'pm-2',
            userId: 'u2', // Workspace Admin / Project Admin
            role: 'PROJECT_ADMIN',
            joinedAt: new Date().toISOString(),
            user: { id: 'u2', fullName: 'Admin User', username: 'wadmin', avatarUrl: null },
          },
          {
            id: 'pm-3',
            userId: 'u3', // Workspace Member / Project Member
            role: 'PROJECT_MEMBER',
            joinedAt: new Date().toISOString(),
            user: { id: 'u3', fullName: 'd-board', username: 'dboard', avatarUrl: null },
          },
        ],
      };

      render(
        <ProjectOverviewPage
          project={projectWithMembers}
          hideHeader={true}
        />
      );

      await waitFor(() => {
        // Workspace Owner must be tagged as OWNER
        expect(screen.getByText('OWNER')).toBeInTheDocument();
        // Admin must be tagged as ADMIN
        expect(screen.getByText('ADMIN')).toBeInTheDocument();
        // Member must be tagged as MEMBER
        expect(screen.getByText('MEMBER')).toBeInTheDocument();
        // Must not contain P-ADMIN or P-MEMBER
        expect(screen.queryByText('P-ADMIN')).not.toBeInTheDocument();
        expect(screen.queryByText('P-MEMBER')).not.toBeInTheDocument();
      });
    });

    it('correctly displays OWNER tag when workspace owner is a project member without project admin role', async () => {
      const projectWithOwnerAsMember: Project = {
        ...mockProject,
        createdById: 'u2',
        workspace: {
          id: 'ws-1',
          ownerId: 'u-owner',
          members: [
            { userId: 'u-owner', role: 'OWNER' },
            { userId: 'u2', role: 'WORKSPACE_ADMIN' },
          ],
        } as any,
        members: [
          {
            id: 'pm-owner',
            userId: 'u-owner',
            role: 'PROJECT_MEMBER',
            joinedAt: new Date().toISOString(),
            user: { id: 'u-owner', fullName: 'Owner Person', username: 'owneruser', avatarUrl: null },
          },
        ],
      };

      render(
        <ProjectOverviewPage
          project={projectWithOwnerAsMember}
          hideHeader={true}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('OWNER')).toBeInTheDocument();
      });
    });
  });
