import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ProjectsPage } from '../pages/app/ProjectsPage';
import * as WorkspaceContextModule from '../context/WorkspaceContext';
import * as AuthContextModule from '../context/AuthContext';
import { projectsApi } from '../api/projects.api';

const mockNavigate = vi.fn();

// Mock Router
vi.mock('../router/Router', () => ({
  Link: ({ children, to, className, ...props }: any) => (
    <a href={to} className={className} data-testid={props['data-testid'] || 'nav-link'}>
      {children}
    </a>
  ),
  useRouter: () => ({
    path: '/app/projects',
    navigate: mockNavigate,
  }),
}));

// Mock APIs
vi.mock('../api/projects.api', () => ({
  projectsApi: {
    getUserProjects: vi.fn(),
    archiveProject: vi.fn(),
    unarchiveProject: vi.fn(),
    deleteProject: vi.fn(),
  },
}));

describe('ProjectsPage Component Tests', () => {
  const mockUser = {
    id: 'user-1',
    fullName: 'Alex Developer',
    username: 'alexdev',
    email: 'alex@example.com',
  };

  const mockOwnerWorkspace = {
    id: 'ws-team',
    name: 'Apollo Engineering',
    slug: 'apollo-engineering',
    avatarUrl: null,
    ownerId: 'user-1',
    isPersonal: false,
    isOwner: true,
    userRole: 'OWNER' as const,
    memberCount: 8,
    projectCount: 4,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    owner: mockUser,
  };

  const mockMemberWorkspace = {
    id: 'ws-team-2',
    name: 'Beta Labs',
    slug: 'beta-labs',
    avatarUrl: null,
    ownerId: 'user-999',
    isPersonal: false,
    isOwner: false,
    userRole: 'WORKSPACE_MEMBER' as const,
    memberCount: 15,
    projectCount: 4,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    owner: { id: 'user-999', username: 'otherowner', fullName: 'Other Owner', avatarUrl: null },
  };

  const sampleProjects = [
    {
      id: 'proj-1',
      name: 'Falcon Heavy Avionics',
      key: 'FHA',
      description: 'Flight computer telemetry and guidance systems.',
      category: 'ENGINEERING',
      createdById: 'user-1',
      status: 'ACTIVE' as const,
      userRole: 'PROJECT_ADMIN' as const,
      visibility: 'Workspace' as const,
      taskCount: 10,
      completedTaskCount: 7,
      progress: 70,
      technologyStack: ['Rust', 'C++', 'RTOS'],
      memberCount: 4,
      members: [{ user: mockUser, role: 'PROJECT_ADMIN' }],
      updatedAt: '2026-10-10T00:00:00Z',
    },
    {
      id: 'proj-2',
      name: 'Lunar Rover Telemetry',
      key: 'LRT',
      description: 'Surface navigation and sample collection automation.',
      category: 'DESIGN',
      createdById: 'user-2', // owned by someone else in the workspace!
      status: 'ACTIVE' as const,
      userRole: 'PROJECT_MEMBER' as const,
      visibility: 'Restricted' as const,
      taskCount: 20,
      completedTaskCount: 5,
      progress: 25,
      technologyStack: ['Python', 'ROS'],
      memberCount: 6,
      members: [],
      updatedAt: '2026-10-08T00:00:00Z',
    },
    {
      id: 'proj-3',
      name: 'Orbital Ground Station',
      key: 'OGS',
      description: 'Satellite downlink array and ground station controls.',
      category: 'INFRASTRUCTURE',
      createdById: 'user-1',
      status: 'ARCHIVED' as const,
      userRole: 'PROJECT_ADMIN' as const,
      visibility: 'Workspace' as const,
      taskCount: 15,
      completedTaskCount: 15,
      progress: 100,
      technologyStack: ['Go', 'Kubernetes'],
      memberCount: 2,
      members: [{ user: mockUser, role: 'PROJECT_ADMIN' }],
      updatedAt: '2026-09-01T00:00:00Z',
    },
    {
      id: 'proj-4',
      name: 'Deep Space Probe',
      key: 'DSP',
      description: 'Autonomous exploration probe mission software.',
      category: 'ENGINEERING',
      createdById: 'user-2',
      status: 'COMPLETED' as const,
      userRole: 'PROJECT_MEMBER' as const,
      visibility: 'Workspace' as const,
      taskCount: 8,
      completedTaskCount: 8,
      progress: 100,
      technologyStack: ['C', 'Assembly'],
      memberCount: 3,
      members: [],
      updatedAt: '2026-08-15T00:00:00Z',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: mockUser as any,
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      updateUser: vi.fn(),
    });

    vi.spyOn(WorkspaceContextModule, 'useWorkspace').mockReturnValue({
      workspaces: { owned: [mockOwnerWorkspace], joined: [] },
      activeWorkspace: mockOwnerWorkspace,
      activeRole: 'OWNER',
      isLoading: false,
      error: null,
      setActiveWorkspaceId: vi.fn(),
      createWorkspace: vi.fn(),
      recoverWorkspace: vi.fn(),
      refreshWorkspaces: vi.fn(),
      refreshDeletedWorkspaces: vi.fn(),
      deletedWorkspaces: [],
    });

    vi.mocked(projectsApi.getUserProjects).mockResolvedValue({
      success: true,
      data: {
        owned: [sampleProjects[0], sampleProjects[2]],
        joined: [sampleProjects[1], sampleProjects[3]],
        all: sampleProjects,
      },
    } as any);

    vi.mocked(projectsApi.archiveProject).mockResolvedValue({
      success: true,
      data: { project: { ...sampleProjects[0], status: 'ARCHIVED' } },
    } as any);

    vi.mocked(projectsApi.unarchiveProject).mockResolvedValue({
      success: true,
      data: { project: { ...sampleProjects[2], status: 'ACTIVE' } },
    } as any);
  });

  describe('Workspace Owner View', () => {
    it('1. displays exactly four metric cards (Total, Active, Completed, Archived) and no Owned/Joined cards', async () => {
      render(<ProjectsPage />);

      await waitFor(() => {
        expect(screen.getByText('Falcon Heavy Avionics')).toBeInTheDocument();
      });

      // 4 Metric cards exist
      expect(screen.getByText('Total Projects')).toBeInTheDocument();
      expect(screen.getByText('Active Projects')).toBeInTheDocument();
      expect(screen.getByText('Completed Projects')).toBeInTheDocument();
      expect(screen.getByText('Archived Projects')).toBeInTheDocument();

      // Counts match actual workspace data (4 total, 2 active, 1 completed, 1 archived)
      expect(screen.getByText('4')).toBeInTheDocument(); // Total Projects
      expect(screen.getByText('2')).toBeInTheDocument(); // Active Projects
      expect(screen.getAllByText('1').length).toBe(2); // Completed & Archived cards

      // Redundant metrics for owner are removed
      expect(screen.queryByText('Owned Projects')).not.toBeInTheDocument();
      expect(screen.queryByText('Joined Projects')).not.toBeInTheDocument();
    });

    it('2. displays exactly four primary filter tabs for Workspace Owner (All, Active, Completed, Archived)', async () => {
      render(<ProjectsPage />);

      await waitFor(() => {
        expect(screen.getByText('Falcon Heavy Avionics')).toBeInTheDocument();
      });

      // Tabs
      expect(screen.getByRole('button', { name: /All Projects \(3\)/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Active \(2\)/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Completed \(1\)/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Archived \(1\)/i })).toBeInTheDocument();

      // Should NOT have Owned or Joined tabs
      expect(screen.queryByRole('button', { name: /^Owned/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^Joined/i })).not.toBeInTheDocument();
    });

    it('3. filters projects correctly across tabs (Active, Completed, Archived, All)', async () => {
      render(<ProjectsPage />);

      await waitFor(() => {
        expect(screen.getByText('Falcon Heavy Avionics')).toBeInTheDocument();
      });

      // All Projects tab: includes active and completed, excludes archived
      expect(screen.getByText('Falcon Heavy Avionics')).toBeInTheDocument(); // active
      expect(screen.getByText('Lunar Rover Telemetry')).toBeInTheDocument(); // active (created by another user)
      expect(screen.getByText('Deep Space Probe')).toBeInTheDocument(); // completed
      expect(screen.queryByText('Orbital Ground Station')).not.toBeInTheDocument(); // archived excluded

      // Switch to Active tab
      fireEvent.click(screen.getByRole('button', { name: /Active \(2\)/i }));
      expect(screen.getByText('Falcon Heavy Avionics')).toBeInTheDocument();
      expect(screen.getByText('Lunar Rover Telemetry')).toBeInTheDocument();
      expect(screen.queryByText('Deep Space Probe')).not.toBeInTheDocument();
      expect(screen.queryByText('Orbital Ground Station')).not.toBeInTheDocument();

      // Switch to Completed tab
      fireEvent.click(screen.getByRole('button', { name: /Completed \(1\)/i }));
      expect(screen.getByText('Deep Space Probe')).toBeInTheDocument();
      expect(screen.queryByText('Falcon Heavy Avionics')).not.toBeInTheDocument();
      expect(screen.queryByText('Orbital Ground Station')).not.toBeInTheDocument();

      // Switch to Archived tab
      fireEvent.click(screen.getByRole('button', { name: /Archived \(1\)/i }));
      expect(screen.getByText('Orbital Ground Station')).toBeInTheDocument();
      expect(screen.queryByText('Falcon Heavy Avionics')).not.toBeInTheDocument();
      expect(screen.queryByText('Deep Space Probe')).not.toBeInTheDocument();
    });

    it('4. clicking metric cards acts as filters', async () => {
      render(<ProjectsPage />);

      await waitFor(() => {
        expect(screen.getByText('Falcon Heavy Avionics')).toBeInTheDocument();
      });

      // Click "Completed Projects" metric card
      const completedCard = screen.getByText('Completed Projects').closest('.mywork-summary-card');
      expect(completedCard).toBeDefined();
      fireEvent.click(completedCard!);

      expect(screen.getByText('Deep Space Probe')).toBeInTheDocument();
      expect(screen.queryByText('Falcon Heavy Avionics')).not.toBeInTheDocument();

      // Click "Archived Projects" metric card
      const archivedCard = screen.getByText('Archived Projects').closest('.mywork-summary-card');
      expect(archivedCard).toBeDefined();
      fireEvent.click(archivedCard!);

      expect(screen.getByText('Orbital Ground Station')).toBeInTheDocument();
      expect(screen.queryByText('Deep Space Probe')).not.toBeInTheDocument();
    });

    it('5. renders clean project cards for Workspace Owner without redundant ADMIN or Restricted badges', async () => {
      render(<ProjectsPage />);

      await waitFor(() => {
        expect(screen.getByText('Falcon Heavy Avionics')).toBeInTheDocument();
      });

      // Redundant ADMIN badge and Restricted visibility pills must NOT be shown for owner
      expect(screen.queryByText('ADMIN')).not.toBeInTheDocument();
      expect(screen.queryByText('Restricted')).not.toBeInTheDocument();

      // Status pill should be visible
      expect(screen.getAllByText('Active').length).toBeGreaterThan(0);

      // Task completion format: "X of Y tasks completed"
      expect(screen.getByText('7 of 10 tasks completed')).toBeInTheDocument();
      expect(screen.getByText('5 of 20 tasks completed')).toBeInTheDocument();

      // Open Project action
      const openLinks = screen.getAllByText('Open Project');
      expect(openLinks.length).toBeGreaterThan(0);
      fireEvent.click(openLinks[0]);
      expect(mockNavigate).toHaveBeenCalledWith('/app/projects/proj-1');
    });

    it('6. provides 3-dot overflow menu with Archive and Unarchive workflows with confirmation dialogs', async () => {
      render(<ProjectsPage />);

      await waitFor(() => {
        expect(screen.getByText('Falcon Heavy Avionics')).toBeInTheDocument();
      });

      // Find 3-dot buttons
      const moreButtons = screen.getAllByTitle('Project options');
      expect(moreButtons.length).toBeGreaterThan(0);

      // Open 3-dot menu for first project
      fireEvent.click(moreButtons[0]);

      expect(screen.getByRole('button', { name: /Archive Project/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Project Settings/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Manage Members/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Delete Project/i })).toBeInTheDocument();

      // Click Archive Project -> Opens Archive Modal
      fireEvent.click(screen.getByRole('button', { name: /Archive Project/i }));

      expect(screen.getByText(/Are you sure you want to archive/i)).toBeInTheDocument();
      expect(screen.getByText(/Preserve project records:/i)).toBeInTheDocument();

      // Confirm Archive
      const confirmArchiveBtn = screen.getByRole('button', { name: 'Archive Project' });
      fireEvent.click(confirmArchiveBtn);

      await waitFor(() => {
        expect(projectsApi.archiveProject).toHaveBeenCalledWith('proj-1');
      });

      // Now switch to Archived tab to verify Unarchive
      fireEvent.click(screen.getByRole('button', { name: /Archived \(1\)/i }));
      expect(screen.getByText('Orbital Ground Station')).toBeInTheDocument();

      // Click 3-dot options on archived project
      const archivedMoreBtn = screen.getByTitle('Project options');
      fireEvent.click(archivedMoreBtn);

      expect(screen.getByRole('button', { name: /Unarchive Project/i })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^Archive Project/i })).not.toBeInTheDocument();

      // Click Unarchive Project
      fireEvent.click(screen.getByRole('button', { name: /Unarchive Project/i }));
      expect(screen.getByText(/Restore project:/i)).toBeInTheDocument();

      const confirmUnarchiveBtn = screen.getByRole('button', { name: 'Unarchive Project' });
      fireEvent.click(confirmUnarchiveBtn);

      await waitFor(() => {
        expect(projectsApi.unarchiveProject).toHaveBeenCalledWith('proj-3');
      });
    });
  });

  describe('Role Separation: Project Admin / Project Member View', () => {
    beforeEach(() => {
      vi.spyOn(WorkspaceContextModule, 'useWorkspace').mockReturnValue({
        workspaces: { owned: [], joined: [mockMemberWorkspace] },
        activeWorkspace: mockMemberWorkspace,
        activeRole: 'WORKSPACE_MEMBER',
        isLoading: false,
        error: null,
        setActiveWorkspaceId: vi.fn(),
        createWorkspace: vi.fn(),
        recoverWorkspace: vi.fn(),
        refreshWorkspaces: vi.fn(),
        refreshDeletedWorkspaces: vi.fn(),
        deletedWorkspaces: [],
      });
    });

    it('1. displays 4 metric cards for Project Admin / Workspace Member matching Owner', async () => {
      render(<ProjectsPage />);

      await waitFor(() => {
        expect(screen.getByText('Falcon Heavy Avionics')).toBeInTheDocument();
      });

      // 4 Metric cards
      expect(screen.getByText('Total Projects')).toBeInTheDocument();
      expect(screen.getByText('Active Projects')).toBeInTheDocument();
      expect(screen.getByText('Completed Projects')).toBeInTheDocument();
      expect(screen.getByText('Archived Projects')).toBeInTheDocument();

      // Redundant metrics are not present
      expect(screen.queryByText('Owned Projects')).not.toBeInTheDocument();
      expect(screen.queryByText('Joined Projects')).not.toBeInTheDocument();
    });

    it('2. displays 4 primary tabs for Project Admin / Workspace Member (All, Active, Completed, Archived)', async () => {
      render(<ProjectsPage />);

      await waitFor(() => {
        expect(screen.getByText('Falcon Heavy Avionics')).toBeInTheDocument();
      });

      expect(screen.getByRole('button', { name: /All Projects \(/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^Active \(/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^Completed \(/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^Archived \(/i })).toBeInTheDocument();

      // Should not have Owned or Joined tabs
      expect(screen.queryByRole('button', { name: /^Owned \(/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^Joined \(/i })).not.toBeInTheDocument();
    });

    it('3. renders clean project cards with status pill, Open Project link, and options menu', async () => {
      render(<ProjectsPage />);

      await waitFor(() => {
        expect(screen.getByText('Falcon Heavy Avionics')).toBeInTheDocument();
      });

      // Status pill
      expect(screen.getAllByText('Active').length).toBeGreaterThan(0);

      // Open Project action links
      const openLinks = screen.getAllByText('Open Project');
      expect(openLinks.length).toBeGreaterThan(0);

      // Project options menu button
      const moreButtons = screen.getAllByTitle('Project options');
      expect(moreButtons.length).toBeGreaterThan(0);
    });
  });

  describe('Search and Sorting Controls', () => {
    it('filters projects by search text across name and description', async () => {
      render(<ProjectsPage />);

      await waitFor(() => {
        expect(screen.getByText('Falcon Heavy Avionics')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/Search by name, key, tech/i);
      fireEvent.change(searchInput, { target: { value: 'Avionics' } });

      expect(screen.getByText('Falcon Heavy Avionics')).toBeInTheDocument();
      expect(screen.queryByText('Lunar Rover Telemetry')).not.toBeInTheDocument();
    });
  });

  describe('Role Equivalence: Workspace Admin View matches Workspace Owner', () => {
    beforeEach(() => {
      vi.spyOn(WorkspaceContextModule, 'useWorkspace').mockReturnValue({
        workspaces: { owned: [], joined: [mockMemberWorkspace] },
        activeWorkspace: { ...mockMemberWorkspace, userRole: 'WORKSPACE_ADMIN' },
        activeRole: 'WORKSPACE_ADMIN',
        isLoading: false,
        error: null,
        setActiveWorkspaceId: vi.fn(),
        createWorkspace: vi.fn(),
        recoverWorkspace: vi.fn(),
        refreshWorkspaces: vi.fn(),
        refreshDeletedWorkspaces: vi.fn(),
        deletedWorkspaces: [],
      });
    });

    it('displays exactly four metric cards for Workspace Admin', async () => {
      render(<ProjectsPage />);

      await waitFor(() => {
        expect(screen.getByText('Falcon Heavy Avionics')).toBeInTheDocument();
      });

      expect(screen.getByText('Total Projects')).toBeInTheDocument();
      expect(screen.getByText('Active Projects')).toBeInTheDocument();
      expect(screen.getByText('Completed Projects')).toBeInTheDocument();
      expect(screen.getByText('Archived Projects')).toBeInTheDocument();
      expect(screen.queryByText('Owned Projects')).not.toBeInTheDocument();
      expect(screen.queryByText('Joined Projects')).not.toBeInTheDocument();
    });

    it('displays exactly four primary filter tabs for Workspace Admin', async () => {
      render(<ProjectsPage />);

      await waitFor(() => {
        expect(screen.getByText('Falcon Heavy Avionics')).toBeInTheDocument();
      });

      expect(screen.getByRole('button', { name: /^All Projects \(/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^Active \(/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^Completed \(/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^Archived \(/i })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^Owned \(/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^Joined \(/i })).not.toBeInTheDocument();
    });

    it('provides 3-dot overflow menu and Open Project for Workspace Admin', async () => {
      render(<ProjectsPage />);

      await waitFor(() => {
        expect(screen.getByText('Falcon Heavy Avionics')).toBeInTheDocument();
      });

      const moreButtons = screen.getAllByTitle('Project options');
      expect(moreButtons.length).toBeGreaterThan(0);
      expect(screen.getAllByText('Open Project').length).toBeGreaterThan(0);
    });
  });
});
