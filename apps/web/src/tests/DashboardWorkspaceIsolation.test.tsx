import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DashboardPage } from '../pages/app/DashboardPage';
import * as WorkspaceContextModule from '../context/WorkspaceContext';
import * as AuthContextModule from '../context/AuthContext';
import { dashboardApi } from '../api/dashboard.api';
import { invitationsApi } from '../api/invitations.api';

const mockNavigate = vi.fn();

// Mock Router
vi.mock('../router/Router', () => ({
  Link: ({ children, to, className, ...props }: any) => (
    <a href={to} className={className} data-testid={props['data-testid'] || 'nav-link'}>
      {children}
    </a>
  ),
  useRouter: () => ({
    path: '/app',
    navigate: mockNavigate,
  }),
}));

// Mock APIs
vi.mock('../api/dashboard.api', () => ({
  dashboardApi: {
    getDashboard: vi.fn(),
  },
}));

vi.mock('../api/invitations.api', () => ({
  invitationsApi: {
    getUserInvitations: vi.fn().mockResolvedValue({
      success: true,
      data: { invitations: [] },
    }),
  },
}));

describe('Dashboard Workspace Isolation & Switching Tests', () => {
  const mockUser = {
    id: 'user-1',
    fullName: 'Alex Developer',
    username: 'alexdev',
    email: 'alex@example.com',
  };

  const wsA = {
    id: 'ws-alpha',
    name: 'Workspace Alpha',
    slug: 'workspace-alpha',
    avatarUrl: null,
    ownerId: 'user-1',
    isPersonal: true,
    isOwner: true,
    userRole: 'OWNER' as const,
    memberCount: 1,
    projectCount: 2,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    owner: mockUser,
  };

  const wsB = {
    id: 'ws-beta',
    name: 'Workspace Beta',
    slug: 'workspace-beta',
    avatarUrl: null,
    ownerId: 'user-2',
    isPersonal: false,
    isOwner: false,
    userRole: 'WORKSPACE_MEMBER' as const,
    memberCount: 5,
    projectCount: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    owner: { id: 'user-2', fullName: 'Bob Boss', username: 'bobboss', avatarUrl: null },
  };

  const alphaData = {
    stats: {
      myProjectsCount: 1,
      joinedProjectsCount: 0,
      myOpenWorkCount: 3,
      upcomingDeadlinesCount: 1,
    },
    recentProjects: [],
    myProjects: [
      {
        id: 'proj-alpha-1',
        name: 'Alpha Core Engine',
        key: 'ACE',
        description: 'Core systems for Workspace Alpha',
        category: 'Engineering',
        role: 'PROJECT_ADMIN',
        status: 'ACTIVE',
        createdById: 'user-1',
        taskCount: 5,
        progress: 40,
        visibility: 'Workspace',
        owner: mockUser,
        members: [{ user: mockUser, role: 'PROJECT_ADMIN' }],
      },
    ],
    joinedProjects: [],
    recentActivities: [],
  };

  const betaData = {
    stats: {
      myProjectsCount: 0,
      joinedProjectsCount: 1,
      myOpenWorkCount: 7,
      upcomingDeadlinesCount: 2,
    },
    recentProjects: [],
    myProjects: [],
    joinedProjects: [
      {
        id: 'proj-beta-1',
        name: 'Beta Mobile App',
        key: 'BMA',
        description: 'Mobile client for Workspace Beta',
        category: 'Mobile',
        role: 'PROJECT_MEMBER',
        status: 'ACTIVE',
        createdById: 'user-2',
        taskCount: 12,
        progress: 62,
        visibility: 'Restricted',
        owner: { id: 'user-2', fullName: 'Bob Boss' },
        members: [],
      },
    ],
    recentActivities: [],
  };

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
  });

  it('1. loads dashboard scoped strictly to active workspace (Workspace Alpha)', async () => {
    vi.spyOn(WorkspaceContextModule, 'useWorkspace').mockReturnValue({
      workspaces: { owned: [wsA], joined: [wsB] },
      activeWorkspace: wsA,
      activeRole: 'OWNER',
      isLoading: false,
      error: null,
      setActiveWorkspaceId: vi.fn(),
      createWorkspace: vi.fn(),
      refreshWorkspaces: vi.fn(),
    });

    vi.mocked(dashboardApi.getDashboard).mockResolvedValueOnce({
      success: true,
      data: alphaData,
    } as any);

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Alpha Core Engine')).toBeInTheDocument();
    });

    // Verify Workspace Beta project is NOT present
    expect(screen.queryByText('Beta Mobile App')).not.toBeInTheDocument();

    // Verify View All button navigates to /app/projects
    const viewAllButtons = screen.getAllByRole('button', { name: /view all/i });
    const projectsViewAllBtn = viewAllButtons.find((btn) => btn.textContent?.trim() === 'View All');
    expect(projectsViewAllBtn).toBeDefined();
    fireEvent.click(projectsViewAllBtn!);
    expect(mockNavigate).toHaveBeenCalledWith('/app/projects');
  });

  it('2. reloads dashboard when active workspace switches to Workspace Beta', async () => {
    const useWorkspaceSpy = vi.spyOn(WorkspaceContextModule, 'useWorkspace');

    // First render with Workspace Alpha
    useWorkspaceSpy.mockReturnValue({
      workspaces: { owned: [wsA], joined: [wsB] },
      activeWorkspace: wsA,
      activeRole: 'OWNER',
      isLoading: false,
      error: null,
      setActiveWorkspaceId: vi.fn(),
      createWorkspace: vi.fn(),
      refreshWorkspaces: vi.fn(),
    });

    vi.mocked(dashboardApi.getDashboard).mockResolvedValueOnce({
      success: true,
      data: alphaData,
    } as any);

    const { rerender } = render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Alpha Core Engine')).toBeInTheDocument();
    });

    // Now switch active workspace to Workspace Beta
    useWorkspaceSpy.mockReturnValue({
      workspaces: { owned: [wsA], joined: [wsB] },
      activeWorkspace: wsB,
      activeRole: 'WORKSPACE_MEMBER',
      isLoading: false,
      error: null,
      setActiveWorkspaceId: vi.fn(),
      createWorkspace: vi.fn(),
      refreshWorkspaces: vi.fn(),
    });

    vi.mocked(dashboardApi.getDashboard).mockResolvedValueOnce({
      success: true,
      data: betaData,
    } as any);

    rerender(<DashboardPage />);

    // Dashboard should update with Beta's project and Alpha's project should be gone
    await waitFor(() => {
      expect(screen.getByText('Beta Mobile App')).toBeInTheDocument();
    });
    expect(screen.queryByText('Alpha Core Engine')).not.toBeInTheDocument();
  });

  it('3. discards stale responses when workspace switches rapidly (race condition guard)', async () => {
    const useWorkspaceSpy = vi.spyOn(WorkspaceContextModule, 'useWorkspace');

    useWorkspaceSpy.mockReturnValue({
      workspaces: { owned: [wsA], joined: [wsB] },
      activeWorkspace: wsA,
      activeRole: 'OWNER',
      isLoading: false,
      error: null,
      setActiveWorkspaceId: vi.fn(),
      createWorkspace: vi.fn(),
      refreshWorkspaces: vi.fn(),
    });

    // Create a slow promise for wsA
    let resolveSlowAlpha: (val: any) => void;
    const slowAlphaPromise = new Promise((resolve) => {
      resolveSlowAlpha = resolve;
    });

    vi.mocked(dashboardApi.getDashboard).mockReturnValueOnce(slowAlphaPromise as any);

    const { rerender } = render(<DashboardPage />);

    // Fast switch to wsB before wsA resolves
    useWorkspaceSpy.mockReturnValue({
      workspaces: { owned: [wsA], joined: [wsB] },
      activeWorkspace: wsB,
      activeRole: 'WORKSPACE_MEMBER',
      isLoading: false,
      error: null,
      setActiveWorkspaceId: vi.fn(),
      createWorkspace: vi.fn(),
      refreshWorkspaces: vi.fn(),
    });

    vi.mocked(dashboardApi.getDashboard).mockResolvedValueOnce({
      success: true,
      data: betaData,
    } as any);

    rerender(<DashboardPage />);

    // Fast wsB completes first
    await waitFor(() => {
      expect(screen.getByText('Beta Mobile App')).toBeInTheDocument();
    });

    // Now slow wsA finally completes
    resolveSlowAlpha!({
      success: true,
      data: alphaData,
    });

    // Should NOT overwrite wsB data with stale wsA data
    await waitFor(() => {
      expect(screen.getByText('Beta Mobile App')).toBeInTheDocument();
    });
    expect(screen.queryByText('Alpha Core Engine')).not.toBeInTheDocument();
  });

  it('4. clears previous workspace data and does not show stale data when new workspace fetch fails (500)', async () => {
    const useWorkspaceSpy = vi.spyOn(WorkspaceContextModule, 'useWorkspace');

    // 1. Initial render with Workspace Alpha
    useWorkspaceSpy.mockReturnValue({
      workspaces: { owned: [wsA], joined: [wsB] },
      activeWorkspace: wsA,
      activeRole: 'OWNER',
      isLoading: false,
      error: null,
      setActiveWorkspaceId: vi.fn(),
      createWorkspace: vi.fn(),
      refreshWorkspaces: vi.fn(),
    });

    vi.mocked(dashboardApi.getDashboard).mockResolvedValueOnce({
      success: true,
      data: alphaData,
    } as any);

    const { rerender } = render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Alpha Core Engine')).toBeInTheDocument();
    });

    // 2. Switch to Workspace Beta, which rejects with a 500 error
    useWorkspaceSpy.mockReturnValue({
      workspaces: { owned: [wsA], joined: [wsB] },
      activeWorkspace: wsB,
      activeRole: 'WORKSPACE_MEMBER',
      isLoading: false,
      error: null,
      setActiveWorkspaceId: vi.fn(),
      createWorkspace: vi.fn(),
      refreshWorkspaces: vi.fn(),
    });

    vi.mocked(dashboardApi.getDashboard).mockRejectedValueOnce(new Error('Internal Server Error'));

    rerender(<DashboardPage />);

    // Alpha data must immediately disappear and never reappear
    await waitFor(() => {
      expect(screen.queryByText('Alpha Core Engine')).not.toBeInTheDocument();
    });
    expect(screen.getByText('Internal Server Error')).toBeInTheDocument();
  });

  it('5. clears previous workspace data and does not show stale data when new workspace returns 403 (revoked membership)', async () => {
    const useWorkspaceSpy = vi.spyOn(WorkspaceContextModule, 'useWorkspace');

    // 1. Initial render with Workspace Alpha
    useWorkspaceSpy.mockReturnValue({
      workspaces: { owned: [wsA], joined: [wsB] },
      activeWorkspace: wsA,
      activeRole: 'OWNER',
      isLoading: false,
      error: null,
      setActiveWorkspaceId: vi.fn(),
      createWorkspace: vi.fn(),
      refreshWorkspaces: vi.fn(),
    });

    vi.mocked(dashboardApi.getDashboard).mockResolvedValueOnce({
      success: true,
      data: alphaData,
    } as any);

    const { rerender } = render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Alpha Core Engine')).toBeInTheDocument();
    });

    // 2. Switch to Workspace Beta where user membership was revoked (403 Forbidden)
    useWorkspaceSpy.mockReturnValue({
      workspaces: { owned: [wsA], joined: [wsB] },
      activeWorkspace: wsB,
      activeRole: 'WORKSPACE_MEMBER',
      isLoading: false,
      error: null,
      setActiveWorkspaceId: vi.fn(),
      createWorkspace: vi.fn(),
      refreshWorkspaces: vi.fn(),
    });

    const forbiddenError = {
      response: {
        status: 403,
        data: { message: 'You do not have access to this workspace' },
      },
    };
    vi.mocked(dashboardApi.getDashboard).mockRejectedValueOnce(forbiddenError);

    rerender(<DashboardPage />);

    // Stale Alpha data must NOT be shown
    await waitFor(() => {
      expect(screen.queryByText('Alpha Core Engine')).not.toBeInTheDocument();
    });
    expect(screen.getByText('You do not have access to this workspace')).toBeInTheDocument();
  });

  it('6. handles multi-step out-of-order switching (wsA -> wsB -> wsC) without stale response leaks', async () => {
    const wsC = {
      id: 'ws-gamma',
      name: 'Workspace Gamma',
      slug: 'workspace-gamma',
      avatarUrl: null,
      ownerId: 'user-1',
      isPersonal: false,
      isOwner: true,
      userRole: 'OWNER' as const,
      memberCount: 2,
      projectCount: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      owner: mockUser,
    };

    const gammaData = {
      stats: { myProjectsCount: 1, joinedProjectsCount: 0, myOpenWorkCount: 1, upcomingDeadlinesCount: 0 },
      recentProjects: [],
      myProjects: [
        {
          id: 'proj-gamma-1',
          name: 'Gamma Deep Space',
          key: 'GDS',
          description: 'Gamma mission operations',
          category: 'Space',
          role: 'PROJECT_ADMIN',
          status: 'ACTIVE',
          createdById: 'user-1',
          taskCount: 2,
          progress: 80,
          visibility: 'Workspace',
          owner: mockUser,
          members: [],
        },
      ],
      joinedProjects: [],
      recentActivities: [],
    };

    const useWorkspaceSpy = vi.spyOn(WorkspaceContextModule, 'useWorkspace');

    // 1. Start on wsA with slow response
    let resolveWsA: any;
    const wsAPromise = new Promise((resolve) => { resolveWsA = resolve; });
    vi.mocked(dashboardApi.getDashboard).mockReturnValueOnce(wsAPromise as any);

    useWorkspaceSpy.mockReturnValue({
      workspaces: { owned: [wsA, wsC], joined: [wsB] },
      activeWorkspace: wsA,
      activeRole: 'OWNER',
      isLoading: false,
      error: null,
      setActiveWorkspaceId: vi.fn(),
      createWorkspace: vi.fn(),
      refreshWorkspaces: vi.fn(),
    });

    const { rerender } = render(<DashboardPage />);

    // 2. Switch quickly to wsB with failing response
    let rejectWsB: any;
    const wsBPromise = new Promise((_, reject) => { rejectWsB = reject; });
    vi.mocked(dashboardApi.getDashboard).mockReturnValueOnce(wsBPromise as any);

    useWorkspaceSpy.mockReturnValue({
      workspaces: { owned: [wsA, wsC], joined: [wsB] },
      activeWorkspace: wsB,
      activeRole: 'WORKSPACE_MEMBER',
      isLoading: false,
      error: null,
      setActiveWorkspaceId: vi.fn(),
      createWorkspace: vi.fn(),
      refreshWorkspaces: vi.fn(),
    });

    rerender(<DashboardPage />);

    // 3. Switch to wsC which immediately resolves successfully
    vi.mocked(dashboardApi.getDashboard).mockResolvedValueOnce({
      success: true,
      data: gammaData,
    } as any);

    useWorkspaceSpy.mockReturnValue({
      workspaces: { owned: [wsA, wsC], joined: [wsB] },
      activeWorkspace: wsC,
      activeRole: 'OWNER',
      isLoading: false,
      error: null,
      setActiveWorkspaceId: vi.fn(),
      createWorkspace: vi.fn(),
      refreshWorkspaces: vi.fn(),
    });

    rerender(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Gamma Deep Space')).toBeInTheDocument();
    });

    // Now resolve wsA and reject wsB out of order
    resolveWsA({ success: true, data: alphaData });
    rejectWsB(new Error('wsB failed'));

    // Gamma data must remain cleanly intact
    await waitFor(() => {
      expect(screen.getByText('Gamma Deep Space')).toBeInTheDocument();
    });
    expect(screen.queryByText('Alpha Core Engine')).not.toBeInTheDocument();
    expect(screen.queryByText('wsB failed')).not.toBeInTheDocument();
  });
});
