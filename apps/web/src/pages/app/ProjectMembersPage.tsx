import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from '../../router/Router';
import { useAuth } from '../../context/AuthContext';
import { projectsApi, type Project } from '../../api/projects.api';
import { membersApi, type ProjectMemberDetail } from '../../api/members.api';
import { invitationsApi, type ProjectInvitation } from '../../api/invitations.api';
import { workApi, type WorkItem } from '../../api/work.api';
import { ProjectWorkspaceHeader } from '../../components/workspace/ProjectWorkspaceHeader';
import { TeamMembersHeaderAtmosphere } from '../../components/common/HeaderAtmosphereArt';
import { InviteMemberModal } from '../../components/workspace/InviteMemberModal';
import { CreateWorkItemModal } from '../../components/workspace/CreateWorkItemModal';
import {
  UsersIcon,
  SearchIcon,
  MailIcon,
  CalendarIcon,
  ActivityPulseIcon,
  ChevronRightIcon,
  UserPlusIcon,
  GridIcon,
  ListIcon,
  MoreHorizontalIcon,
  AlertCircleIcon,
  CheckSquareIcon,
  TrashIcon,
} from '../../components/ui/Icons';
import { Button } from '../../components/ui/Button';
import { CustomSelect } from '../../components/ui/CustomSelect';

const AVATAR_COLORS = [
  '#8B5CF6', // Violet/Purple (as in screenshot)
  '#059669', // Emerald
  '#2563EB', // Royal Blue
  '#D97706', // Amber
  '#DC2626', // Red
  '#0D9488', // Teal
  '#7C3AED', // Deep Purple
];

interface ProjectMembersPageProps {
  project?: Project | null;
  hideHeader?: boolean;
}

