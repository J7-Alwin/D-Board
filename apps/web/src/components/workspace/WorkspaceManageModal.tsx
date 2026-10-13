import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import {
  workspacesApi,
  type WorkspaceMemberItem,
  type WorkspaceInvitationItem,
  type WorkspaceRole,
  type WorkspaceAdminPermissions,
  type OwnershipTransferItem,
  type WorkspaceAuditLogItem,
} from '../../api/workspaces.api';
import {
  UsersIcon,
  MailIcon,
  ShieldIcon,
  CloseIcon,
  SearchIcon,
  TrashIcon,
  CheckIcon,
  AlertCircleIcon,
  PlusIcon,
  RefreshCwIcon,
  ArrowRightIcon,
  ActivityPulseIcon,
} from '../ui/Icons';
import { Button } from '../ui/Button';
import {
  projectTransferApi,
  type ProjectTransfer,
} from '../../api/projectTransfer.api';
import './WorkspaceManageModal.css';

export interface WorkspaceManageModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'members' | 'invitations' | 'permissions' | 'transfers' | 'ownership' | 'audit' | 'danger';
}

export const WorkspaceManageModal: React.FC<WorkspaceManageModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'members',
}) => {
  const { user } = useAuth();
  const { activeWorkspace, activeRole, refreshWorkspaces, refreshDeletedWorkspaces } = useWorkspace();

  const [activeTab, setActiveTab] = useState<'members' | 'invitations' | 'permissions' | 'transfers' | 'ownership' | 'audit' | 'danger'>(initialTab);

  // Members Tab State
  const [members, setMembers] = useState<WorkspaceMemberItem[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersError, setMembersError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [totalMembers, setTotalMembers] = useState(0);

  // Role Change Confirmation
  const [targetMemberForRole, setTargetMemberForRole] = useState<{
    member: WorkspaceMemberItem;
    newRole: WorkspaceRole;
  } | null>(null);
  const [isUpdatingRole, setIsUpdatingRole] = useState(false);

  // Remove Member Confirmation
  const [memberToRemove, setMemberToRemove] = useState<WorkspaceMemberItem | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);

  // Invitations Tab State
  const [invitations, setInvitations] = useState<WorkspaceInvitationItem[]>([]);
  const [invitationsLoading, setInvitationsLoading] = useState(false);
  const [invitationsError, setInvitationsError] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<WorkspaceRole>('WORKSPACE_MEMBER');
  const [inviteMessage, setInviteMessage] = useState('');
  const [isInviting, setIsInviting] = useState(false);
  const [inviteFeedback, setInviteFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Revoke Confirmation
  const [invitationToRevoke, setInvitationToRevoke] = useState<WorkspaceInvitationItem | null>(null);
  const [isRevoking, setIsRevoking] = useState(false);
  const [resendingId, setResendingId] = useState<string | null>(null);

  // Permissions Tab State (Owner only)
  const [adminPermissions, setAdminPermissions] = useState<WorkspaceAdminPermissions>({
    canInviteMembers: false,
    canRemoveMembers: false,
    canCreateProjects: false,
    canManageRoles: false,
  });
  const [permissionsLoading, setPermissionsLoading] = useState(false);
  const [isSavingPermissions, setIsSavingPermissions] = useState(false);
  const [permissionsFeedback, setPermissionsFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Member Limit State (Phase 3 Owner-controlled)
  const [maxMembersInput, setMaxMembersInput] = useState<string>('');
  const [isSavingLimit, setIsSavingLimit] = useState(false);
  const [limitFeedback, setLimitFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Transfers Tab State (Phase 4)
  const [incomingTransfers, setIncomingTransfers] = useState<ProjectTransfer[]>([]);
  const [outgoingTransfers, setOutgoingTransfers] = useState<ProjectTransfer[]>([]);
  const [transfersLoading, setTransfersLoading] = useState(false);
  const [transfersError, setTransfersError] = useState<string | null>(null);
  const [transferToApprove, setTransferToApprove] = useState<ProjectTransfer | null>(null);
  const [transferToReject, setTransferToReject] = useState<ProjectTransfer | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [isProcessingTransfer, setIsProcessingTransfer] = useState(false);
  const [transferFeedback, setTransferFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Ownership Transfer Tab State (Phase 5A)
  const [pendingOwnershipTransfer, setPendingOwnershipTransfer] = useState<OwnershipTransferItem | null>(null);
  const [ownershipLoading, setOwnershipLoading] = useState(false);
  const [ownershipError, setOwnershipError] = useState<string | null>(null);
  const [ownershipFeedback, setOwnershipFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [targetRecipientMode, setTargetRecipientMode] = useState<'member' | 'email'>('member');
  const [targetRecipientUserId, setTargetRecipientUserId] = useState<string>('');
  const [targetRecipientEmail, setTargetRecipientEmail] = useState<string>('');
  const [resultingRole, setResultingRole] = useState<'WORKSPACE_ADMIN' | 'WORKSPACE_MEMBER'>('WORKSPACE_ADMIN');
  const [isInitiatingTransfer, setIsInitiatingTransfer] = useState(false);
  const [isCancellingTransfer, setIsCancellingTransfer] = useState(false);
  const [isAcceptingTransfer, setIsAcceptingTransfer] = useState(false);
  const [isRejectingTransfer, setIsRejectingTransfer] = useState(false);

  // Audit Trail Tab State (Phase 5C)
  const [auditLogs, setAuditLogs] = useState<WorkspaceAuditLogItem[]>([]);
  const [auditLogsLoading, setAuditLogsLoading] = useState(false);
  const [auditLogsError, setAuditLogsError] = useState<string | null>(null);
  const [auditPage, setAuditPage] = useState(1);
  const [auditTotalPages, setAuditTotalPages] = useState(1);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditActionFilter, setAuditActionFilter] = useState<string>('ALL');

  // Danger Zone / Deletion Tab State (Phase 5B)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteConfirmationName, setDeleteConfirmationName] = useState('');
  const [isDeletingWorkspace, setIsDeletingWorkspace] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Authority Flags
  const isOwner = useMemo(() => {
    return activeRole === 'OWNER' || activeWorkspace?.isOwner === true;
  }, [activeRole, activeWorkspace]);

  const canTransfer = useMemo(() => {
    return isOwner || activeRole === 'WORKSPACE_ADMIN';
  }, [isOwner, activeRole]);

  const canInvite = useMemo(() => {
    if (isOwner) return true;
    if (activeRole === 'WORKSPACE_ADMIN' && activeWorkspace?.adminPermissions?.canInviteMembers) return true;
    return false;
  }, [isOwner, activeRole, activeWorkspace]);

  const canRemove = useMemo(() => {
    if (isOwner) return true;
    if (activeRole === 'WORKSPACE_ADMIN' && activeWorkspace?.adminPermissions?.canRemoveMembers) return true;
    return false;
  }, [isOwner, activeRole, activeWorkspace]);

  const canManageRoles = useMemo(() => {
    if (isOwner) return true;
    if (activeRole === 'WORKSPACE_ADMIN' && activeWorkspace?.adminPermissions?.canManageRoles) return true;
    return false;
  }, [isOwner, activeRole, activeWorkspace]);

  // Load Members
  const loadMembers = useCallback(async () => {
    if (!activeWorkspace) return;
    try {
      setMembersLoading(true);
      setMembersError(null);
      const res = await workspacesApi.getMembers(activeWorkspace.id, {
        search: searchQuery.trim() || undefined,
        role: roleFilter !== 'ALL' ? roleFilter : undefined,
        limit: 50,
      });
      if (res.success && res.data) {
        setMembers(res.data.members || []);
        setTotalMembers(res.data.total || 0);
      }
    } catch (err: any) {
      setMembersError(err.message || 'Failed to load workspace members');
    } finally {
      setMembersLoading(false);
    }
  }, [activeWorkspace, searchQuery, roleFilter]);

  // Load Invitations
  const loadInvitations = useCallback(async () => {
    if (!activeWorkspace) return;
    try {
      setInvitationsLoading(true);
      setInvitationsError(null);
      const res = await workspacesApi.getInvitations(activeWorkspace.id);
      if (res.success && res.data) {
        setInvitations(res.data.invitations || []);
      }
    } catch (err: any) {
      setInvitationsError(err.message || 'Failed to load invitations');
    } finally {
      setInvitationsLoading(false);
    }
  }, [activeWorkspace]);

  // Load Admin Permissions
  const loadPermissions = useCallback(async () => {
    if (!activeWorkspace || !isOwner || activeWorkspace.isPersonal) return;
    try {
      setPermissionsLoading(true);
      const res = await workspacesApi.getAdminPermissions(activeWorkspace.id);
      if (res.success && res.data) {
        setAdminPermissions(res.data.permissions);
      }
    } catch (err: any) {
      setPermissionsFeedback({ type: 'error', message: err.message || 'Failed to load admin permissions' });
    } finally {
      setPermissionsLoading(false);
    }
  }, [activeWorkspace, isOwner]);

  // Load Project Transfers (Phase 4)
  const loadTransfers = useCallback(async () => {
    if (!activeWorkspace || activeWorkspace.isPersonal) return;
    try {
      setTransfersLoading(true);
      setTransfersError(null);
      const res = await projectTransferApi.getWorkspacePendingTransfers(activeWorkspace.id);
      if (res.success && res.data) {
        setIncomingTransfers(res.data.incoming || []);
        setOutgoingTransfers(res.data.outgoing || []);
      }
    } catch (err: any) {
      setTransfersError(err.message || 'Failed to load project transfers');
    } finally {
      setTransfersLoading(false);
    }
  }, [activeWorkspace]);

  // Load Pending Ownership Transfer (Phase 5A)
  const loadPendingOwnershipTransfer = useCallback(async () => {
    if (!activeWorkspace || activeWorkspace.isPersonal) return;
    try {
      setOwnershipLoading(true);
      setOwnershipError(null);
      const res = await workspacesApi.getPendingOwnershipTransfer(activeWorkspace.id);
      if (res.success && res.data) {
        setPendingOwnershipTransfer(res.data.transfer);
      }
    } catch (err: any) {
      setOwnershipError(err.message || 'Failed to load ownership transfer status');
    } finally {
      setOwnershipLoading(false);
    }
  }, [activeWorkspace]);

  // Load Audit Logs (Phase 5C)
  const loadAuditLogs = useCallback(
    async (pageToLoad = 1, actionFilter = auditActionFilter) => {
      if (!activeWorkspace) return;
      try {
        setAuditLogsLoading(true);
        setAuditLogsError(null);
        const res = await workspacesApi.getAuditLogs(activeWorkspace.id, {
          page: pageToLoad,
          limit: 15,
          action: actionFilter !== 'ALL' ? actionFilter : undefined,
        });
        if (res.success && res.data) {
          setAuditLogs(res.data.logs || []);
          setAuditTotal(res.data.pagination?.total || 0);
          setAuditTotalPages(res.data.pagination?.totalPages || 1);
          setAuditPage(pageToLoad);
        }
      } catch (err: any) {
        setAuditLogsError(err.message || 'Failed to load workspace audit trail');
      } finally {
        setAuditLogsLoading(false);
      }
    },
    [activeWorkspace, auditActionFilter]
  );

  // Trigger loads on open and tab changes
  useEffect(() => {
    if (!isOpen || !activeWorkspace) return;
    if (activeTab === 'members') {
      loadMembers();
    } else if (activeTab === 'invitations') {
      loadInvitations();
    } else if (activeTab === 'permissions') {
      loadPermissions();
    } else if (activeTab === 'transfers') {
      loadTransfers();
    } else if (activeTab === 'ownership') {
      loadPendingOwnershipTransfer();
    } else if (activeTab === 'audit') {
      loadAuditLogs(1, auditActionFilter);
    }
    // Pre-fetch transfers on modal open to populate badge counter if authorized
    if (canTransfer && !activeWorkspace.isPersonal) {
      loadTransfers();
    }
    if (isOwner && !activeWorkspace.isPersonal) {
      loadPendingOwnershipTransfer();
    }
  }, [
    isOpen,
    activeWorkspace?.id,
    activeTab,
    loadMembers,
    loadInvitations,
    loadPermissions,
    loadTransfers,
    loadPendingOwnershipTransfer,
    loadAuditLogs,
    canTransfer,
    isOwner,
    auditActionFilter,
  ]);

  // Handle Approve Transfer
  const confirmApproveTransfer = async () => {
    if (!activeWorkspace || !transferToApprove) return;
    try {
      setIsProcessingTransfer(true);
      setTransferFeedback(null);
      const res = await projectTransferApi.approveTransfer(transferToApprove.id);
      if (res.success) {
        setTransferFeedback({ type: 'success', message: 'Project transfer approved! Project added to workspace.' });
        setTransferToApprove(null);
        await loadTransfers();
        await refreshWorkspaces();
      }
    } catch (err: any) {
      setTransferFeedback({ type: 'error', message: err.message || 'Failed to approve transfer' });
    } finally {
      setIsProcessingTransfer(false);
    }
  };

  // Handle Reject Transfer
  const confirmRejectTransfer = async () => {
    if (!activeWorkspace || !transferToReject) return;
    try {
      setIsProcessingTransfer(true);
      setTransferFeedback(null);
      const res = await projectTransferApi.rejectTransfer(transferToReject.id, rejectReason.trim() || undefined);
      if (res.success) {
        setTransferFeedback({ type: 'success', message: 'Project transfer rejected.' });
        setTransferToReject(null);
        setRejectReason('');
        await loadTransfers();
      }
    } catch (err: any) {
      setTransferFeedback({ type: 'error', message: err.message || 'Failed to reject transfer' });
    } finally {
      setIsProcessingTransfer(false);
    }
  };

  // Handle Cancel Outgoing Transfer
  const handleCancelOutgoingTransfer = async (transferId: string) => {
    if (!activeWorkspace) return;
    try {
      setIsProcessingTransfer(true);
      setTransferFeedback(null);
      const res = await projectTransferApi.cancelTransfer(transferId);
      if (res.success) {
        setTransferFeedback({ type: 'success', message: 'Transfer request cancelled.' });
        await loadTransfers();
      }
    } catch (err: any) {
      setTransferFeedback({ type: 'error', message: err.message || 'Failed to cancel transfer request' });
    } finally {
      setIsProcessingTransfer(false);
    }
  };

  // Reset tab on open if not permitted
  useEffect(() => {
    if (isOpen) {
      if (initialTab === 'permissions' && (!isOwner || activeWorkspace?.isPersonal)) {
        setActiveTab('members');
      } else if (initialTab === 'ownership' && (!isOwner || activeWorkspace?.isPersonal)) {
        setActiveTab('members');
      } else if (initialTab === 'danger' && !isOwner) {
        setActiveTab('members');
      } else if (initialTab === 'audit' && (!isOwner && activeRole !== 'WORKSPACE_ADMIN')) {
        setActiveTab('members');
      } else {
        setActiveTab(initialTab);
      }
    }
  }, [isOpen, initialTab, isOwner, activeRole, activeWorkspace?.isPersonal]);

  // Handle Initiate Ownership Transfer (Phase 5A)
  const handleInitiateOwnershipTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWorkspace) return;
    try {
      setIsInitiatingTransfer(true);
      setOwnershipFeedback(null);
      if (targetRecipientMode === 'member' && !targetRecipientUserId) {
        setOwnershipFeedback({ type: 'error', message: 'Please select a workspace member to receive ownership' });
        setIsInitiatingTransfer(false);
        return;
      }
      if (targetRecipientMode === 'email' && !targetRecipientEmail.trim()) {
        setOwnershipFeedback({ type: 'error', message: 'Please enter a valid recipient email address' });
        setIsInitiatingTransfer(false);
        return;
      }

      const input = targetRecipientMode === 'member'
        ? { targetUserId: targetRecipientUserId, targetRole: resultingRole }
        : { targetEmail: targetRecipientEmail.trim().toLowerCase(), targetRole: resultingRole };

      const res = await workspacesApi.requestOwnershipTransfer(activeWorkspace.id, input);
      if (res.success && res.data) {
        setPendingOwnershipTransfer(res.data.transfer);
        setOwnershipFeedback({
          type: 'success',
          message: 'Ownership transfer request initiated! The recipient must accept to complete the transfer.',
        });
        setTargetRecipientEmail('');
        setTargetRecipientUserId('');
      }
    } catch (err: any) {
      setOwnershipFeedback({ type: 'error', message: err.message || 'Failed to initiate ownership transfer' });
    } finally {
      setIsInitiatingTransfer(false);
    }
  };

  // Handle Cancel Ownership Transfer (Phase 5A)
  const handleCancelOwnershipTransfer = async () => {
    if (!activeWorkspace) return;
    try {
      setIsCancellingTransfer(true);
      setOwnershipFeedback(null);
      const res = await workspacesApi.cancelOwnershipTransfer(activeWorkspace.id);
      if (res.success) {
        setPendingOwnershipTransfer(null);
        setOwnershipFeedback({ type: 'success', message: 'Ownership transfer request cancelled.' });
      }
    } catch (err: any) {
      setOwnershipFeedback({ type: 'error', message: err.message || 'Failed to cancel ownership transfer' });
    } finally {
      setIsCancellingTransfer(false);
    }
  };

  // Handle Accept Ownership Transfer (Phase 5A)
  const handleAcceptOwnershipTransfer = async () => {
    if (!activeWorkspace) return;
    try {
      setIsAcceptingTransfer(true);
      setOwnershipFeedback(null);
      const res = await workspacesApi.acceptOwnershipTransfer(activeWorkspace.id);
      if (res.success) {
        setOwnershipFeedback({ type: 'success', message: 'You are now the Owner of this workspace!' });
        await refreshWorkspaces();
        await loadPendingOwnershipTransfer();
      }
    } catch (err: any) {
      setOwnershipFeedback({ type: 'error', message: err.message || 'Failed to accept ownership transfer' });
    } finally {
      setIsAcceptingTransfer(false);
    }
  };

  // Handle Reject Ownership Transfer (Phase 5A)
  const handleRejectOwnershipTransfer = async () => {
    if (!activeWorkspace) return;
    try {
      setIsRejectingTransfer(true);
      setOwnershipFeedback(null);
      const res = await workspacesApi.rejectOwnershipTransfer(activeWorkspace.id);
      if (res.success) {
        setPendingOwnershipTransfer(null);
        setOwnershipFeedback({ type: 'success', message: 'Ownership transfer request rejected.' });
      }
    } catch (err: any) {
      setOwnershipFeedback({ type: 'error', message: err.message || 'Failed to reject ownership transfer' });
    } finally {
      setIsRejectingTransfer(false);
    }
  };

  // Handle Confirm Delete Workspace (Phase 5B)
  const handleConfirmDeleteWorkspace = async () => {
    if (!activeWorkspace) return;
    if (deleteConfirmationName.trim() !== activeWorkspace.name.trim()) {
      setDeleteError(`Please type "${activeWorkspace.name}" exactly to confirm.`);
      return;
    }
    try {
      setIsDeletingWorkspace(true);
      setDeleteError(null);
      const res = await workspacesApi.deleteWorkspace(activeWorkspace.id, deleteConfirmationName.trim());
      if (res.success) {
        setDeleteModalOpen(false);
        setDeleteConfirmationName('');
        await refreshWorkspaces();
        await refreshDeletedWorkspaces();
        onClose();
      }
    } catch (err: any) {
      setDeleteError(err.message || 'Failed to delete workspace');
    } finally {
      setIsDeletingWorkspace(false);
    }
  };

  // Handle Role Change
  const confirmRoleChange = async () => {
    if (!activeWorkspace || !targetMemberForRole) return;
    try {
      setIsUpdatingRole(true);
      const res = await workspacesApi.updateMemberRole(
        activeWorkspace.id,
        targetMemberForRole.member.id,
        targetMemberForRole.newRole
      );
      if (res.success) {
        setTargetMemberForRole(null);
        await loadMembers();
        await refreshWorkspaces();
      }
    } catch (err: any) {
      alert(err.message || 'Failed to update member role');
    } finally {
      setIsUpdatingRole(false);
    }
  };

  // Handle Remove Member
  const confirmRemoveMember = async () => {
    if (!activeWorkspace || !memberToRemove) return;
    try {
      setIsRemoving(true);
      const res = await workspacesApi.removeMember(activeWorkspace.id, memberToRemove.id);
      if (res.success) {
        setMemberToRemove(null);
        await loadMembers();
        await refreshWorkspaces();
      }
    } catch (err: any) {
      alert(err.message || 'Failed to remove member');
    } finally {
      setIsRemoving(false);
    }
  };

  // Handle Send Invitation
  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWorkspace) return;
    const email = inviteEmail.trim().toLowerCase();
    if (!email) {
      setInviteFeedback({ type: 'error', message: 'Email address is required' });
      return;
    }

    try {
      setIsInviting(true);
      setInviteFeedback(null);
      const res = await workspacesApi.createInvitation(activeWorkspace.id, {
        email,
        role: inviteRole,
        message: inviteMessage.trim() || undefined,
      });

      if (res.success) {
        setInviteFeedback({ type: 'success', message: `Invitation sent to ${email}` });
        setInviteEmail('');
        setInviteMessage('');
        setInviteRole('WORKSPACE_MEMBER');
        await loadInvitations();
      }
    } catch (err: any) {
      setInviteFeedback({ type: 'error', message: err.message || 'Failed to send invitation' });
    } finally {
      setIsInviting(false);
    }
  };

  // Handle Resend Invitation
  const handleResend = async (invitationId: string) => {
    if (!activeWorkspace) return;
    try {
      setResendingId(invitationId);
      const res = await workspacesApi.resendInvitation(activeWorkspace.id, invitationId);
      if (res.success) {
        setInviteFeedback({ type: 'success', message: 'Invitation resent successfully' });
        await loadInvitations();
      }
    } catch (err: any) {
      setInviteFeedback({ type: 'error', message: err.message || 'Failed to resend invitation' });
    } finally {
      setResendingId(null);
    }
  };

  // Handle Revoke Invitation
  const confirmRevokeInvitation = async () => {
    if (!activeWorkspace || !invitationToRevoke) return;
    try {
      setIsRevoking(true);
      const res = await workspacesApi.revokeInvitation(activeWorkspace.id, invitationToRevoke.id);
      if (res.success) {
        setInvitationToRevoke(null);
        setInviteFeedback({ type: 'success', message: 'Invitation revoked' });
        await loadInvitations();
      }
    } catch (err: any) {
      alert(err.message || 'Failed to revoke invitation');
    } finally {
      setIsRevoking(false);
    }
  };

  // Handle Save Admin Permissions
  const handleSavePermissions = async () => {
    if (!activeWorkspace || !isOwner) return;
    try {
      setIsSavingPermissions(true);
      setPermissionsFeedback(null);
      const res = await workspacesApi.updateAdminPermissions(activeWorkspace.id, adminPermissions);
      if (res.success && res.data) {
        setAdminPermissions(res.data.permissions);
        setPermissionsFeedback({ type: 'success', message: 'Admin permissions updated successfully' });
        await refreshWorkspaces();
      }
    } catch (err: any) {
      setPermissionsFeedback({ type: 'error', message: err.message || 'Failed to update permissions' });
    } finally {
      setIsSavingPermissions(false);
    }
  };

  useEffect(() => {
    if (activeWorkspace) {
      setMaxMembersInput(activeWorkspace.maxMembers != null ? String(activeWorkspace.maxMembers) : '');
      setLimitFeedback(null);
    }
  }, [activeWorkspace?.id, activeWorkspace?.maxMembers]);

  // Handle Save Member Limit (Phase 3 Owner-controlled)
  const handleSaveMemberLimit = async () => {
    if (!activeWorkspace || !isOwner) return;
    try {
      setIsSavingLimit(true);
      setLimitFeedback(null);
      const trimmed = maxMembersInput.trim();
      let parsedLimit: number | null = null;
      if (trimmed !== '') {
        parsedLimit = parseInt(trimmed, 10);
        if (isNaN(parsedLimit) || parsedLimit < 1) {
          setLimitFeedback({ type: 'error', message: 'Member limit must be a positive number' });
          setIsSavingLimit(false);
          return;
        }
      }
      const res = await workspacesApi.updateWorkspace(activeWorkspace.id, {
        maxMembers: parsedLimit,
      });
      if (res.success) {
        setLimitFeedback({
          type: 'success',
          message: parsedLimit
            ? `Workspace member limit set to ${parsedLimit}`
            : 'Workspace member limit removed (unlimited membership)',
        });
        await refreshWorkspaces();
      }
    } catch (err: any) {
      setLimitFeedback({ type: 'error', message: err.message || 'Failed to update member limit' });
    } finally {
      setIsSavingLimit(false);
    }
  };

  if (!isOpen || !activeWorkspace) return null;

  const initials = activeWorkspace.name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

  return (
    <div className="wmm-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="wmm-container" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="wmm-header">
          <div className="wmm-header-left">
            <div className="wmm-avatar">
              {activeWorkspace.avatarUrl ? (
                <img src={activeWorkspace.avatarUrl} alt={activeWorkspace.name} />
              ) : (
                <span>{initials}</span>
              )}
            </div>
            <div className="wmm-header-info">
              <div className="wmm-header-title-row">
                <h2 className="wmm-header-title">{activeWorkspace.name}</h2>
                <span
                  className={`wmm-tag-role ${
                    isOwner ? 'wmm-tag-owner' : activeRole === 'WORKSPACE_ADMIN' ? 'wmm-tag-admin' : 'wmm-tag-member'
                  }`}
                >
                  {isOwner ? 'Owner' : activeRole === 'WORKSPACE_ADMIN' ? 'Admin' : 'Member'}
                </span>
              </div>
              <span className="wmm-header-subtitle">
                {activeWorkspace.isPersonal ? 'Personal Workspace' : 'Team Workspace'} • {totalMembers || activeWorkspace.memberCount} members
              </span>
            </div>
          </div>
          <button type="button" className="wmm-close-btn" onClick={onClose} aria-label="Close modal">
            <CloseIcon size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="wmm-tabs">
          <button
            type="button"
            className={`wmm-tab-btn ${activeTab === 'members' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('members')}
          >
            <UsersIcon size={16} />
            <span>Members</span>
            <span className="wmm-tab-badge">{totalMembers || members.length}</span>
          </button>

          {(isOwner || canInvite) && (
            <button
              type="button"
              className={`wmm-tab-btn ${activeTab === 'invitations' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('invitations')}
            >
              <MailIcon size={16} />
              <span>Invitations</span>
              {invitations.filter((i) => i.status === 'PENDING').length > 0 && (
                <span className="wmm-tab-badge">
                  {invitations.filter((i) => i.status === 'PENDING').length}
                </span>
              )}
            </button>
          )}

          {isOwner && !activeWorkspace.isPersonal && (
            <button
              type="button"
              className={`wmm-tab-btn ${activeTab === 'permissions' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('permissions')}
            >
              <ShieldIcon size={16} />
              <span>Admin Permissions</span>
            </button>
          )}

          {canTransfer && !activeWorkspace.isPersonal && (
            <button
              type="button"
              className={`wmm-tab-btn ${activeTab === 'transfers' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('transfers')}
            >
              <ArrowRightIcon size={16} />
              <span>Transfers</span>
              {incomingTransfers.length > 0 && (
                <span className="wmm-tab-badge" style={{ backgroundColor: '#f59e0b', color: '#000000', fontWeight: 'bold' }}>
                  {incomingTransfers.length}
                </span>
              )}
            </button>
          )}

          {/* Phase 5A: Workspace Ownership Transfer */}
          {isOwner && !activeWorkspace.isPersonal && (
            <button
              type="button"
              className={`wmm-tab-btn ${activeTab === 'ownership' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('ownership')}
            >
              <UsersIcon size={16} />
              <span>Ownership</span>
              {pendingOwnershipTransfer && (
                <span className="wmm-tab-badge" style={{ backgroundColor: '#3b82f6', color: '#ffffff' }}>
                  1
                </span>
              )}
            </button>
          )}

          {/* Phase 5C: Administration Audit Trail */}
          {(isOwner || activeRole === 'WORKSPACE_ADMIN') && (
            <button
              type="button"
              className={`wmm-tab-btn ${activeTab === 'audit' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('audit')}
            >
              <ActivityPulseIcon size={16} />
              <span>Audit Trail</span>
            </button>
          )}

          {/* Phase 5B: Workspace Deletion / Danger Zone */}
          {isOwner && (
            <button
              type="button"
              className={`wmm-tab-btn ${activeTab === 'danger' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('danger')}
            >
              <TrashIcon size={16} />
              <span>Danger Zone</span>
            </button>
          )}
        </div>

        {/* Modal Body */}
        <div className="wmm-body">
          {/* 1. Members Tab */}
          {activeTab === 'members' && (
            <div>
              <div className="wmm-toolbar">
                <div className="wmm-search-box">
                  <SearchIcon size={16} />
                  <input
                    type="text"
                    placeholder="Search by name, username, or email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <select
                  className="wmm-filter-select"
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  aria-label="Filter by role"
                >
                  <option value="ALL">All Roles</option>
                  <option value="OWNER">Owner</option>
                  <option value="WORKSPACE_ADMIN">Admin</option>
                  <option value="WORKSPACE_MEMBER">Member</option>
                </select>
              </div>

              {membersError && (
                <div className="wmm-feedback-banner wmm-feedback-error">
                  <AlertCircleIcon size={16} />
                  <span>{membersError}</span>
                </div>
              )}

              {membersLoading ? (
                <div className="wmm-loading-state">
                  <div className="btn-spinner" />
                  <span>Loading members...</span>
                </div>
              ) : members.length === 0 ? (
                <div className="wmm-empty-state">
                  <p>No members match your criteria</p>
                </div>
              ) : (
                <div className="wmm-members-list">
                  {members.map((m) => {
                    const isSelf = m.userId === user?.id;
                    const isMemberOwner = m.isOwner || m.role === 'OWNER';
                    const memberInitials = m.user.fullName
                      ? m.user.fullName.slice(0, 2).toUpperCase()
                      : m.user.username.slice(0, 2).toUpperCase();

                    return (
                      <div key={m.id} className="wmm-member-card">
                        <div className="wmm-member-left">
                          <div className="wmm-member-avatar">
                            {m.user.avatarUrl ? (
                              <img src={m.user.avatarUrl} alt={m.user.fullName || m.user.username} />
                            ) : (
                              <span>{memberInitials}</span>
                            )}
                          </div>
                          <div className="wmm-member-info">
                            <div className="wmm-member-name-row">
                              <span className="wmm-member-name">
                                {m.user.fullName || m.user.username}
                                {isSelf && ' (You)'}
                              </span>
                              <span className={`wmm-badge-origin ${m.origin.toLowerCase()}`}>
                                {m.origin === 'DIRECT' ? 'Direct' : 'Project'}
                              </span>
                            </div>
                            <span className="wmm-member-email">
                              @{m.user.username} • {m.user.email}
                            </span>
                          </div>
                        </div>

                        <div className="wmm-member-actions">
                          {isMemberOwner ? (
                            <span className="wmm-tag-role wmm-tag-owner">Owner</span>
                          ) : (
                            <select
                              className="wmm-role-dropdown"
                              value={m.role}
                              disabled={!canManageRoles || isSelf}
                              onChange={(e) => {
                                const newRole = e.target.value as WorkspaceRole;
                                setTargetMemberForRole({ member: m, newRole });
                              }}
                              aria-label={`Change role for ${m.user.username}`}
                            >
                              <option value="WORKSPACE_ADMIN">Admin</option>
                              <option value="WORKSPACE_MEMBER">Member</option>
                            </select>
                          )}

                          {!isMemberOwner && !isSelf && canRemove && (
                            <button
                              type="button"
                              className="wmm-btn-remove"
                              title="Remove from workspace"
                              onClick={() => setMemberToRemove(m)}
                              aria-label={`Remove ${m.user.username}`}
                            >
                              <TrashIcon size={16} />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* 2. Invitations Tab */}
          {activeTab === 'invitations' && (
            <div>
              {invitationsError && (
                <div className="wmm-feedback-banner wmm-feedback-error">
                  <AlertCircleIcon size={16} />
                  <span>{invitationsError}</span>
                </div>
              )}

              {inviteFeedback && (
                <div
                  className={`wmm-feedback-banner ${
                    inviteFeedback.type === 'success' ? 'wmm-feedback-success' : 'wmm-feedback-error'
                  }`}
                >
                  {inviteFeedback.type === 'success' ? <CheckIcon size={16} /> : <AlertCircleIcon size={16} />}
                  <span>{inviteFeedback.message}</span>
                </div>
              )}

              {/* Invite Form */}
              {canInvite && (() => {
                const pendingCount = invitations.filter((i) => i.status === 'PENDING').length;
                const activeCount = totalMembers || activeWorkspace.memberCount;
                const isLimitReached =
                  activeWorkspace.maxMembers != null && activeCount + pendingCount >= activeWorkspace.maxMembers;

                return (
                  <>
                    {activeWorkspace.maxMembers != null && (
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '0.625rem 0.875rem',
                          borderRadius: '8px',
                          backgroundColor: isLimitReached ? 'rgba(239, 68, 68, 0.12)' : 'rgba(59, 130, 246, 0.1)',
                          border: `1px solid ${
                            isLimitReached ? 'rgba(239, 68, 68, 0.25)' : 'rgba(59, 130, 246, 0.2)'
                          }`,
                          marginBottom: '1rem',
                          fontSize: '0.8125rem',
                        }}
                      >
                        <span style={{ color: isLimitReached ? '#fca5a5' : '#93c5fd' }}>
                          Capacity: <strong>{activeCount + pendingCount}</strong> /{' '}
                          <strong>{activeWorkspace.maxMembers}</strong> spots committed ({activeCount} active,{' '}
                          {pendingCount} reserved)
                        </span>
                        {isLimitReached && (
                          <span style={{ color: '#ef4444', fontWeight: 600, fontSize: '0.75rem' }}>
                            Limit reached
                          </span>
                        )}
                      </div>
                    )}

                    <form onSubmit={handleInviteSubmit} className="wmm-invite-box">
                      <h3 className="wmm-invite-title">
                        <PlusIcon size={16} />
                        <span>Invite New Member</span>
                      </h3>
                      <div className="wmm-invite-grid">
                        <div>
                          <input
                            type="email"
                            placeholder="colleague@example.com"
                            value={inviteEmail}
                            onChange={(e) => setInviteEmail(e.target.value)}
                            required
                            disabled={isInviting || isLimitReached}
                            className="wmm-search-box"
                            style={{ width: '100%' }}
                          />
                        </div>
                        <div>
                          <select
                            className="wmm-filter-select"
                            value={inviteRole}
                            onChange={(e) => setInviteRole(e.target.value as WorkspaceRole)}
                            disabled={isInviting || isLimitReached}
                            style={{ width: '100%' }}
                          >
                            <option value="WORKSPACE_MEMBER">Workspace Member</option>
                            {isOwner && <option value="WORKSPACE_ADMIN">Workspace Admin</option>}
                          </select>
                        </div>
                        <div>
                          <Button
                            type="submit"
                            variant="primary"
                            size="md"
                            isLoading={isInviting}
                            disabled={isInviting || isLimitReached}
                            leftIcon={<MailIcon size={16} />}
                          >
                            {isLimitReached ? 'Capacity Full' : 'Send Invite'}
                          </Button>
                        </div>
                      </div>
                    </form>
                  </>
                );
              })()}

              {/* Invitations List */}
              <div className="wmm-toolbar" style={{ marginTop: '1rem', marginBottom: '0.75rem' }}>
                <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#a1a1aa' }}>
                  WORKSPACE INVITATIONS ({invitations.length})
                </span>
                <button
                  type="button"
                  onClick={loadInvitations}
                  className="wmm-btn-resend"
                  style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <RefreshCwIcon size={12} />
                  <span>Refresh</span>
                </button>
              </div>

              {invitationsLoading ? (
                <div className="wmm-loading-state">
                  <div className="btn-spinner" />
                  <span>Loading invitations...</span>
                </div>
              ) : invitations.length === 0 ? (
                <div className="wmm-empty-state">
                  <p>No invitations sent yet</p>
                </div>
              ) : (
                <div className="wmm-invitations-list">
                  {invitations.map((inv) => {
                    const isPending = inv.status === 'PENDING';
                    return (
                      <div key={inv.id} className="wmm-invitation-card">
                        <div className="wmm-inv-details">
                          <div className="wmm-inv-email-row">
                            <span className="wmm-inv-email">{inv.invitedEmail}</span>
                            <span className={`wmm-status-pill status-${inv.status.toLowerCase()}`}>
                              {inv.status}
                            </span>
                            <span className="wmm-tag-role wmm-tag-member">
                              {inv.role === 'WORKSPACE_ADMIN' ? 'Admin' : 'Member'}
                            </span>
                          </div>
                          <span className="wmm-inv-meta">
                            Invited by @{inv.invitedBy.username} • Expires {new Date(inv.expiresAt).toLocaleDateString()}
                          </span>
                        </div>

                        {isPending && canInvite && (
                          <div className="wmm-inv-actions">
                            <button
                              type="button"
                              className="wmm-btn-resend"
                              disabled={resendingId === inv.id}
                              onClick={() => handleResend(inv.id)}
                            >
                              {resendingId === inv.id ? 'Resending...' : 'Resend'}
                            </button>
                            <button
                              type="button"
                              className="wmm-btn-revoke"
                              onClick={() => setInvitationToRevoke(inv)}
                            >
                              Revoke
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* 3. Admin Permissions Tab */}
          {activeTab === 'permissions' && isOwner && !activeWorkspace.isPersonal && (
            <div className="wmm-permissions-view">
              <div className="wmm-permissions-intro">
                Customize delegated permissions for Workspace Administrators. These controls grant or restrict privileged capabilities in this team workspace.
              </div>

              {/* Member Capacity Settings (Owner only) */}
              <div
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '10px',
                  padding: '1.25rem',
                  marginBottom: '1.25rem',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: '0.75rem',
                  }}
                >
                  <div>
                    <h4 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: '#f4f4f5' }}>
                      Active Member Limit
                    </h4>
                    <p style={{ margin: '0.25rem 0 0', fontSize: '0.8125rem', color: '#a1a1aa' }}>
                      Configure an active-member limit for this workspace. Pending invitations reserve capacity. Leave
                      blank for unlimited members.
                    </p>
                  </div>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      padding: '0.25rem 0.625rem',
                      borderRadius: '6px',
                      backgroundColor: activeWorkspace.maxMembers
                        ? 'rgba(59, 130, 246, 0.15)'
                        : 'rgba(16, 185, 129, 0.15)',
                      color: activeWorkspace.maxMembers ? '#60a5fa' : '#34d399',
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {activeWorkspace.maxMembers ? `${activeWorkspace.maxMembers} Max Members` : 'Unlimited'}
                  </span>
                </div>

                {limitFeedback && (
                  <div
                    className={`wmm-feedback-banner ${
                      limitFeedback.type === 'success' ? 'wmm-feedback-success' : 'wmm-feedback-error'
                    }`}
                    style={{ marginBottom: '0.75rem' }}
                  >
                    {limitFeedback.type === 'success' ? <CheckIcon size={16} /> : <AlertCircleIcon size={16} />}
                    <span>{limitFeedback.message}</span>
                  </div>
                )}

                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <input
                    type="number"
                    min={totalMembers || activeWorkspace.memberCount || 1}
                    placeholder="e.g. 15 (leave blank for unlimited)"
                    value={maxMembersInput}
                    onChange={(e) => setMaxMembersInput(e.target.value)}
                    className="wmm-search-box"
                    style={{ maxWidth: '280px', flex: 1 }}
                    disabled={isSavingLimit}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="md"
                    isLoading={isSavingLimit}
                    onClick={handleSaveMemberLimit}
                  >
                    Update Limit
                  </Button>
                </div>
                <div style={{ fontSize: '0.75rem', color: '#71717a', marginTop: '0.5rem' }}>
                  Current usage: {totalMembers || activeWorkspace.memberCount} active member
                  {(totalMembers || activeWorkspace.memberCount) === 1 ? '' : 's'}
                  {invitations.filter((i) => i.status === 'PENDING').length > 0 &&
                    ` • ${invitations.filter((i) => i.status === 'PENDING').length} pending reservation(s)`}
                </div>
              </div>

              {permissionsFeedback && (
                <div
                  className={`wmm-feedback-banner ${
                    permissionsFeedback.type === 'success' ? 'wmm-feedback-success' : 'wmm-feedback-error'
                  }`}
                >
                  {permissionsFeedback.type === 'success' ? <CheckIcon size={16} /> : <AlertCircleIcon size={16} />}
                  <span>{permissionsFeedback.message}</span>
                </div>
              )}

              {permissionsLoading ? (
                <div className="wmm-loading-state">
                  <div className="btn-spinner" />
                  <span>Loading permissions...</span>
                </div>
              ) : (
                <div className="wmm-permission-cards">
                  {/* Toggle 1: Invite Members */}
                  <label className="wmm-perm-card">
                    <div className="wmm-perm-info">
                      <span className="wmm-perm-title">Invite Members</span>
                      <span className="wmm-perm-desc">
                        Allow workspace administrators to invite new members to this workspace.
                      </span>
                    </div>
                    <div className="wmm-switch">
                      <input
                        type="checkbox"
                        checked={adminPermissions.canInviteMembers}
                        onChange={(e) =>
                          setAdminPermissions((prev) => ({ ...prev, canInviteMembers: e.target.checked }))
                        }
                      />
                      <span className="wmm-slider" />
                    </div>
                  </label>

                  {/* Toggle 2: Remove Members */}
                  <label className="wmm-perm-card">
                    <div className="wmm-perm-info">
                      <span className="wmm-perm-title">Remove Members</span>
                      <span className="wmm-perm-desc">
                        Allow administrators to remove non-owner members and revoke workspace access.
                      </span>
                    </div>
                    <div className="wmm-switch">
                      <input
                        type="checkbox"
                        checked={adminPermissions.canRemoveMembers}
                        onChange={(e) =>
                          setAdminPermissions((prev) => ({ ...prev, canRemoveMembers: e.target.checked }))
                        }
                      />
                      <span className="wmm-slider" />
                    </div>
                  </label>

                  {/* Toggle 3: Create Projects */}
                  <label className="wmm-perm-card">
                    <div className="wmm-perm-info">
                      <span className="wmm-perm-title">Create Projects</span>
                      <span className="wmm-perm-desc">
                        Allow administrators to create new projects inside this workspace.
                      </span>
                    </div>
                    <div className="wmm-switch">
                      <input
                        type="checkbox"
                        checked={adminPermissions.canCreateProjects}
                        onChange={(e) =>
                          setAdminPermissions((prev) => ({ ...prev, canCreateProjects: e.target.checked }))
                        }
                      />
                      <span className="wmm-slider" />
                    </div>
                  </label>

                  {/* Toggle 4: Manage Roles */}
                  <label className="wmm-perm-card">
                    <div className="wmm-perm-info">
                      <span className="wmm-perm-title">Manage Roles</span>
                      <span className="wmm-perm-desc">
                        Allow administrators to promote or demote members between Administrator and Member.
                      </span>
                    </div>
                    <div className="wmm-switch">
                      <input
                        type="checkbox"
                        checked={adminPermissions.canManageRoles}
                        onChange={(e) =>
                          setAdminPermissions((prev) => ({ ...prev, canManageRoles: e.target.checked }))
                        }
                      />
                      <span className="wmm-slider" />
                    </div>
                  </label>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  isLoading={isSavingPermissions}
                  onClick={handleSavePermissions}
                >
                  Save Admin Permissions
                </Button>
              </div>
            </div>
          )}

          {/* 4. Project Transfers Tab (Phase 4) */}
          {activeTab === 'transfers' && (
            <div className="wmm-transfers-section">
              {transferFeedback && (
                <div
                  className={`wmm-alert ${
                    transferFeedback.type === 'success' ? 'wmm-alert-success' : 'wmm-alert-error'
                  }`}
                  style={{
                    padding: '0.75rem 1rem',
                    borderRadius: '8px',
                    marginBottom: '1rem',
                    backgroundColor:
                      transferFeedback.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                    color: transferFeedback.type === 'success' ? '#34d399' : '#f87171',
                    border: `1px solid ${
                      transferFeedback.type === 'success' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'
                    }`,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    fontSize: '0.8125rem',
                  }}
                >
                  {transferFeedback.type === 'success' ? <CheckIcon size={16} /> : <AlertCircleIcon size={16} />}
                  <span>{transferFeedback.message}</span>
                </div>
              )}

              {transfersLoading ? (
                <div className="wmm-empty-state">
                  <RefreshCwIcon size={24} className="wmm-spin" />
                  <p>Loading project transfers...</p>
                </div>
              ) : transfersError ? (
                <div className="wmm-empty-state">
                  <AlertCircleIcon size={24} style={{ color: '#ef4444' }} />
                  <p>{transfersError}</p>
                </div>
              ) : (
                <>
                  {/* Incoming Transfer Requests */}
                  <div className="wmm-transfers-group">
                    <h3 className="wmm-transfers-title">
                      Incoming Transfer Requests ({incomingTransfers.length})
                    </h3>
                    {incomingTransfers.length === 0 ? (
                      <div className="wmm-empty-state" style={{ padding: '1.5rem', minHeight: 'unset' }}>
                        <p style={{ margin: 0, fontSize: '0.8125rem' }}>No incoming project transfer requests for this workspace.</p>
                      </div>
                    ) : (
                      <div className="wmm-transfers-list">
                        {incomingTransfers.map((item) => (
                          <div key={item.id} className="wmm-transfer-card">
                            <div className="wmm-transfer-card-info">
                              <span className="wmm-transfer-project-name">
                                {item.project?.name || item.projectName || 'Project'}
                              </span>
                              <div className="wmm-transfer-meta">
                                <span>From: <strong>{item.sourceWorkspace?.name}</strong></span>
                                <span>•</span>
                                <span>By: {item.initiatedBy?.fullName || item.initiatedBy?.username}</span>
                                <span>•</span>
                                <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                              </div>
                            </div>
                            <div className="wmm-transfer-actions">
                              <button
                                type="button"
                                className="wmm-btn-reject"
                                onClick={() => {
                                  setTransferToReject(item);
                                  setRejectReason('');
                                }}
                                disabled={isProcessingTransfer}
                              >
                                Reject
                              </button>
                              <button
                                type="button"
                                className="wmm-btn-approve"
                                onClick={() => setTransferToApprove(item)}
                                disabled={isProcessingTransfer}
                              >
                                <CheckIcon size={14} />
                                <span>Approve</span>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Outgoing Transfer Requests */}
                  <div className="wmm-transfers-group" style={{ marginTop: '1rem' }}>
                    <h3 className="wmm-transfers-title">
                      Outgoing Transfer Requests ({outgoingTransfers.length})
                    </h3>
                    {outgoingTransfers.length === 0 ? (
                      <div className="wmm-empty-state" style={{ padding: '1.5rem', minHeight: 'unset' }}>
                        <p style={{ margin: 0, fontSize: '0.8125rem' }}>No outgoing project transfer requests.</p>
                      </div>
                    ) : (
                      <div className="wmm-transfers-list">
                        {outgoingTransfers.map((item) => (
                          <div key={item.id} className="wmm-transfer-card">
                            <div className="wmm-transfer-card-info">
                              <span className="wmm-transfer-project-name">
                                {item.project?.name || item.projectName || 'Project'}
                              </span>
                              <div className="wmm-transfer-meta">
                                <span>To: <strong>{item.destinationWorkspace?.name}</strong></span>
                                <span>•</span>
                                <span>Status: Pending destination approval</span>
                                <span>•</span>
                                <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                              </div>
                            </div>
                            <div className="wmm-transfer-actions">
                              <button
                                type="button"
                                className="wmm-btn-cancel-transfer"
                                onClick={() => handleCancelOutgoingTransfer(item.id)}
                                disabled={isProcessingTransfer}
                              >
                                Cancel Request
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Phase 5A: Ownership Tab */}
          {activeTab === 'ownership' && (
            <div className="wmm-ownership-section">
              <div className="wmm-notice-card">
                <div className="wmm-notice-title">
                  <ShieldIcon size={16} />
                  <span>Workspace Ownership Lifecycle</span>
                </div>
                <p className="wmm-notice-desc">
                  Transferring ownership grants full administrative control of this workspace to the recipient.
                  All projects, tasks, comments, notes, files, and memberships remain intact under the same workspace ID.
                  Once accepted, you will transition to your chosen role (Admin or Member).
                </p>
              </div>

              {ownershipFeedback && (
                <div
                  className={`wmm-feedback-banner ${
                    ownershipFeedback.type === 'success' ? 'wmm-feedback-success' : 'wmm-feedback-error'
                  }`}
                >
                  {ownershipFeedback.type === 'success' ? <CheckIcon size={16} /> : <AlertCircleIcon size={16} />}
                  <span>{ownershipFeedback.message}</span>
                </div>
              )}

              {ownershipError && (
                <div className="wmm-feedback-banner wmm-feedback-error">
                  <AlertCircleIcon size={16} />
                  <span>{ownershipError}</span>
                </div>
              )}

              {ownershipLoading ? (
                <div className="wmm-loading-state">
                  <div className="btn-spinner" />
                  <span>Checking ownership transfer status...</span>
                </div>
              ) : pendingOwnershipTransfer ? (
                <div className="wmm-pending-transfer-box">
                  <div className="wmm-pending-header">
                    <div className="wmm-pending-title">
                      <UsersIcon size={18} />
                      <span>Pending Ownership Transfer</span>
                    </div>
                    <span className="wmm-audit-badge wmm-audit-badge-ownership">
                      {pendingOwnershipTransfer.status}
                    </span>
                  </div>

                  <div className="wmm-pending-details">
                    <div>
                      <div className="wmm-pending-item-label">Transfer Recipient:</div>
                      <div className="wmm-pending-item-val">
                        {pendingOwnershipTransfer.targetUser.fullName || pendingOwnershipTransfer.targetUser.username}
                        {' '}({pendingOwnershipTransfer.targetUser.email})
                      </div>
                    </div>
                    <div>
                      <div className="wmm-pending-item-label">Requested By:</div>
                      <div className="wmm-pending-item-val">
                        {pendingOwnershipTransfer.sourceOwner.fullName || pendingOwnershipTransfer.sourceOwner.username}
                      </div>
                    </div>
                    <div>
                      <div className="wmm-pending-item-label">Your Post-Transfer Role:</div>
                      <div className="wmm-pending-item-val">
                        {pendingOwnershipTransfer.targetRole === 'WORKSPACE_ADMIN' ? 'Admin' : 'Member'}
                      </div>
                    </div>
                    <div>
                      <div className="wmm-pending-item-label">Expires:</div>
                      <div className="wmm-pending-item-val">
                        {new Date(pendingOwnershipTransfer.expiresAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                    {isOwner && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        isLoading={isCancellingTransfer}
                        onClick={handleCancelOwnershipTransfer}
                      >
                        Cancel Transfer Request
                      </Button>
                    )}
                    {pendingOwnershipTransfer.targetUserId === user?.id && (
                      <>
                        <Button
                          type="button"
                          variant="primary"
                          size="sm"
                          style={{ backgroundColor: '#10b981', borderColor: '#059669' }}
                          isLoading={isAcceptingTransfer}
                          onClick={handleAcceptOwnershipTransfer}
                        >
                          Accept Ownership
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          isLoading={isRejectingTransfer}
                          onClick={handleRejectOwnershipTransfer}
                        >
                          Decline
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                <form className="wmm-transfer-form" onSubmit={handleInitiateOwnershipTransfer}>
                  <h4 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600 }}>Initiate Transfer Request</h4>

                  <div className="wmm-form-group">
                    <label className="wmm-form-label">Transfer Recipient Target</label>
                    <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.5rem' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8125rem', cursor: 'pointer' }}>
                        <input
                          type="radio"
                          name="recipientMode"
                          checked={targetRecipientMode === 'member'}
                          onChange={() => setTargetRecipientMode('member')}
                        />
                        <span>Current Workspace Member</span>
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8125rem', cursor: 'pointer' }}>
                        <input
                          type="radio"
                          name="recipientMode"
                          checked={targetRecipientMode === 'email'}
                          onChange={() => setTargetRecipientMode('email')}
                        />
                        <span>Registered User Email</span>
                      </label>
                    </div>

                    {targetRecipientMode === 'member' ? (
                      <select
                        className="wmm-form-select"
                        value={targetRecipientUserId}
                        onChange={(e) => setTargetRecipientUserId(e.target.value)}
                        required
                      >
                        <option value="">Select a member...</option>
                        {members
                          .filter((m) => m.userId !== user?.id)
                          .map((m) => (
                            <option key={m.userId} value={m.userId}>
                              {m.user.fullName || m.user.username} ({m.user.email}) - {m.role === 'WORKSPACE_ADMIN' ? 'Admin' : 'Member'}
                            </option>
                          ))}
                      </select>
                    ) : (
                      <input
                        type="email"
                        className="wmm-form-input"
                        placeholder="verified.user@example.com"
                        value={targetRecipientEmail}
                        onChange={(e) => setTargetRecipientEmail(e.target.value)}
                        required
                      />
                    )}
                    <span className="wmm-form-helper">
                      Recipient must have a verified registered account to receive and accept workspace ownership.
                    </span>
                  </div>

                  <div className="wmm-form-group">
                    <label className="wmm-form-label">Your Resulting Role After Transfer</label>
                    <select
                      className="wmm-form-select"
                      value={resultingRole}
                      onChange={(e) => setResultingRole(e.target.value as 'WORKSPACE_ADMIN' | 'WORKSPACE_MEMBER')}
                    >
                      <option value="WORKSPACE_ADMIN">Workspace Admin (Recommended)</option>
                      <option value="WORKSPACE_MEMBER">Workspace Member</option>
                    </select>
                    <span className="wmm-form-helper">
                      Upon recipient acceptance, your role will transition to this setting.
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                    <Button
                      type="submit"
                      variant="primary"
                      size="sm"
                      isLoading={isInitiatingTransfer}
                    >
                      Send Transfer Request
                    </Button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* Phase 5C: Audit Trail Tab */}
          {activeTab === 'audit' && (
            <div className="wmm-audit-section">
              <div className="wmm-audit-toolbar">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <label className="wmm-form-label" style={{ margin: 0 }}>Filter Action:</label>
                  <select
                    className="wmm-filter-select"
                    value={auditActionFilter}
                    onChange={(e) => {
                      const newFilter = e.target.value;
                      setAuditActionFilter(newFilter);
                      loadAuditLogs(1, newFilter);
                    }}
                  >
                    <option value="ALL">All Actions</option>
                    <option value="OWNERSHIP_TRANSFER_REQUESTED">Ownership Transfer Requested</option>
                    <option value="OWNERSHIP_TRANSFERRED">Ownership Transferred</option>
                    <option value="OWNERSHIP_TRANSFER_CANCELLED">Ownership Transfer Cancelled</option>
                    <option value="OWNERSHIP_TRANSFER_REJECTED">Ownership Transfer Rejected</option>
                    <option value="WORKSPACE_DELETION_SCHEDULED">Workspace Deletion Scheduled</option>
                    <option value="WORKSPACE_RECOVERED">Workspace Recovered</option>
                    <option value="ADMIN_PERMISSIONS_UPDATED">Admin Permissions Updated</option>
                    <option value="MEMBER_ROLE_UPDATED">Member Role Updated</option>
                    <option value="MEMBER_REMOVED">Member Removed</option>
                    <option value="MEMBER_INVITED">Member Invited</option>
                    <option value="MEMBER_JOINED">Member Joined</option>
                  </select>
                </div>
                <button
                  type="button"
                  className="wmm-btn-resend"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}
                  onClick={() => loadAuditLogs(auditPage, auditActionFilter)}
                  disabled={auditLogsLoading}
                >
                  <RefreshCwIcon size={14} />
                  <span>Refresh</span>
                </button>
              </div>

              {auditLogsError && (
                <div className="wmm-feedback-banner wmm-feedback-error">
                  <AlertCircleIcon size={16} />
                  <span>{auditLogsError}</span>
                </div>
              )}

              {auditLogsLoading ? (
                <div className="wmm-loading-state">
                  <div className="btn-spinner" />
                  <span>Loading audit log entries...</span>
                </div>
              ) : auditLogs.length === 0 ? (
                <div className="wmm-empty-state">
                  <p>No administrative audit logs found.</p>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="wmm-audit-table">
                    <thead>
                      <tr>
                        <th>Date & Time</th>
                        <th>Actor</th>
                        <th>Action</th>
                        <th>Target</th>
                        <th>Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditLogs.map((log) => {
                        let badgeClass = 'wmm-audit-badge-default';
                        if (log.action.includes('OWNERSHIP')) badgeClass = 'wmm-audit-badge-ownership';
                        else if (log.action.includes('DELETION')) badgeClass = 'wmm-audit-badge-delete';
                        else if (log.action.includes('RECOVER')) badgeClass = 'wmm-audit-badge-recovery';
                        else if (log.action.includes('MEMBER')) badgeClass = 'wmm-audit-badge-member';

                        return (
                          <tr key={log.id}>
                            <td style={{ whiteSpace: 'nowrap' }}>
                              {new Date(log.createdAt).toLocaleString(undefined, {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </td>
                            <td>
                              <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontWeight: 600, color: '#ffffff' }}>
                                  {log.actor?.fullName || log.actor?.username || 'System'}
                                </span>
                                {log.actor?.email && (
                                  <span style={{ fontSize: '0.6875rem', color: '#71717a' }}>{log.actor.email}</span>
                                )}
                              </div>
                            </td>
                            <td>
                              <span className={`wmm-audit-badge ${badgeClass}`}>
                                {log.action.replace(/_/g, ' ')}
                              </span>
                            </td>
                            <td>
                              {log.targetType ? (
                                <span style={{ fontSize: '0.75rem', color: '#a1a1aa' }}>
                                  {log.targetType}
                                </span>
                              ) : (
                                <span style={{ color: '#52525b' }}>—</span>
                              )}
                            </td>
                            <td>
                              {log.metadata && Object.keys(log.metadata).length > 0 ? (
                                <pre className="wmm-audit-meta-preview">
                                  {JSON.stringify(log.metadata, null, 2)}
                                </pre>
                              ) : (
                                <span style={{ color: '#52525b' }}>—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {auditTotalPages > 1 && (
                <div className="wmm-audit-pagination">
                  <span style={{ fontSize: '0.75rem', color: '#a1a1aa' }}>
                    Page {auditPage} of {auditTotalPages} ({auditTotal} total events)
                  </span>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={auditPage <= 1 || auditLogsLoading}
                      onClick={() => loadAuditLogs(auditPage - 1, auditActionFilter)}
                    >
                      Previous
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={auditPage >= auditTotalPages || auditLogsLoading}
                      onClick={() => loadAuditLogs(auditPage + 1, auditActionFilter)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Phase 5B: Danger Zone Tab */}
          {activeTab === 'danger' && (
            <div className="wmm-danger-section">
              {activeWorkspace.isPersonal ? (
                <div className="wmm-danger-protected">
                  <h4 style={{ margin: 0, color: '#60a5fa', fontSize: '0.9375rem', fontWeight: 600 }}>
                    Personal Workspace Protected
                  </h4>
                  <p style={{ margin: 0, fontSize: '0.8125rem', color: '#d4d4d8', lineHeight: 1.5 }}>
                    This workspace is your personal default workspace tied directly to your user account.
                    It cannot be deleted.
                  </p>
                </div>
              ) : (
                <div className="wmm-danger-card">
                  <div className="wmm-danger-header">
                    <TrashIcon size={20} className="wmm-danger-title" />
                    <h4 className="wmm-danger-title">Delete Workspace</h4>
                  </div>
                  <p className="wmm-danger-desc">
                    Soft-deletes <strong>{activeWorkspace.name}</strong> with a 30-day recovery grace period.
                    <br /><br />
                    • <strong>Immediate Access Revocation:</strong> All access to projects, tasks, comments, notes, files, and calendar will be instantly hidden and denied for all members.
                    <br />
                    • <strong>Transfers & Invitations:</strong> Any pending project transfers and workspace invitations will be transactionally cancelled.
                    <br />
                    • <strong>30-Day Recovery:</strong> As the workspace Owner, you can restore this workspace within 30 days from the Workspace Switcher in the sidebar. After 30 days, the workspace will permanently expire.
                  </p>
                  <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: '0.5rem' }}>
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      style={{ backgroundColor: '#dc2626', borderColor: '#b91c1c' }}
                      onClick={() => {
                        setDeleteConfirmationName('');
                        setDeleteError(null);
                        setDeleteModalOpen(true);
                      }}
                    >
                      Delete This Workspace
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Confirmation Overlay: Role Change */}
        {targetMemberForRole && (
          <div className="wmm-confirm-backdrop">
            <div className="wmm-confirm-box">
              <h4 className="wmm-confirm-title">Change Member Role?</h4>
              <p className="wmm-confirm-desc">
                Are you sure you want to change <strong>{targetMemberForRole.member.user.username}</strong>&apos;s role to{' '}
                <strong>{targetMemberForRole.newRole === 'WORKSPACE_ADMIN' ? 'Admin' : 'Member'}</strong>?
              </p>
              <div className="wmm-confirm-actions">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setTargetMemberForRole(null)}
                  disabled={isUpdatingRole}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  isLoading={isUpdatingRole}
                  onClick={confirmRoleChange}
                >
                  Confirm Change
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Confirmation Overlay: Remove Member */}
        {memberToRemove && (
          <div className="wmm-confirm-backdrop">
            <div className="wmm-confirm-box">
              <h4 className="wmm-confirm-title" style={{ color: '#f87171' }}>
                Remove Member from Workspace?
              </h4>
              <p className="wmm-confirm-desc">
                Are you sure you want to remove <strong>{memberToRemove.user.username}</strong> from{' '}
                <strong>{activeWorkspace.name}</strong>?<br /><br />
                <span style={{ color: '#ef4444', fontWeight: 600 }}>
                  This will immediately revoke their workspace access and all project memberships in this workspace, and unassign any active tasks.
                </span>
              </p>
              <div className="wmm-confirm-actions">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setMemberToRemove(null)}
                  disabled={isRemoving}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  style={{ backgroundColor: '#dc2626', borderColor: '#b91c1c' }}
                  isLoading={isRemoving}
                  onClick={confirmRemoveMember}
                >
                  Remove Member
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Confirmation Overlay: Revoke Invitation */}
        {invitationToRevoke && (
          <div className="wmm-confirm-backdrop">
            <div className="wmm-confirm-box">
              <h4 className="wmm-confirm-title">Revoke Invitation?</h4>
              <p className="wmm-confirm-desc">
                Are you sure you want to revoke the invitation sent to{' '}
                <strong>{invitationToRevoke.invitedEmail}</strong>? The recipient will no longer be able to use this invitation to join the workspace.
              </p>
              <div className="wmm-confirm-actions">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setInvitationToRevoke(null)}
                  disabled={isRevoking}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  style={{ backgroundColor: '#dc2626', borderColor: '#b91c1c' }}
                  isLoading={isRevoking}
                  onClick={confirmRevokeInvitation}
                >
                  Revoke Invitation
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Confirmation Overlay: Approve Transfer (Phase 4) */}
        {transferToApprove && (
          <div className="wmm-confirm-backdrop">
            <div className="wmm-confirm-box">
              <h4 className="wmm-confirm-title">Approve Project Transfer?</h4>
              <p className="wmm-confirm-desc">
                Accept project <strong>{transferToApprove.project?.name || transferToApprove.projectName}</strong> from{' '}
                <strong>{transferToApprove.sourceWorkspace?.name}</strong> into this workspace?
                <br /><br />
                All tasks, comments, files, and notes will be transferred as one logical unit. Existing project members not in this workspace will lose project access, and their assigned tasks will be unassigned.
              </p>
              <div className="wmm-confirm-actions">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setTransferToApprove(null)}
                  disabled={isProcessingTransfer}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  style={{ backgroundColor: '#10b981', borderColor: '#059669' }}
                  isLoading={isProcessingTransfer}
                  onClick={confirmApproveTransfer}
                >
                  Approve & Transfer
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Confirmation Overlay: Reject Transfer (Phase 4) */}
        {transferToReject && (
          <div className="wmm-confirm-backdrop">
            <div className="wmm-confirm-box">
              <h4 className="wmm-confirm-title" style={{ color: '#f87171' }}>Reject Project Transfer?</h4>
              <p className="wmm-confirm-desc">
                Decline the transfer request for <strong>{transferToReject.project?.name || transferToReject.projectName}</strong>.
              </p>
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ fontSize: '0.75rem', color: '#a1a1aa', display: 'block', marginBottom: '0.375rem' }}>
                  Rejection Reason (optional)
                </label>
                <textarea
                  style={{
                    width: '100%',
                    backgroundColor: 'rgba(0, 0, 0, 0.25)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '6px',
                    color: '#ffffff',
                    padding: '0.5rem',
                    fontSize: '0.8125rem',
                    resize: 'vertical',
                    minHeight: '60px',
                    boxSizing: 'border-box',
                  }}
                  placeholder="e.g. Incompatible workspace, redundant project..."
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  disabled={isProcessingTransfer}
                />
              </div>
              <div className="wmm-confirm-actions">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setTransferToReject(null)}
                  disabled={isProcessingTransfer}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  style={{ backgroundColor: '#dc2626', borderColor: '#b91c1c' }}
                  isLoading={isProcessingTransfer}
                  onClick={confirmRejectTransfer}
                >
                  Reject Request
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Confirmation Overlay: Workspace Soft Deletion (Phase 5B) */}
        {deleteModalOpen && (
          <div className="wmm-confirm-backdrop">
            <div className="wmm-confirm-box" style={{ maxWidth: '440px' }}>
              <h4 className="wmm-confirm-title" style={{ color: '#f87171' }}>
                Delete Workspace?
              </h4>
              <p className="wmm-confirm-desc">
                Are you sure you want to soft-delete <strong>{activeWorkspace.name}</strong>?
                <br /><br />
                All members will lose access immediately. You will have 30 days to recover this workspace from the workspace switcher before it is permanently expired.
              </p>
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ fontSize: '0.75rem', color: '#a1a1aa', display: 'block', marginBottom: '0.375rem' }}>
                  Please type <strong>{activeWorkspace.name}</strong> to confirm:
                </label>
                <input
                  type="text"
                  className="wmm-confirm-input"
                  placeholder={activeWorkspace.name}
                  value={deleteConfirmationName}
                  onChange={(e) => {
                    setDeleteConfirmationName(e.target.value);
                    setDeleteError(null);
                  }}
                  disabled={isDeletingWorkspace}
                />
                {deleteError && (
                  <span style={{ fontSize: '0.75rem', color: '#f87171', display: 'block', marginTop: '0.375rem' }}>
                    {deleteError}
                  </span>
                )}
              </div>
              <div className="wmm-confirm-actions">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setDeleteModalOpen(false);
                    setDeleteConfirmationName('');
                    setDeleteError(null);
                  }}
                  disabled={isDeletingWorkspace}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  style={{ backgroundColor: '#dc2626', borderColor: '#b91c1c' }}
                  isLoading={isDeletingWorkspace}
                  disabled={deleteConfirmationName.trim() !== activeWorkspace.name.trim()}
                  onClick={handleConfirmDeleteWorkspace}
                >
                  Delete Workspace
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
