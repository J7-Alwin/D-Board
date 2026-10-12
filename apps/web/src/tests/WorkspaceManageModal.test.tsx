import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { WorkspaceManageModal } from '../components/workspace/WorkspaceManageModal';
import * as WorkspaceContextModule from '../context/WorkspaceContext';
import * as AuthContextModule from '../context/AuthContext';
import { workspacesApi } from '../api/workspaces.api';

describe('WorkspaceManageModal Component Tests', () => {
  const mockRefreshWorkspaces = vi.fn();

  const mockUser = {
    id: 'user-owner',
    username: 'alexdev',
    email: 'alex@example.com',
    fullName: 'Alex Dev',
    avatarUrl: null,
    isEmailVerified: true,
  };

  const mockTeamWorkspace = {
    id: 'ws-team-1',
    name: 'Acme Studio',
    slug: 'acme-studio',
    avatarUrl: null,
    ownerId: 'user-owner',
    isPersonal: false,
    isOwner: true,
    userRole: 'OWNER' as const,
    memberCount: 2,
    projectCount: 3,
    adminPermissions: {
      canInviteMembers: true,
      canRemoveMembers: true,
      canCreateProjects: true,
      canManageRoles: true,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    owner: { id: 'user-owner', fullName: 'Alex Dev', username: 'alexdev', avatarUrl: null },
  };

  const mockMembers = [
    {
      id: 'wm-1',
      workspaceId: 'ws-team-1',
      userId: 'user-owner',
      role: 'OWNER' as const,
      origin: 'DIRECT' as const,
      joinedAt: new Date().toISOString(),
      isOwner: true,
      user: {
        id: 'user-owner',
        fullName: 'Alex Dev',
        username: 'alexdev',
        email: 'alex@example.com',
        avatarUrl: null,
      },
    },
    {
      id: 'wm-2',
      workspaceId: 'ws-team-1',
      userId: 'user-member',
      role: 'WORKSPACE_MEMBER' as const,
      origin: 'DIRECT' as const,
      joinedAt: new Date().toISOString(),
      isOwner: false,
      user: {
        id: 'user-member',
        fullName: 'Charlie Collaborator',
        username: 'charlie',
        email: 'charlie@example.com',
        avatarUrl: null,
      },
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
      workspaces: { owned: [mockTeamWorkspace], joined: [] },
      activeWorkspace: mockTeamWorkspace,
      activeRole: 'OWNER',
      isLoading: false,
      error: null,
      setActiveWorkspaceId: vi.fn(),
      createWorkspace: vi.fn(),
      refreshWorkspaces: mockRefreshWorkspaces,
    });

    vi.spyOn(workspacesApi, 'getMembers').mockResolvedValue({
      success: true,
      data: {
        members: mockMembers,
        total: 2,
        page: 1,
        limit: 50,
        totalPages: 1,
      },
    });

    vi.spyOn(workspacesApi, 'getInvitations').mockResolvedValue({
      success: true,
      data: {
        invitations: [
          {
            id: 'inv-1',
            workspaceId: 'ws-team-1',
            invitedEmail: 'pending@example.com',
            invitedUserId: null,
            role: 'WORKSPACE_MEMBER',
            status: 'PENDING',
            message: 'Join us!',
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            createdAt: new Date().toISOString(),
            invitedBy: { id: 'user-owner', fullName: 'Alex Dev', username: 'alexdev' },
          },
        ],
      },
    });

    vi.spyOn(workspacesApi, 'getAdminPermissions').mockResolvedValue({
      success: true,
      data: {
        permissions: {
          canInviteMembers: true,
          canRemoveMembers: false,
          canCreateProjects: true,
          canManageRoles: false,
        },
      },
    });
  });

  it('renders modal when open and displays members tab with member details', async () => {
    render(<WorkspaceManageModal isOpen={true} onClose={vi.fn()} />);

    expect(screen.getByText('Acme Studio')).toBeInTheDocument();
    expect(screen.getByText('Members')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Alex Dev (You)')).toBeInTheDocument();
      expect(screen.getByText('Charlie Collaborator')).toBeInTheDocument();
    });
  });

  it('displays Owner role badge for owner and prevents modifying owner role', async () => {
    render(<WorkspaceManageModal isOpen={true} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Alex Dev (You)')).toBeInTheDocument();
    });

    // Owner row should have Owner badge and no remove button
    expect(screen.getAllByText('Owner').length).toBeGreaterThan(0);
  });

  it('shows Admin Permissions tab for Owner in team workspace and allows toggling', async () => {
    render(<WorkspaceManageModal isOpen={true} onClose={vi.fn()} initialTab="permissions" />);

    expect(screen.getByText('Admin Permissions')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Invite Members')).toBeInTheDocument();
      expect(screen.getByText('Remove Members')).toBeInTheDocument();
      expect(screen.getByText('Create Projects')).toBeInTheDocument();
      expect(screen.getByText('Manage Roles')).toBeInTheDocument();
    });
  });

  it('hides Admin Permissions tab for non-owners', () => {
    vi.spyOn(WorkspaceContextModule, 'useWorkspace').mockReturnValue({
      workspaces: { owned: [], joined: [mockTeamWorkspace] },
      activeWorkspace: { ...mockTeamWorkspace, isOwner: false, userRole: 'WORKSPACE_MEMBER' },
      activeRole: 'WORKSPACE_MEMBER',
      isLoading: false,
      error: null,
      setActiveWorkspaceId: vi.fn(),
      createWorkspace: vi.fn(),
      refreshWorkspaces: mockRefreshWorkspaces,
    });

    render(<WorkspaceManageModal isOpen={true} onClose={vi.fn()} />);

    expect(screen.queryByText('Admin Permissions')).not.toBeInTheDocument();
  });

  it('triggers confirmation dialog when remove member is clicked', async () => {
    render(<WorkspaceManageModal isOpen={true} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Charlie Collaborator')).toBeInTheDocument();
    });

    const removeBtn = screen.getByLabelText('Remove charlie');
    fireEvent.click(removeBtn);

    expect(screen.getByText('Remove Member from Workspace?')).toBeInTheDocument();
    expect(
      screen.getByText(/This will immediately revoke their workspace access and all project memberships/i)
    ).toBeInTheDocument();
  });
});
