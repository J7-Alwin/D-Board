import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from '../../router/Router';
import { useAuth } from '../../context/AuthContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import {
  workspacesApi,
  type WorkspaceMemberItem,
  type WorkspaceInvitationItem,
  type WorkspaceRole,
  type OwnershipTransferItem,
  type WorkspaceAuditLogItem,
  type WorkspaceDeletionRequestItem,
} from '../../api/workspaces.api';
import {
  projectTransferApi,
  type ProjectTransfer,
} from '../../api/projectTransfer.api';
import {
  UsersIcon,
  MailIcon,
  ShieldIcon,
  TrashIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  AlertCircleIcon,
  SearchIcon,
  PlusIcon,
  RefreshCwIcon,
  ActivityPulseIcon,
  CloseIcon,
  LockIcon,
  SettingsIcon,
  UploadIcon,
  CameraIcon,
} from '../../components/ui/Icons';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { WorkspaceSettingsHeaderAtmosphere } from '../../components/common/HeaderAtmosphereArt';
import './WorkspaceSettingsPage.css';

export type WorkspaceSettingsTab =
  | 'general'
  | 'members'
  | 'invitations'
  | 'permissions'
  | 'transfers'
  | 'ownership'
  | 'deletion-request'
  | 'audit'
  | 'danger';

const WORKSPACE_ROLE_ORDER: Record<string, number> = {
  OWNER: 1,
  WORKSPACE_ADMIN: 2,
  PROJECT_ADMIN: 3,
  WORKSPACE_MEMBER: 4,
};

const getMemberRoleOrder = (m: { role?: string; isOwner?: boolean }) => {
  if (m.isOwner || m.role === 'OWNER') return 1;
  return WORKSPACE_ROLE_ORDER[m.role || ''] ?? 99;
};

const sortWorkspaceMembers = (items: WorkspaceMemberItem[]): WorkspaceMemberItem[] => {
  return [...items].sort((a, b) => {
    const orderA = getMemberRoleOrder(a);
    const orderB = getMemberRoleOrder(b);
    if (orderA !== orderB) return orderA - orderB;
    if (a.joinedAt && b.joinedAt) {
      const timeDiff = new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime();
      if (timeDiff !== 0) return timeDiff;
    }
    const nameA = (a.user?.fullName || a.user?.username || '').toLowerCase();
    const nameB = (b.user?.fullName || b.user?.username || '').toLowerCase();
    return nameA.localeCompare(nameB);
  });
};

