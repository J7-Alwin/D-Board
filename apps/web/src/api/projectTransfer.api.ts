import { apiClient, type ApiResponse } from './client.js';

export type ProjectTransferStatus = 'PENDING' | 'COMPLETED' | 'REJECTED' | 'CANCELLED' | 'EXPIRED';

export interface DestinationCandidate {
  id: string;
  name: string;
  isOwner: boolean;
  role: string;
}

export interface ProjectMemberDetail {
  id: string;
  userId: string;
  role: string;
  user: {
    id: string;
    fullName: string;
    username: string;
    email: string;
    avatarUrl?: string | null;
  };
}

export interface ProjectTransferEligibility {
  isEligible: boolean;
  reason?: string;
  project: {
    id: string;
    name: string;
    key: string | null;
    workspaceId: string;
  };
  sourceWorkspace: {
    id: string;
    name: string;
    isPersonal: boolean;
    isOwner: boolean;
  };
  eligibleDestinations: DestinationCandidate[];
  currentMembers: ProjectMemberDetail[];
}

export interface ProjectTransfer {
  id: string;
  projectId: string;
  projectName?: string;
  projectKey?: string | null;
  project?: {
    id: string;
    name: string;
    key: string | null;
  };
  sourceWorkspaceId: string;
  destinationWorkspaceId: string;
  sourceWorkspace?: {
    id: string;
    name: string;
    ownerId?: string;
  };
  destinationWorkspace?: {
    id: string;
    name: string;
    ownerId?: string;
  };
  initiatedById: string;
  initiatedBy?: {
    id: string;
    fullName: string;
    username: string;
    email?: string;
    avatarUrl?: string | null;
  };
  reviewedById?: string | null;
  reviewedBy?: {
    id: string;
    fullName: string;
    username: string;
    email?: string;
    avatarUrl?: string | null;
  };
  status: ProjectTransferStatus;
  rejectionReason?: string | null;
  memberSnapshot?: any;
  expiresAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspacePendingTransfers {
  incoming: ProjectTransfer[];
  outgoing: ProjectTransfer[];
}

export const projectTransferApi = {
  /**
   * Get eligibility and destination workspace options for transferring a project.
   */
  async getEligibility(projectId: string): Promise<ApiResponse<ProjectTransferEligibility>> {
    return apiClient<ApiResponse<ProjectTransferEligibility>>(`/projects/${projectId}/transfer-eligibility`);
  },

  /**
   * Request transfer of project to a target workspace.
   * If source and destination have the same owner, transfer completes immediately.
   * Otherwise, creates a pending request requiring destination approval.
   */
  async requestTransfer(
    projectId: string,
    destinationWorkspaceId: string
  ): Promise<ApiResponse<{ executedImmediately: boolean; transfer: ProjectTransfer; message: string }>> {
    return apiClient<ApiResponse<{ executedImmediately: boolean; transfer: ProjectTransfer; message: string }>>(
      `/projects/${projectId}/transfer`,
      {
        method: 'POST',
        body: JSON.stringify({ destinationWorkspaceId }),
      }
    );
  },

  /**
   * List transfer history for a project.
   */
  async getProjectTransfers(projectId: string): Promise<ApiResponse<{ transfers: ProjectTransfer[] }>> {
    return apiClient<ApiResponse<{ transfers: ProjectTransfer[] }>>(`/projects/${projectId}/transfers`);
  },

  /**
   * List incoming and outgoing pending transfers for a workspace.
   */
  async getWorkspacePendingTransfers(
    workspaceId: string
  ): Promise<ApiResponse<WorkspacePendingTransfers>> {
    return apiClient<ApiResponse<WorkspacePendingTransfers>>(`/workspaces/${workspaceId}/transfers/pending`);
  },

  /**
   * Get details of a single transfer request.
   */
  async getTransferDetails(transferId: string): Promise<ApiResponse<ProjectTransfer>> {
    return apiClient<ApiResponse<ProjectTransfer>>(`/transfers/${transferId}`);
  },

  /**
   * Approve a cross-owner transfer request (destination owner/admin).
   */
  async approveTransfer(
    transferId: string
  ): Promise<ApiResponse<{ success: boolean; message: string; transfer: ProjectTransfer }>> {
    return apiClient<ApiResponse<{ success: boolean; message: string; transfer: ProjectTransfer }>>(
      `/transfers/${transferId}/approve`,
      {
        method: 'POST',
      }
    );
  },

  /**
   * Reject a cross-owner transfer request (destination owner/admin).
   */
  async rejectTransfer(
    transferId: string,
    rejectionReason?: string
  ): Promise<ApiResponse<{ success: boolean; message: string; transfer: ProjectTransfer }>> {
    return apiClient<ApiResponse<{ success: boolean; message: string; transfer: ProjectTransfer }>>(
      `/transfers/${transferId}/reject`,
      {
        method: 'POST',
        body: JSON.stringify({ rejectionReason }),
      }
    );
  },

  /**
   * Cancel an outgoing transfer request (initiator or source workspace authority).
   */
  async cancelTransfer(
    transferId: string
  ): Promise<ApiResponse<{ success: boolean; message: string; transfer: ProjectTransfer }>> {
    return apiClient<ApiResponse<{ success: boolean; message: string; transfer: ProjectTransfer }>>(
      `/transfers/${transferId}/cancel`,
      {
        method: 'POST',
      }
    );
  },
};
