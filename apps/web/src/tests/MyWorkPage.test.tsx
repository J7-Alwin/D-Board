import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MyWorkPage } from '../pages/app/MyWorkPage';
import { myWorkApi } from '../api/myWork.api';
import { projectsApi } from '../api/projects.api';
import { WorkspaceContext } from '../context/WorkspaceContext';
import { AuthContext } from '../context/AuthContext';

vi.mock('../api/myWork.api', () => ({
  myWorkApi: {
    getMyWork: vi.fn(),
  },
}));

vi.mock('../api/projects.api', () => ({
  projectsApi: {
    getUserProjects: vi.fn(),
  },
}));

vi.mock('../api/work.api', () => ({
  workApi: {
    deleteWorkItem: vi.fn(),
  },
}));

vi.mock('../router/Router', () => ({
  useRouter: () => ({
    navigate: vi.fn(),
    path: '/app/my-work',
  }),
  Link: ({ children, to, ...props }: any) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

describe('MyWorkPage Component Tests', () => {
  const mockUser = {
    id: 'user-1',
    fullName: 'Alwin James',
    username: 'aj07',
    email: 'alwin@example.com',
  };

  const mockWorkspace = {
    id: 'ws-123',
    name: 'Test Workspace',
    slug: 'test-ws',
    ownerId: 'user-1',
    isPersonal: false,
  };

  const mockProjects = [
    {
      id: 'proj-1',
      name: 'Test Project',
      key: 'TP',
      workspaceId: 'ws-123',
      createdById: 'user-1',
    },
  ];

  const mockWorkItems = [
    {
      id: 'item-1',
      title: 'Documentation task',
      description: 'Write docs',
      status: 'TODO',
      priority: 'HIGH',
      type: 'TASK',
      projectId: 'proj-1',
      project: { id: 'proj-1', name: 'Test Project', key: 'TP' },
      createdById: 'user-1',
      assignedToId: 'user-1',
      dueDate: '2026-10-25T12:00:00Z',
    },
    {
      id: 'item-2',
      title: 'Canceled feature work',
      description: 'Work canceled by client',
      status: 'BLOCKED',
      priority: 'MEDIUM',
      type: 'FEATURE',
      projectId: 'proj-1',
      project: { id: 'proj-1', name: 'Test Project', key: 'TP' },
      createdById: 'user-1',
      assignedToId: 'user-1',
      dueDate: '2026-10-28T12:00:00Z',
    },
  ];

  const mockSummary = {
    total: 2,
    createdTotal: 2,
    inProgress: 0,
    dueSoon: 1,
    overdue: 0,
    blocked: 1,
    canceled: 1,
    completed: 0,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (projectsApi.getUserProjects as any).mockResolvedValue({
      success: true,
      data: { all: mockProjects, owned: mockProjects, joined: [] },
    });
    (myWorkApi.getMyWork as any).mockResolvedValue({
      success: true,
      data: {
        workItems: mockWorkItems,
        summary: mockSummary,
        pagination: { page: 1, limit: 10, total: 2, totalPages: 1 },
      },
    });
  });

  const renderWithProviders = (ws = mockWorkspace) => {
    return render(
      <AuthContext.Provider value={{ user: mockUser as any, token: 'fake-token' } as any}>
        <WorkspaceContext.Provider
          value={{
            activeWorkspace: ws as any,
            activeRole: 'OWNER',
            workspaces: [ws as any],
            isLoading: false,
          } as any}
        >
          <MyWorkPage />
        </WorkspaceContext.Provider>
      </AuthContext.Provider>
    );
  };

  it('1. removes the Blocked summary card from the top metric cards grid', async () => {
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText('Assigned to You')).toBeInTheDocument();
      expect(screen.getByText('Created by You')).toBeInTheDocument();
      expect(screen.getByText('In Progress')).toBeInTheDocument();
      expect(screen.getByText('Due Soon')).toBeInTheDocument();
      expect(screen.getByText('Overdue')).toBeInTheDocument();
      expect(screen.getByText('Completed')).toBeInTheDocument();
    });

    // Verify there is no summary card for Blocked
    const blockedLabels = screen.queryAllByText('Blocked');
    expect(blockedLabels).toHaveLength(0);
    expect(screen.queryByText('Blocked items')).not.toBeInTheDocument();
  });

  it('2. renames Blocked tab to Canceled with count', async () => {
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Canceled \(1\)/i })).toBeInTheDocument();
    });

    expect(screen.queryByRole('button', { name: /Blocked/i })).not.toBeInTheDocument();
  });

  it('3. displays Canceled tag for work items with BLOCKED status', async () => {
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Canceled \(1\)/i })).toBeInTheDocument();
    });

    const itemTitles = screen.getAllByText('Canceled feature work');
    expect(itemTitles.length).toBeGreaterThan(0);

    // The status pill for BLOCKED work item should display "Canceled"
    const canceledBadges = screen.getAllByText('Canceled');
    expect(canceledBadges.length).toBeGreaterThan(0);
  });

  it('4. scopes data requests to the active workspace ID', async () => {
    renderWithProviders(mockWorkspace);

    await waitFor(() => {
      expect(projectsApi.getUserProjects).toHaveBeenCalledWith('ws-123');
      expect(myWorkApi.getMyWork).toHaveBeenCalledWith(
        expect.objectContaining({ tab: 'my-work' }),
        'ws-123'
      );
    });
  });
});
