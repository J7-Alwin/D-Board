import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { WorkspaceSettingsPage } from '../pages/app/WorkspaceSettingsPage';
import * as WorkspaceContextModule from '../context/WorkspaceContext';
import * as AuthContextModule from '../context/AuthContext';
import * as RouterModule from '../router/Router';
import { workspacesApi } from '../api/workspaces.api';
import { projectTransferApi } from '../api/projectTransfer.api';
import { projectsApi } from '../api/projects.api';

describe('WorkspaceSettingsPage Component Tests', () => {
  afterEach(() => {
    cleanup();
  });
  const mockNavigate = vi.fn();
  const mockRefreshWorkspaces = vi.fn();
  const mockRefreshDeletedWorkspaces = vi.fn();

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
    maxMembers: 10,
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

  const mockPersonalWorkspace = {
    id: 'ws-personal-1',
    name: "Alex Dev's Workspace",
    slug: 'alex-devs-workspace',
    avatarUrl: null,
    ownerId: 'user-owner',
    isPersonal: true,
    isDefault: true,
    isOwner: true,
    userRole: 'OWNER' as const,
    memberCount: 1,
    projectCount: 1,
    maxMembers: 1,
    adminPermissions: undefined,
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
    window.history.replaceState({}, '', '/app/workspace/settings');

    vi.spyOn(RouterModule, 'useRouter').mockReturnValue({
      path: '/app/workspace/settings',
      navigate: mockNavigate,
    });

    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: mockUser as any,
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
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
      refreshDeletedWorkspaces: mockRefreshDeletedWorkspaces,
      deletedWorkspaces: [],
      recoverWorkspace: vi.fn(),
    });

    vi.spyOn(workspacesApi, 'getMembers').mockResolvedValue({
      success: true,
      data: { members: mockMembers as any, total: 2, page: 1, limit: 10, totalPages: 1 },
    });

    vi.spyOn(workspacesApi, 'getInvitations').mockResolvedValue({
      success: true,
      data: { invitations: [] },
    });

    vi.spyOn(workspacesApi, 'getAdminPermissions').mockResolvedValue({
      success: true,
      data: {
        permissions: {
          canInviteMembers: true,
          canRemoveMembers: true,
          canCreateProjects: true,
          canManageRoles: true,
        },
      },
    });

    vi.spyOn(projectTransferApi, 'getWorkspacePendingTransfers').mockResolvedValue({
      success: true,
      data: { incoming: [], outgoing: [] },
    });

    vi.spyOn(workspacesApi, 'getPendingOwnershipTransfer').mockResolvedValue({
      success: true,
      data: { transfer: null },
    });

    vi.spyOn(workspacesApi, 'getAuditLogs').mockResolvedValue({
      success: true,
      data: { logs: [], pagination: { total: 0, totalPages: 1, page: 1, limit: 15 } },
    });
  });

  it('1. renders Workspace Settings page with header card, title, atmosphere art, and back link', async () => {
    render(<WorkspaceSettingsPage />);

    expect(screen.getByText('Back to Dashboard')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Workspace Settings' })).toBeInTheDocument();
    expect(screen.getByText('Acme Studio')).toBeInTheDocument();
    expect(screen.getByText(/A great workspace/i)).toBeInTheDocument();
    expect(screen.getByText(/brings people, ideas, and progress/i)).toBeInTheDocument();
    expect(screen.getByText(/together\./i)).toBeInTheDocument();
  });

  it('2. back to dashboard button triggers router navigate', async () => {
    render(<WorkspaceSettingsPage />);

    const backBtn = screen.getByText('Back to Dashboard').closest('button');
    expect(backBtn).toBeDefined();
    fireEvent.click(backBtn!);

    expect(mockNavigate).toHaveBeenCalledWith('/app/dashboard');
  });

  it('3. renders all 8 navigation tabs for a Team Workspace Owner', async () => {
    render(<WorkspaceSettingsPage />);

    expect(screen.getByRole('tab', { name: /General/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Members/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Invitations/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Permissions/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Transfers/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Ownership/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Audit Trail/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Danger Zone/i })).toBeInTheDocument();
  });

  it('4. filters tabs for Workspace Admin (hides Admin Permissions and Ownership, shows Danger Zone)', async () => {
    vi.spyOn(WorkspaceContextModule, 'useWorkspace').mockReturnValue({
      workspaces: { owned: [], joined: [{ ...mockTeamWorkspace, isOwner: false, userRole: 'WORKSPACE_ADMIN' }] },
      activeWorkspace: { ...mockTeamWorkspace, isOwner: false, userRole: 'WORKSPACE_ADMIN' },
      activeRole: 'WORKSPACE_ADMIN',
      isLoading: false,
      error: null,
      setActiveWorkspaceId: vi.fn(),
      createWorkspace: vi.fn(),
      refreshWorkspaces: mockRefreshWorkspaces,
      refreshDeletedWorkspaces: mockRefreshDeletedWorkspaces,
      deletedWorkspaces: [],
      recoverWorkspace: vi.fn(),
    });

    render(<WorkspaceSettingsPage />);

    expect(screen.getByRole('tab', { name: /General/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Members/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Invitations/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Transfers/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Audit Trail/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Danger Zone/i })).toBeInTheDocument();

    expect(screen.queryByRole('tab', { name: /Permissions/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /Ownership/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /Deletion Request/i })).not.toBeInTheDocument();
  });

  it('5. filters tabs for regular Member (shows General, Members, and Danger Zone for leaving)', async () => {
    vi.spyOn(WorkspaceContextModule, 'useWorkspace').mockReturnValue({
      workspaces: { owned: [], joined: [{ ...mockTeamWorkspace, isOwner: false, userRole: 'WORKSPACE_MEMBER' }] },
      activeWorkspace: { ...mockTeamWorkspace, isOwner: false, userRole: 'WORKSPACE_MEMBER' },
      activeRole: 'WORKSPACE_MEMBER',
      isLoading: false,
      error: null,
      setActiveWorkspaceId: vi.fn(),
      createWorkspace: vi.fn(),
      refreshWorkspaces: mockRefreshWorkspaces,
      refreshDeletedWorkspaces: mockRefreshDeletedWorkspaces,
      deletedWorkspaces: [],
      recoverWorkspace: vi.fn(),
    });

    render(<WorkspaceSettingsPage />);

    expect(screen.getByRole('tab', { name: /General/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Members/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Danger Zone/i })).toBeInTheDocument();

    expect(screen.queryByRole('tab', { name: /Invitations/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /Permissions/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /Transfers/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /Ownership/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /Audit Trail/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /Deletion Request/i })).not.toBeInTheDocument();
  });

  it('6. hides team-specific tabs for Personal Workspace', async () => {
    vi.spyOn(WorkspaceContextModule, 'useWorkspace').mockReturnValue({
      workspaces: { owned: [mockPersonalWorkspace], joined: [] },
      activeWorkspace: mockPersonalWorkspace,
      activeRole: 'OWNER',
      isLoading: false,
      error: null,
      setActiveWorkspaceId: vi.fn(),
      createWorkspace: vi.fn(),
      refreshWorkspaces: mockRefreshWorkspaces,
      refreshDeletedWorkspaces: mockRefreshDeletedWorkspaces,
      deletedWorkspaces: [],
      recoverWorkspace: vi.fn(),
    });

    render(<WorkspaceSettingsPage />);

    expect(screen.getByRole('tab', { name: /General/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Members/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Danger Zone/i })).toBeInTheDocument();

    expect(screen.queryByRole('tab', { name: /Admin Permissions/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /Transfers/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /Ownership/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /Deletion Request/i })).not.toBeInTheDocument();
  });

  it('7. loads and displays workspace members with their role tags', async () => {
    render(<WorkspaceSettingsPage />);

    const membersTab = screen.getByRole('tab', { name: /Members/i });
    fireEvent.click(membersTab);

    await waitFor(() => {
      expect(screen.getByText('Alex Dev (You)')).toBeInTheDocument();
      expect(screen.getByText('Charlie Collaborator')).toBeInTheDocument();
      expect(screen.getByText('@charlie • charlie@example.com')).toBeInTheDocument();
    });
  });

  it('8. switches to Invitations tab when clicked', async () => {
    render(<WorkspaceSettingsPage />);

    const invitesTab = screen.getByRole('tab', { name: /Invitations/i });
    fireEvent.click(invitesTab);

    expect(screen.getByRole('heading', { name: /Invitations & Member Limits/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('colleague@example.com')).toBeInTheDocument();
  });

  it('9. switches to Permissions tab and shows toggles', async () => {
    render(<WorkspaceSettingsPage />);

    const permsTab = screen.getByRole('tab', { name: /Permissions/i });
    fireEvent.click(permsTab);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Permissions & Delegation Controls/i })).toBeInTheDocument();
      expect(screen.getByText('Invite New Members')).toBeInTheDocument();
      expect(screen.getByText('Remove Members')).toBeInTheDocument();
    });
  });

  it('10. switches to Danger Zone and opens Delete Workspace confirmation modal', async () => {
    render(<WorkspaceSettingsPage />);

    const dangerTab = screen.getByRole('tab', { name: /Danger Zone/i });
    fireEvent.click(dangerTab);

    const deleteBtn = screen.getByRole('button', { name: 'Delete Workspace' });
    expect(deleteBtn).toBeInTheDocument();
    fireEvent.click(deleteBtn);

    expect(screen.getByPlaceholderText('Acme Studio')).toBeInTheDocument();
  });

  it('11. renders General tab by default and allows editing workspace name and member limit', async () => {
    const updateWorkspaceSpy = vi.spyOn(workspacesApi, 'updateWorkspace').mockResolvedValue({
      success: true,
      data: {
        workspace: {
          ...mockTeamWorkspace,
          name: 'Acme Studio Global',
          maxMembers: 25,
        },
      },
    });

    render(<WorkspaceSettingsPage />);

    expect(screen.getByRole('heading', { name: 'Workspace Profile & Settings' })).toBeInTheDocument();
    const nameInput = screen.getByLabelText(/Workspace Name \*/i);
    expect(nameInput).toHaveValue('Acme Studio');

    const limitInput = screen.getByLabelText(/Member Limit/i);
    expect(limitInput).toHaveValue(10);

    fireEvent.change(nameInput, { target: { value: 'Acme Studio Global' } });
    fireEvent.change(limitInput, { target: { value: '25' } });

    const saveBtn = screen.getByRole('button', { name: /Save Changes/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(updateWorkspaceSpy).toHaveBeenCalledWith('ws-team-1', {
        name: 'Acme Studio Global',
        avatarUrl: null,
        maxMembers: 25,
      });
      expect(screen.getByText('Workspace profile saved successfully!')).toBeInTheDocument();
    });
  });

  it('12. displays Deletion Request section to Owner only when an active request exists', async () => {
    vi.spyOn(workspacesApi, 'getWorkspaceDeletionRequest').mockResolvedValue({
      success: true,
      data: {
        deletionRequest: {
          id: 'del-req-1',
          requestedById: 'user-admin',
          requestedByName: 'Sarah Admin',
          requestedByEmail: 'sarah@example.com',
          requestedByAvatar: null,
          reason: 'Client engagement ended, decommissioning workspace.',
          requestedAt: new Date().toISOString(),
          status: 'PENDING',
        },
      },
    });

    render(<WorkspaceSettingsPage />);

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /Deletion Request/i })).toBeInTheDocument();
    });

    const delReqTab = screen.getByRole('tab', { name: /Deletion Request/i });
    fireEvent.click(delReqTab);

    expect(screen.getByRole('heading', { name: 'Workspace Deletion Request' })).toBeInTheDocument();
    expect(screen.getByText('Sarah Admin')).toBeInTheDocument();
    expect(screen.getByText(/Client engagement ended/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Approve & Delete Workspace' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Decline Request' })).toBeInTheDocument();
  });

  it('13. allows non-owner member to open Leave Workspace confirmation modal in Danger Zone', async () => {
    vi.spyOn(WorkspaceContextModule, 'useWorkspace').mockReturnValue({
      workspaces: { owned: [mockPersonalWorkspace], joined: [{ ...mockTeamWorkspace, isOwner: false, userRole: 'WORKSPACE_MEMBER' }] },
      activeWorkspace: { ...mockTeamWorkspace, isOwner: false, userRole: 'WORKSPACE_MEMBER' },
      activeRole: 'WORKSPACE_MEMBER',
      isLoading: false,
      error: null,
      setActiveWorkspaceId: vi.fn(),
      createWorkspace: vi.fn(),
      refreshWorkspaces: mockRefreshWorkspaces,
      refreshDeletedWorkspaces: mockRefreshDeletedWorkspaces,
      deletedWorkspaces: [],
      recoverWorkspace: vi.fn(),
    });

    render(<WorkspaceSettingsPage />);

    // Header Leave Workspace button is present for non-owner
    const leaveButtons = screen.getAllByRole('button', { name: 'Leave Workspace' });
    expect(leaveButtons.length).toBeGreaterThanOrEqual(1);

    const dangerTab = screen.getByRole('tab', { name: /Danger Zone/i });
    fireEvent.click(dangerTab);

    // In Danger Zone, click the leave workspace action button
    const dangerLeaveBtn = document.getElementById('ws-leave-workspace-btn');
    expect(dangerLeaveBtn).toBeInTheDocument();
    fireEvent.click(dangerLeaveBtn!);

    expect(screen.getByRole('heading', { name: 'Leave Workspace' })).toBeInTheDocument();
    expect(screen.getByText(/What happens when you leave:/i)).toBeInTheDocument();
  });

  it('14. allows personal workspace owner to open Clear Personal Workspace Data modal in Danger Zone', async () => {
    vi.spyOn(WorkspaceContextModule, 'useWorkspace').mockReturnValue({
      workspaces: { owned: [mockPersonalWorkspace], joined: [] },
      activeWorkspace: mockPersonalWorkspace,
      activeRole: 'OWNER',
      isLoading: false,
      error: null,
      setActiveWorkspaceId: vi.fn(),
      createWorkspace: vi.fn(),
      refreshWorkspaces: mockRefreshWorkspaces,
      refreshDeletedWorkspaces: mockRefreshDeletedWorkspaces,
      deletedWorkspaces: [],
      recoverWorkspace: vi.fn(),
    });

    render(<WorkspaceSettingsPage />);

    const dangerTab = screen.getByRole('tab', { name: /Danger Zone/i });
    fireEvent.click(dangerTab);

    expect(screen.getByText('Personal Workspace Protection')).toBeInTheDocument();
    const clearBtn = document.getElementById('ws-clear-personal-btn');
    expect(clearBtn).toBeInTheDocument();
    fireEvent.click(clearBtn!);

    expect(screen.getByRole('heading', { level: 3, name: 'Clear Workspace Data' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('CLEAR')).toBeInTheDocument();
  });

  it('15. updates member role with floating toast popup and allows changing role back without refreshing', async () => {
    let currentMembers = [
      { ...mockMembers[0] },
      { ...mockMembers[1] },
    ];

    vi.spyOn(workspacesApi, 'getMembers').mockImplementation(async () => ({
      success: true,
      data: { members: currentMembers as any, total: 2, page: 1, limit: 10, totalPages: 1 },
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

    render(<WorkspaceSettingsPage />);

    // 1. Navigate to Members tab
    const membersTab = screen.getByRole('tab', { name: /Members/i });
    fireEvent.click(membersTab);

    await waitFor(() => {
      expect(screen.getByText('Charlie Collaborator')).toBeInTheDocument();
    });

    const roleDropdown = screen.getByLabelText('Change role for charlie') as HTMLSelectElement;
    expect(roleDropdown).toHaveValue('WORKSPACE_MEMBER');

    // 2. Change role from Member -> Admin
    fireEvent.change(roleDropdown, { target: { value: 'WORKSPACE_ADMIN' } });

    // Verify confirmation modal opens
    expect(screen.getByRole('heading', { name: 'Change Member Role' })).toBeInTheDocument();
    expect(screen.getByText(/Are you sure you want to change/i)).toBeInTheDocument();

    const confirmBtn = screen.getByRole('button', { name: 'Update Role' });
    fireEvent.click(confirmBtn);

    // Verify API called with WORKSPACE_ADMIN
    await waitFor(() => {
      expect(updateMemberRoleSpy).toHaveBeenCalledWith('ws-team-1', 'wm-2', 'WORKSPACE_ADMIN');
      // Verify floating toast popup appears
      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(screen.getByText('Role updated successfully')).toBeInTheDocument();
      expect(roleDropdown).toHaveValue('WORKSPACE_ADMIN');
    });

    // 3. Verify user can immediately change role from Workspace Admin -> Project Admin without page reload
    fireEvent.change(roleDropdown, { target: { value: 'PROJECT_ADMIN' } });

    expect(screen.getByRole('heading', { name: 'Change Member Role' })).toBeInTheDocument();
    const confirmBtn2 = screen.getByRole('button', { name: 'Update Role' });
    fireEvent.click(confirmBtn2);

    await waitFor(() => {
      expect(updateMemberRoleSpy).toHaveBeenCalledWith('ws-team-1', 'wm-2', 'PROJECT_ADMIN');
      expect(screen.getByText('Role updated successfully')).toBeInTheDocument();
      expect(roleDropdown).toHaveValue('PROJECT_ADMIN');
    });

    // 4. Verify user can immediately change role BACK from Project Admin -> Workspace Member without page reload
    fireEvent.change(roleDropdown, { target: { value: 'WORKSPACE_MEMBER' } });

    expect(screen.getByRole('heading', { name: 'Change Member Role' })).toBeInTheDocument();
    const confirmBtn3 = screen.getByRole('button', { name: 'Update Role' });
    fireEvent.click(confirmBtn3);

    await waitFor(() => {
      expect(updateMemberRoleSpy).toHaveBeenCalledWith('ws-team-1', 'wm-2', 'WORKSPACE_MEMBER');
      expect(screen.getByText('Role updated successfully')).toBeInTheDocument();
      expect(roleDropdown).toHaveValue('WORKSPACE_MEMBER');
    });
  });

  it('16. disables role dropdown for members without permission', async () => {
    vi.spyOn(WorkspaceContextModule, 'useWorkspace').mockReturnValue({
      workspaces: { owned: [], joined: [mockTeamWorkspace] },
      activeWorkspace: {
        ...mockTeamWorkspace,
        adminPermissions: {
          canInviteMembers: false,
          canRemoveMembers: false,
          canCreateProjects: false,
          canManageRoles: false,
        },
      },
      activeRole: 'WORKSPACE_MEMBER',
      isLoading: false,
      error: null,
      setActiveWorkspaceId: vi.fn(),
      createWorkspace: vi.fn(),
      refreshWorkspaces: mockRefreshWorkspaces,
      refreshDeletedWorkspaces: mockRefreshDeletedWorkspaces,
      deletedWorkspaces: [],
      recoverWorkspace: vi.fn(),
    });

    render(<WorkspaceSettingsPage />);

    const membersTab = screen.getByRole('tab', { name: /Members/i });
    fireEvent.click(membersTab);

    await waitFor(() => {
      expect(screen.getByText('Charlie Collaborator')).toBeInTheDocument();
    });

    const roleDropdown = screen.getByLabelText('Change role for charlie') as HTMLSelectElement;
    expect(roleDropdown).toBeDisabled();
  });

  it('17. orders members correctly: owner first, then workspace admin, project admin, and workspace member', async () => {
    const shuffledMembers = [
      {
        id: 'wm-member',
        workspaceId: 'ws-team-1',
        userId: 'user-member-1',
        role: 'WORKSPACE_MEMBER' as const,
        origin: 'DIRECT' as const,
        joinedAt: new Date(2025, 1, 1).toISOString(),
        isOwner: false,
        user: {
          id: 'user-member-1',
          fullName: 'Dave Member',
          username: 'dave',
          email: 'dave@example.com',
          avatarUrl: null,
        },
      },
      {
        id: 'wm-proj-admin',
        workspaceId: 'ws-team-1',
        userId: 'user-proj-admin',
        role: 'PROJECT_ADMIN' as const,
        origin: 'DIRECT' as const,
        joinedAt: new Date(2025, 2, 1).toISOString(),
        isOwner: false,
        user: {
          id: 'user-proj-admin',
          fullName: 'Carol ProjectAdmin',
          username: 'carol',
          email: 'carol@example.com',
          avatarUrl: null,
        },
      },
      {
        id: 'wm-ws-admin',
        workspaceId: 'ws-team-1',
        userId: 'user-ws-admin',
        role: 'WORKSPACE_ADMIN' as const,
        origin: 'DIRECT' as const,
        joinedAt: new Date(2025, 3, 1).toISOString(),
        isOwner: false,
        user: {
          id: 'user-ws-admin',
          fullName: 'Bob WorkspaceAdmin',
          username: 'bob',
          email: 'bob@example.com',
          avatarUrl: null,
        },
      },
      {
        id: 'wm-owner',
        workspaceId: 'ws-team-1',
        userId: 'user-owner',
        role: 'OWNER' as const,
        origin: 'DIRECT' as const,
        joinedAt: new Date(2025, 4, 1).toISOString(),
        isOwner: true,
        user: {
          id: 'user-owner',
          fullName: 'Alice Owner',
          username: 'alice',
          email: 'alice@example.com',
          avatarUrl: null,
        },
      },
    ];

    vi.spyOn(workspacesApi, 'getMembers').mockResolvedValue({
      success: true,
      data: { members: shuffledMembers as any, total: 4, page: 1, limit: 50, totalPages: 1 },
    });

    render(<WorkspaceSettingsPage />);

    const membersTab = screen.getByRole('tab', { name: /Members/i });
    fireEvent.click(membersTab);

    await waitFor(() => {
      expect(screen.getByText(/Alice Owner/)).toBeInTheDocument();
      expect(screen.getByText('Bob WorkspaceAdmin')).toBeInTheDocument();
      expect(screen.getByText('Carol ProjectAdmin')).toBeInTheDocument();
      expect(screen.getByText('Dave Member')).toBeInTheDocument();
    });

    const renderedNames = Array.from(document.querySelectorAll('.ws-member-name')).map(
      (el) => el.textContent?.trim()
    );

    expect(renderedNames).toEqual([
      'Alice Owner (You)',
      'Bob WorkspaceAdmin',
      'Carol ProjectAdmin',
      'Dave Member',
    ]);
  });

  it('18. renders Transfers tab with sub-tabs matching the project transfer modal', async () => {
    vi.spyOn(projectTransferApi, 'getWorkspacePendingTransfers').mockResolvedValue({
      success: true,
      data: {
        incoming: [
          {
            id: 'tr-incoming-1',
            projectId: 'proj-1',
            sourceWorkspaceId: 'ws-src',
            destinationWorkspaceId: 'ws-team-1',
            status: 'PENDING',
            createdAt: new Date().toISOString(),
            project: { id: 'proj-1', name: 'Alpha Project', key: 'ALP' },
            sourceWorkspace: { id: 'ws-src', name: 'Source Team' },
            destinationWorkspace: { id: 'ws-team-1', name: 'Acme Studio' },
            initiatedBy: { id: 'u-1', fullName: 'Bob Builder', username: 'bob' },
          } as any,
        ],
        outgoing: [],
      },
    });

    vi.spyOn(projectsApi, 'getUserProjects').mockResolvedValue({
      success: true,
      data: {
        all: [{ id: 'proj-1', name: 'Alpha Project', key: 'ALP' }] as any,
        owned: [],
        joined: [],
      },
    });

    window.history.pushState({}, '', '?tab=transfers');

    render(<WorkspaceSettingsPage />);

    await waitFor(() => {
      expect(screen.getByText('Transfer Project')).toBeInTheDocument();
      expect(screen.getByText('Incoming Requests')).toBeInTheDocument();
      expect(screen.getByText(/Transfer History/)).toBeInTheDocument();
      expect(screen.getByText('Select Project to Transfer')).toBeInTheDocument();
      expect(screen.getByText('Source Workspace')).toBeInTheDocument();
      expect(screen.getByText('Destination Workspace')).toBeInTheDocument();
    });

    window.history.pushState({}, '', window.location.pathname);
  });

  it('19. allows switching to Incoming Requests and reviewing transfer cards', async () => {
    vi.spyOn(projectTransferApi, 'getWorkspacePendingTransfers').mockResolvedValue({
      success: true,
      data: {
        incoming: [
          {
            id: 'tr-incoming-1',
            projectId: 'proj-1',
            sourceWorkspaceId: 'ws-src',
            destinationWorkspaceId: 'ws-team-1',
            status: 'PENDING',
            createdAt: new Date().toISOString(),
            project: { id: 'proj-1', name: 'Alpha Project', key: 'ALP' },
            sourceWorkspace: { id: 'ws-src', name: 'Source Team' },
            destinationWorkspace: { id: 'ws-team-1', name: 'Acme Studio' },
            initiatedBy: { id: 'u-1', fullName: 'Bob Builder', username: 'bob' },
          } as any,
        ],
        outgoing: [],
      },
    });

    vi.spyOn(projectsApi, 'getUserProjects').mockResolvedValue({
      success: true,
      data: {
        all: [{ id: 'proj-1', name: 'Alpha Project', key: 'ALP' }] as any,
        owned: [],
        joined: [],
      },
    });

    window.history.pushState({}, '', '?tab=transfers');

    render(<WorkspaceSettingsPage />);

    await waitFor(() => {
      expect(screen.getByText('Incoming Requests')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Incoming Requests'));

    await waitFor(() => {
      expect(screen.getByText('Alpha Project')).toBeInTheDocument();
      expect(screen.getByText('Review & Accept')).toBeInTheDocument();
      expect(screen.getByText('Decline')).toBeInTheDocument();
    });

    window.history.pushState({}, '', window.location.pathname);
  });
  it('20. renders Ownership Transfer tab with 100% Team Retention guarantee and exact name confirmation guard', async () => {
    vi.spyOn(WorkspaceContextModule, 'useWorkspace').mockReturnValue({
      workspaces: { owned: [mockTeamWorkspace], joined: [] },
      activeWorkspace: mockTeamWorkspace,
      activeRole: 'OWNER',
      isLoading: false,
      error: null,
      setActiveWorkspaceId: vi.fn(),
      createWorkspace: vi.fn(),
      refreshWorkspaces: mockRefreshWorkspaces,
      refreshDeletedWorkspaces: mockRefreshDeletedWorkspaces,
      deletedWorkspaces: [],
      recoverWorkspace: vi.fn(),
    });

    render(<WorkspaceSettingsPage />);

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /Ownership/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('tab', { name: /Ownership/i }));

    await waitFor(() => {
      expect(screen.getByText('Workspace Ownership Transfer')).toBeInTheDocument();
      expect(screen.getByText('100% Team & Work Retention Guaranteed')).toBeInTheDocument();
      expect(screen.getByText('Transfer Recipient')).toBeInTheDocument();
      expect(screen.getByText('Your Resulting Role After Transfer')).toBeInTheDocument();
      expect(screen.getByText(/to confirm transfer/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Type "Acme Studio" to confirm')).toBeInTheDocument();
    });

    const submitBtn = screen.getByRole('button', { name: /Initiate Ownership Transfer/i });
    expect(submitBtn).toBeDisabled();
  });

  it('21. enables Initiate Ownership Transfer button only when exact workspace name is typed', async () => {
    vi.spyOn(WorkspaceContextModule, 'useWorkspace').mockReturnValue({
      workspaces: { owned: [mockTeamWorkspace], joined: [] },
      activeWorkspace: mockTeamWorkspace,
      activeRole: 'OWNER',
      isLoading: false,
      error: null,
      setActiveWorkspaceId: vi.fn(),
      createWorkspace: vi.fn(),
      refreshWorkspaces: mockRefreshWorkspaces,
      refreshDeletedWorkspaces: mockRefreshDeletedWorkspaces,
      deletedWorkspaces: [],
      recoverWorkspace: vi.fn(),
    });

    const initiateSpy = vi.spyOn(workspacesApi, 'initiateOwnershipTransfer').mockResolvedValue({
      success: true,
      data: {
        transfer: {
          id: 'tr-1',
          workspaceId: 'ws-team-1',
          sourceOwnerId: 'user-owner',
          targetUserId: 'user-member',
          targetRole: 'WORKSPACE_ADMIN',
          status: 'PENDING',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          createdAt: new Date().toISOString(),
          sourceOwner: { id: 'user-owner', fullName: 'Alice Owner', username: 'alice', email: 'alice@example.com', avatarUrl: null },
          targetUser: { id: 'user-member', fullName: 'Charlie Collaborator', username: 'charlie', email: 'charlie@example.com', avatarUrl: null },
        },
      },
    });

    render(<WorkspaceSettingsPage />);

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /Ownership/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('tab', { name: /Ownership/i }));

    await waitFor(() => {
      expect(screen.getByText('Workspace Ownership Transfer')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Select a member...')).toBeInTheDocument();
    });

    // Select existing member
    const memberSelect = screen.getByDisplayValue('Select a member...');
    fireEvent.change(memberSelect, { target: { value: 'user-member' } });

    const confirmInput = screen.getByPlaceholderText('Type "Acme Studio" to confirm');
    const submitBtn = screen.getByRole('button', { name: /Initiate Ownership Transfer/i });

    // Wrong name
    fireEvent.change(confirmInput, { target: { value: 'Wrong Name' } });
    expect(submitBtn).toBeDisabled();

    // Exact name
    fireEvent.change(confirmInput, { target: { value: 'Acme Studio' } });
    expect(submitBtn).not.toBeDisabled();

    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(initiateSpy).toHaveBeenCalledWith('ws-team-1', expect.objectContaining({
        targetUserId: 'user-member',
        resultingRole: 'WORKSPACE_ADMIN',
        confirmationName: 'Acme Studio',
      }));
    });
  });

  it('22. displays pending ownership transfer with countdown badge and triggers cancel modal', async () => {
    vi.spyOn(workspacesApi, 'getPendingOwnershipTransfer').mockResolvedValue({
      success: true,
      data: {
        transfer: {
          id: 'tr-pending-1',
          workspaceId: 'ws-team-1',
          sourceOwnerId: 'user-owner',
          targetUserId: 'user-member-2',
          targetRole: 'WORKSPACE_ADMIN',
          status: 'PENDING',
          expiresAt: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString(),
          createdAt: new Date().toISOString(),
          sourceOwner: { id: 'user-owner', fullName: 'Alice Owner', username: 'alice', email: 'alice@example.com', avatarUrl: null },
          targetUser: { id: 'user-member-2', fullName: 'Bob Member', username: 'bob', email: 'bob@example.com', avatarUrl: null },
        },
      },
    });

    window.history.pushState({}, '', '?tab=ownership');

    render(<WorkspaceSettingsPage />);

    await waitFor(() => {
      expect(screen.getByText('Ownership Transfer in Progress')).toBeInTheDocument();
      expect(screen.getByText(/remaining/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Cancel Transfer Request/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Cancel Transfer Request/i }));

    await waitFor(() => {
      expect(screen.getByText(/Are you sure you want to cancel the pending ownership transfer/i)).toBeInTheDocument();
    });

    window.history.pushState({}, '', window.location.pathname);
  });
});
