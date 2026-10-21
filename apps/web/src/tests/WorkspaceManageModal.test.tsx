import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { WorkspaceManageModal } from '../components/workspace/WorkspaceManageModal';
import * as WorkspaceContextModule from '../context/WorkspaceContext';
import * as AuthContextModule from '../context/AuthContext';
import { workspacesApi } from '../api/workspaces.api';

describe('WorkspaceManageModal Component Tests', () => {
  const mockRefreshWorkspaces = vi.fn();
  const mockRefreshDeletedWorkspaces = vi.fn();
  const mockRecoverWorkspace = vi.fn();

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
      refreshUser: vi.fn(),
    });

    vi.spyOn(WorkspaceContextModule, 'useWorkspace').mockReturnValue({
      workspaces: { owned: [mockTeamWorkspace], joined: [] },
      deletedWorkspaces: [],
      activeWorkspace: mockTeamWorkspace,
      activeRole: 'OWNER',
      isLoading: false,
      error: null,
      setActiveWorkspaceId: vi.fn(),
      createWorkspace: vi.fn(),
      recoverWorkspace: mockRecoverWorkspace,
      refreshWorkspaces: mockRefreshWorkspaces,
      refreshDeletedWorkspaces: mockRefreshDeletedWorkspaces,
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

    vi.spyOn(workspacesApi, 'getPendingOwnershipTransfer').mockResolvedValue({
      success: true,
      data: {
        transfer: null,
      },
    });

    vi.spyOn(workspacesApi, 'getAuditLogs').mockResolvedValue({
      success: true,
      data: {
        logs: [
          {
            id: 'log-1',
            workspaceId: 'ws-team-1',
            actorId: 'user-owner',
            action: 'OWNERSHIP_TRANSFERRED',
            targetType: 'WORKSPACE',
            targetId: 'ws-team-1',
            metadata: { formerOwner: 'alexdev' },
            ipAddress: null,
            userAgent: null,
            createdAt: new Date().toISOString(),
            actor: {
              id: 'user-owner',
              fullName: 'Alex Dev',
              username: 'alexdev',
              email: 'alex@example.com',
              avatarUrl: null,
            },
          },
        ],
        pagination: {
          page: 1,
          limit: 15,
          total: 1,
          totalPages: 1,
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
      deletedWorkspaces: [],
      activeWorkspace: { ...mockTeamWorkspace, isOwner: false, userRole: 'WORKSPACE_MEMBER' },
      activeRole: 'WORKSPACE_MEMBER',
      isLoading: false,
      error: null,
      setActiveWorkspaceId: vi.fn(),
      createWorkspace: vi.fn(),
      recoverWorkspace: mockRecoverWorkspace,
      refreshWorkspaces: mockRefreshWorkspaces,
      refreshDeletedWorkspaces: mockRefreshDeletedWorkspaces,
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

  it('updates member role through role dropdown, confirms change with correct role labels, and displays toast notification', async () => {
    let currentMembers = [
      { ...mockMembers[0] },
      { ...mockMembers[1] },
    ];

    vi.spyOn(workspacesApi, 'getMembers').mockImplementation(async () => ({
      success: true,
      data: { members: currentMembers as any, total: 2, page: 1, limit: 50, totalPages: 1 },
    }));

    const updateMemberRoleSpy = vi.spyOn(workspacesApi, 'updateMemberRole').mockImplementation(async (_wsId, _memberId, newRole) => {
      currentMembers = currentMembers.map((m) =>
        m.id === 'wm-2' ? { ...m, role: newRole as any } : m
      );
      return {
        success: true,
        data: { member: { ...mockMembers[1], role: newRole } as any },
      };
    });

    render(<WorkspaceManageModal isOpen={true} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Charlie Collaborator')).toBeInTheDocument();
    });

    const roleDropdown = screen.getByLabelText('Change role for charlie') as HTMLSelectElement;
    expect(roleDropdown).toHaveValue('WORKSPACE_MEMBER');

    // Check all 3 options exist inside role dropdown
    expect(roleDropdown.querySelector('option[value="WORKSPACE_ADMIN"]')?.textContent).toBe('Workspace Admin');
    expect(roleDropdown.querySelector('option[value="PROJECT_ADMIN"]')?.textContent).toBe('Project Admin');
    expect(roleDropdown.querySelector('option[value="WORKSPACE_MEMBER"]')?.textContent).toBe('Workspace Member');

    // 1. Change to Project Admin
    fireEvent.change(roleDropdown, { target: { value: 'PROJECT_ADMIN' } });

    expect(screen.getByText('Change Member Role?')).toBeInTheDocument();
    expect(document.querySelector('.wmm-confirm-box')).toHaveTextContent('Project Admin');

    const confirmBtn = screen.getByRole('button', { name: 'Confirm Change' });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(updateMemberRoleSpy).toHaveBeenCalledWith('ws-team-1', 'wm-2', 'PROJECT_ADMIN');
      expect(screen.getByText('Role updated successfully')).toBeInTheDocument();
      expect(roleDropdown).toHaveValue('PROJECT_ADMIN');
    });

    // 2. Change back to Workspace Member
    fireEvent.change(roleDropdown, { target: { value: 'WORKSPACE_MEMBER' } });
    expect(screen.getByText('Change Member Role?')).toBeInTheDocument();
    const confirmBtn2 = screen.getByRole('button', { name: 'Confirm Change' });
    fireEvent.click(confirmBtn2);

    await waitFor(() => {
      expect(updateMemberRoleSpy).toHaveBeenCalledWith('ws-team-1', 'wm-2', 'WORKSPACE_MEMBER');
      expect(screen.getByText('Role updated successfully')).toBeInTheDocument();
      expect(roleDropdown).toHaveValue('WORKSPACE_MEMBER');
    });
  });

  it('renders Ownership Transfer tab with form for Owner', async () => {
    render(<WorkspaceManageModal isOpen={true} onClose={vi.fn()} initialTab="ownership" />);

    expect(screen.getByText('Ownership')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Workspace Ownership Lifecycle')).toBeInTheDocument();
      expect(screen.getByText('Initiate Transfer Request')).toBeInTheDocument();
      expect(screen.getByText('Your Resulting Role After Transfer')).toBeInTheDocument();
    });
  });

  it('renders Audit Trail tab and displays audit events', async () => {
    render(<WorkspaceManageModal isOpen={true} onClose={vi.fn()} initialTab="audit" />);

    expect(screen.getByText('Audit Trail')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Filter Action:')).toBeInTheDocument();
      expect(screen.getByText('OWNERSHIP TRANSFERRED')).toBeInTheDocument();
    });
  });

  it('renders Danger Zone tab and opens confirmation dialog requiring workspace name', async () => {
    render(<WorkspaceManageModal isOpen={true} onClose={vi.fn()} initialTab="danger" />);

    expect(screen.getByText('Danger Zone')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Delete Workspace')).toBeInTheDocument();
      expect(screen.getByText(/Soft-deletes/i)).toBeInTheDocument();
    });

    const deleteBtn = screen.getByRole('button', { name: /delete this workspace/i });
    fireEvent.click(deleteBtn);

    expect(screen.getByText('Delete Workspace?')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Acme Studio')).toBeInTheDocument();
  });

  it('protects personal workspace in Danger Zone tab', async () => {
    const personalWs = {
      ...mockTeamWorkspace,
      id: 'ws-personal',
      name: 'Personal Space',
      isPersonal: true,
    };

    vi.spyOn(WorkspaceContextModule, 'useWorkspace').mockReturnValue({
      workspaces: { owned: [personalWs], joined: [] },
      deletedWorkspaces: [],
      activeWorkspace: personalWs,
      activeRole: 'OWNER',
      isLoading: false,
      error: null,
      setActiveWorkspaceId: vi.fn(),
      createWorkspace: vi.fn(),
      recoverWorkspace: mockRecoverWorkspace,
      refreshWorkspaces: mockRefreshWorkspaces,
      refreshDeletedWorkspaces: mockRefreshDeletedWorkspaces,
    });

    render(<WorkspaceManageModal isOpen={true} onClose={vi.fn()} initialTab="danger" />);

    await waitFor(() => {
      expect(screen.getByText('Personal Workspace Protected')).toBeInTheDocument();
      expect(screen.getByText(/cannot be deleted/i)).toBeInTheDocument();
    });
  });
});
