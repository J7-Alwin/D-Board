import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ProjectTransferModal } from '../components/workspace/ProjectTransferModal';
import { projectTransferApi } from '../api/projectTransfer.api';

describe('ProjectTransferModal Component Tests', () => {
  const mockProject = {
    id: 'proj-123',
    name: 'Alpha Project',
    key: 'ALP',
    workspaceId: 'ws-src-1',
  };

  const mockEligibility = {
    isEligible: true,
    project: mockProject,
    sourceWorkspace: {
      id: 'ws-src-1',
      name: 'Source Studio',
      isPersonal: false,
      isOwner: true,
    },
    eligibleDestinations: [
      {
        id: 'ws-dest-1',
        name: 'Target Team Workspace',
        isOwner: true,
        role: 'OWNER',
      },
      {
        id: 'ws-dest-2',
        name: 'Secondary Studio',
        isOwner: false,
        role: 'WORKSPACE_ADMIN',
      },
    ],
    currentMembers: [
      {
        id: 'pm-1',
        userId: 'u-1',
        role: 'PROJECT_ADMIN',
        user: { id: 'u-1', fullName: 'Alice Admin', username: 'alice', email: 'alice@example.com' },
      },
    ],
  };

  const mockTransfers = [
    {
      id: 'pt-1',
      projectId: 'proj-123',
      sourceWorkspaceId: 'ws-src-1',
      destinationWorkspaceId: 'ws-dest-1',
      destinationWorkspace: { id: 'ws-dest-1', name: 'Target Team Workspace' },
      initiatedById: 'u-1',
      initiatedBy: { id: 'u-1', fullName: 'Alice Admin', username: 'alice' },
      status: 'PENDING' as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(projectTransferApi, 'getEligibility').mockResolvedValue({
      success: true,
      data: mockEligibility as any,
    });
    vi.spyOn(projectTransferApi, 'getProjectTransfers').mockResolvedValue({
      success: true,
      data: { transfers: mockTransfers as any },
    });
    vi.spyOn(projectTransferApi, 'requestTransfer').mockResolvedValue({
      success: true,
      data: {
        executedImmediately: true,
        transfer: mockTransfers[0] as any,
        message: 'Project transferred successfully',
      },
    });
  });

  it('renders modal and loads transfer eligibility with destination options', async () => {
    render(
      <ProjectTransferModal
        isOpen={true}
        onClose={vi.fn()}
        project={mockProject}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Transfer Project to Workspace/i)).toBeInTheDocument();
      expect(screen.getByText('Source Studio')).toBeInTheDocument();
      expect(screen.getByText('Target Team Workspace (Owner)')).toBeInTheDocument();
    });
  });

  it('enforces explicit project name confirmation before allowing transfer execution', async () => {
    render(
      <ProjectTransferModal
        isOpen={true}
        onClose={vi.fn()}
        project={mockProject}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Transfer Project Now/i })).toBeInTheDocument();
    });

    const transferBtn = screen.getByRole('button', { name: /Transfer Project Now/i });
    expect(transferBtn).toBeDisabled();

    // Type partial or wrong name
    const input = screen.getByLabelText(/to confirm/i);
    fireEvent.change(input, { target: { value: 'Wrong Name' } });
    expect(transferBtn).toBeDisabled();

    // Type exact project name
    fireEvent.change(input, { target: { value: 'Alpha Project' } });
    expect(transferBtn).not.toBeDisabled();
  });

  it('submits transfer request on valid confirmation and calls API', async () => {
    const onTransferred = vi.fn();
    render(
      <ProjectTransferModal
        isOpen={true}
        onClose={vi.fn()}
        project={mockProject}
        onTransferred={onTransferred}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Transfer Project Now/i })).toBeInTheDocument();
    });

    const input = screen.getByLabelText(/to confirm/i);
    fireEvent.change(input, { target: { value: 'Alpha Project' } });

    const transferBtn = screen.getByRole('button', { name: /Transfer Project Now/i });
    fireEvent.click(transferBtn);

    await waitFor(() => {
      expect(projectTransferApi.requestTransfer).toHaveBeenCalledWith('proj-123', 'ws-dest-1');
    });
  });

  it('switches to Transfer History tab and displays past transfer requests', async () => {
    render(
      <ProjectTransferModal
        isOpen={true}
        onClose={vi.fn()}
        project={mockProject}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Transfer History/i)).toBeInTheDocument();
    });

    const historyTab = screen.getByRole('button', { name: /Transfer History/i });
    fireEvent.click(historyTab);

    await waitFor(() => {
      expect(screen.getByText('PENDING')).toBeInTheDocument();
      expect(screen.getByText('Target Team Workspace')).toBeInTheDocument();
      expect(screen.getByText('Alice Admin')).toBeInTheDocument();
    });
  });
});
