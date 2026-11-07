import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { ProjectTransferAcceptModal } from '../components/workspace/ProjectTransferAcceptModal';
import { projectTransferApi, type ProjectTransfer } from '../api/projectTransfer.api';

describe('ProjectTransferAcceptModal Component Tests', () => {
  afterEach(() => {
    cleanup();
  });

  const mockTransfer: ProjectTransfer = {
    id: 'transfer-123',
    projectId: 'proj-123',
    projectName: 'Phoenix Platform',
    projectKey: 'PHX',
    sourceWorkspaceId: 'ws-src-1',
    destinationWorkspaceId: 'ws-dest-1',
    status: 'PENDING',
    sourceWorkspace: { id: 'ws-src-1', name: 'Original Workspace' },
    destinationWorkspace: {
      id: 'ws-dest-1',
      name: 'Destination Workspace',
      ownerId: 'owner-dest',
      members: [
        { userId: 'user-shared-1', role: 'WORKSPACE_MEMBER' },
      ],
    },
    project: {
      id: 'proj-123',
      name: 'Phoenix Platform',
      key: 'PHX',
      description: 'Core project platform',
      members: [
        {
          id: 'pm-1',
          userId: 'user-shared-1',
          role: 'PROJECT_MEMBER',
          user: {
            id: 'user-shared-1',
            fullName: 'Shared Sam',
            username: 'sam',
            email: 'sam@example.com',
          },
        },
        {
          id: 'pm-2',
          userId: 'user-prev-1',
          role: 'PROJECT_ADMIN',
          user: {
            id: 'user-prev-1',
            fullName: 'Previous Pam',
            username: 'pam',
            email: 'pam@example.com',
          },
        },
      ],
    },
    initiatedById: 'init-1',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(projectTransferApi, 'approveTransfer').mockResolvedValue({
      success: true,
      message: 'Transfer completed',
      data: { success: true, message: 'Transfer completed', newProjectId: 'proj-new-uuid' },
    });
  });

  it('renders modal with shared members and previous members sections', () => {
    render(
      <ProjectTransferAcceptModal
        isOpen={true}
        onClose={vi.fn()}
        transfer={mockTransfer}
        onSuccess={vi.fn()}
      />
    );

    expect(screen.getByText(/Accept Project Transfer/i)).toBeInTheDocument();
    expect(screen.getByText('Phoenix Platform')).toBeInTheDocument();
    expect(screen.getByText(/Shared Members/i)).toBeInTheDocument();
    expect(screen.getByText('Shared Sam')).toBeInTheDocument();
    expect(screen.getByText(/Previous Project Members/i)).toBeInTheDocument();
    expect(screen.getByText(/Invite All to Workspace/i)).toBeInTheDocument();
    expect(screen.getByText(/Decide Later \(Recommended\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Remove Members from Project/i)).toBeInTheDocument();
  });

  it('allows toggling shared member decision and submits approval payload', async () => {
    const onSuccess = vi.fn();
    render(
      <ProjectTransferAcceptModal
        isOpen={true}
        onClose={vi.fn()}
        transfer={mockTransfer}
        onSuccess={onSuccess}
      />
    );

    // Toggle Shared Sam to Remove
    const removeBtn = screen.getByRole('button', { name: /Remove/i });
    fireEvent.click(removeBtn);

    // Select Invite All
    const inviteAllRadio = screen.getByLabelText(/Invite All to Workspace/i);
    fireEvent.click(inviteAllRadio);

    // Click confirm
    const confirmBtn = screen.getByRole('button', { name: /Confirm & Accept Transfer/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(projectTransferApi.approveTransfer).toHaveBeenCalledWith('transfer-123', {
        memberAction: 'INVITE_ALL',
        sharedMemberDecisions: { 'user-shared-1': 'REMOVE' },
        newProjectKey: undefined,
      });
      expect(onSuccess).toHaveBeenCalledWith('proj-new-uuid');
    });
  });
});