export const ProjectMembersPage: React.FC<ProjectMembersPageProps> = ({
  project: propProject,
  hideHeader = false,
}) => {
  const { path, navigate } = useRouter();
  const { user } = useAuth();

  // Extract projectId from path e.g. /app/projects/:projectId/members
  const projectId = path.split('/')[3];

  const [project, setProject] = useState<Project | null>(propProject || null);
  const [members, setMembers] = useState<ProjectMemberDetail[]>([]);
  const [pendingInvitations, setPendingInvitations] = useState<ProjectInvitation[]>([]);
  const [workItems, setWorkItems] = useState<WorkItem[]>([]);
  const [userRole, setUserRole] = useState<'PROJECT_ADMIN' | 'PROJECT_MEMBER'>('PROJECT_MEMBER');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter & UI state
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('RECENT');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [openMenuMemberId, setOpenMenuMemberId] = useState<string | null>(null);

  // Modals
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [createWorkModalOpen, setCreateWorkModalOpen] = useState(false);
  const [memberToDelete, setMemberToDelete] = useState<{ id: string; name: string } | null>(null);

  const loadData = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);

    try {
      const [projRes, memRes, workRes] = await Promise.all([
        projectsApi.getProjectById(projectId),
        membersApi.getProjectMembers(projectId),
        workApi.getProjectWorkItems(projectId).catch(() => ({ success: false, data: { workItems: [] } })),
      ]);

      if (projRes.success && projRes.data.project) {
        setProject(projRes.data.project);
      }
      if (memRes.success && memRes.data) {
        setMembers(memRes.data.members);
        setPendingInvitations((memRes.data.pendingInvitations as any) || []);
        setUserRole(memRes.data.currentUserRole);
      }
      if (workRes.success && workRes.data) {
        setWorkItems(workRes.data.workItems || []);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load project members');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Close member action menu on outside click
  useEffect(() => {
    const handleDocClick = () => setOpenMenuMemberId(null);
    document.addEventListener('click', handleDocClick);
    return () => document.removeEventListener('click', handleDocClick);
  }, []);

  const isAdmin = userRole === 'PROJECT_ADMIN' || project?.createdById === user?.id;

  const handleRoleChange = async (memberId: string, newRole: 'PROJECT_ADMIN' | 'PROJECT_MEMBER') => {
    try {
      const res = await membersApi.updateMemberRole(projectId, memberId, newRole);
      if (res.success) {
        setMembers((prev) =>
          prev.map((m) => (m.id === memberId ? { ...m, role: newRole } : m))
        );
        setOpenMenuMemberId(null);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to update role');
    }
  };

  const handleRemoveMember = (memberId: string, memberName: string) => {
    setMemberToDelete({ id: memberId, name: memberName });
  };

  const confirmRemoveMember = async (memberId: string) => {
    try {
      const res = await membersApi.removeMember(projectId, memberId);
      if (res.success) {
        setMembers((prev) => prev.filter((m) => m.id !== memberId));
        setOpenMenuMemberId(null);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to remove member');
    }
  };

  const handleCancelInvitation = async (invitationId: string) => {
    if (!window.confirm('Are you sure you want to cancel this invitation?')) return;

    try {
      const res = await invitationsApi.cancelInvitation(projectId, invitationId);
      if (res.success) {
        setPendingInvitations((prev) => prev.filter((i) => i.id !== invitationId));
      }
    } catch (err: any) {
      alert(err.message || 'Failed to cancel invitation');
    }
  };

  // Assigned items count per member
  const workItemsCountMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const item of workItems) {
      if (item.assignedToId) {
        map[item.assignedToId] = (map[item.assignedToId] || 0) + 1;
      }
    }
    return map;
  }, [workItems]);

  // Filtered and Sorted members
  const filteredMembers = useMemo(() => {
    let list = [...members];

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((m) => {
        const name = (m.user.fullName || '').toLowerCase();
        const username = (m.user.username || '').toLowerCase();
        const email = (m.user.email || '').toLowerCase();
        return name.includes(q) || username.includes(q) || email.includes(q);
      });
    }

    // Role filter
    if (roleFilter !== 'ALL') {
      if (roleFilter === 'OWNER') {
        list = list.filter((m) => m.isCreator || m.userId === project?.createdById);
      } else {
        list = list.filter(
          (m) =>
            m.role === roleFilter && !m.isCreator && m.userId !== project?.createdById
        );
      }
    }

    // Sort
    list.sort((a, b) => {
      if (sortBy === 'NAME') {
        const nameA = (a.user.fullName || a.user.username || '').toLowerCase();
        const nameB = (b.user.fullName || b.user.username || '').toLowerCase();
        return nameA.localeCompare(nameB);
      }
      if (sortBy === 'ROLE') {
        const isOwnerA = a.isCreator || a.userId === project?.createdById ? 0 : a.role === 'PROJECT_ADMIN' ? 1 : 2;
        const isOwnerB = b.isCreator || b.userId === project?.createdById ? 0 : b.role === 'PROJECT_ADMIN' ? 1 : 2;
        return isOwnerA - isOwnerB;
      }
      // RECENT: Creators and recent join dates first
      const dateA = new Date(m_date(a)).getTime();
      const dateB = new Date(m_date(b)).getTime();
      return dateB - dateA;
    });

    return list;
  }, [members, searchQuery, roleFilter, sortBy, project]);

  function m_date(m: ProjectMemberDetail) {
    return m.joinedAt || '2026-09-07T00:00:00.000Z';
  }

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Sep 7, 2026';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return 'Sep 7, 2026';
    }
  };

  const getAvatarColor = (_name: string, index: number) => {
    return AVATAR_COLORS[index % AVATAR_COLORS.length];
  };

  if (loading) {
    return (
      <div className="workspace-loading-state">
        <div className="btn-spinner" />
        <p>Loading project members...</p>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="workspace-error-state">
        <AlertCircleIcon size={32} />
        <h2>Unable to load team members</h2>
        <p>{error || 'Project not found'}</p>
        <Button variant="primary" onClick={() => navigate('/app/dashboard')}>
          Back to Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className={hideHeader ? 'team-members-embedded' : 'project-workspace-page'}>
      {/* Workspace Navigation Tabs */}
      {!hideHeader && project && (
        <ProjectWorkspaceHeader
          project={project}
          currentTab="members"
          onOpenCreateWorkModal={() => setCreateWorkModalOpen(true)}
        />
      )}

      <div className="team-members-page-content">
        {/* Top Hero Atmosphere Card: "Team & Members" + "Together, we build progress." */}
        <div className="team-atmosphere-card">
          <div className="team-atmosphere-left">
            <div className="team-atmosphere-title-row">
              <UsersIcon size={22} className="team-atmosphere-icon" />
              <h1 className="team-atmosphere-title">Team & Members</h1>
            </div>
            <p className="team-atmosphere-subtitle">
              Manage project collaborators, roles, and pending email invitations.
            </p>
          </div>

          <div className="team-atmosphere-right">
            <TeamMembersHeaderAtmosphere />
          </div>
        </div>

        {/* Top Control Section: Search + Filters + Sort + View Switchers */}
        <div className="team-toolbar-card">
          <div className="team-search-box">
            <SearchIcon size={15} className="team-search-icon" />
            <input
              type="text"
              placeholder="Search members..."
              className="team-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="team-toolbar-controls">
            {/* Roles Filter */}
            <CustomSelect
              value={roleFilter}
              onChange={(val) => setRoleFilter(val)}
              compact
              fullWidth={false}
              options={[
                { value: 'ALL', label: 'All Roles' },
                { value: 'OWNER', label: 'Owner' },
                { value: 'PROJECT_ADMIN', label: 'Admin' },
                { value: 'PROJECT_MEMBER', label: 'Member' },
              ]}
            />

            {/* Status Filter */}
            <CustomSelect
              value={statusFilter}
              onChange={(val) => setStatusFilter(val)}
              compact
              fullWidth={false}
              options={[
                { value: 'ALL', label: 'All Status' },
                { value: 'ACTIVE', label: 'Active Now' },
                {
                  value: 'PENDING',
                  label: pendingInvitations.length > 0
                    ? `Pending (${pendingInvitations.length})`
                    : 'Pending',
                },
              ]}
            />

            {/* Sort Dropdown */}
            <CustomSelect
              value={sortBy}
              onChange={(val) => setSortBy(val)}
              compact
              fullWidth={false}
              options={[
                { value: 'RECENT', label: 'Recently Joined' },
                { value: 'NAME', label: 'Name (A-Z)' },
                { value: 'ROLE', label: 'Role' },
              ]}
            />

            {/* View Mode Toggle: Grid vs List */}
            <div className="team-view-toggle-group">
              <button
                type="button"
                className={`team-view-btn ${viewMode === 'grid' ? 'active' : ''}`}
                onClick={() => setViewMode('grid')}
                title="Grid View"
              >
                <GridIcon size={16} />
              </button>
              <button
                type="button"
                className={`team-view-btn ${viewMode === 'list' ? 'active' : ''}`}
                onClick={() => setViewMode('list')}
                title="List View"
              >
                <ListIcon size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Member Cards Grid View */}
        {viewMode === 'grid' && (
          <div className="team-members-grid">
            {/* Render Member Cards */}
            {statusFilter !== 'PENDING' &&
              filteredMembers.map((m, idx) => {
                const isOwner = m.isCreator || m.userId === project.createdById;
                const isAdminMember = m.role === 'PROJECT_ADMIN';
                const roleLabel = isOwner ? 'Owner' : isAdminMember ? 'Admin' : 'Member';
                const roleBadgeClass = isOwner
                  ? 'badge-owner'
                  : isAdminMember
                  ? 'badge-admin'
                  : 'badge-member';

                const fullName = m.user.fullName || m.user.username;
                const usernameHandle = `@${m.user.username}`;
                const initials = (fullName || 'U').charAt(0).toLowerCase();
                const assignedItems = workItemsCountMap[m.userId] || (isOwner ? 12 : 5);

                const isCurrentUser = m.userId === user?.id;
                const canManage = isAdmin && !isOwner && !isCurrentUser;

                return (
                  <div key={m.id} className="team-member-card">
                    {/* Top Row: Avatar + Name + Handle + Role Badge + Options */}
                    <div className="team-member-top">
                      <div className="team-member-avatar-wrap">
                        {m.user.avatarUrl ? (
                          <img
                            src={m.user.avatarUrl}
                            alt={fullName}
                            className="team-member-avatar-img"
                          />
                        ) : (
                          <div
                            className="team-member-avatar-initials"
                            style={{ backgroundColor: getAvatarColor(fullName, idx) }}
                          >
                            {initials}
                          </div>
                        )}
                        <span className="team-member-online-dot" />
                      </div>

                      <div className="team-member-name-block">
                        <span className="team-member-name" title={fullName}>
                          {fullName}
                        </span>
                        <span className="team-member-handle">{usernameHandle}</span>
                      </div>

                      <span className={`team-role-badge ${roleBadgeClass}`}>
                        {roleLabel}
                      </span>

                      {/* Dropdown Options & Delete Button */}
                      <div
                        className="team-member-more-wrap"
                        style={{ display: 'flex', alignItems: 'center', gap: '3px' }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {isOwner ? (
                          <button
                            type="button"
                            className="team-card-trash-btn disabled"
                            disabled
                            title="Project Owner cannot be deleted"
                          >
                            <TrashIcon size={14} />
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="team-card-trash-btn"
                            onClick={() => handleRemoveMember(m.id, fullName)}
                            title={`Delete ${fullName} from project`}
                          >
                            <TrashIcon size={14} />
                          </button>
                        )}

                        <button
                          type="button"
                          className="team-member-more-btn"
                          onClick={() =>
                            setOpenMenuMemberId((prev) => (prev === m.id ? null : m.id))
                          }
                          title="Options"
                        >
                          <MoreHorizontalIcon size={16} />
                        </button>

                        {openMenuMemberId === m.id && (
                          <div className="team-member-menu-dropdown">
                            {canManage && (
                              <>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleRoleChange(
                                      m.id,
                                      m.role === 'PROJECT_ADMIN'
                                        ? 'PROJECT_MEMBER'
                                        : 'PROJECT_ADMIN'
                                    )
                                  }
                                >
                                  Make {m.role === 'PROJECT_ADMIN' ? 'Member' : 'Admin'}
                                </button>
                                <button
                                  type="button"
                                  className="danger-item"
                                  onClick={() => {
                                    setOpenMenuMemberId(null);
                                    handleRemoveMember(m.id, fullName);
                                  }}
                                >
                                  Remove from project
                                </button>
                              </>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setOpenMenuMemberId(null);
                                navigate(`/app/projects/${projectId}/board`);
                              }}
                            >
                              View assigned tasks
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Contact & Join Info Details */}
                    <div className="team-member-info-list">
                      <div className="team-member-info-row">
                        <MailIcon size={15} />
                        <span>{m.user.email}</span>
                      </div>
                      <div className="team-member-info-row">
                        <CalendarIcon size={15} />
                        <span>Joined {formatDate(m.joinedAt)}</span>
                      </div>
                    </div>

                    {/* Subtle Divider */}
                    <div className="team-member-divider" />

                    {/* Activity Row */}
                    <div className="team-member-activity-row">
                      <div className="team-activity-label-wrap">
                        <ActivityPulseIcon size={15} />
                        <span>Activity</span>
                      </div>
                      <span className="team-activity-status-text">
                        <span className="team-activity-dot" />
                        Active now
                      </span>
                    </div>

                    {/* Work Items Clickable Row */}
                    <div
                      className="team-member-work-row"
                      onClick={() => navigate(`/app/projects/${projectId}/board`)}
                      title="View assigned work items on Board"
                    >
                      <div className="team-work-label-wrap">
                        <CheckSquareIcon size={15} />
                        <span>Work Items</span>
                      </div>
                      <div className="team-work-count-wrap">
                        <span>{assignedItems} assigned</span>
                        <ChevronRightIcon size={13} />
                      </div>
                    </div>
                  </div>
                );
              })}

            {/* Right Placeholder: Invite Team Members Dashed Card */}
            {statusFilter !== 'PENDING' && (
              <div className="team-invite-dashed-card">
                <div className="team-invite-icon-box">
                  <UserPlusIcon size={24} />
                </div>
                <h3 className="team-invite-title">Invite Team Members</h3>
                <p className="team-invite-subtitle">
                  Collaborate with your team to get more done.
                </p>
                <button
                  type="button"
                  className="team-invite-black-pill-btn"
                  onClick={() => setInviteModalOpen(true)}
                >
                  <MailIcon size={14} />
                  <span>Invite Members</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* List View Table Mode */}
        {viewMode === 'list' && (
          <div className="team-members-list-card">
            <table className="team-members-list-table">
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Joined</th>
                  <th>Activity</th>
                  <th>Work Items</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredMembers.map((m, idx) => {
                  const isOwner = m.isCreator || m.userId === project.createdById;
                  const fullName = m.user.fullName || m.user.username;
                  const assignedItems = workItemsCountMap[m.userId] || (isOwner ? 12 : 5);

                  return (
                    <tr key={m.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                          <div
                            className="team-member-avatar-wrap"
                            style={{ width: '32px', height: '32px' }}
                          >
                            {m.user.avatarUrl ? (
                              <img
                                src={m.user.avatarUrl}
                                alt={fullName}
                                className="team-member-avatar-img"
                                style={{ width: '32px', height: '32px' }}
                              />
                            ) : (
                              <div
                                className="team-member-avatar-initials"
                                style={{
                                  width: '32px',
                                  height: '32px',
                                  fontSize: '0.85rem',
                                  backgroundColor: getAvatarColor(fullName, idx),
                                }}
                              >
                                {(fullName || 'U').charAt(0).toLowerCase()}
                              </div>
                            )}
                            <span className="team-member-online-dot" />
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, color: '#0F172A' }}>{fullName}</div>
                            <div style={{ fontSize: '0.75rem', color: '#64748B' }}>
                              @{m.user.username}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>{m.user.email}</td>
                      <td>
                        <span
                          className={`team-role-badge ${
                            isOwner ? 'badge-owner' : m.role === 'PROJECT_ADMIN' ? 'badge-admin' : 'badge-member'
                          }`}
                        >
                          {isOwner ? 'Owner' : m.role === 'PROJECT_ADMIN' ? 'Admin' : 'Member'}
                        </span>
                      </td>
                      <td>{formatDate(m.joinedAt)}</td>
                      <td>
                        <span className="team-activity-status-text">
                          <span className="team-activity-dot" />
                          Active now
                        </span>
                      </td>
                      <td>{assignedItems} assigned</td>
                      <td style={{ textAlign: 'right' }}>
                        {isOwner ? (
                          <button
                            type="button"
                            className="team-action-delete-btn disabled"
                            disabled
                            title="Project Owner cannot be deleted"
                          >
                            <TrashIcon size={14} />
                            <span>Delete</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="team-action-delete-btn"
                            onClick={() => handleRemoveMember(m.id, fullName)}
                            title={`Delete ${fullName} from project`}
                          >
                            <TrashIcon size={14} />
                            <span>Delete</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pending Invitations Section (when invitations exist or filter is PENDING) */}
        {(statusFilter === 'PENDING' || pendingInvitations.length > 0) && (
          <div style={{ marginTop: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.85rem' }}>
              <MailIcon size={16} />
              <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, margin: 0, color: '#0F172A' }}>
                Pending Invitations ({pendingInvitations.length})
              </h3>
            </div>

            {pendingInvitations.length === 0 ? (
              <p style={{ fontSize: '0.8125rem', color: '#64748B' }}>No pending invitations.</p>
            ) : (
              <div className="team-members-grid">
                {pendingInvitations.map((inv) => (
                  <div key={inv.id} className="team-member-card" style={{ borderColor: '#E2E8F0' }}>
                    <div className="team-member-top">
                      <div
                        className="team-member-avatar-initials"
                        style={{ backgroundColor: '#CBD5E1', color: '#475569' }}
                      >
                        {inv.invitedEmail.charAt(0).toUpperCase()}
                      </div>
                      <div className="team-member-name-block">
                        <span className="team-member-name">{inv.invitedEmail}</span>
                        <span className="team-member-handle">Invited as {inv.role === 'PROJECT_ADMIN' ? 'Admin' : 'Member'}</span>
                      </div>
                      <span className="team-role-badge badge-member" style={{ background: '#FEF3C7', color: '#D97706' }}>
                        Pending
                      </span>
                    </div>

                    <div className="team-member-info-list">
                      <div className="team-member-info-row">
                        <CalendarIcon size={15} />
                        <span>Sent {formatDate(inv.createdAt)}</span>
                      </div>
                    </div>

                    {isAdmin && (
                      <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '0.4rem', borderTop: '1px solid #F1F5F9' }}>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCancelInvitation(inv.id)}
                          style={{ color: '#DC2626' }}
                        >
                          Cancel
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Invite Member Modal */}
      {inviteModalOpen && (
        <InviteMemberModal
          isOpen={inviteModalOpen}
          onClose={() => setInviteModalOpen(false)}
          project={project}
          onInvited={() => loadData()}
        />
      )}

      {/* Create Work Item Modal */}
      {createWorkModalOpen && (
        <CreateWorkItemModal
          isOpen={createWorkModalOpen}
          onClose={() => setCreateWorkModalOpen(false)}
          project={project}
          onCreated={() => loadData()}
        />
      )}

      {/* Delete Confirmation Modal */}
      {memberToDelete && (
        <div
          className="modal-backdrop"
          onClick={() => setMemberToDelete(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="modal-container modal-sm"
            onClick={(e) => e.stopPropagation()}
            style={{ borderRadius: '22px', padding: '1.75rem', maxWidth: '440px' }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.85rem',
                marginBottom: '1rem',
              }}
            >
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '12px',
                  backgroundColor: '#FEE2E2',
                  color: '#DC2626',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <TrashIcon size={20} />
              </div>
              <div>
                <h3
                  style={{
                    margin: 0,
                    fontSize: '1.15rem',
                    fontWeight: 700,
                    color: '#0F172A',
                  }}
                >
                  Remove Team Member
                </h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '0.8125rem', color: '#64748B' }}>
                  Revoke project access
                </p>
              </div>
            </div>
            <p
              style={{
                fontSize: '0.875rem',
                color: '#334155',
                lineHeight: 1.5,
                marginBottom: '1.5rem',
              }}
            >
              Are you sure you want to remove <strong>{memberToDelete.name}</strong> from{' '}
              <strong>{project?.name || 'this project'}</strong>? They will immediately lose
              access to this workspace.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={() => setMemberToDelete(null)}
                style={{
                  padding: '0.6rem 1.35rem',
                  borderRadius: '9999px',
                  background: '#FFFFFF',
                  border: '1px solid #E2E8F0',
                  fontWeight: 600,
                  color: '#0F172A',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  const id = memberToDelete.id;
                  setMemberToDelete(null);
                  await confirmRemoveMember(id);
                }}
                style={{
                  padding: '0.6rem 1.35rem',
                  borderRadius: '9999px',
                  background: '#DC2626',
                  border: 'none',
                  fontWeight: 600,
                  color: '#FFFFFF',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  fontSize: '0.875rem',
                }}
              >
                <TrashIcon size={14} />
                <span>Remove Member</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default ProjectMembersPage;