export const WorkspaceSettingsPage: React.FC = () => {
  const { navigate } = useRouter();
  const { user } = useAuth();
  const {
    activeWorkspace,
    activeRole,
    workspaces,
    setActiveWorkspaceId,
    refreshWorkspaces,
    refreshDeletedWorkspaces,
    isLoading: isWsLoading,
  } = useWorkspace();

  // Read initial tab from URL query param if present
  const [activeTab, setActiveTab] = useState<WorkspaceSettingsTab>(() => {
    try {
      const search = window.location.search;
      const params = new URLSearchParams(search);
      const tab = params.get('tab') as WorkspaceSettingsTab;
      if (
        tab &&
        ['general', 'members', 'invitations', 'permissions', 'transfers', 'ownership', 'deletion-request', 'audit', 'danger'].includes(tab)
      ) {
        return tab;
      }
    } catch {
      // ignore
    }
    return 'general';
  });

  // Global Page Feedback Alerts
  const [pageError, setPageError] = useState<string | null>(null);
  const [pageSuccess, setPageSuccess] = useState<string | null>(null);

  // Floating Toast Notification (matching project creation style)
  const [toastMessage, setToastMessage] = useState<{
    type: 'success' | 'error';
    title: string;
    message?: string;
  } | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = useCallback((type: 'success' | 'error', title: string, message?: string) => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    setToastMessage({ type, title, message });
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

  // Authority Flags
  const isOwner = useMemo(() => {
    if (activeRole === 'WORKSPACE_ADMIN' || activeRole === 'PROJECT_ADMIN' || activeRole === 'WORKSPACE_MEMBER') {
      return false;
    }
    if (user && activeWorkspace && activeWorkspace.ownerId && user.id) {
      if (activeWorkspace.ownerId !== user.id) {
        return false;
      }
    }
    return activeRole === 'OWNER' || activeWorkspace?.isOwner === true;
  }, [activeRole, activeWorkspace, user]);

  const canTransfer = useMemo(() => {
    return isOwner || activeRole === 'WORKSPACE_ADMIN';
  }, [isOwner, activeRole]);

  const canInvite = useMemo(() => {
    if (isOwner) return true;
    if (activeRole === 'WORKSPACE_ADMIN') {
      const perms = activeWorkspace?.adminPermissions;
      return Boolean(perms?.workspaceAdmin?.canInviteMembers ?? perms?.canInviteMembers ?? true);
    }
    return false;
  }, [isOwner, activeRole, activeWorkspace]);

  const canRemove = useMemo(() => {
    if (isOwner) return true;
    if (activeRole === 'WORKSPACE_ADMIN') {
      const perms = activeWorkspace?.adminPermissions;
      return Boolean(perms?.workspaceAdmin?.canRemoveMembers ?? perms?.canRemoveMembers ?? false);
    }
    return false;
  }, [isOwner, activeRole, activeWorkspace]);

  const canManageRoles = useMemo(() => {
    if (isOwner) return true;
    if (activeRole === 'WORKSPACE_ADMIN') {
      const perms = activeWorkspace?.adminPermissions;
      return Boolean(perms?.workspaceAdmin?.canManageRoles ?? perms?.canManageRoles ?? false);
    }
    return false;
  }, [isOwner, activeRole, activeWorkspace]);

  const canManagePermissions = useMemo(() => {
    if (isOwner) return true;
    if (activeRole === 'WORKSPACE_ADMIN') {
      const perms = activeWorkspace?.adminPermissions;
      return Boolean(perms?.workspaceAdmin?.canManagePermissions ?? perms?.canManagePermissions ?? false);
    }
    return false;
  }, [isOwner, activeRole, activeWorkspace]);

  const canViewPermissions = useMemo(() => {
    if (!activeWorkspace || activeWorkspace.isPersonal) return false;
    return isOwner || (activeRole === 'WORKSPACE_ADMIN' && canManagePermissions);
  }, [activeWorkspace, isOwner, activeRole, canManagePermissions]);

  // Sync tab with URL and ensure tab is valid for current role
  const handleTabChange = (newTab: WorkspaceSettingsTab) => {
    setActiveTab(newTab);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', newTab);
      window.history.replaceState({}, '', url.pathname + url.search);
    } catch {
      // ignore
    }
  };

  // Deletion Request state (Admin requests, Owner reviews)
  const [deletionRequest, setDeletionRequest] = useState<WorkspaceDeletionRequestItem | null>(null);
  const [requestDeletionModalOpen, setRequestDeletionModalOpen] = useState(false);
  const [deletionRequestReason, setDeletionRequestReason] = useState('');
  const [isSubmittingDeletionRequest, setIsSubmittingDeletionRequest] = useState(false);
  const [isCancellingDeletionRequest, setIsCancellingDeletionRequest] = useState(false);
  const [declineModalOpen, setDeclineModalOpen] = useState(false);
  const [declineReason, setDeclineReason] = useState('');
  const [isDecliningDeletionRequest, setIsDecliningDeletionRequest] = useState(false);

  // Leave Workspace state (for non-owners)
  const [leaveModalOpen, setLeaveModalOpen] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  // Clear Personal Workspace Data state (for personal workspace owners)
  const [clearModalOpen, setClearModalOpen] = useState(false);
  const [clearConfirmText, setClearConfirmText] = useState('');
  const [isClearing, setIsClearing] = useState(false);
  const [clearError, setClearError] = useState<string | null>(null);

  const loadDeletionRequest = useCallback(async () => {
    if (!activeWorkspace || activeWorkspace.isPersonal) {
      setDeletionRequest(null);
      return;
    }
    try {
      const res = await workspacesApi.getWorkspaceDeletionRequest(activeWorkspace.id);
      if (res.success && res.data) {
        setDeletionRequest(res.data.deletionRequest);
      }
    } catch {
      // ignore
    }
  }, [activeWorkspace]);

  useEffect(() => {
    loadDeletionRequest();
  }, [loadDeletionRequest]);

  // Reset tab if current tab is no longer permitted
  useEffect(() => {
    if (!activeWorkspace) return;
    if (activeTab === 'permissions' && !canViewPermissions) {
      setActiveTab('general');
    } else if (activeTab === 'transfers' && (!canTransfer || activeWorkspace.isPersonal)) {
      setActiveTab('general');
    } else if (activeTab === 'ownership' && (!isOwner || activeWorkspace.isPersonal)) {
      setActiveTab('general');
    } else if (activeTab === 'deletion-request' && (!isOwner || !deletionRequest || deletionRequest.status !== 'PENDING')) {
      setActiveTab('general');
    } else if (activeTab === 'audit' && !isOwner && activeRole !== 'WORKSPACE_ADMIN') {
      setActiveTab('general');
    } else if (activeTab === 'invitations' && !isOwner && !canInvite) {
      setActiveTab('general');
    }
  }, [activeTab, isOwner, canInvite, canTransfer, canViewPermissions, activeRole, activeWorkspace, deletionRequest]);

  // ----------------------------------------------------
  // 0. General Tab State (Workspace Profile & Limits)
  // ----------------------------------------------------
  const [wsName, setWsName] = useState(activeWorkspace?.name || '');
  const [wsAvatar, setWsAvatar] = useState(activeWorkspace?.avatarUrl || '');
  const [wsMaxMembers, setWsMaxMembers] = useState(
    activeWorkspace?.maxMembers != null ? String(activeWorkspace.maxMembers) : ''
  );
  const [isSavingGeneral, setIsSavingGeneral] = useState(false);
  const [generalFeedback, setGeneralFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (activeWorkspace) {
      setWsName(activeWorkspace.name);
      setWsAvatar(activeWorkspace.avatarUrl || '');
      setWsMaxMembers(activeWorkspace.maxMembers != null ? String(activeWorkspace.maxMembers) : '');
    }
  }, [activeWorkspace?.id, activeWorkspace?.name, activeWorkspace?.avatarUrl, activeWorkspace?.maxMembers]);

  const handleAvatarFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setGeneralFeedback({ type: 'error', message: 'Logo file size must be less than 5MB' });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setWsAvatar(reader.result);
        setGeneralFeedback({ type: 'success', message: 'Logo loaded! Click Save Changes to update.' });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveGeneral = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWorkspace || !isOwner) return;
    const trimmedName = wsName.trim();
    if (trimmedName.length < 2) {
      setGeneralFeedback({ type: 'error', message: 'Workspace name must be at least 2 characters' });
      return;
    }

    let parsedLimit: number | null = null;
    if (wsMaxMembers.trim() !== '') {
      const parsed = parseInt(wsMaxMembers.trim(), 10);
      if (isNaN(parsed) || parsed < 1) {
        setGeneralFeedback({ type: 'error', message: 'Member limit must be a positive integer' });
        return;
      }
      parsedLimit = parsed;
    }

    try {
      setIsSavingGeneral(true);
      setGeneralFeedback(null);
      const res = await workspacesApi.updateWorkspace(activeWorkspace.id, {
        name: trimmedName,
        avatarUrl: wsAvatar.trim() ? wsAvatar.trim() : null,
        maxMembers: activeWorkspace.isPersonal ? undefined : parsedLimit,
      });

      if (res.success) {
        setGeneralFeedback({ type: 'success', message: 'Workspace profile saved successfully!' });
        await refreshWorkspaces();
      }
    } catch (err: any) {
      setGeneralFeedback({ type: 'error', message: err.message || 'Failed to update workspace profile' });
    } finally {
      setIsSavingGeneral(false);
    }
  };

  // ----------------------------------------------------
  // 1. Members Tab State
  // ----------------------------------------------------
  const [members, setMembers] = useState<WorkspaceMemberItem[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersError, setMembersError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [totalMembers, setTotalMembers] = useState(0);

  // Sorted members respecting role hierarchy: Owner -> Workspace Admin -> Project Admin -> Workspace Member
  const sortedMembers = useMemo(() => {
    return sortWorkspaceMembers(members);
  }, [members]);

  // Role Change Confirmation Modal
  const [targetMemberForRole, setTargetMemberForRole] = useState<{
    member: WorkspaceMemberItem;
    newRole: WorkspaceRole;
  } | null>(null);
  const [isUpdatingRole, setIsUpdatingRole] = useState(false);

  // Remove Member Confirmation Modal
  const [memberToRemove, setMemberToRemove] = useState<WorkspaceMemberItem | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);

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
        setMembers(sortWorkspaceMembers(res.data.members || []));
        setTotalMembers(res.data.total || 0);
      }
    } catch (err: any) {
      setMembersError(err.message || 'Failed to load workspace members');
    } finally {
      setMembersLoading(false);
    }
  }, [activeWorkspace, searchQuery, roleFilter]);

  const confirmRoleChange = async () => {
    if (!activeWorkspace || !targetMemberForRole) return;
    const { member, newRole } = targetMemberForRole;

    try {
      setIsUpdatingRole(true);
      setTargetMemberForRole(null);

      const res = await workspacesApi.updateMemberRole(
        activeWorkspace.id,
        member.id,
        newRole
      );

      if (res.success) {
        // Optimistically update local members state immediately
        setMembers((prev) =>
          sortWorkspaceMembers(
            prev.map((item) => (item.id === member.id ? { ...item, role: newRole } : item))
          )
        );
        setMembersError(null);
        showToast('success', 'Role updated successfully');
        await loadMembers();
        await refreshWorkspaces();
      } else {
        showToast('error', 'Role update failed', res.message || 'Failed to update member role');
        await loadMembers();
      }
    } catch (err: any) {
      showToast('error', 'Role update failed', err.message || 'Failed to update member role');
      await loadMembers();
    } finally {
      setIsUpdatingRole(false);
    }
  };

  const confirmRemoveMember = async () => {
    if (!activeWorkspace || !memberToRemove) return;
    const member = memberToRemove;
    const memberName = member.user.fullName || member.user.username;

    try {
      setIsRemoving(true);
      setMemberToRemove(null);

      const res = await workspacesApi.removeMember(activeWorkspace.id, member.id);
      if (res.success) {
        setMembers((prev) => prev.filter((item) => item.id !== member.id));
        setMembersError(null);
        showToast('success', 'Member Removed', `Removed ${memberName} from workspace.`);
        await loadMembers();
        await refreshWorkspaces();
      } else {
        showToast('error', 'Action Failed', res.message || 'Failed to remove member');
        await loadMembers();
      }
    } catch (err: any) {
      showToast('error', 'Action Failed', err.message || 'Failed to remove member');
      await loadMembers();
    } finally {
      setIsRemoving(false);
    }
  };

  // ----------------------------------------------------
  // 2. Invitations Tab State
  // ----------------------------------------------------
  const [invitations, setInvitations] = useState<WorkspaceInvitationItem[]>([]);
  const [invitationsLoading, setInvitationsLoading] = useState(false);
  const [invitationsError, setInvitationsError] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<WorkspaceRole>('WORKSPACE_MEMBER');
  const [inviteMessage, setInviteMessage] = useState('');
  const [isInviting, setIsInviting] = useState(false);
  const [inviteFeedback, setInviteFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [invitationToRevoke, setInvitationToRevoke] = useState<WorkspaceInvitationItem | null>(null);
  const [isRevoking, setIsRevoking] = useState(false);
  const [resendingId, setResendingId] = useState<string | null>(null);

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
      setInviteFeedback({ type: 'error', message: err.message || 'Failed to revoke invitation' });
    } finally {
      setIsRevoking(false);
    }
  };

  // ----------------------------------------------------
  // 3. Workspace Permissions Tab State (Owner & Authorized Admin)
  // ----------------------------------------------------
  const [adminPermissions, setAdminPermissions] = useState({
    canInviteMembers: true,
    canRemoveMembers: false,
    canCreateProjects: true,
    canManageRoles: false,
    canDirectlyCompleteProject: true,
    canArchiveProjects: true,
    canManagePermissions: false,
  });

  const [projectAdminPermissions, setProjectAdminPermissions] = useState({
    canCreateProjects: false,
    canRequestProjectCompletion: true,
  });

  const [workspaceMemberPermissions, setWorkspaceMemberPermissions] = useState({
    canCreateProjects: false,
  });

  const [permissionsLoading, setPermissionsLoading] = useState(false);
  const [isSavingPermissions, setIsSavingPermissions] = useState(false);
  const [permissionsFeedback, setPermissionsFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [maxMembersInput, setMaxMembersInput] = useState<string>('');
  const [isSavingLimit, setIsSavingLimit] = useState(false);
  const [limitFeedback, setLimitFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const loadPermissions = useCallback(async () => {
    if (!activeWorkspace || !canViewPermissions || activeWorkspace.isPersonal) return;
    try {
      setPermissionsLoading(true);
      const res = await workspacesApi.getAdminPermissions(activeWorkspace.id);
      if (res.success && res.data) {
        const raw = res.data.permissions as any;
        const wsAdmin = raw.workspaceAdmin || raw;
        setAdminPermissions({
          canInviteMembers: typeof wsAdmin.canInviteMembers === 'boolean' ? wsAdmin.canInviteMembers : (typeof raw.canInviteMembers === 'boolean' ? raw.canInviteMembers : true),
          canRemoveMembers: typeof wsAdmin.canRemoveMembers === 'boolean' ? wsAdmin.canRemoveMembers : (typeof raw.canRemoveMembers === 'boolean' ? raw.canRemoveMembers : false),
          canCreateProjects: typeof wsAdmin.canCreateProjects === 'boolean' ? wsAdmin.canCreateProjects : (typeof raw.canCreateProjects === 'boolean' ? raw.canCreateProjects : true),
          canManageRoles: typeof wsAdmin.canManageRoles === 'boolean' ? wsAdmin.canManageRoles : (typeof raw.canManageRoles === 'boolean' ? raw.canManageRoles : false),
          canDirectlyCompleteProject: typeof wsAdmin.canDirectlyCompleteProject === 'boolean' ? wsAdmin.canDirectlyCompleteProject : (typeof raw.canDirectlyCompleteProject === 'boolean' ? raw.canDirectlyCompleteProject : true),
          canArchiveProjects: typeof wsAdmin.canArchiveProjects === 'boolean' ? wsAdmin.canArchiveProjects : (typeof raw.canArchiveProjects === 'boolean' ? raw.canArchiveProjects : true),
          canManagePermissions: typeof wsAdmin.canManagePermissions === 'boolean' ? wsAdmin.canManagePermissions : (typeof raw.canManagePermissions === 'boolean' ? raw.canManagePermissions : false),
        });

        const projAdmin = raw.projectAdmin || {};
        setProjectAdminPermissions({
          canCreateProjects: typeof projAdmin.canCreateProjects === 'boolean' ? projAdmin.canCreateProjects : false,
          canRequestProjectCompletion: typeof projAdmin.canRequestProjectCompletion === 'boolean' ? projAdmin.canRequestProjectCompletion : true,
        });

        const wsMember = raw.workspaceMember || {};
        setWorkspaceMemberPermissions({
          canCreateProjects: typeof wsMember.canCreateProjects === 'boolean' ? wsMember.canCreateProjects : false,
        });
      }
    } catch (err: any) {
      setPermissionsFeedback({ type: 'error', message: err.message || 'Failed to load workspace permissions' });
    } finally {
      setPermissionsLoading(false);
    }
  }, [activeWorkspace, canViewPermissions]);

  const handleToggleAdminPermission = (key: keyof typeof adminPermissions) => {
    if (!isOwner) return;
    setAdminPermissions((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleToggleProjectAdminPermission = (key: keyof typeof projectAdminPermissions) => {
    setProjectAdminPermissions((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleToggleWorkspaceMemberPermission = (key: keyof typeof workspaceMemberPermissions) => {
    setWorkspaceMemberPermissions((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleSavePermissions = async () => {
    if (!activeWorkspace || !canViewPermissions) return;
    try {
      setIsSavingPermissions(true);
      setPermissionsFeedback(null);

      const payload: any = {};
      if (isOwner) {
        payload.workspaceAdmin = adminPermissions;
        payload.canInviteMembers = adminPermissions.canInviteMembers;
        payload.canRemoveMembers = adminPermissions.canRemoveMembers;
        payload.canCreateProjects = adminPermissions.canCreateProjects;
        payload.canManageRoles = adminPermissions.canManageRoles;
        payload.canDirectlyCompleteProject = adminPermissions.canDirectlyCompleteProject;
        payload.canArchiveProjects = adminPermissions.canArchiveProjects;
        payload.canManagePermissions = adminPermissions.canManagePermissions;
      }
      payload.projectAdmin = projectAdminPermissions;
      payload.workspaceMember = workspaceMemberPermissions;

      const res = await workspacesApi.updateAdminPermissions(activeWorkspace.id, payload);
      if (res.success) {
        setPermissionsFeedback({ type: 'success', message: 'Admin delegation permissions updated successfully' });
        await refreshWorkspaces();
      }
    } catch (err: any) {
      setPermissionsFeedback({ type: 'error', message: err.message || 'Failed to update admin permissions' });
    } finally {
      setIsSavingPermissions(false);
    }
  };

  const handleSaveMemberLimit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWorkspace || !isOwner) return;

    const trimmed = maxMembersInput.trim();
    let limitVal: number | null = null;
    if (trimmed !== '') {
      const parsed = parseInt(trimmed, 10);
      if (isNaN(parsed) || parsed < 1) {
        setLimitFeedback({ type: 'error', message: 'Member limit must be a positive number' });
        return;
      }
      limitVal = parsed;
    }

    try {
      setIsSavingLimit(true);
      setLimitFeedback(null);
      const res = await workspacesApi.updateMemberLimit(activeWorkspace.id, limitVal);
      if (res.success) {
        setLimitFeedback({
          type: 'success',
          message: limitVal ? `Member limit set to ${limitVal}` : 'Member limit removed (unlimited)',
        });
        await refreshWorkspaces();
      }
    } catch (err: any) {
      setLimitFeedback({ type: 'error', message: err.message || 'Failed to update member limit' });
    } finally {
      setIsSavingLimit(false);
    }
  };

  // ----------------------------------------------------
  // 4. Project Transfers Tab State (Phase 4)
  // ----------------------------------------------------
  const [incomingTransfers, setIncomingTransfers] = useState<ProjectTransfer[]>([]);
  const [outgoingTransfers, setOutgoingTransfers] = useState<ProjectTransfer[]>([]);
  const [transfersLoading, setTransfersLoading] = useState(false);
  const [transfersError, setTransfersError] = useState<string | null>(null);
  const [transferToApprove, setTransferToApprove] = useState<ProjectTransfer | null>(null);
  const [transferToReject, setTransferToReject] = useState<ProjectTransfer | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [isProcessingTransfer, setIsProcessingTransfer] = useState(false);
  const [transferFeedback, setTransferFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

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

  const confirmApproveTransfer = async () => {
    if (!activeWorkspace || !transferToApprove) return;
    try {
      setIsProcessingTransfer(true);
      const res = await projectTransferApi.approveTransfer(transferToApprove.id);
      if (res.success) {
        setTransferToApprove(null);
        setTransferFeedback({ type: 'success', message: 'Project transfer approved successfully!' });
        await loadTransfers();
        await refreshWorkspaces();
      }
    } catch (err: any) {
      setTransferFeedback({ type: 'error', message: err.message || 'Failed to approve transfer' });
    } finally {
      setIsProcessingTransfer(false);
    }
  };

  const confirmRejectTransfer = async () => {
    if (!activeWorkspace || !transferToReject) return;
    try {
      setIsProcessingTransfer(true);
      const res = await projectTransferApi.rejectTransfer(transferToReject.id, rejectReason.trim() || undefined);
      if (res.success) {
        setTransferToReject(null);
        setRejectReason('');
        setTransferFeedback({ type: 'success', message: 'Project transfer rejected.' });
        await loadTransfers();
      }
    } catch (err: any) {
      setTransferFeedback({ type: 'error', message: err.message || 'Failed to reject transfer' });
    } finally {
      setIsProcessingTransfer(false);
    }
  };

  // ----------------------------------------------------
  // 5. Ownership Transfer Tab State (Phase 5A)
  // ----------------------------------------------------
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

  const handleInitiateOwnershipTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWorkspace || !isOwner) return;

    const payload: any = { resultingRole };
    if (targetRecipientMode === 'member') {
      if (!targetRecipientUserId) {
        setOwnershipFeedback({ type: 'error', message: 'Please select a workspace member' });
        return;
      }
      payload.targetUserId = targetRecipientUserId;
    } else {
      const email = targetRecipientEmail.trim().toLowerCase();
      if (!email) {
        setOwnershipFeedback({ type: 'error', message: 'Please provide a recipient email' });
        return;
      }
      payload.targetEmail = email;
    }

    try {
      setIsInitiatingTransfer(true);
      setOwnershipFeedback(null);
      const res = await workspacesApi.initiateOwnershipTransfer(activeWorkspace.id, payload);
      if (res.success && res.data) {
        setPendingOwnershipTransfer(res.data.transfer);
        setOwnershipFeedback({
          type: 'success',
          message: `Ownership transfer initiated. Verification email sent to ${res.data.transfer.targetEmail || 'recipient'}.`,
        });
      }
    } catch (err: any) {
      setOwnershipFeedback({ type: 'error', message: err.message || 'Failed to initiate ownership transfer' });
    } finally {
      setIsInitiatingTransfer(false);
    }
  };

  const handleCancelOwnershipTransfer = async () => {
    if (!activeWorkspace) return;
    try {
      setIsCancellingTransfer(true);
      setOwnershipFeedback(null);
      const res = await workspacesApi.cancelOwnershipTransfer(activeWorkspace.id);
      if (res.success) {
        setPendingOwnershipTransfer(null);
        setOwnershipFeedback({ type: 'success', message: 'Ownership transfer cancelled.' });
      }
    } catch (err: any) {
      setOwnershipFeedback({ type: 'error', message: err.message || 'Failed to cancel ownership transfer' });
    } finally {
      setIsCancellingTransfer(false);
    }
  };

  const handleAcceptOwnershipTransfer = async () => {
    if (!activeWorkspace) return;
    try {
      setIsAcceptingTransfer(true);
      setOwnershipFeedback(null);
      const res = await workspacesApi.acceptOwnershipTransfer(activeWorkspace.id);
      if (res.success) {
        setPendingOwnershipTransfer(null);
        setOwnershipFeedback({ type: 'success', message: 'Congratulations! You are now the workspace Owner.' });
        await refreshWorkspaces();
      }
    } catch (err: any) {
      setOwnershipFeedback({ type: 'error', message: err.message || 'Failed to accept ownership transfer' });
    } finally {
      setIsAcceptingTransfer(false);
    }
  };

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

  // ----------------------------------------------------
  // 6. Audit Trail Tab State (Phase 5C)
  // ----------------------------------------------------
  const [auditLogs, setAuditLogs] = useState<WorkspaceAuditLogItem[]>([]);
  const [auditLogsLoading, setAuditLogsLoading] = useState(false);
  const [auditLogsError, setAuditLogsError] = useState<string | null>(null);
  const [auditPage, setAuditPage] = useState(1);
  const [auditTotalPages, setAuditTotalPages] = useState(1);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditActionFilter, setAuditActionFilter] = useState<string>('ALL');

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

  // ----------------------------------------------------
  // 7. Danger Zone / Deletion Tab State (Phase 5B)
  // ----------------------------------------------------
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteConfirmationName, setDeleteConfirmationName] = useState('');
  const [isDeletingWorkspace, setIsDeletingWorkspace] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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
        navigate('/app/dashboard');
      }
    } catch (err: any) {
      setDeleteError(err.message || 'Failed to delete workspace');
    } finally {
      setIsDeletingWorkspace(false);
    }
  };

  const handleLeaveWorkspace = async () => {
    if (!activeWorkspace || isOwner || activeWorkspace.isPersonal) return;
    try {
      setIsLeaving(true);
      const res = await workspacesApi.leaveWorkspace(activeWorkspace.id);
      if (res.success) {
        setLeaveModalOpen(false);
        const personalWs = workspaces.owned.find((w) => w.isPersonal);
        const targetWs = personalWs || workspaces.owned[0] || workspaces.joined[0];
        if (targetWs) {
          setActiveWorkspaceId(targetWs.id);
        }
        await refreshWorkspaces();
        navigate('/app/dashboard');
      }
    } catch (err: any) {
      setPageError(err.message || 'Failed to leave workspace');
    } finally {
      setIsLeaving(false);
    }
  };

  const handleClearPersonalData = async () => {
    if (!activeWorkspace || !isOwner) return;
    if (clearConfirmText.trim().toUpperCase() !== 'CLEAR') {
      setClearError('Please type CLEAR to confirm');
      return;
    }
    try {
      setIsClearing(true);
      setClearError(null);
      const res = await workspacesApi.clearWorkspaceData(activeWorkspace.id);
      if (res.success) {
        setClearModalOpen(false);
        setClearConfirmText('');
        setPageSuccess('Workspace data reset successfully!');
        await refreshWorkspaces();
      }
    } catch (err: any) {
      setClearError(err.message || 'Failed to clear workspace data');
    } finally {
      setIsClearing(false);
    }
  };

  const handleRequestDeletion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWorkspace || isOwner || activeRole !== 'WORKSPACE_ADMIN') return;
    try {
      setIsSubmittingDeletionRequest(true);
      const res = await workspacesApi.requestWorkspaceDeletion(activeWorkspace.id, deletionRequestReason);
      if (res.success && res.data?.deletionRequest) {
        setDeletionRequest(res.data.deletionRequest);
        setRequestDeletionModalOpen(false);
        setDeletionRequestReason('');
        setPageSuccess('Workspace deletion request submitted to owner');
      }
    } catch (err: any) {
      setPageError(err.message || 'Failed to submit deletion request');
    } finally {
      setIsSubmittingDeletionRequest(false);
    }
  };

  const handleCancelDeletionRequest = async () => {
    if (!activeWorkspace) return;
    try {
      setIsCancellingDeletionRequest(true);
      const res = await workspacesApi.cancelWorkspaceDeletionRequest(activeWorkspace.id);
      if (res.success) {
        setDeletionRequest(null);
        setPageSuccess('Workspace deletion request cancelled');
      }
    } catch (err: any) {
      setPageError(err.message || 'Failed to cancel deletion request');
    } finally {
      setIsCancellingDeletionRequest(false);
    }
  };

  const handleDeclineDeletionRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWorkspace || !isOwner) return;
    try {
      setIsDecliningDeletionRequest(true);
      const res = await workspacesApi.declineWorkspaceDeletionRequest(activeWorkspace.id, declineReason);
      if (res.success) {
        setDeclineModalOpen(false);
        setDeclineReason('');
        setDeletionRequest(null);
        setActiveTab('general');
        setPageSuccess('Workspace deletion request declined');
      }
    } catch (err: any) {
      setPageError(err.message || 'Failed to decline deletion request');
    } finally {
      setIsDecliningDeletionRequest(false);
    }
  };

  // Initial tab-dependent data loaders
  useEffect(() => {
    if (!activeWorkspace) return;
    if (activeTab === 'members') {
      loadMembers();
    } else if (activeTab === 'invitations') {
      loadInvitations();
    } else if (activeTab === 'permissions') {
      loadPermissions();
      if (activeWorkspace.maxMembers != null) {
        setMaxMembersInput(String(activeWorkspace.maxMembers));
      } else {
        setMaxMembersInput('');
      }
    } else if (activeTab === 'transfers') {
      loadTransfers();
    } else if (activeTab === 'ownership') {
      loadPendingOwnershipTransfer();
    } else if (activeTab === 'audit') {
      loadAuditLogs(1, auditActionFilter);
    }
  }, [
    activeTab,
    activeWorkspace,
    loadMembers,
    loadInvitations,
    loadPermissions,
    loadTransfers,
    loadPendingOwnershipTransfer,
    loadAuditLogs,
    auditActionFilter,
  ]);

  // Loading state
  if (isWsLoading || !activeWorkspace) {
    return (
      <div className="workspace-settings-page">
        <div className="ws-header-top-row">
          <button type="button" className="ws-back-link" onClick={() => navigate('/app/dashboard')}>
            <ArrowLeftIcon size={14} />
            <span>Back to Dashboard</span>
          </button>
        </div>
        <div className="ws-settings-loading">
          <div className="btn-spinner" />
          <span>Loading workspace settings...</span>
        </div>
      </div>
    );
  }

  const workspaceInitials = activeWorkspace.name
    ? activeWorkspace.name.slice(0, 2).toUpperCase()
    : 'WS';

  const pendingInvitesCount = invitations.filter((i) => i.status === 'PENDING').length;
  const committedSpots = (totalMembers || activeWorkspace.memberCount) + pendingInvitesCount;
  const isLimitReached =
    activeWorkspace.maxMembers != null && committedSpots >= activeWorkspace.maxMembers;

  return (
    <div className="workspace-settings-page">
      {/* Toast Notification Alert (matching Project Creation style) */}
      {toastMessage && (
        <div
          className={`project-created-toast-banner ${
            toastMessage.type === 'error' ? 'toast-error' : 'toast-success'
          } animate-slide-down`}
          role="status"
          aria-live="polite"
        >
          <div className="toast-icon-wrap">
            {toastMessage.type === 'error' ? '⚠️' : '✅'}
          </div>
          <div className="toast-content">
            <span className="toast-title">{toastMessage.title}</span>
            {toastMessage.message && <span className="toast-msg">{toastMessage.message}</span>}
          </div>
          <button
            type="button"
            className="toast-close-btn"
            onClick={() => setToastMessage(null)}
            aria-label="Dismiss notification"
          >
            <CloseIcon size={14} />
          </button>
        </div>
      )}

      {/* Top Back Navigation Link */}
      <div className="ws-header-top-row">
        <button
          type="button"
          className="ws-back-link"
          onClick={() => navigate('/app/dashboard')}
          id="ws-back-dashboard-btn"
        >
          <ArrowLeftIcon size={14} />
          <span>Back to Dashboard</span>
        </button>
      </div>

      {/* Hero Header Card (Matching Account Settings UI/UX) */}
      <div className="account-settings-header-card ws-header-card">
        <div className="ws-header-content">
          {/* Left: Squircle Icon + Title + Subtitle */}
          <div className="ws-header-left-col">
            <div className="ws-header-icon-box">
              <UsersIcon size={24} />
            </div>
            <div className="ws-header-text">
              <h1>Workspace Settings</h1>
              <p>Manage team members, roles, invitations, permissions, and workspace policies.</p>
            </div>
          </div>

          {/* First Vertical Divider */}
          <div className="ws-header-divider" />

          {/* Center: Quote + Atmosphere Art */}
          <div className="ws-header-center-col">
            <WorkspaceSettingsHeaderAtmosphere />
          </div>

          {/* Second Vertical Divider */}
          <div className="ws-header-divider" />

          {/* Right: Workspace Capsule Pill */}
          <div className="ws-header-right-col">
            <div className="ws-header-user-pill">
              <div className="ws-pill-avatar">
                {activeWorkspace.avatarUrl ? (
                  <img src={activeWorkspace.avatarUrl} alt={activeWorkspace.name} />
                ) : (
                  <span>{workspaceInitials}</span>
                )}
              </div>
              <div className="ws-pill-text-col">
                <span className="ws-pill-name">{activeWorkspace.name}</span>
                <span className="ws-pill-type">
                  {activeWorkspace.isPersonal ? 'Personal' : 'Team Workspace'} • {totalMembers || activeWorkspace.memberCount} members
                </span>
              </div>
              <span
                className={`ws-tag-role ${
                  isOwner ? 'ws-tag-owner' : activeRole === 'WORKSPACE_ADMIN' ? 'ws-tag-admin' : activeRole === 'PROJECT_ADMIN' ? 'ws-tag-admin' : 'ws-tag-member'
                }`}
              >
                {isOwner ? 'Owner' : activeRole === 'WORKSPACE_ADMIN' ? 'Workspace Admin' : activeRole === 'PROJECT_ADMIN' ? 'Project Admin' : 'Workspace Member'}
              </span>
              {!isOwner && !activeWorkspace.isPersonal && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  style={{ color: '#DC2626', borderColor: '#FECACA', marginLeft: '0.5rem', height: '28px', padding: '0 10px', fontSize: '0.75rem' }}
                  onClick={() => setLeaveModalOpen(true)}
                  id="ws-header-leave-btn"
                >
                  Leave Workspace
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Global Alerts */}
      {pageError && (
        <div className="ws-alert ws-alert-error">
          <AlertCircleIcon size={18} />
          <span>{pageError}</span>
          <button type="button" className="ws-alert-dismiss" onClick={() => setPageError(null)}>
            <CloseIcon size={14} />
          </button>
        </div>
      )}

      {pageSuccess && (
        <div className="ws-alert ws-alert-success">
          <CheckCircleIcon size={18} />
          <span>{pageSuccess}</span>
          <button type="button" className="ws-alert-dismiss" onClick={() => setPageSuccess(null)}>
            <CloseIcon size={14} />
          </button>
        </div>
      )}

      {/* 2-Column Split Grid */}
      <div className="ws-split-grid">
        {/* Left Column: Sidebar Navigation Card */}
        <div className="ws-sidebar-nav-card" role="tablist" aria-label="Workspace settings sections">
          {/* 0. General Tab */}
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'general'}
            className={`ws-sidebar-nav-item ${activeTab === 'general' ? 'active' : ''}`}
            onClick={() => handleTabChange('general')}
            id="ws-tab-general"
          >
            <SettingsIcon size={18} />
            <span>General</span>
          </button>

          {/* 1. Members Tab */}
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'members'}
            className={`ws-sidebar-nav-item ${activeTab === 'members' ? 'active' : ''}`}
            onClick={() => handleTabChange('members')}
            id="ws-tab-members"
          >
            <UsersIcon size={18} />
            <span>Members</span>
            <span className="ws-sidebar-badge">{totalMembers || activeWorkspace.memberCount}</span>
          </button>

          {/* 2. Invitations Tab */}
          {(isOwner || canInvite) && (
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'invitations'}
              className={`ws-sidebar-nav-item ${activeTab === 'invitations' ? 'active' : ''}`}
              onClick={() => handleTabChange('invitations')}
              id="ws-tab-invitations"
            >
              <MailIcon size={18} />
              <span>Invitations</span>
              {pendingInvitesCount > 0 && (
                <span className="ws-sidebar-badge badge-amber">{pendingInvitesCount}</span>
              )}
            </button>
          )}

          {/* 3. Permissions Tab (Owner or authorized Workspace Admin with canManagePermissions) */}
          {canViewPermissions && (
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'permissions'}
              className={`ws-sidebar-nav-item ${activeTab === 'permissions' ? 'active' : ''}`}
              onClick={() => handleTabChange('permissions')}
              id="ws-tab-permissions"
            >
              <ShieldIcon size={18} />
              <span>Permissions</span>
            </button>
          )}

          {/* 4. Project Transfers Tab */}
          {canTransfer && !activeWorkspace.isPersonal && (
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'transfers'}
              className={`ws-sidebar-nav-item ${activeTab === 'transfers' ? 'active' : ''}`}
              onClick={() => handleTabChange('transfers')}
              id="ws-tab-transfers"
            >
              <ArrowRightIcon size={18} />
              <span>Transfers</span>
              {incomingTransfers.length > 0 && (
                <span className="ws-sidebar-badge badge-amber">{incomingTransfers.length}</span>
              )}
            </button>
          )}

          {/* 5. Ownership Transfer Tab (Owner only, team workspaces) */}
          {isOwner && !activeWorkspace.isPersonal && (
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'ownership'}
              className={`ws-sidebar-nav-item ${activeTab === 'ownership' ? 'active' : ''}`}
              onClick={() => handleTabChange('ownership')}
              id="ws-tab-ownership"
            >
              <LockIcon size={18} />
              <span>Ownership</span>
              {pendingOwnershipTransfer && (
                <span className="ws-sidebar-badge badge-blue">1</span>
              )}
            </button>
          )}

          {/* 6. Audit Trail Tab (Owner or Admin) */}
          {(isOwner || activeRole === 'WORKSPACE_ADMIN') && (
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'audit'}
              className={`ws-sidebar-nav-item ${activeTab === 'audit' ? 'active' : ''}`}
              onClick={() => handleTabChange('audit')}
              id="ws-tab-audit"
            >
              <ActivityPulseIcon size={18} />
              <span>Audit Trail</span>
            </button>
          )}

          {/* Deletion Request Tab (Owner only, ONLY shown if there is an active pending request) */}
          {isOwner && !activeWorkspace.isPersonal && deletionRequest && deletionRequest.status === 'PENDING' && (
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'deletion-request'}
              className={`ws-sidebar-nav-item ${activeTab === 'deletion-request' ? 'active' : ''}`}
              onClick={() => handleTabChange('deletion-request')}
              id="ws-tab-deletion-request"
              style={{ color: '#DC2626' }}
            >
              <AlertCircleIcon size={18} />
              <span>Deletion Request</span>
              <span className="ws-sidebar-badge badge-red">1</span>
            </button>
          )}

          {/* 7. Danger Zone / Clear Workspace Data Tab */}
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'danger'}
            className={`ws-sidebar-nav-item ${activeTab === 'danger' ? 'active' : ''}`}
            onClick={() => handleTabChange('danger')}
            id="ws-tab-danger"
            style={{ color: activeTab === 'danger' ? '#DC2626' : undefined }}
          >
            <TrashIcon size={18} />
            <span>{activeWorkspace.isDefault ? 'Danger Zone (Clear Data)' : 'Danger Zone'}</span>
          </button>
        </div>

        {/* Right Column: Main Content Card */}
        <div className="ws-main-card">
          {/* ---------------------------------------------------- */}
          {/* TAB 0: GENERAL (Workspace Profile & Limits) */}
          {/* ---------------------------------------------------- */}
          {activeTab === 'general' && (
            <div>
              <div className="ws-card-header">
                <div className="ws-card-header-left">
                  <h2>Workspace Profile & Settings</h2>
                  <p>Update your workspace identity, logo, and membership capacity.</p>
                </div>
              </div>

              {generalFeedback && (
                <div
                  className={`ws-alert ${
                    generalFeedback.type === 'success' ? 'ws-alert-success' : 'ws-alert-error'
                  }`}
                  style={{ marginBottom: '1.5rem' }}
                >
                  {generalFeedback.type === 'success' ? <CheckCircleIcon size={16} /> : <AlertCircleIcon size={16} />}
                  <span>{generalFeedback.message}</span>
                </div>
              )}

              <form onSubmit={handleSaveGeneral}>
                {/* Workspace Logo / Avatar Section */}
                <div className="ws-avatar-section">
                  <div className="ws-avatar-preview-wrap">
                    <div className="ws-avatar-large">
                      {wsAvatar ? (
                        <img src={wsAvatar} alt={wsName || 'Workspace'} />
                      ) : (
                        <span>{wsName ? wsName.slice(0, 2).toUpperCase() : 'WS'}</span>
                      )}
                    </div>
                    {isOwner && (
                      <button
                        type="button"
                        className="ws-avatar-camera-badge"
                        title="Upload logo"
                        onClick={() => fileInputRef.current?.click()}
                        aria-label="Upload workspace logo"
                      >
                        <CameraIcon size={14} />
                      </button>
                    )}
                  </div>

                  <div className="ws-avatar-actions-col">
                    <h4>Workspace Logo</h4>
                    <p>Upload a PNG, JPG, or WebP (max 5MB) or provide a direct image URI.</p>
                    {isOwner && (
                      <div className="ws-avatar-btn-row">
                        <input
                          type="file"
                          ref={fileInputRef}
                          style={{ display: 'none' }}
                          accept="image/png,image/jpeg,image/webp"
                          onChange={handleAvatarFileUpload}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          leftIcon={<UploadIcon size={14} />}
                          onClick={() => fileInputRef.current?.click()}
                        >
                          Upload Logo
                        </Button>
                        {wsAvatar && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            style={{ color: '#DC2626', borderColor: '#FECACA' }}
                            onClick={() => setWsAvatar('')}
                          >
                            Remove
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Direct Image URI input */}
                {isOwner && (
                  <div className="ws-form-group">
                    <label className="ws-form-label" htmlFor="ws-avatar-url-input">Logo Image URI</label>
                    <input
                      type="url"
                      id="ws-avatar-url-input"
                      className="ws-input"
                      placeholder="https://example.com/logo.png"
                      value={wsAvatar}
                      onChange={(e) => setWsAvatar(e.target.value)}
                    />
                    <span className="ws-form-hint">Direct link to hosted logo image</span>
                  </div>
                )}

                {/* Workspace Name */}
                <div className="ws-form-group">
                  <label className="ws-form-label" htmlFor="ws-name-input">Workspace Name *</label>
                  <input
                    type="text"
                    className="ws-input"
                    placeholder="e.g. Acme Corp, Engineering Studio"
                    value={wsName}
                    onChange={(e) => setWsName(e.target.value)}
                    required
                    disabled={!isOwner}
                    id="ws-name-input"
                  />
                  <span className="ws-form-hint">Displayed to all members and project collaborators</span>
                </div>

                {/* Member Limit (Moved here directly from Admin Permissions!) */}
                {!activeWorkspace.isPersonal && (
                  <div className="ws-form-group">
                    <label className="ws-form-label" htmlFor="ws-member-limit-input">Member Limit</label>
                    <input
                      type="number"
                      min="1"
                      className="ws-input"
                      placeholder="e.g. 10 (Leave blank for unlimited)"
                      value={wsMaxMembers}
                      onChange={(e) => setWsMaxMembers(e.target.value)}
                      disabled={!isOwner}
                      id="ws-member-limit-input"
                    />
                    <span className="ws-form-hint">
                      Maximum combined active members and pending invitations permitted in this workspace. Leave empty for unlimited.
                    </span>
                  </div>
                )}

                {/* Workspace Metadata Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', margin: '2rem 0' }}>
                  <div className="ws-info-card">
                    <span className="ws-info-label">Workspace Type</span>
                    <span className="ws-info-value">
                      {activeWorkspace.isPersonal ? 'Personal Workspace' : 'Team Workspace'}
                    </span>
                  </div>
                  <div className="ws-info-card">
                    <span className="ws-info-label">Current Members</span>
                    <span className="ws-info-value">
                      {totalMembers || activeWorkspace.memberCount} members
                    </span>
                  </div>
                  <div className="ws-info-card">
                    <span className="ws-info-label">Created</span>
                    <span className="ws-info-value">
                      {new Date(activeWorkspace.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                {isOwner && (
                  <div style={{ marginTop: '1.5rem' }}>
                    <Button
                      type="submit"
                      variant="primary"
                      size="md"
                      isLoading={isSavingGeneral}
                      id="ws-save-general-btn"
                    >
                      Save Changes
                    </Button>
                  </div>
                )}

                {/* Clear Personal Workspace Data Card in General Tab */}
                {activeWorkspace.isPersonal && (
                  <div
                    style={{
                      marginTop: '2rem',
                      padding: '1.25rem',
                      borderRadius: '10px',
                      border: '1px solid #FECACA',
                      backgroundColor: '#FEF2F2',
                    }}
                  >
                    <h3 style={{ fontSize: '0.9375rem', fontWeight: 600, color: '#991B1B', margin: '0 0 0.35rem 0' }}>
                      Clear Workspace Data
                    </h3>
                    <p style={{ fontSize: '0.8125rem', color: '#7F1D1D', margin: '0 0 1rem 0', lineHeight: 1.5 }}>
                      Need a clean slate? You can wipe all projects, tasks, comments, notes, uploaded files, and calendar events from this personal workspace without deleting the workspace itself.
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      style={{ color: '#DC2626', borderColor: '#FCA5A5', backgroundColor: '#FFFFFF' }}
                      onClick={() => {
                        setClearModalOpen(true);
                        setClearConfirmText('');
                        setClearError(null);
                      }}
                      id="ws-general-clear-data-btn"
                    >
                      Clear Workspace Data
                    </Button>
                  </div>
                )}
              </form>
            </div>
          )}

          {/* ---------------------------------------------------- */}
          {/* TAB 1: MEMBERS */}
          {/* ---------------------------------------------------- */}
          {activeTab === 'members' && (
            <div>
              <div className="ws-card-header">
                <div className="ws-card-header-left">
                  <h2>Workspace Members</h2>
                  <p>View and manage team members, assign administrative roles, or adjust access.</p>
                </div>
                {(isOwner || canInvite) && (
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    leftIcon={<PlusIcon size={16} />}
                    onClick={() => handleTabChange('invitations')}
                    id="ws-invite-shortcut-btn"
                  >
                    Invite Member
                  </Button>
                )}
              </div>

              {/* Toolbar */}
              <div className="ws-toolbar">
                <div className="ws-search-box">
                  <SearchIcon size={16} />
                  <input
                    type="text"
                    placeholder="Search by name, username, or email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    id="ws-members-search-input"
                  />
                </div>
                <select
                  className="ws-filter-select"
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  aria-label="Filter by role"
                  id="ws-role-filter-select"
                >
                  <option value="ALL">All Roles</option>
                  <option value="OWNER">Owner</option>
                  <option value="WORKSPACE_ADMIN">Workspace Admin</option>
                  <option value="PROJECT_ADMIN">Project Admin</option>
                  <option value="WORKSPACE_MEMBER">Workspace Member</option>
                </select>
              </div>

              {membersError && (
                <div
                  className="ws-alert ws-alert-error"
                  style={{
                    marginBottom: '1rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <AlertCircleIcon size={16} />
                    <span>{membersError}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMembersError(null)}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: '#DC2626',
                      display: 'flex',
                      padding: '2px',
                    }}
                    aria-label="Dismiss error"
                  >
                    <CloseIcon size={14} />
                  </button>
                </div>
              )}

              {/* Members List */}
              {membersLoading ? (
                <div className="ws-loading-state">
                  <div className="btn-spinner" />
                  <span>Loading members...</span>
                </div>
              ) : members.length === 0 ? (
                <div className="ws-empty-state">
                  <UsersIcon size={32} style={{ marginBottom: '0.75rem', opacity: 0.5 }} />
                  <p>No members match your criteria.</p>
                </div>
              ) : (
                <div className="ws-members-list">
                  {sortedMembers.map((m) => {
                    const isSelf = m.userId === user?.id;
                    const isMemberOwner = m.isOwner || m.role === 'OWNER';
                    const memberInitials = m.user.fullName
                      ? m.user.fullName.slice(0, 2).toUpperCase()
                      : m.user.username.slice(0, 2).toUpperCase();

                    return (
                      <div key={m.id} className="ws-member-card">
                        <div className="ws-member-left">
                          <div className="ws-member-avatar">
                            {m.user.avatarUrl ? (
                              <img src={m.user.avatarUrl} alt={m.user.fullName || m.user.username} />
                            ) : (
                              <span>{memberInitials}</span>
                            )}
                          </div>
                          <div className="ws-member-info">
                            <div className="ws-member-name-row">
                              <span className="ws-member-name">
                                {m.user.fullName || m.user.username}
                                {isSelf && ' (You)'}
                              </span>
                              <span className={`ws-badge-origin ${m.origin.toLowerCase()}`}>
                                {m.origin === 'DIRECT' ? 'Direct' : 'Project'}
                              </span>
                            </div>
                            <span className="ws-member-email">
                              @{m.user.username} • {m.user.email}
                            </span>
                          </div>
                        </div>

                        <div className="ws-member-actions">
                          {isMemberOwner ? (
                            <span className="ws-tag-role ws-tag-owner">Owner</span>
                          ) : (
                            <select
                              className="ws-role-dropdown"
                              value={m.role}
                              disabled={!canManageRoles || isSelf || (!isOwner && m.role === 'WORKSPACE_ADMIN')}
                              onChange={(e) => {
                                const newRole = e.target.value as WorkspaceRole;
                                if (newRole !== m.role) {
                                  setTargetMemberForRole({ member: m, newRole });
                                }
                              }}
                              aria-label={`Change role for ${m.user.username}`}
                            >
                              <option value="WORKSPACE_ADMIN">Workspace Admin</option>
                              <option value="PROJECT_ADMIN">Project Admin</option>
                              <option value="WORKSPACE_MEMBER">Workspace Member</option>
                            </select>
                          )}

                          {isSelf && !isMemberOwner && !activeWorkspace.isPersonal && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              style={{ color: '#DC2626', borderColor: '#FECACA', fontSize: '0.75rem', height: '28px', padding: '0 8px' }}
                              onClick={() => setLeaveModalOpen(true)}
                              id="ws-member-row-leave-btn"
                            >
                              Leave Workspace
                            </Button>
                          )}

                          {!isMemberOwner && !isSelf && canRemove && (
                            <button
                              type="button"
                              className="ws-btn-remove"
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

          {/* ---------------------------------------------------- */}
          {/* TAB 2: INVITATIONS */}
          {/* ---------------------------------------------------- */}
          {activeTab === 'invitations' && (
            <div>
              <div className="ws-card-header">
                <div className="ws-card-header-left">
                  <h2>Invitations & Member Limits</h2>
                  <p>Invite new members to collaborate in this workspace and manage pending invitations.</p>
                </div>
              </div>

              {invitationsError && (
                <div className="ws-alert ws-alert-error" style={{ marginBottom: '1rem' }}>
                  <AlertCircleIcon size={16} />
                  <span>{invitationsError}</span>
                </div>
              )}

              {inviteFeedback && (
                <div
                  className={`ws-alert ${inviteFeedback.type === 'success' ? 'ws-alert-success' : 'ws-alert-error'}`}
                  style={{ marginBottom: '1.25rem' }}
                >
                  {inviteFeedback.type === 'success' ? <CheckCircleIcon size={16} /> : <AlertCircleIcon size={16} />}
                  <span>{inviteFeedback.message}</span>
                </div>
              )}

              {/* Member Limit / Capacity Banner */}
              {activeWorkspace.maxMembers != null && (
                <div className={`ws-capacity-notice ${isLimitReached ? 'is-limit' : ''}`}>
                  <span>
                    Capacity: <strong>{committedSpots}</strong> / <strong>{activeWorkspace.maxMembers}</strong> spots
                    committed ({totalMembers || activeWorkspace.memberCount} active, {pendingInvitesCount} reserved)
                  </span>
                  {isLimitReached && (
                    <span style={{ fontWeight: 700, fontSize: '0.8rem' }}>Limit reached</span>
                  )}
                </div>
              )}

              {/* Invite Form */}
              {canInvite && (
                <div className="ws-invite-card">
                  <h3 className="ws-invite-title">
                    <PlusIcon size={16} />
                    <span>Invite New Member</span>
                  </h3>
                  <form onSubmit={handleInviteSubmit}>
                    <div className="ws-invite-grid">
                      <div>
                        <input
                          type="email"
                          className="ws-input"
                          placeholder="colleague@example.com"
                          value={inviteEmail}
                          onChange={(e) => setInviteEmail(e.target.value)}
                          required
                          disabled={isInviting || isLimitReached}
                          id="ws-invite-email-input"
                        />
                      </div>
                      <div>
                        <select
                          className="ws-input"
                          value={inviteRole}
                          onChange={(e) => setInviteRole(e.target.value as WorkspaceRole)}
                          disabled={isInviting || isLimitReached}
                          id="ws-invite-role-select"
                        >
                          {isOwner && <option value="WORKSPACE_ADMIN">Workspace Admin</option>}
                          <option value="PROJECT_ADMIN">Project Admin</option>
                          <option value="WORKSPACE_MEMBER">Workspace Member</option>
                        </select>
                      </div>
                      <div>
                        <Button
                          type="submit"
                          variant="primary"
                          size="md"
                          style={{ width: '100%' }}
                          isLoading={isInviting}
                          disabled={isLimitReached}
                          id="ws-send-invite-btn"
                        >
                          Send Invite
                        </Button>
                      </div>
                    </div>

                    <div style={{ marginTop: '0.75rem' }}>
                      <textarea
                        className="ws-input"
                        rows={2}
                        placeholder="Optional invitation note..."
                        value={inviteMessage}
                        onChange={(e) => setInviteMessage(e.target.value)}
                        disabled={isInviting || isLimitReached}
                      />
                    </div>
                  </form>
                </div>
              )}

              {/* Pending Invitations Table */}
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0F172A', margin: '1.5rem 0 0.75rem 0' }}>
                Pending Invitations ({invitations.filter((i) => i.status === 'PENDING').length})
              </h3>

              {invitationsLoading ? (
                <div className="ws-loading-state">
                  <div className="btn-spinner" />
                  <span>Loading invitations...</span>
                </div>
              ) : invitations.length === 0 ? (
                <div className="ws-empty-state">
                  <MailIcon size={32} style={{ marginBottom: '0.75rem', opacity: 0.5 }} />
                  <p>No invitations found for this workspace.</p>
                </div>
              ) : (
                <div className="ws-table-container">
                  <table className="ws-table">
                    <thead>
                      <tr>
                        <th>Recipient</th>
                        <th>Role</th>
                        <th>Status</th>
                        <th>Invited Date</th>
                        <th style={{ textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invitations.map((inv) => (
                        <tr key={inv.id}>
                          <td>
                            <strong>{inv.invitedEmail}</strong>
                          </td>
                          <td>
                            <span className="ws-tag-role ws-tag-member">
                              {inv.role === 'WORKSPACE_ADMIN'
                                ? 'Workspace Admin'
                                : inv.role === 'PROJECT_ADMIN'
                                ? 'Project Admin'
                                : 'Workspace Member'}
                            </span>
                          </td>
                          <td>
                            <span
                              style={{
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                padding: '2px 8px',
                                borderRadius: '4px',
                                backgroundColor: inv.status === 'PENDING' ? '#FEF3C7' : '#F1F5F9',
                                color: inv.status === 'PENDING' ? '#B45309' : '#475569',
                              }}
                            >
                              {inv.status}
                            </span>
                          </td>
                          <td>{new Date(inv.createdAt).toLocaleDateString()}</td>
                          <td style={{ textAlign: 'right' }}>
                            {inv.status === 'PENDING' && (
                              <div style={{ display: 'inline-flex', gap: '0.5rem' }}>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleResend(inv.id)}
                                  disabled={resendingId === inv.id}
                                >
                                  {resendingId === inv.id ? 'Resending...' : 'Resend'}
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  style={{ color: '#DC2626', borderColor: '#FECACA' }}
                                  onClick={() => setInvitationToRevoke(inv)}
                                >
                                  Revoke
                                </Button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ---------------------------------------------------- */}
          {/* TAB 3: WORKSPACE PERMISSIONS & MEMBER LIMIT */}
          {/* ---------------------------------------------------- */}
          {activeTab === 'permissions' && canViewPermissions && !activeWorkspace.isPersonal && (
            <div className="ws-permissions-wrapper">
              <div className="ws-card-header">
                <div className="ws-card-header-left">
                  <h2>Permissions & Delegation Controls</h2>
                  <p>Configure role-based privileges and operational policies across your workspace.</p>
                </div>
              </div>

              {permissionsFeedback && (
                <div
                  className={`ws-alert ${
                    permissionsFeedback.type === 'success' ? 'ws-alert-success' : 'ws-alert-error'
                  }`}
                  style={{ marginBottom: '1.25rem' }}
                >
                  {permissionsFeedback.type === 'success' ? <CheckCircleIcon size={16} /> : <AlertCircleIcon size={16} />}
                  <span>{permissionsFeedback.message}</span>
                </div>
              )}

              {permissionsLoading ? (
                <div className="ws-loading-state">
                  <div className="btn-spinner" />
                  <span>Loading permissions...</span>
                </div>
              ) : (
                <div>
                  {/* SECTION 1: WORKSPACE ADMIN */}
                  <div className="ws-permission-section">
                    <div className="ws-permission-section-header">
                      <div>
                        <h3 className="ws-permission-section-title">Workspace Admin Permissions</h3>
                        <p className="ws-permission-section-desc">
                          Define administrative privileges for Workspace Administrators.
                        </p>
                      </div>
                      {!isOwner && (
                        <span className="ws-permission-badge-readonly">
                          <LockIcon size={12} /> Managed by Owner
                        </span>
                      )}
                    </div>

                    <div className="ws-permissions-grid">
                      {/* Toggle 1: Invite Members */}
                      <div className="ws-permission-item">
                        <div className="ws-permission-info">
                          <span className="ws-permission-title">Invite New Members</span>
                          <span className="ws-permission-desc">
                            Allows Workspace Admins to invite new members to the workspace.
                          </span>
                        </div>
                        <label className={`ws-toggle-switch ${!isOwner ? 'disabled' : ''}`}>
                          <input
                            type="checkbox"
                            checked={adminPermissions.canInviteMembers}
                            disabled={!isOwner}
                            onChange={() => handleToggleAdminPermission('canInviteMembers')}
                          />
                          <span className="ws-toggle-slider" />
                        </label>
                      </div>

                      {/* Toggle 2: Remove Members */}
                      <div className="ws-permission-item">
                        <div className="ws-permission-info">
                          <span className="ws-permission-title">Remove Members</span>
                          <span className="ws-permission-desc">
                            Allows Workspace Admins to remove existing members from the workspace.
                          </span>
                        </div>
                        <label className={`ws-toggle-switch ${!isOwner ? 'disabled' : ''}`}>
                          <input
                            type="checkbox"
                            checked={adminPermissions.canRemoveMembers}
                            disabled={!isOwner}
                            onChange={() => handleToggleAdminPermission('canRemoveMembers')}
                          />
                          <span className="ws-toggle-slider" />
                        </label>
                      </div>

                      {/* Toggle 3: Create Projects */}
                      <div className="ws-permission-item">
                        <div className="ws-permission-info">
                          <span className="ws-permission-title">Create Projects</span>
                          <span className="ws-permission-desc">
                            Allows Workspace Admins to create new projects within this workspace.
                          </span>
                        </div>
                        <label className={`ws-toggle-switch ${!isOwner ? 'disabled' : ''}`}>
                          <input
                            type="checkbox"
                            checked={adminPermissions.canCreateProjects}
                            disabled={!isOwner}
                            onChange={() => handleToggleAdminPermission('canCreateProjects')}
                          />
                          <span className="ws-toggle-slider" />
                        </label>
                      </div>

                      {/* Toggle 4: Manage Roles */}
                      <div className="ws-permission-item">
                        <div className="ws-permission-info">
                          <span className="ws-permission-title">Manage Member Roles</span>
                          <span className="ws-permission-desc">
                            Allows Workspace Admins to promote members to Admin or demote them to Member.
                          </span>
                        </div>
                        <label className={`ws-toggle-switch ${!isOwner ? 'disabled' : ''}`}>
                          <input
                            type="checkbox"
                            checked={adminPermissions.canManageRoles}
                            disabled={!isOwner}
                            onChange={() => handleToggleAdminPermission('canManageRoles')}
                          />
                          <span className="ws-toggle-slider" />
                        </label>
                      </div>

                      {/* Toggle 5: Directly Complete Projects */}
                      <div className="ws-permission-item">
                        <div className="ws-permission-info">
                          <span className="ws-permission-title">Directly Complete Projects</span>
                          <span className="ws-permission-desc">
                            Allows Workspace Admins to mark projects as completed directly without requesting approval.
                          </span>
                        </div>
                        <label className={`ws-toggle-switch ${!isOwner ? 'disabled' : ''}`}>
                          <input
                            type="checkbox"
                            checked={adminPermissions.canDirectlyCompleteProject}
                            disabled={!isOwner}
                            onChange={() => handleToggleAdminPermission('canDirectlyCompleteProject')}
                          />
                          <span className="ws-toggle-slider" />
                        </label>
                      </div>

                      {/* Toggle 6: Archive Projects */}
                      <div className="ws-permission-item">
                        <div className="ws-permission-info">
                          <span className="ws-permission-title">Archive Projects</span>
                          <span className="ws-permission-desc">
                            Allows Workspace Admins to archive and unarchive projects in this workspace.
                          </span>
                        </div>
                        <label className={`ws-toggle-switch ${!isOwner ? 'disabled' : ''}`}>
                          <input
                            type="checkbox"
                            checked={adminPermissions.canArchiveProjects}
                            disabled={!isOwner}
                            onChange={() => handleToggleAdminPermission('canArchiveProjects')}
                          />
                          <span className="ws-toggle-slider" />
                        </label>
                      </div>

                      {/* Toggle 7: Manage Permissions */}
                      <div className="ws-permission-item">
                        <div className="ws-permission-info">
                          <span className="ws-permission-title">Manage Member Permissions</span>
                          <span className="ws-permission-desc">
                            Allows Workspace Admins to view and configure permissions for Project Admins and Workspace Members.
                          </span>
                        </div>
                        <label className={`ws-toggle-switch ${!isOwner ? 'disabled' : ''}`}>
                          <input
                            type="checkbox"
                            checked={adminPermissions.canManagePermissions}
                            disabled={!isOwner}
                            onChange={() => handleToggleAdminPermission('canManagePermissions')}
                          />
                          <span className="ws-toggle-slider" />
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* SECTION 2: PROJECT ADMIN */}
                  <div className="ws-permission-section">
                    <div className="ws-permission-section-header">
                      <div>
                        <h3 className="ws-permission-section-title">Project Admin Permissions</h3>
                        <p className="ws-permission-section-desc">
                          Configure baseline capabilities for Project Administrators in this workspace.
                        </p>
                      </div>
                    </div>

                    <div className="ws-permissions-grid">
                      {/* Toggle 1: Create Projects */}
                      <div className="ws-permission-item">
                        <div className="ws-permission-info">
                          <span className="ws-permission-title">Create Projects</span>
                          <span className="ws-permission-desc">
                            Allows Project Admins to create new projects within this workspace.
                          </span>
                        </div>
                        <label className="ws-toggle-switch">
                          <input
                            type="checkbox"
                            checked={projectAdminPermissions.canCreateProjects}
                            onChange={() => handleToggleProjectAdminPermission('canCreateProjects')}
                          />
                          <span className="ws-toggle-slider" />
                        </label>
                      </div>

                      {/* Toggle 2: Request Completion */}
                      <div className="ws-permission-item">
                        <div className="ws-permission-info">
                          <span className="ws-permission-title">Request Project Completion</span>
                          <span className="ws-permission-desc">
                            Allows Project Admins to submit project completion requests to workspace owners and admins.
                          </span>
                        </div>
                        <label className="ws-toggle-switch">
                          <input
                            type="checkbox"
                            checked={projectAdminPermissions.canRequestProjectCompletion}
                            onChange={() => handleToggleProjectAdminPermission('canRequestProjectCompletion')}
                          />
                          <span className="ws-toggle-slider" />
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* SECTION 3: WORKSPACE MEMBER */}
                  <div className="ws-permission-section">
                    <div className="ws-permission-section-header">
                      <div>
                        <h3 className="ws-permission-section-title">Workspace Member Permissions</h3>
                        <p className="ws-permission-section-desc">
                          Configure baseline capabilities for standard Workspace Members in this workspace.
                        </p>
                      </div>
                    </div>

                    <div className="ws-permissions-grid">
                      {/* Toggle 1: Create Projects */}
                      <div className="ws-permission-item">
                        <div className="ws-permission-info">
                          <span className="ws-permission-title">Create Projects</span>
                          <span className="ws-permission-desc">
                            Allows Workspace Members to create new projects within this workspace.
                          </span>
                        </div>
                        <label className="ws-toggle-switch">
                          <input
                            type="checkbox"
                            checked={workspaceMemberPermissions.canCreateProjects}
                            onChange={() => handleToggleWorkspaceMemberPermission('canCreateProjects')}
                          />
                          <span className="ws-toggle-slider" />
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Save Button */}
                  <div style={{ marginTop: '0.5rem', marginBottom: '1.5rem' }}>
                    <Button
                      type="button"
                      variant="primary"
                      size="md"
                      isLoading={isSavingPermissions}
                      onClick={handleSavePermissions}
                      id="ws-save-permissions-btn"
                    >
                      Save Admin Permissions
                    </Button>
                  </div>

                  {/* Member Limit Configuration (Owner only) */}
                  {isOwner && (
                    <div style={{ marginTop: '3rem', paddingTop: '2rem', borderTop: '1px solid #E2E8F0' }}>
                      <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0F172A', margin: '0 0 0.5rem 0' }}>
                        Workspace Member Limit
                      </h3>
                      <p style={{ fontSize: '0.875rem', color: '#64748B', margin: '0 0 1.25rem 0' }}>
                        Set the maximum number of active members and pending invitations permitted in this workspace. Leave empty for unlimited.
                      </p>

                      {limitFeedback && (
                        <div
                          className={`ws-alert ${
                            limitFeedback.type === 'success' ? 'ws-alert-success' : 'ws-alert-error'
                          }`}
                          style={{ marginBottom: '1.25rem' }}
                        >
                          {limitFeedback.type === 'success' ? <CheckCircleIcon size={16} /> : <AlertCircleIcon size={16} />}
                          <span>{limitFeedback.message}</span>
                        </div>
                      )}

                      <form onSubmit={handleSaveMemberLimit} style={{ display: 'flex', gap: '0.75rem', maxWidth: '400px' }}>
                        <input
                          type="number"
                          min="1"
                          className="ws-input"
                          placeholder="e.g. 10 (Leave blank for unlimited)"
                          value={maxMembersInput}
                          onChange={(e) => setMaxMembersInput(e.target.value)}
                        />
                        <Button type="submit" variant="primary" size="md" isLoading={isSavingLimit}>
                          Save Limit
                        </Button>
                      </form>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ---------------------------------------------------- */}
          {/* TAB 4: PROJECT TRANSFERS (Phase 4) */}
          {/* ---------------------------------------------------- */}
          {activeTab === 'transfers' && canTransfer && !activeWorkspace.isPersonal && (
            <div>
              <div className="ws-card-header">
                <div className="ws-card-header-left">
                  <h2>Project Transfers</h2>
                  <p>Review incoming transfer requests from other workspaces and monitor outgoing transfers.</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  leftIcon={<RefreshCwIcon size={14} />}
                  onClick={loadTransfers}
                  isLoading={transfersLoading}
                >
                  Refresh
                </Button>
              </div>

              {transfersError && (
                <div className="ws-alert ws-alert-error" style={{ marginBottom: '1rem' }}>
                  <AlertCircleIcon size={16} />
                  <span>{transfersError}</span>
                </div>
              )}

              {transferFeedback && (
                <div
                  className={`ws-alert ${
                    transferFeedback.type === 'success' ? 'ws-alert-success' : 'ws-alert-error'
                  }`}
                  style={{ marginBottom: '1.25rem' }}
                >
                  {transferFeedback.type === 'success' ? <CheckCircleIcon size={16} /> : <AlertCircleIcon size={16} />}
                  <span>{transferFeedback.message}</span>
                </div>
              )}

              {/* Incoming Transfers */}
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0F172A', margin: '0 0 0.75rem 0' }}>
                Incoming Transfers Awaiting Approval ({incomingTransfers.length})
              </h3>

              {transfersLoading ? (
                <div className="ws-loading-state">
                  <div className="btn-spinner" />
                  <span>Loading transfers...</span>
                </div>
              ) : incomingTransfers.length === 0 ? (
                <div className="ws-empty-state" style={{ marginBottom: '2rem' }}>
                  <p>No incoming project transfers.</p>
                </div>
              ) : (
                <div className="ws-table-container" style={{ marginBottom: '2rem' }}>
                  <table className="ws-table">
                    <thead>
                      <tr>
                        <th>Project</th>
                        <th>Source Workspace</th>
                        <th>Initiated By</th>
                        <th>Date</th>
                        <th style={{ textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {incomingTransfers.map((t) => (
                        <tr key={t.id}>
                          <td>
                            <strong>{t.project?.name || t.projectName}</strong>
                          </td>
                          <td>{t.sourceWorkspace?.name}</td>
                          <td>{t.initiator?.fullName || t.initiator?.username}</td>
                          <td>{new Date(t.createdAt).toLocaleDateString()}</td>
                          <td style={{ textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', gap: '0.5rem' }}>
                              <Button
                                type="button"
                                variant="primary"
                                size="sm"
                                style={{ backgroundColor: '#10B981', borderColor: '#059669' }}
                                onClick={() => setTransferToApprove(t)}
                              >
                                Approve
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                style={{ color: '#DC2626', borderColor: '#FECACA' }}
                                onClick={() => setTransferToReject(t)}
                              >
                                Reject
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Outgoing Transfers */}
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0F172A', margin: '1.5rem 0 0.75rem 0' }}>
                Outgoing Transfers ({outgoingTransfers.length})
              </h3>
              {outgoingTransfers.length === 0 ? (
                <div className="ws-empty-state">
                  <p>No outgoing project transfers.</p>
                </div>
              ) : (
                <div className="ws-table-container">
                  <table className="ws-table">
                    <thead>
                      <tr>
                        <th>Project</th>
                        <th>Target Workspace</th>
                        <th>Status</th>
                        <th>Initiated Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {outgoingTransfers.map((t) => (
                        <tr key={t.id}>
                          <td>
                            <strong>{t.project?.name || t.projectName}</strong>
                          </td>
                          <td>{t.targetWorkspace?.name}</td>
                          <td>
                            <span
                              style={{
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                padding: '2px 8px',
                                borderRadius: '4px',
                                backgroundColor:
                                  t.status === 'PENDING'
                                    ? '#FEF3C7'
                                    : t.status === 'ACCEPTED'
                                    ? '#D1FAE5'
                                    : '#FEE2E2',
                                color:
                                  t.status === 'PENDING'
                                    ? '#B45309'
                                    : t.status === 'ACCEPTED'
                                    ? '#065F46'
                                    : '#991B1B',
                              }}
                            >
                              {t.status}
                            </span>
                          </td>
                          <td>{new Date(t.createdAt).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ---------------------------------------------------- */}
          {/* TAB 5: OWNERSHIP TRANSFER (Phase 5A) */}
          {/* ---------------------------------------------------- */}
          {activeTab === 'ownership' && isOwner && !activeWorkspace.isPersonal && (
            <div>
              <div className="ws-card-header">
                <div className="ws-card-header-left">
                  <h2>Workspace Ownership Transfer</h2>
                  <p>Transfer primary ownership of this workspace to another team member or administrative email.</p>
                </div>
              </div>

              {ownershipLoading && (
                <div className="ws-loading-state" style={{ marginBottom: '1.5rem' }}>
                  <div className="btn-spinner" />
                  <span>Loading ownership details...</span>
                </div>
              )}

              {ownershipError && (
                <div className="ws-alert ws-alert-error" style={{ marginBottom: '1rem' }}>
                  <AlertCircleIcon size={16} />
                  <span>{ownershipError}</span>
                </div>
              )}

              {ownershipFeedback && (
                <div
                  className={`ws-alert ${
                    ownershipFeedback.type === 'success' ? 'ws-alert-success' : 'ws-alert-error'
                  }`}
                  style={{ marginBottom: '1.25rem' }}
                >
                  {ownershipFeedback.type === 'success' ? <CheckCircleIcon size={16} /> : <AlertCircleIcon size={16} />}
                  <span>{ownershipFeedback.message}</span>
                </div>
              )}

              {/* Pending Ownership Transfer in Flight */}
              {pendingOwnershipTransfer ? (
                <div
                  style={{
                    backgroundColor: '#FEF3C7',
                    border: '1px solid #FDE68A',
                    borderRadius: '16px',
                    padding: '1.5rem',
                    marginBottom: '2rem',
                  }}
                >
                  <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#92400E', margin: '0 0 0.5rem 0' }}>
                    Ownership Transfer in Progress
                  </h3>
                  <p style={{ fontSize: '0.875rem', color: '#78350F', margin: '0 0 1rem 0', lineHeight: 1.5 }}>
                    An ownership transfer request was sent to{' '}
                    <strong>{pendingOwnershipTransfer.targetEmail || 'designated member'}</strong>. It will expire on{' '}
                    {new Date(pendingOwnershipTransfer.expiresAt).toLocaleDateString()}.
                  </p>

                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      style={{ color: '#DC2626', borderColor: '#FECACA', backgroundColor: '#FFFFFF' }}
                      isLoading={isCancellingTransfer}
                      onClick={handleCancelOwnershipTransfer}
                    >
                      Cancel Transfer Request
                    </Button>

                    {/* If current user is the target recipient */}
                    {pendingOwnershipTransfer.targetUserId === user?.id && (
                      <>
                        <Button
                          type="button"
                          variant="primary"
                          size="sm"
                          style={{ backgroundColor: '#10B981', borderColor: '#059669' }}
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
                          Reject Ownership
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                /* Initiate Ownership Transfer Form */
                <form onSubmit={handleInitiateOwnershipTransfer} style={{ maxWidth: '600px' }}>
                  <div
                    style={{
                      padding: '1.25rem',
                      borderRadius: '12px',
                      backgroundColor: '#EFF6FF',
                      border: '1px solid #BFDBFE',
                      marginBottom: '1.5rem',
                      fontSize: '0.85rem',
                      color: '#1E40AF',
                      lineHeight: 1.5,
                    }}
                  >
                    <strong>Important:</strong> When you transfer ownership, the new owner receives full control over the workspace, including member management, deletion, and policies. Your role will be converted to the role selected below.
                  </div>

                  <div style={{ marginBottom: '1.25rem' }}>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#0F172A', marginBottom: '0.5rem' }}>
                      Transfer Recipient
                    </label>
                    <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.75rem' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.875rem', cursor: 'pointer' }}>
                        <input
                          type="radio"
                          name="recipientMode"
                          checked={targetRecipientMode === 'member'}
                          onChange={() => setTargetRecipientMode('member')}
                        />
                        <span>Existing Workspace Member</span>
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.875rem', cursor: 'pointer' }}>
                        <input
                          type="radio"
                          name="recipientMode"
                          checked={targetRecipientMode === 'email'}
                          onChange={() => setTargetRecipientMode('email')}
                        />
                        <span>Enter Email Address</span>
                      </label>
                    </div>

                    {targetRecipientMode === 'member' ? (
                      <select
                        className="ws-input"
                        value={targetRecipientUserId}
                        onChange={(e) => setTargetRecipientUserId(e.target.value)}
                        required
                      >
                        <option value="">Select a member...</option>
                        {members
                          .filter((m) => m.userId !== user?.id)
                          .map((m) => (
                            <option key={m.userId} value={m.userId}>
                              {m.user.fullName || m.user.username} (@{m.user.username}) - {m.user.email}
                            </option>
                          ))}
                      </select>
                    ) : (
                      <input
                        type="email"
                        className="ws-input"
                        placeholder="newowner@example.com"
                        value={targetRecipientEmail}
                        onChange={(e) => setTargetRecipientEmail(e.target.value)}
                        required
                      />
                    )}
                  </div>

                  <div style={{ marginBottom: '1.75rem' }}>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#0F172A', marginBottom: '0.5rem' }}>
                      Your Resulting Role After Transfer
                    </label>
                    <select
                      className="ws-input"
                      value={resultingRole}
                      onChange={(e) => setResultingRole(e.target.value as any)}
                    >
                      <option value="WORKSPACE_ADMIN">Workspace Admin</option>
                      <option value="WORKSPACE_MEMBER">Workspace Member</option>
                    </select>
                  </div>

                  <Button type="submit" variant="primary" size="md" isLoading={isInitiatingTransfer}>
                    Initiate Ownership Transfer
                  </Button>
                </form>
              )}
            </div>
          )}

          {/* ---------------------------------------------------- */}
          {/* TAB 6: AUDIT TRAIL (Phase 5C) */}
          {/* ---------------------------------------------------- */}
          {activeTab === 'audit' && (isOwner || activeRole === 'WORKSPACE_ADMIN') && (
            <div>
              <div className="ws-card-header">
                <div className="ws-card-header-left">
                  <h2>Workspace Audit Trail</h2>
                  <p>Immutable log of administrative events, membership modifications, and security actions.</p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <select
                    className="ws-filter-select"
                    value={auditActionFilter}
                    onChange={(e) => {
                      setAuditActionFilter(e.target.value);
                      loadAuditLogs(1, e.target.value);
                    }}
                    aria-label="Filter audit action"
                  >
                    <option value="ALL">All Actions</option>
                    <option value="MEMBER_INVITED">Member Invited</option>
                    <option value="MEMBER_REMOVED">Member Removed</option>
                    <option value="ROLE_CHANGED">Role Changed</option>
                    <option value="PERMISSIONS_UPDATED">Permissions Updated</option>
                    <option value="OWNERSHIP_TRANSFERRED">Ownership Transferred</option>
                    <option value="PROJECT_TRANSFERRED">Project Transferred</option>
                    <option value="MEMBER_LIMIT_CHANGED">Member Limit Changed</option>
                  </select>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    leftIcon={<RefreshCwIcon size={14} />}
                    onClick={() => loadAuditLogs(auditPage, auditActionFilter)}
                    isLoading={auditLogsLoading}
                  >
                    Refresh
                  </Button>
                </div>
              </div>

              {auditLogsError && (
                <div className="ws-alert ws-alert-error" style={{ marginBottom: '1rem' }}>
                  <AlertCircleIcon size={16} />
                  <span>{auditLogsError}</span>
                </div>
              )}

              {auditLogsLoading ? (
                <div className="ws-loading-state">
                  <div className="btn-spinner" />
                  <span>Loading audit trail...</span>
                </div>
              ) : auditLogs.length === 0 ? (
                <div className="ws-empty-state">
                  <ActivityPulseIcon size={32} style={{ marginBottom: '0.75rem', opacity: 0.5 }} />
                  <p>No audit trail logs recorded yet.</p>
                </div>
              ) : (
                <>
                  <div className="ws-table-container">
                    <table className="ws-table">
                      <thead>
                        <tr>
                          <th>Action</th>
                          <th>Actor</th>
                          <th>Target</th>
                          <th>Timestamp</th>
                        </tr>
                      </thead>
                      <tbody>
                        {auditLogs.map((log) => (
                          <tr key={log.id}>
                            <td>
                              <span
                                style={{
                                  fontSize: '0.75rem',
                                  fontWeight: 700,
                                  padding: '2px 8px',
                                  borderRadius: '4px',
                                  backgroundColor: '#EFF6FF',
                                  color: '#1E40AF',
                                }}
                              >
                                {log.action}
                              </span>
                            </td>
                            <td>{log.actor?.fullName || log.actor?.username || 'System'}</td>
                            <td>{log.targetUser?.fullName || log.targetUser?.username || log.targetEmail || '—'}</td>
                            <td>{new Date(log.createdAt).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  <div className="ws-pagination">
                    <button
                      type="button"
                      className="ws-page-btn"
                      disabled={auditPage <= 1}
                      onClick={() => loadAuditLogs(auditPage - 1, auditActionFilter)}
                    >
                      Previous
                    </button>
                    <span className="ws-page-indicator">
                      Page {auditPage} of {auditTotalPages} ({auditTotal} events)
                    </span>
                    <button
                      type="button"
                      className="ws-page-btn"
                      disabled={auditPage >= auditTotalPages}
                      onClick={() => loadAuditLogs(auditPage + 1, auditActionFilter)}
                    >
                      Next
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ---------------------------------------------------- */}
          {/* TAB 6B: DELETION REQUEST (Owner only, only if active request) */}
          {/* ---------------------------------------------------- */}
          {activeTab === 'deletion-request' && isOwner && deletionRequest && (
            <div>
              <div className="ws-card-header">
                <div className="ws-card-header-left">
                  <h2 style={{ color: '#DC2626' }}>Workspace Deletion Request</h2>
                  <p>A workspace administrator has requested that this workspace be deleted.</p>
                </div>
              </div>

              <div
                style={{
                  border: '1px solid #FECACA',
                  backgroundColor: '#FEF2F2',
                  borderRadius: '12px',
                  padding: '1.5rem',
                  marginBottom: '1.5rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                  <div
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      backgroundColor: '#FEE2E2',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      color: '#DC2626',
                    }}
                  >
                    {deletionRequest.requestedByName ? deletionRequest.requestedByName[0].toUpperCase() : 'A'}
                  </div>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: '#1E293B' }}>
                      {deletionRequest.requestedByName}
                    </h4>
                    <span style={{ fontSize: '0.8125rem', color: '#64748B' }}>
                      {deletionRequest.requestedByEmail} • Requested on {new Date(deletionRequest.requestedAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                <div
                  style={{
                    backgroundColor: '#FFFFFF',
                    borderRadius: '8px',
                    border: '1px solid #FCA5A5',
                    padding: '1rem',
                    marginBottom: '1.25rem',
                  }}
                >
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#991B1B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Stated Reason
                  </span>
                  <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.875rem', color: '#334155', fontStyle: deletionRequest.reason ? 'normal' : 'italic' }}>
                    {deletionRequest.reason || 'No specific reason was provided by the administrator.'}
                  </p>
                </div>

                <p style={{ fontSize: '0.8125rem', color: '#7F1D1D', marginBottom: '1.5rem', lineHeight: 1.5 }}>
                  As the workspace owner, you have ultimate authority over this workspace. Approving this request will soft-delete the workspace, giving a 30-day recovery grace period before permanent deletion.
                </p>

                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <Button
                    type="button"
                    variant="primary"
                    size="md"
                    style={{ backgroundColor: '#DC2626', borderColor: '#B91C1C' }}
                    onClick={() => setDeleteModalOpen(true)}
                    id="ws-approve-deletion-request-btn"
                  >
                    Approve & Delete Workspace
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="md"
                    onClick={() => setDeclineModalOpen(true)}
                    id="ws-decline-deletion-request-btn"
                  >
                    Decline Request
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* ---------------------------------------------------- */}
          {/* TAB 7: DANGER ZONE / CLEAR WORKSPACE DATA */}
          {/* ---------------------------------------------------- */}
          {activeTab === 'danger' && (
            <div>
              <div className="ws-card-header">
                <div className="ws-card-header-left">
                  <h2 style={{ color: '#DC2626' }}>
                    {activeWorkspace.isDefault ? 'Clear Workspace Data' : 'Danger Zone'}
                  </h2>
                  <p>
                    {activeWorkspace.isDefault
                      ? 'Reset your default workspace by wiping all project and task data while preserving your personal workspace.'
                      : 'Destructive, exit, and reset operations for this workspace.'}
                  </p>
                </div>
              </div>

              {/* 1. Default Personal Workspace Protection Notice */}
              {activeWorkspace.isDefault && (
                <div className="ws-danger-card" style={{ marginBottom: '1.5rem', borderColor: '#CBD5E1', backgroundColor: '#F8FAFC' }}>
                  <div>
                    <h3 className="ws-danger-title" style={{ color: '#334155' }}>Personal Workspace Protection</h3>
                    <p className="ws-danger-desc">
                      The default personal workspace is permanently protected and cannot be deleted to ensure you always have an active workspace. You can clear its data below instead.
                    </p>
                  </div>
                </div>
              )}

              {/* 2. Clear Workspace Data (Reset Sandbox) - Available to the Owner of any workspace */}
              {isOwner && (
                <div className="ws-danger-card" style={{ marginBottom: '1.5rem' }}>
                  <div>
                    <h3 className="ws-danger-title">Clear Workspace Data (Reset Sandbox)</h3>
                    <p className="ws-danger-desc">
                      Permanently wipes all projects, tasks, comments, notes, uploaded files, and calendar events from <strong>{activeWorkspace.name}</strong>. The workspace shell, settings, and memberships remain intact so you can start over with a clean slate.
                    </p>
                  </div>
                  <div>
                    <Button
                      type="button"
                      variant="primary"
                      size="md"
                      style={{ backgroundColor: '#DC2626', borderColor: '#B91C1C' }}
                      onClick={() => {
                        setClearModalOpen(true);
                        setClearConfirmText('');
                        setClearError(null);
                      }}
                      id="ws-clear-personal-btn"
                    >
                      Clear Workspace Data
                    </Button>
                  </div>
                </div>
              )}

              {/* 3. Non-Default Workspace - Owner Soft Delete */}
              {isOwner && !activeWorkspace.isDefault && (
                <div className="ws-danger-card" style={{ marginBottom: '1.5rem' }}>
                  <div>
                    <h3 className="ws-danger-title">Delete this workspace</h3>
                    <p className="ws-danger-desc">
                      Soft-deletes <strong>{activeWorkspace.name}</strong>. {activeWorkspace.isPersonal ? 'You will lose access to all projects, files, and resources in this workspace.' : 'Workspace members will immediately lose access to all projects, files, and resources in this workspace.'} You will have a 30-day recovery grace period from the workspace switcher before all resources are permanently deleted.
                    </p>
                  </div>
                  <div>
                    <Button
                      type="button"
                      variant="primary"
                      size="md"
                      style={{ backgroundColor: '#DC2626', borderColor: '#B91C1C' }}
                      onClick={() => setDeleteModalOpen(true)}
                      id="ws-delete-workspace-btn"
                    >
                      Delete Workspace
                    </Button>
                  </div>
                </div>
              )}

              {/* 3. Team Workspace - Administrator Deletion Request */}
              {!activeWorkspace.isPersonal && !isOwner && activeRole === 'WORKSPACE_ADMIN' && (
                <div className="ws-danger-card" style={{ marginBottom: '1.5rem' }}>
                  <div>
                    <h3 className="ws-danger-title">Request Workspace Deletion</h3>
                    {deletionRequest && deletionRequest.status === 'PENDING' ? (
                      <p className="ws-danger-desc">
                        You submitted a deletion request on <strong>{new Date(deletionRequest.requestedAt).toLocaleDateString()}</strong>. Reason: <em>"{deletionRequest.reason || 'None provided'}"</em>. The workspace owner has been notified and can review and approve it.
                      </p>
                    ) : (
                      <p className="ws-danger-desc">
                        Only the workspace owner can delete this workspace. As a Workspace Administrator, you can submit a deletion request with an explanation for the Owner to review.
                      </p>
                    )}
                  </div>
                  <div>
                    {deletionRequest && deletionRequest.status === 'PENDING' ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="md"
                        isLoading={isCancellingDeletionRequest}
                        onClick={handleCancelDeletionRequest}
                        id="ws-cancel-deletion-request-btn"
                      >
                        Cancel Request
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        size="md"
                        style={{ color: '#DC2626', borderColor: '#FECACA' }}
                        onClick={() => {
                          setRequestDeletionModalOpen(true);
                          setDeletionRequestReason('');
                        }}
                        id="ws-request-deletion-btn"
                      >
                        Request Deletion
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {/* 4. Team Workspace - Leave Workspace (for all non-owners) */}
              {!activeWorkspace.isPersonal && !isOwner && (
                <div className="ws-danger-card">
                  <div>
                    <h3 className="ws-danger-title">Leave this workspace</h3>
                    <p className="ws-danger-desc">
                      Voluntarily leave <strong>{activeWorkspace.name}</strong>. Your tasks, comments, notes, and uploaded files will remain preserved for team continuity. In-flight task assignments will be unassigned. You will lose access to all projects in this workspace, and can only rejoin if an Owner or Admin sends you an invitation.
                    </p>
                  </div>
                  <div>
                    <Button
                      type="button"
                      variant="primary"
                      size="md"
                      style={{ backgroundColor: '#DC2626', borderColor: '#B91C1C' }}
                      onClick={() => setLeaveModalOpen(true)}
                      id="ws-leave-workspace-btn"
                    >
                      Leave Workspace
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ---------------------------------------------------- */}
      {/* CONFIRMATION MODALS */}
      {/* ---------------------------------------------------- */}

      {/* Role Change Modal */}
      <Modal
        isOpen={!!targetMemberForRole}
        onClose={() => setTargetMemberForRole(null)}
        title="Change Member Role"
        maxWidth="sm"
      >
        {targetMemberForRole && (
          <div>
            <p style={{ fontSize: '0.875rem', color: '#475569', marginBottom: '1.25rem', lineHeight: 1.5 }}>
              Are you sure you want to change{' '}
              <strong>
                {targetMemberForRole.member.user.fullName || targetMemberForRole.member.user.username}
              </strong>
              's role to{' '}
              <strong>
                {targetMemberForRole.newRole === 'WORKSPACE_ADMIN'
                  ? 'Workspace Admin'
                  : targetMemberForRole.newRole === 'PROJECT_ADMIN'
                  ? 'Project Admin'
                  : 'Workspace Member'}
              </strong>
              ?
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
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
                Update Role
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Remove Member Modal */}
      <Modal
        isOpen={!!memberToRemove}
        onClose={() => setMemberToRemove(null)}
        title="Remove Member from Workspace"
        maxWidth="sm"
      >
        {memberToRemove && (
          <div>
            <p style={{ fontSize: '0.875rem', color: '#475569', marginBottom: '1.25rem', lineHeight: 1.5 }}>
              Are you sure you want to remove <strong>{memberToRemove.user.fullName || memberToRemove.user.username}</strong> from <strong>{activeWorkspace.name}</strong>?
              <br /><br />
              <span style={{ color: '#DC2626', fontWeight: 600 }}>
                This will immediately revoke their workspace access and all project memberships in this workspace, and unassign any active tasks.
              </span>
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
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
                style={{ backgroundColor: '#DC2626', borderColor: '#B91C1C' }}
                isLoading={isRemoving}
                onClick={confirmRemoveMember}
              >
                Remove Member
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Revoke Invitation Modal */}
      <Modal
        isOpen={!!invitationToRevoke}
        onClose={() => setInvitationToRevoke(null)}
        title="Revoke Invitation"
        maxWidth="sm"
      >
        {invitationToRevoke && (
          <div>
            <p style={{ fontSize: '0.875rem', color: '#475569', marginBottom: '1.25rem', lineHeight: 1.5 }}>
              Are you sure you want to revoke the invitation sent to{' '}
              <strong>{invitationToRevoke.invitedEmail}</strong>? The recipient will no longer be able to use this invitation to join the workspace.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
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
                style={{ backgroundColor: '#DC2626', borderColor: '#B91C1C' }}
                isLoading={isRevoking}
                onClick={confirmRevokeInvitation}
              >
                Revoke Invitation
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Approve Project Transfer Modal */}
      <Modal
        isOpen={!!transferToApprove}
        onClose={() => setTransferToApprove(null)}
        title="Approve Project Transfer"
        maxWidth="sm"
      >
        {transferToApprove && (
          <div>
            <p style={{ fontSize: '0.875rem', color: '#475569', marginBottom: '1.25rem', lineHeight: 1.5 }}>
              Accept project <strong>{transferToApprove.project?.name || transferToApprove.projectName}</strong> from{' '}
              <strong>{transferToApprove.sourceWorkspace?.name}</strong> into this workspace?
              <br /><br />
              All tasks, comments, files, and notes will be transferred as one logical unit. Existing project members not in this workspace will lose project access, and their assigned tasks will be unassigned.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
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
                style={{ backgroundColor: '#10B981', borderColor: '#059669' }}
                isLoading={isProcessingTransfer}
                onClick={confirmApproveTransfer}
              >
                Approve & Transfer
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Reject Project Transfer Modal */}
      <Modal
        isOpen={!!transferToReject}
        onClose={() => setTransferToReject(null)}
        title="Reject Project Transfer"
        maxWidth="sm"
      >
        {transferToReject && (
          <div>
            <p style={{ fontSize: '0.875rem', color: '#475569', marginBottom: '1rem', lineHeight: 1.5 }}>
              Decline the transfer request for <strong>{transferToReject.project?.name || transferToReject.projectName}</strong>.
            </p>
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ fontSize: '0.8125rem', color: '#64748B', display: 'block', marginBottom: '0.35rem' }}>
                Rejection Reason (optional)
              </label>
              <textarea
                className="ws-input"
                rows={3}
                placeholder="e.g. Incompatible workspace, redundant project..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                disabled={isProcessingTransfer}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
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
                style={{ backgroundColor: '#DC2626', borderColor: '#B91C1C' }}
                isLoading={isProcessingTransfer}
                onClick={confirmRejectTransfer}
              >
                Reject Request
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Workspace Modal */}
      <Modal
        isOpen={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setDeleteConfirmationName('');
          setDeleteError(null);
        }}
        title="Delete Workspace"
        maxWidth="sm"
      >
        <div>
          <p style={{ fontSize: '0.875rem', color: '#475569', marginBottom: '1.25rem', lineHeight: 1.5 }}>
            Are you sure you want to soft-delete <strong>{activeWorkspace.name}</strong>?
            <br /><br />
            {activeWorkspace.isPersonal
              ? 'You will lose access to all projects, files, and resources in this workspace. You will have 30 days to recover this workspace from the workspace switcher before it is permanently expired.'
              : 'All members will lose access immediately. You will have 30 days to recover this workspace from the workspace switcher before it is permanently expired.'}
          </p>
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ fontSize: '0.8125rem', color: '#64748B', display: 'block', marginBottom: '0.35rem' }}>
              Please type <strong>{activeWorkspace.name}</strong> to confirm:
            </label>
            <input
              type="text"
              className="ws-input"
              placeholder={activeWorkspace.name}
              value={deleteConfirmationName}
              onChange={(e) => {
                setDeleteConfirmationName(e.target.value);
                setDeleteError(null);
              }}
              disabled={isDeletingWorkspace}
              id="ws-delete-confirm-input"
            />
            {deleteError && (
              <span style={{ fontSize: '0.8125rem', color: '#DC2626', display: 'block', marginTop: '0.35rem' }}>
                {deleteError}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
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
              style={{ backgroundColor: '#DC2626', borderColor: '#B91C1C' }}
              isLoading={isDeletingWorkspace}
              disabled={deleteConfirmationName.trim() !== activeWorkspace.name.trim()}
              onClick={handleConfirmDeleteWorkspace}
              id="ws-confirm-delete-btn"
            >
              Delete Workspace
            </Button>
          </div>
        </div>
      </Modal>

      {/* Leave Workspace Confirmation Modal */}
      <Modal
        isOpen={leaveModalOpen}
        onClose={() => setLeaveModalOpen(false)}
        title="Leave Workspace"
        maxWidth="sm"
      >
        <div>
          <div style={{ fontSize: '0.875rem', color: '#475569', marginBottom: '1.25rem', lineHeight: 1.5 }}>
            Are you sure you want to leave <strong>{activeWorkspace.name}</strong>?
            <br /><br />
            <strong>What happens when you leave:</strong>
            <ul style={{ paddingLeft: '1.25rem', marginTop: '0.5rem', marginBottom: '0.5rem' }}>
              <li>Your created tasks, notes, comments, and files remain preserved for the team.</li>
              <li>Active task assignments will be unassigned.</li>
              <li>You will lose access to all projects in this workspace.</li>
              <li>You can only rejoin if an Owner or Administrator re-invites you.</li>
            </ul>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setLeaveModalOpen(false)}
              disabled={isLeaving}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              style={{ backgroundColor: '#DC2626', borderColor: '#B91C1C' }}
              isLoading={isLeaving}
              onClick={handleLeaveWorkspace}
              id="ws-confirm-leave-btn"
            >
              Leave Workspace
            </Button>
          </div>
        </div>
      </Modal>

      {/* Clear Personal Workspace Data Modal */}
      <Modal
        isOpen={clearModalOpen}
        onClose={() => {
          setClearModalOpen(false);
          setClearConfirmText('');
          setClearError(null);
        }}
        title="Clear Workspace Data"
        maxWidth="sm"
      >
        <div>
          <p style={{ fontSize: '0.875rem', color: '#475569', marginBottom: '1.25rem', lineHeight: 1.5 }}>
            Are you sure you want to clear all data in <strong>{activeWorkspace.name}</strong>?
            <br /><br />
            <span style={{ color: '#DC2626', fontWeight: 600 }}>
              This will permanently delete all projects, tasks, comments, notes, files, and calendar events from this workspace. The workspace structure and memberships will remain intact. This action cannot be undone.
            </span>
          </p>
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ fontSize: '0.8125rem', color: '#64748B', display: 'block', marginBottom: '0.35rem' }}>
              Please type <strong>CLEAR</strong> to confirm:
            </label>
            <input
              type="text"
              className="ws-input"
              placeholder="CLEAR"
              value={clearConfirmText}
              onChange={(e) => {
                setClearConfirmText(e.target.value);
                setClearError(null);
              }}
              disabled={isClearing}
              id="ws-clear-confirm-input"
            />
            {clearError && (
              <span style={{ fontSize: '0.8125rem', color: '#DC2626', display: 'block', marginTop: '0.35rem' }}>
                {clearError}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setClearModalOpen(false);
                setClearConfirmText('');
                setClearError(null);
              }}
              disabled={isClearing}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              style={{ backgroundColor: '#DC2626', borderColor: '#B91C1C' }}
              isLoading={isClearing}
              disabled={clearConfirmText.trim().toUpperCase() !== 'CLEAR'}
              onClick={handleClearPersonalData}
              id="ws-confirm-clear-btn"
            >
              Clear Workspace Data
            </Button>
          </div>
        </div>
      </Modal>

      {/* Request Workspace Deletion Modal (for Admin) */}
      <Modal
        isOpen={requestDeletionModalOpen}
        onClose={() => setRequestDeletionModalOpen(false)}
        title="Request Workspace Deletion"
        maxWidth="sm"
      >
        <form onSubmit={handleRequestDeletion}>
          <p style={{ fontSize: '0.875rem', color: '#475569', marginBottom: '1.25rem', lineHeight: 1.5 }}>
            Submit a deletion request for <strong>{activeWorkspace.name}</strong> to the workspace owner.
          </p>
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ fontSize: '0.8125rem', color: '#64748B', display: 'block', marginBottom: '0.35rem' }}>
              Reason for deletion (optional):
            </label>
            <textarea
              className="ws-input"
              rows={3}
              placeholder="e.g. Project completed, client engagement ended, or migrating to new workspace..."
              value={deletionRequestReason}
              onChange={(e) => setDeletionRequestReason(e.target.value)}
              disabled={isSubmittingDeletionRequest}
              id="ws-deletion-reason-input"
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setRequestDeletionModalOpen(false)}
              disabled={isSubmittingDeletionRequest}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              style={{ backgroundColor: '#DC2626', borderColor: '#B91C1C' }}
              isLoading={isSubmittingDeletionRequest}
              id="ws-submit-deletion-request-btn"
            >
              Submit Request
            </Button>
          </div>
        </form>
      </Modal>

      {/* Decline Deletion Request Modal (for Owner) */}
      <Modal
        isOpen={declineModalOpen}
        onClose={() => setDeclineModalOpen(false)}
        title="Decline Deletion Request"
        maxWidth="sm"
      >
        <form onSubmit={handleDeclineDeletionRequest}>
          <p style={{ fontSize: '0.875rem', color: '#475569', marginBottom: '1.25rem', lineHeight: 1.5 }}>
            Decline the workspace deletion request submitted by{' '}
            <strong>{deletionRequest?.requestedByName || 'Administrator'}</strong>.
          </p>
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ fontSize: '0.8125rem', color: '#64748B', display: 'block', marginBottom: '0.35rem' }}>
              Reason for declining (optional):
            </label>
            <textarea
              className="ws-input"
              rows={3}
              placeholder="e.g. Workspace is still actively used for ongoing maintenance..."
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              disabled={isDecliningDeletionRequest}
              id="ws-decline-reason-input"
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDeclineModalOpen(false)}
              disabled={isDecliningDeletionRequest}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={isDecliningDeletionRequest}
              id="ws-confirm-decline-btn"
            >
              Decline Request
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
