import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { InviteMemberModal } from '../components/workspace/InviteMemberModal';
import { workspacesApi } from '../api/workspaces.api';
import { membersApi } from '../api/members.api';
import type { Project } from '../api/projects.api';

vi.mock('../api/workspaces.api', () => ({
  workspacesApi: {
    getMembers: vi.fn(),
  },
}));

vi.mock('../api/members.api', () => ({
  membersApi: {
    getProjectMembers: vi.fn(),
    addMember: vi.fn().mockResolvedValue({ success: true, message: 'Member added' }),
  },
}));

vi.mock('../api/invitations.api', () => ({
  invitationsApi: {
    createInvitation: vi.fn(),
  },
}));

describe('InviteMemberModal — Workspace vs Project Role Separation Tests', () => {
  const mockProject: Project = {
    id: 'proj-123',
    name: 'Apollo Flight System',
    key: 'AFS',
    description: 'Mission control infrastructure',
    category: 'Engineering',
    workspaceId: 'ws-456',
    createdById: 'user-owner',
    visibility: 'Restricted',
    status: 'ACTIVE',
    progress: 45,
    taskCount: 10,
    completedTaskCount: 4,
    memberCount: 3,
    members: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const mockWsMembers = [
    {
      id: 'wm-owner',
      workspaceId: 'ws-456',
      userId: 'user-owner',
      role: 'OWNER' as const,
      origin: 'DIRECT' as const,
      joinedAt: new Date().toISOString(),
      isOwner: true,
      user: {
        id: 'user-owner',
        fullName: 'Alice Owner',
        username: 'aliceowner',
        email: 'alice@example.com',
        avatarUrl: null,
      },
    },
    {
      id: 'wm-admin',
      workspaceId: 'ws-456',
      userId: 'user-admin',
      role: 'WORKSPACE_ADMIN' as const,
      origin: 'DIRECT' as const,
      joinedAt: new Date().toISOString(),
      isOwner: false,
      user: {
        id: 'user-admin',
        fullName: 'Bob Admin',
        username: 'bobadmin',
        email: 'bob@example.com',
        avatarUrl: null,
      },
    },
    {
      id: 'wm-member-1',
      workspaceId: 'ws-456',
      userId: 'user-member-projadmin',
      role: 'WORKSPACE_MEMBER' as const,
      origin: 'DIRECT' as const,
      joinedAt: new Date().toISOString(),
      isOwner: false,
      user: {
        id: 'user-member-projadmin',
        fullName: 'Charlie ProjAdmin',
        username: 'charliepa',
        email: 'charlie@example.com',
        avatarUrl: null,
      },
    },
    {
      id: 'wm-member-2',
      workspaceId: 'ws-456',
      userId: 'user-member-standard',
      role: 'WORKSPACE_MEMBER' as const,
      origin: 'DIRECT' as const,
      joinedAt: new Date().toISOString(),
      isOwner: false,
      user: {
        id: 'user-member-standard',
        fullName: 'Diana Member',
        username: 'dianam',
        email: 'diana@example.com',
        avatarUrl: null,
      },
    },
  ];

  // Note: Charlie is already in project as PROJECT_ADMIN!
  const mockExistingMembers = [
    {
      id: 'pm-1',
      userId: 'user-owner',
      role: 'PROJECT_ADMIN' as const,
      joinedAt: new Date().toISOString(),
      isCreator: true,
      user: mockWsMembers[0].user,
    },
    {
      id: 'pm-2',
      userId: 'user-member-projadmin',
      role: 'PROJECT_ADMIN' as const,
      joinedAt: new Date().toISOString(),
      isCreator: false,
      user: mockWsMembers[2].user,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(workspacesApi.getMembers).mockResolvedValue({
      success: true,
      data: { members: mockWsMembers, total: 4 },
    } as any);

    vi.mocked(membersApi.getProjectMembers).mockResolvedValue({
      success: true,
      data: {
        project: mockProject as any,
        members: mockExistingMembers as any,
        pendingInvitations: [],
        currentUserRole: 'PROJECT_ADMIN',
      },
    } as any);
  });

  it('strictly groups by Workspace Role (Owner, Admins, Members) and keeps Project Admins under Workspace Members group', async () => {
    render(
      <InviteMemberModal
        project={mockProject}
        isOpen={true}
        onClose={vi.fn()}
        onInvited={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Workspace Owner \(1\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Workspace Admins \(1\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Workspace Members \(2\)/i)).toBeInTheDocument();
    });

    // Verify there is NO separate "Project Admins" workspace-role group
    expect(screen.queryByText(/Project Admins \(/i)).not.toBeInTheDocument();

    // Verify Charlie ProjAdmin is displayed
    expect(screen.getByText('Charlie ProjAdmin')).toBeInTheDocument();
    // Verify Diana Member is displayed
    expect(screen.getByText('Diana Member')).toBeInTheDocument();
  });

  it('separates Workspace Role and Project Role badges on member items', async () => {
    render(
      <InviteMemberModal
        project={mockProject}
        isOpen={true}
        onClose={vi.fn()}
        onInvited={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Charlie ProjAdmin')).toBeInTheDocument();
    });

    // Charlie has Workspace Role "Workspace Member" AND Project Role "Project Admin"
    // Find all badges for Charlie's row
    const charlieName = screen.getByText('Charlie ProjAdmin');
    const charlieRow = charlieName.closest('div[style*="justify-content: space-between"]');
    expect(charlieRow).toBeInTheDocument();

    // Inside Charlie's row, check both workspace role badge and project role badge
    expect(charlieRow).toHaveTextContent('Workspace Member');
    expect(charlieRow).toHaveTextContent('Project Admin');
    expect(charlieRow).toHaveTextContent('In project');
  });

  it('selecting a Workspace Member to become Project Admin keeps them under Workspace Members and displays Project Admin selection', async () => {
    render(
      <InviteMemberModal
        project={mockProject}
        isOpen={true}
        onClose={vi.fn()}
        onInvited={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Diana Member')).toBeInTheDocument();
    });

    // Diana is not in project; toggle selection
    const dianaName = screen.getByText('Diana Member');
    const dianaRow = dianaName.closest('div[style*="justify-content: space-between"]');
    expect(dianaRow).toBeInTheDocument();

    fireEvent.click(dianaRow!);

    // Should appear in Selected Recipients chips
    await waitFor(() => {
      expect(screen.getByText(/Selected Recipients \(1\)/i)).toBeInTheDocument();
    });

    // Diana chip shows Workspace role: "WS: Member" and Project role selector
    expect(screen.getByText('WS: Member')).toBeInTheDocument();

    // Grouping must STILL show 2 Workspace Members
    expect(screen.getByText(/Workspace Members \(2\)/i)).toBeInTheDocument();
    expect(screen.queryByText(/Project Admins \(/i)).not.toBeInTheDocument();
  });

  it('displays "Project Admin" tag when user in workspace has role PROJECT_ADMIN', async () => {
    const wsMembersWithProjectAdmin = [
      ...mockWsMembers,
      {
        id: 'wm-project-admin-user',
        workspaceId: 'ws-456',
        userId: 'user-pa-role',
        role: 'PROJECT_ADMIN' as const,
        origin: 'DIRECT' as const,
        joinedAt: new Date().toISOString(),
        isOwner: false,
        user: {
          id: 'user-pa-role',
          fullName: 'Evan Workspace PA',
          username: 'evanpa',
          email: 'evan@example.com',
          avatarUrl: null,
        },
      },
    ];

    vi.mocked(workspacesApi.getMembers).mockResolvedValueOnce({
      success: true,
      data: { members: wsMembersWithProjectAdmin, total: 5 },
    } as any);

    render(
      <InviteMemberModal
        project={mockProject}
        isOpen={true}
        onClose={vi.fn()}
        onInvited={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Evan Workspace PA')).toBeInTheDocument();
    });

    const evanRow = screen.getByText('Evan Workspace PA').closest('div[style*="justify-content: space-between"]');
    expect(evanRow).toBeInTheDocument();

    // Verify it shows "Project Admin" badge, NOT "Workspace Member"
    expect(evanRow).toHaveTextContent('Project Admin');
    expect(evanRow).not.toHaveTextContent('Workspace Member');
  });

  it('submits by directly adding selected workspace members into the project via membersApi.addMember', async () => {
    const onClose = vi.fn();
    const onInvited = vi.fn();

    render(
      <InviteMemberModal
        project={mockProject}
        isOpen={true}
        onClose={onClose}
        onInvited={onInvited}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Diana Member')).toBeInTheDocument();
    });

    // Select Diana
    const dianaRow = screen.getByText('Diana Member').closest('div[style*="justify-content: space-between"]');
    fireEvent.click(dianaRow!);

    const submitBtn = screen.getByRole('button', { name: /Add Member to Project/i });
    expect(submitBtn).toBeInTheDocument();

    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(membersApi.addMember).toHaveBeenCalledWith('proj-123', {
        userId: 'user-member-standard',
        role: 'PROJECT_MEMBER',
      });
      expect(onInvited).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });
  });
});
