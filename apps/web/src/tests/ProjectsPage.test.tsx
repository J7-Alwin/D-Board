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
  },
}));

describe('ProjectsPage Component Tests', () => {
  const mockUser = {
    id: 'user-1',
    fullName: 'Alex Developer',
    username: 'alexdev',
    email: 'alex@example.com',
  };

  const mockWorkspace = {
    id: 'ws-team',
    name: 'Apollo Engineering',
    slug: 'apollo-engineering',
    avatarUrl: null,
    ownerId: 'user-1',
    isPersonal: false,
    isOwner: true,
    userRole: 'OWNER' as const,
    memberCount: 8,
    projectCount: 3,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    owner: mockUser,
  };

  const sampleProjects = [
    {
      id: 'proj-1',
      name: 'Falcon Heavy Avionics',
      key: 'FHA',
      description: 'Flight computer telemetry and guidance systems.',
      category: 'ENGINEERING',
      createdById: 'user-1',
      status: 'ACTIVE',
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
      createdById: 'user-2',
      status: 'ACTIVE',
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
      status: 'ARCHIVED',
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
      workspaces: { owned: [mockWorkspace], joined: [] },
      activeWorkspace: mockWorkspace,
      activeRole: 'OWNER',
      isLoading: false,
      error: null,
      setActiveWorkspaceId: vi.fn(),
      createWorkspace: vi.fn(),
      refreshWorkspaces: vi.fn(),
    });

    vi.mocked(projectsApi.getUserProjects).mockResolvedValue({
      success: true,
      data: {
        owned: [sampleProjects[0], sampleProjects[2]],
        joined: [sampleProjects[1]],
        all: sampleProjects,
      },
    } as any);
  });

  it('1. renders header, workspace badge, and metrics summary cards', async () => {
    render(<ProjectsPage />);

    await waitFor(() => {
      expect(screen.getByText('Falcon Heavy Avionics')).toBeInTheDocument();
    });

    expect(screen.getByRole('heading', { level: 1, name: 'Projects' })).toBeInTheDocument();
    expect(screen.getAllByText('Apollo Engineering').length).toBeGreaterThan(0);

    // Summary cards
    expect(screen.getByText('Total Projects')).toBeInTheDocument();
    expect(screen.getByText('Owned Projects')).toBeInTheDocument();
    expect(screen.getByText('Joined Projects')).toBeInTheDocument();
    expect(screen.getByText(/Tasks/)).toBeInTheDocument();
  });

  it('2. displays project cards with key, visibility pills, role badges, and progress bar', async () => {
    render(<ProjectsPage />);

    await waitFor(() => {
      expect(screen.getByText('Falcon Heavy Avionics')).toBeInTheDocument();
    });

    // Check project keys
    expect(screen.getByText('FHA')).toBeInTheDocument();
    expect(screen.getByText('LRT')).toBeInTheDocument();

    // Visibility badges
    const workspacePills = screen.getAllByText('Workspace');
    expect(workspacePills.length).toBeGreaterThan(0);
    const restrictedPills = screen.getAllByText('Restricted');
    expect(restrictedPills.length).toBeGreaterThan(0);

    // Role badges
    expect(screen.getAllByText('ADMIN').length).toBeGreaterThan(0);
    expect(screen.getAllByText('MEMBER').length).toBeGreaterThan(0);

    // Task counts
    expect(screen.getByText('7/10 tasks')).toBeInTheDocument();
    expect(screen.getByText('5/20 tasks')).toBeInTheDocument();
  });

  it('3. filters projects using search query', async () => {
    render(<ProjectsPage />);

    await waitFor(() => {
      expect(screen.getByText('Falcon Heavy Avionics')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/Search by name, key, tech/i);
    fireEvent.change(searchInput, { target: { value: 'Falcon' } });

    expect(screen.getByText('Falcon Heavy Avionics')).toBeInTheDocument();
    expect(screen.queryByText('Lunar Rover Telemetry')).not.toBeInTheDocument();
    expect(screen.queryByText('Orbital Ground Station')).not.toBeInTheDocument();
  });

  it('4. filters projects by active tabs (Owned, Joined, Active, Archived)', async () => {
    render(<ProjectsPage />);

    await waitFor(() => {
      expect(screen.getByText('Falcon Heavy Avionics')).toBeInTheDocument();
    });

    // Find tab buttons by class or span text
    const tabButtons = screen.getAllByRole('button');
    const joinedTab = tabButtons.find((btn) => btn.classList.contains('dash-tab-btn') && btn.textContent?.includes('Joined'));
    expect(joinedTab).toBeDefined();
    fireEvent.click(joinedTab!);

    expect(screen.getByText('Lunar Rover Telemetry')).toBeInTheDocument();
    expect(screen.queryByText('Falcon Heavy Avionics')).not.toBeInTheDocument();

    // Switch to Archived tab
    const archivedTab = tabButtons.find((btn) => btn.classList.contains('dash-tab-btn') && btn.textContent?.includes('Archived'));
    expect(archivedTab).toBeDefined();
    fireEvent.click(archivedTab!);

    expect(screen.getByText('Orbital Ground Station')).toBeInTheDocument();
    expect(screen.queryByText('Falcon Heavy Avionics')).not.toBeInTheDocument();
    expect(screen.queryByText('Lunar Rover Telemetry')).not.toBeInTheDocument();
  });

  it('5. navigates to project workspace when clicking Open workspace', async () => {
    render(<ProjectsPage />);

    await waitFor(() => {
      expect(screen.getByText('Falcon Heavy Avionics')).toBeInTheDocument();
    });

    const openLinks = screen.getAllByText('Open workspace');
    fireEvent.click(openLinks[0]);

    expect(mockNavigate).toHaveBeenCalledWith('/app/projects/proj-1');
  });

  it('6. provides Manage Project button for project admins', async () => {
    render(<ProjectsPage />);

    await waitFor(() => {
      expect(screen.getByText('Falcon Heavy Avionics')).toBeInTheDocument();
    });

    const manageButtons = screen.getAllByTitle('Manage Project');
    expect(manageButtons.length).toBeGreaterThan(0);

    fireEvent.click(manageButtons[0]);
    expect(mockNavigate).toHaveBeenCalledWith('/app/projects/proj-1');
  });

  it('7. pagination controls display correct page count and handle pagination', async () => {
    // Generate 15 sample projects to test pagination (pageSize is 6 in grid mode)
    const manyProjects = Array.from({ length: 15 }, (_, i) => ({
      ...sampleProjects[0],
      id: `proj-paginated-${i}`,
      name: `Project Number ${i + 1}`,
      key: `P${i + 1}`,
    }));

    vi.mocked(projectsApi.getUserProjects).mockResolvedValueOnce({
      success: true,
      data: {
        owned: manyProjects,
        joined: [],
        all: manyProjects,
      },
    } as any);

    render(<ProjectsPage />);

    await waitFor(() => {
      expect(screen.getByText('Project Number 1')).toBeInTheDocument();
    });

    // Should show page 1 (items 1 to 6)
    expect(screen.getByText('Project Number 6')).toBeInTheDocument();
    expect(screen.queryByText('Project Number 7')).not.toBeInTheDocument();

    // Check pagination info using flexible text matcher
    expect(screen.getByText((content, element) => {
      return Boolean(element?.classList.contains('projects-pagination-info') && element?.textContent?.includes('Showing') && element?.textContent?.includes('15 projects'));
    })).toBeInTheDocument();

    // Navigate to Page 2
    const nextBtn = screen.getByRole('button', { name: /Next/i });
    fireEvent.click(nextBtn);

    expect(screen.getByText('Project Number 7')).toBeInTheDocument();
    expect(screen.queryByText('Project Number 1')).not.toBeInTheDocument();

    // Verify pagination info updated to page 2
    expect(screen.getByText((content, element) => {
      return Boolean(element?.classList.contains('projects-pagination-info') && element?.textContent?.includes('Showing') && element?.textContent?.includes('7 to 12'));
    })).toBeInTheDocument();
  });
});
