import { apiClient, type ApiResponse } from './client.js';

export type ProjectTransferStatus = 'PENDING' | 'ACCEPTED' | 'COMPLETED' | 'REJECTED' | 'CANCELLED' | 'EXPIRED';

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
    description?: string;
    members?: Array<{
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
    }>;
  };
  sourceWorkspaceId: string;
  destinationWorkspaceId: string;
  recipientEmail?: string | null;
  destinationWorkspaceName?: string | null;
  sourceWorkspace?: {
    id: string;
    name: string;
    ownerId?: string;
  };
  destinationWorkspace?: {
    id: string;
    name: string;
    ownerId?: string;
    members?: Array<{ userId: string; role: string }>;
  };
  targetWorkspace?: {
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
  initiator?: {
    id: string;
    fullName?: string | null;
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

export interface RequestProjectTransferPayload {
  destinationWorkspaceId?: string;
  destinationUserEmail?: string;
  destinationWorkspaceName?: string;
}

export interface ApproveProjectTransferPayload {
  memberAction: 'INVITE_ALL' | 'DECIDE_LATER' | 'REMOVE_ALL';
  sharedMemberDecisions?: Record<string, 'KEEP' | 'REMOVE'>;
  newProjectKey?: string | null;
}

export interface DeferredMembersResult {
  hasDeferredMembers: boolean;
  deferredMembers: Array<{
    userId: string;
    role: string;
    user: {
      id: string;
      fullName: string;
      username: string;
      email: string;
      avatarUrl?: string | null;
    };
  }>;
  sourceWorkspaceName: string | null;
  transferId?: string;
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
   */
  async requestTransfer(
    projectId: string,
    payload: RequestProjectTransferPayload | string
  ): Promise<ApiResponse<{ executedImmediately: boolean; transfer: ProjectTransfer; message: string }>> {
    const body = typeof payload === 'string' ? { destinationWorkspaceId: payload } : payload;
    return apiClient<ApiResponse<{ executedImmediately: boolean; transfer: ProjectTransfer; message: string }>>(
      `/projects/${projectId}/transfer`,
      {
        method: 'POST',
        body: JSON.stringify(body),
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
   * List incoming and outgoing pending transfers for the current user across workspaces.
   */
  async getUserPendingTransfers(): Promise<ApiResponse<WorkspacePendingTransfers>> {
    return apiClient<ApiResponse<WorkspacePendingTransfers>>('/transfers/pending');
  },

  /**
   * List incoming and outgoing pending transfers for a specific workspace.
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
      transferId: string,
      payload ?: ApproveProjectTransferPayload
    ): Promise < ApiResponse < { success: boolean; message: string; newProjectId?: string; transfer?: ProjectTransfer } >> {
      return apiClient<ApiResponse<{ success: boolean; message: string; newProjectId?: string; transfer?: ProjectTransfer }>>(
        `/transfers/${transferId}/approve`,
        {
          method: 'POST',
          body: payload ? JSON.stringify(payload) : JSON.stringify({}),
        }
      );
    },

      /**
       * Reject a cross-owner transfer request (destination owner/admin).
       */
      async rejectTransfer(
        transferId: string,
    reason ?: string
      ): Promise < ApiResponse < { success: boolean; message: string; transfer: ProjectTransfer } >> {
        return apiClient<ApiResponse<{ success: boolean; message: string; transfer: ProjectTransfer }>>(
          `/transfers/${transferId}/reject`,
          {
            method: 'POST',
            body: JSON.stringify({ reason }),
          }
        );
      },

        /**
         * Cancel an outgoing transfer request (initiator or source workspace authority).
         */
        async cancelTransfer(
          transferId: string
        ): Promise < ApiResponse < { success: boolean; message: string; transfer: ProjectTransfer } >> {
          return apiClient<ApiResponse<{ success: boolean; message: string; transfer: ProjectTransfer }>>(
            `/transfers/${transferId}/cancel`,
            {
              method: 'POST',
            }
          );
        },

          /**
           * Get deferred previous members for a transferred project.
           */
          async getDeferredMembers(projectId: string): Promise < ApiResponse < DeferredMembersResult >> {
            return apiClient<ApiResponse<DeferredMembersResult>>(`/projects/${projectId}/transfers/deferred-members`);
          },

            /**
             * Resolve deferred previous members (Invite or Dismiss).
             */
            async resolveDeferredMembers(
              projectId: string,
              input: { action: 'INVITE' | 'DISMISS'; userIds?: string[] }
            ): Promise < ApiResponse < { success: boolean } >> {
              return apiClient<ApiResponse<{ success: boolean }>>(
                `/projects/${projectId}/transfers/deferred-members/resolve`,
                {
                  method: 'POST',
                  body: JSON.stringify(input),
                }
              );
            },
};
