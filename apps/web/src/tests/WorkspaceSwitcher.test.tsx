import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { WorkspaceSwitcher } from '../components/workspace/WorkspaceSwitcher';
import * as WorkspaceContextModule from '../context/WorkspaceContext';
import * as AuthContextModule from '../context/AuthContext';

describe('WorkspaceSwitcher Component Tests', () => {
  const mockSetActiveWorkspaceId = vi.fn();
  const mockCreateWorkspace = vi.fn();

  const mockWorkspaces = {
    owned: [
      {
        id: 'ws-personal',
        name: 'Alex Personal',
        slug: 'alex-personal',
        avatarUrl: null,
        ownerId: 'user-1',
        isPersonal: true,
        isOwner: true,
        userRole: 'OWNER' as const,
        memberCount: 1,
        projectCount: 3,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        owner: { id: 'user-1', fullName: 'Alex Dev', username: 'alexdev', avatarUrl: null },
      },
      {
        id: 'ws-team-owned',
        name: 'Alex Ventures',
        slug: 'alex-ventures',
        avatarUrl: null,
        ownerId: 'user-1',
        isPersonal: false,
        isOwner: true,
        userRole: 'OWNER' as const,
        memberCount: 5,
        projectCount: 2,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        owner: { id: 'user-1', fullName: 'Alex Dev', username: 'alexdev', avatarUrl: null },
      },
    ],
    joined: [
      {
        id: 'ws-joined-team',
        name: 'Acme Enterprise',
        slug: 'acme-enterprise',
        avatarUrl: null,
        ownerId: 'user-2',
        isPersonal: false,
        isOwner: false,
        userRole: 'WORKSPACE_MEMBER' as const,
        memberCount: 12,
        projectCount: 8,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        owner: { id: 'user-2', fullName: 'Bob Boss', username: 'bobboss', avatarUrl: null },
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: { id: 'user-1', username: 'alexdev', email: 'alex@example.com' } as any,
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      updateUser: vi.fn(),
    });
    vi.spyOn(WorkspaceContextModule, 'useWorkspace').mockReturnValue({
      workspaces: mockWorkspaces,
      activeWorkspace: mockWorkspaces.owned[0],
      activeRole: 'OWNER',
      isLoading: false,
      error: null,
      setActiveWorkspaceId: mockSetActiveWorkspaceId,
      createWorkspace: mockCreateWorkspace,
      refreshWorkspaces: vi.fn(),
    });
  });

  it('1. renders trigger button with active workspace name and Personal badge', () => {
    render(<WorkspaceSwitcher />);

    const trigger = screen.getByRole('button', { name: /switch workspace/i });
    expect(trigger).toBeDefined();
    expect(screen.getByText('Alex Personal')).toBeDefined();
    expect(screen.getByText('Personal')).toBeDefined();
  });

  it('2. opens dropdown on click and displays My Workspaces and Team Workspaces groups', () => {
    render(<WorkspaceSwitcher />);

    const trigger = screen.getByRole('button', { name: /switch workspace/i });
    fireEvent.click(trigger);

    expect(screen.getByText('MY WORKSPACES')).toBeDefined();
    expect(screen.getByText('(2)')).toBeDefined();
    expect(screen.getByText('TEAM WORKSPACES')).toBeDefined();
    expect(screen.getByText('(1)')).toBeDefined();

    expect(screen.getByText('Alex Ventures')).toBeDefined();
    expect(screen.getByText('Acme Enterprise')).toBeDefined();
    expect(screen.getByText(/by @bobboss/i)).toBeDefined();
  });

  it('3. selects another workspace and triggers setActiveWorkspaceId', () => {
    render(<WorkspaceSwitcher />);

    const trigger = screen.getByRole('button', { name: /switch workspace/i });
    fireEvent.click(trigger);

    const teamWsBtn = screen.getByText('Acme Enterprise').closest('button');
    expect(teamWsBtn).toBeDefined();
    fireEvent.click(teamWsBtn!);

    expect(mockSetActiveWorkspaceId).toHaveBeenCalledWith('ws-joined-team');
  });

  it('4. opens create workspace modal when clicking Create Workspace action', async () => {
    render(<WorkspaceSwitcher />);

    const trigger = screen.getByRole('button', { name: /switch workspace/i });
    fireEvent.click(trigger);

    const createBtn = screen.getByRole('button', { name: /create workspace/i });
    fireEvent.click(createBtn);

    expect(screen.getByText('Create New Workspace')).toBeDefined();
    expect(screen.getByPlaceholderText(/e\.g\. Acme Corp/i)).toBeDefined();
  });

  it('5. submits new workspace form successfully', async () => {
    mockCreateWorkspace.mockResolvedValue({
      id: 'ws-new',
      name: 'Starlight Studio',
      slug: 'starlight-studio',
    });

    render(<WorkspaceSwitcher />);

    // Open dropdown and click create
    fireEvent.click(screen.getByRole('button', { name: /switch workspace/i }));
    fireEvent.click(screen.getByRole('button', { name: /create workspace/i }));

    const nameInput = screen.getByPlaceholderText(/e\.g\. Acme Corp/i);
    fireEvent.change(nameInput, { target: { value: 'Starlight Studio' } });

    const submitBtn = screen.getAllByRole('button', { name: /create workspace/i }).find((b) => b.getAttribute('type') === 'submit');
    expect(submitBtn).toBeDefined();
    fireEvent.click(submitBtn!);

    await waitFor(() => {
      expect(mockCreateWorkspace).toHaveBeenCalledWith({
        name: 'Starlight Studio',
        description: undefined,
      });
    });
  });
});
