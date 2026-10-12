import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import {
  workspacesApi,
  type WorkspaceMemberItem,
  type WorkspaceInvitationItem,
  type WorkspaceRole,
  type WorkspaceAdminPermissions,
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
} from '../ui/Icons';
import { Button } from '../ui/Button';
import './WorkspaceManageModal.css';

export interface WorkspaceManageModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'members' | 'invitations' | 'permissions';
}

export const WorkspaceManageModal: React.FC<WorkspaceManageModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'members',
}) => {
  const { user } = useAuth();
  const { activeWorkspace, activeRole, refreshWorkspaces } = useWorkspace();

  const [activeTab, setActiveTab] = useState<'members' | 'invitations' | 'permissions'>(initialTab);

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

  // Authority Flags
  const isOwner = useMemo(() => {
    return activeRole === 'OWNER' || activeWorkspace?.isOwner === true;
  }, [activeRole, activeWorkspace]);

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

  // Trigger loads on open and tab changes
  useEffect(() => {
    if (!isOpen || !activeWorkspace) return;
    if (activeTab === 'members') {
      loadMembers();
    } else if (activeTab === 'invitations') {
      loadInvitations();
    } else if (activeTab === 'permissions') {
      loadPermissions();
    }
  }, [isOpen, activeWorkspace?.id, activeTab, loadMembers, loadInvitations, loadPermissions]);

  // Reset tab on open if not permitted
  useEffect(() => {
    if (isOpen) {
      if (initialTab === 'permissions' && (!isOwner || activeWorkspace?.isPersonal)) {
        setActiveTab('members');
      } else {
        setActiveTab(initialTab);
      }
    }
  }, [isOpen, initialTab, isOwner, activeWorkspace?.isPersonal]);

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
              {canInvite && (
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
                        disabled={isInviting}
                        className="wmm-search-box"
                        style={{ width: '100%' }}
                      />
                    </div>
                    <div>
                      <select
                        className="wmm-filter-select"
                        value={inviteRole}
                        onChange={(e) => setInviteRole(e.target.value as WorkspaceRole)}
                        disabled={isInviting}
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
                        leftIcon={<MailIcon size={16} />}
                      >
                        Send Invite
                      </Button>
                    </div>
                  </div>
                </form>
              )}

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
      </div>
    </div>
  );
};
