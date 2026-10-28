import React, { useState, useEffect, useMemo } from 'react';
import type { Project } from '../../api/projects.api';
import { type ProjectInvitation } from '../../api/invitations.api';
import { workspacesApi, type WorkspaceMemberItem } from '../../api/workspaces.api';
import { membersApi, type ProjectMemberDetail } from '../../api/members.api';
import { CloseIcon, MailIcon, SearchIcon, UserPlusIcon } from '../ui/Icons';
import { CustomSelect } from '../ui/CustomSelect';

interface InviteMemberModalProps {
  project: Project;
  isOpen: boolean;
  onClose: () => void;
  onInvited: (invitation?: ProjectInvitation) => void;
}

interface SelectedUserEntry {
  user: WorkspaceMemberItem['user'];
  workspaceRole: string;
  projectRole: 'PROJECT_MEMBER' | 'PROJECT_ADMIN';
}

export const InviteMemberModal: React.FC<InviteMemberModalProps> = ({
  project,
  isOpen,
  onClose,
  onInvited,
}) => {
  const [selectedUsers, setSelectedUsers] = useState<Map<string, SelectedUserEntry>>(new Map());
  const [message, setMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [defaultRole, setDefaultRole] = useState<'PROJECT_MEMBER' | 'PROJECT_ADMIN'>('PROJECT_MEMBER');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Loaded workspace members & project members
  const [wsMembers, setWsMembers] = useState<WorkspaceMemberItem[]>([]);
  const [existingMembers, setExistingMembers] = useState<ProjectMemberDetail[]>([]);
  const [pendingInvitations, setPendingInvitations] = useState<any[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    setSelectedUsers(new Map());
    setMessage('');
    setSearchQuery('');
    setError(null);

    let mounted = true;
    setLoadingMembers(true);

    Promise.all([
      project.workspaceId
        ? workspacesApi.getMembers(project.workspaceId, { limit: 100 })
        : Promise.resolve({ success: false, data: { members: [] } }),
      membersApi.getProjectMembers(project.id).catch(() => ({ success: false, data: null })),
    ])
      .then(([wsRes, memRes]) => {
        if (!mounted) return;
        if (wsRes.success && wsRes.data?.members) {
          setWsMembers(wsRes.data.members.filter((m) => !m.user.isDeactivated));
        }
        if (memRes.success && memRes.data) {
          setExistingMembers(memRes.data.members || []);
          setPendingInvitations(memRes.data.pendingInvitations || []);
        }
      })
      .catch((err) => {
        if (!mounted) return;
        setError(err.message || 'Failed to load workspace members');
      })
      .finally(() => {
        if (mounted) setLoadingMembers(false);
      });

    return () => {
      mounted = false;
    };
  }, [isOpen, project.id, project.workspaceId]);

  // Accessibility: Escape key and body scroll lock
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isSubmitting) {
        onClose();
      }
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose, isSubmitting]);

  // Sets of existing project member user IDs & pending emails
  const existingUserIds = useMemo(
    () => new Set(existingMembers.map((m) => m.userId)),
    [existingMembers]
  );

  const pendingEmails = useMemo(
    () => new Set(pendingInvitations.map((inv) => (inv.invitedEmail || '').toLowerCase())),
    [pendingInvitations]
  );

  const existingMembersMap = useMemo(
    () => new Map(existingMembers.map((em) => [em.userId, em])),
    [existingMembers]
  );

  // Group and sort active workspace members strictly by their actual workspace role:
  // 1. Workspace Owner
  // 2. Workspace Admins
  // 3. Workspace Members
  // Alphabetical within each group
  const groupedMembers = useMemo(() => {
    const owners: WorkspaceMemberItem[] = [];
    const admins: WorkspaceMemberItem[] = [];
    const members: WorkspaceMemberItem[] = [];

    const query = searchQuery.trim().toLowerCase();

    for (const wm of wsMembers) {
      const name = (wm.user.fullName || '').toLowerCase();
      const username = (wm.user.username || '').toLowerCase();
      const email = (wm.user.email || '').toLowerCase();

      if (query && !name.includes(query) && !username.includes(query) && !email.includes(query)) {
        continue;
      }

      if (wm.role === 'OWNER') {
        owners.push(wm);
      } else if (wm.role === 'WORKSPACE_ADMIN') {
        admins.push(wm);
      } else {
        members.push(wm);
      }
    }

    const sortFn = (a: WorkspaceMemberItem, b: WorkspaceMemberItem) => {
      const nameA = (a.user.fullName || a.user.username).toLowerCase();
      const nameB = (b.user.fullName || b.user.username).toLowerCase();
      return nameA.localeCompare(nameB);
    };

    owners.sort(sortFn);
    admins.sort(sortFn);
    members.sort(sortFn);

    return [
      { title: 'Workspace Owner', items: owners },
      { title: 'Workspace Admins', items: admins },
      { title: 'Workspace Members', items: members },
    ].filter((g) => g.items.length > 0);
  }, [wsMembers, searchQuery]);

  if (!isOpen) return null;

  const toggleSelectUser = (wm: WorkspaceMemberItem) => {
    const isAlreadyMember = existingUserIds.has(wm.userId);
    const isPending = pendingEmails.has(wm.user.email.toLowerCase());
    if (isAlreadyMember || isPending) return;

    setSelectedUsers((prev) => {
      const next = new Map(prev);
      if (next.has(wm.userId)) {
        next.delete(wm.userId);
      } else {
        const initialProjectRole =
          wm.role === 'PROJECT_ADMIN' || wm.role === 'WORKSPACE_ADMIN'
            ? 'PROJECT_ADMIN'
            : defaultRole;
        next.set(wm.userId, {
          user: wm.user,
          workspaceRole: wm.role,
          projectRole: initialProjectRole,
        });
      }
      return next;
    });
  };

  const handleUpdateRole = (userId: string, newRole: 'PROJECT_MEMBER' | 'PROJECT_ADMIN') => {
    setSelectedUsers((prev) => {
      const next = new Map(prev);
      const entry = next.get(userId);
      if (entry) {
        next.set(userId, { ...entry, projectRole: newRole });
      }
      return next;
    });
  };

  const handleRemoveSelected = (userId: string) => {
    setSelectedUsers((prev) => {
      const next = new Map(prev);
      next.delete(userId);
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedUsers.size === 0) {
      setError('Please select at least one workspace member to add');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const userList = Array.from(selectedUsers.values());
    const errorsList: string[] = [];

    for (const item of userList) {
      try {
        await membersApi.addMember(project.id, {
          userId: item.user.id,
          role: item.projectRole,
        });
      } catch (err: any) {
        errorsList.push(`${item.user.fullName || item.user.username}: ${err.message || 'Failed'}`);
      }
    }

    setIsSubmitting(false);

    if (errorsList.length > 0) {
      setError(`Some members could not be added:\n${errorsList.join('\n')}`);
    } else {
      onInvited();
      onClose();
    }
  };

  return (
    <div className="modal-backdrop" onClick={() => !isSubmitting && onClose()} role="dialog" aria-modal="true">
      <div
        className="modal-container invite-modal-luxury"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '640px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
      >
        {/* Top Header Row with Atmosphere Art & Close Button */}
        <div className="im-modal-header" style={{ flexShrink: 0 }}>
          <div className="im-header-left">
            <div className="im-header-icon-box">
              <MailIcon size={20} className="im-header-mail-icon" />
            </div>
            <div className="im-header-text">
              <h2 className="im-header-title">Add Workspace Members</h2>
              <p className="im-header-subtitle">
                Select eligible workspace members to collaborate on <strong>{project.name}</strong>.
              </p>
            </div>
          </div>

          {/* Envelope & Flying Airplane Atmosphere Art */}
          <div className="im-atmosphere-wrap">
            <svg
              width="150"
              height="80"
              viewBox="0 0 150 80"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="im-atmosphere-svg"
            >
              <ellipse cx="120" cy="74" rx="42" ry="20" fill="#DCFCE7" opacity="0.6" />
              <ellipse cx="85" cy="76" rx="35" ry="18" fill="#D1FAE5" opacity="0.8" />
              <ellipse cx="130" cy="68" rx="28" ry="14" fill="#A7F3D0" opacity="0.5" />
              <ellipse cx="78" cy="70" rx="24" ry="5" fill="#000000" opacity="0.04" />
              <rect x="62" y="46" width="34" height="24" rx="3" fill="#F59E0B" />
              <rect x="66" y="32" width="26" height="24" rx="2.5" fill="#FFFFFF" stroke="#E2E8F0" strokeWidth="1" />
              <rect x="70" y="37" width="18" height="2" rx="1" fill="#10B981" />
              <rect x="70" y="42" width="14" height="2" rx="1" fill="#10B981" />
              <rect x="70" y="47" width="11" height="2" rx="1" fill="#34D399" />
              <line x1="79" y1="23" x2="79" y2="28" stroke="#F59E0B" strokeWidth="1.75" strokeLinecap="round" />
              <line x1="69" y1="26" x2="72" y2="29" stroke="#FBBF24" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="89" y1="26" x2="86" y2="29" stroke="#FBBF24" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M62 70L79 56L96 70H62Z" fill="#FBBF24" />
              <path d="M62 48L79 61L62 70V48Z" fill="#F59E0B" />
              <path d="M96 48L79 61L96 70V48Z" fill="#F59E0B" />
              <path d="M62 48L79 61L96 48" stroke="#D97706" strokeWidth="0.8" />
              <path
                d="M94 52 C104 54, 110 45, 116 38"
                stroke="#60A5FA"
                strokeWidth="1.5"
                strokeDasharray="2.5 2.5"
                strokeLinecap="round"
                fill="none"
              />
              <g transform="translate(116, 26) rotate(10)">
                <path d="M0 10 L18 0 L8 17 L6 11 L0 10Z" fill="#3B82F6" />
                <path d="M6 11 L18 0 L8 17 L6 11Z" fill="#2563EB" />
                <path d="M6 11 L10 14 L8 17 L6 11Z" fill="#1D4ED8" />
              </g>
            </svg>
          </div>

          <button
            type="button"
            className="im-close-btn"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Close"
          >
            <CloseIcon size={16} />
          </button>
        </div>

        {error && (
          <div className="form-error-banner" style={{ margin: '0.75rem 1.5rem 0 1.5rem', whiteSpace: 'pre-line' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          <div style={{ padding: '1rem 1.5rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Search Input & Default Role Selector */}
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <div style={{ flex: 1, position: 'relative' }}>
                <SearchIcon
                  size={15}
                  style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }}
                />
                <input
                  type="text"
                  placeholder="Search workspace members by name or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.55rem 0.75rem 0.55rem 2.25rem',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    fontSize: '0.84375rem',
                  }}
                />
              </div>

              <div style={{ minWidth: '170px' }}>
                <CustomSelect
                  value={defaultRole}
                  onChange={(val) => setDefaultRole(val as any)}
                  compact
                  options={[
                    { value: 'PROJECT_MEMBER', label: 'Default: Member' },
                    { value: 'PROJECT_ADMIN', label: 'Default: Admin' },
                  ]}
                />
              </div>
            </div>

            {/* Selected Users Summary Chips */}
            {selectedUsers.size > 0 && (
              <div
                style={{
                  backgroundColor: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  borderRadius: '10px',
                  padding: '0.65rem 0.85rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155' }}>
                    Selected Recipients ({selectedUsers.size})
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedUsers(new Map())}
                    style={{ background: 'none', border: 'none', fontSize: '0.75rem', color: '#DC2626', cursor: 'pointer', fontWeight: 600 }}
                  >
                    Clear all
                  </button>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', maxHeight: '110px', overflowY: 'auto' }}>
                  {Array.from(selectedUsers.values()).map((entry) => (
                    <div
                      key={entry.user.id}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.45rem',
                        backgroundColor: '#FFFFFF',
                        border: '1px solid #CBD5E1',
                        borderRadius: '9999px',
                        padding: '0.2rem 0.55rem 0.2rem 0.65rem',
                        fontSize: '0.75rem',
                      }}
                    >
                      <span style={{ fontWeight: 600, color: '#0F172A' }}>
                        {entry.user.fullName || entry.user.username}
                      </span>
                      <span
                        style={{
                          fontSize: '0.65rem',
                          padding: '0.1rem 0.35rem',
                          borderRadius: '4px',
                          backgroundColor:
                            entry.workspaceRole === 'OWNER'
                              ? '#FEF3C7'
                              : entry.workspaceRole === 'WORKSPACE_ADMIN'
                              ? '#EFF6FF'
                              : entry.workspaceRole === 'PROJECT_ADMIN'
                              ? '#EEF2FF'
                              : '#F1F5F9',
                          color:
                            entry.workspaceRole === 'OWNER'
                              ? '#B45309'
                              : entry.workspaceRole === 'WORKSPACE_ADMIN'
                              ? '#1D4ED8'
                              : entry.workspaceRole === 'PROJECT_ADMIN'
                              ? '#4F46E5'
                              : '#475569',
                          fontWeight: 600,
                        }}
                        title={`Workspace role: ${entry.workspaceRole}`}
                      >
                        WS: {entry.workspaceRole === 'OWNER'
                          ? 'Owner'
                          : entry.workspaceRole === 'WORKSPACE_ADMIN'
                          ? 'Admin'
                          : entry.workspaceRole === 'PROJECT_ADMIN'
                          ? 'Project Admin'
                          : 'Member'}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <span style={{ fontSize: '0.65rem', color: '#64748B', fontWeight: 600 }}>Project:</span>
                        <select
                          value={entry.projectRole}
                          onChange={(e) => handleUpdateRole(entry.user.id, e.target.value as any)}
                          style={{
                            fontSize: '0.7rem',
                            padding: '0.1rem 0.25rem',
                            borderRadius: '4px',
                            border: '1px solid #E2E8F0',
                            backgroundColor: entry.projectRole === 'PROJECT_ADMIN' ? '#EFF6FF' : '#F1F5F9',
                            color: entry.projectRole === 'PROJECT_ADMIN' ? '#2563EB' : '#475569',
                            fontWeight: 600,
                          }}
                        >
                          <option value="PROJECT_MEMBER">Project Member</option>
                          <option value="PROJECT_ADMIN">Project Admin</option>
                        </select>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveSelected(entry.user.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: '#94A3B8',
                          padding: '0 2px',
                          fontSize: '0.85rem',
                          lineHeight: 1,
                        }}
                        title="Remove"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Member Selector List grouped by Role */}
            <div
              style={{
                border: '1px solid #E2E8F0',
                borderRadius: '10px',
                maxHeight: '230px',
                overflowY: 'auto',
                backgroundColor: '#FFFFFF',
              }}
            >
              {loadingMembers ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#64748B', fontSize: '0.875rem' }}>
                  Loading workspace members...
                </div>
              ) : groupedMembers.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#64748B', fontSize: '0.875rem' }}>
                  No workspace members found matching your search.
                </div>
              ) : (
                groupedMembers.map((group) => (
                  <div key={group.title}>
                    <div
                      style={{
                        padding: '0.4rem 0.75rem',
                        backgroundColor: '#F8FAFC',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        color: '#64748B',
                        letterSpacing: '0.05em',
                        borderBottom: '1px solid #F1F5F9',
                      }}
                    >
                      {group.title} ({group.items.length})
                    </div>
                    {group.items.map((wm) => {
                      const isAlready = existingUserIds.has(wm.userId);
                      const isPending = pendingEmails.has(wm.user.email.toLowerCase());
                      const isSelected = selectedUsers.has(wm.userId);
                      const name = wm.user.fullName || wm.user.username;

                      return (
                        <div
                          key={wm.id}
                          onClick={() => toggleSelectUser(wm)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '0.55rem 0.75rem',
                            borderBottom: '1px solid #F1F5F9',
                            cursor: isAlready || isPending ? 'not-allowed' : 'pointer',
                            backgroundColor: isSelected ? '#F0FDF4' : '#FFFFFF',
                            opacity: isAlready || isPending ? 0.6 : 1,
                            transition: 'background 0.15s ease',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                            <input
                              type="checkbox"
                              checked={isSelected || isAlready}
                              disabled={isAlready || isPending}
                              onChange={() => toggleSelectUser(wm)}
                              style={{ cursor: isAlready || isPending ? 'not-allowed' : 'pointer' }}
                            />
                            <div
                              style={{
                                width: '30px',
                                height: '30px',
                                borderRadius: '50%',
                                backgroundColor: isSelected ? '#DCFCE7' : '#E2E8F0',
                                color: isSelected ? '#16A34A' : '#475569',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 700,
                                fontSize: '0.75rem',
                              }}
                            >
                              {name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <span style={{ fontWeight: 600, fontSize: '0.84375rem', color: '#0F172A' }}>{name}</span>
                                <span style={{ fontSize: '0.75rem', color: '#64748B' }}>@{wm.user.username}</span>
                              </div>
                              <div style={{ fontSize: '0.75rem', color: '#64748B' }}>{wm.user.email}</div>
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            {/* Primary Workspace Role Badge */}
                            <span
                              style={{
                                fontSize: '0.6875rem',
                                fontWeight: 600,
                                padding: '0.15rem 0.45rem',
                                borderRadius: '6px',
                                backgroundColor:
                                  wm.role === 'OWNER'
                                    ? '#FEF3C7'
                                    : wm.role === 'WORKSPACE_ADMIN'
                                    ? '#EFF6FF'
                                    : wm.role === 'PROJECT_ADMIN'
                                    ? '#EEF2FF'
                                    : '#F1F5F9',
                                color:
                                  wm.role === 'OWNER'
                                    ? '#B45309'
                                    : wm.role === 'WORKSPACE_ADMIN'
                                    ? '#1D4ED8'
                                    : wm.role === 'PROJECT_ADMIN'
                                    ? '#4F46E5'
                                    : '#475569',
                              }}
                              title={`Workspace role: ${wm.role}`}
                            >
                              {wm.role === 'OWNER'
                                ? 'Workspace Owner'
                                : wm.role === 'WORKSPACE_ADMIN'
                                ? 'Workspace Admin'
                                : wm.role === 'PROJECT_ADMIN'
                                ? 'Project Admin'
                                : 'Workspace Member'}
                            </span>

                            {/* Existing Project Role Badge if already in project */}
                            {isAlready && (
                              <>
                                <span
                                  style={{
                                    fontSize: '0.6875rem',
                                    fontWeight: 600,
                                    padding: '0.15rem 0.45rem',
                                    borderRadius: '6px',
                                    backgroundColor:
                                      existingMembersMap.get(wm.userId)?.role === 'PROJECT_ADMIN'
                                        ? '#EFF6FF'
                                        : '#F1F5F9',
                                    color:
                                      existingMembersMap.get(wm.userId)?.role === 'PROJECT_ADMIN'
                                        ? '#1D4ED8'
                                        : '#475569',
                                  }}
                                >
                                  {existingMembersMap.get(wm.userId)?.role === 'PROJECT_ADMIN'
                                    ? 'Project Admin'
                                    : 'Project Member'}
                                </span>
                                <span
                                  style={{
                                    fontSize: '0.6875rem',
                                    fontWeight: 600,
                                    color: '#16A34A',
                                    backgroundColor: '#DCFCE7',
                                    padding: '0.15rem 0.45rem',
                                    borderRadius: '6px',
                                  }}
                                >
                                  In project
                                </span>
                              </>
                            )}

                            {/* Pending Invitation Badge */}
                            {isPending && (
                              <span
                                style={{
                                  fontSize: '0.6875rem',
                                  fontWeight: 600,
                                  color: '#D97706',
                                  backgroundColor: '#FEF3C7',
                                  padding: '0.15rem 0.45rem',
                                  borderRadius: '6px',
                                }}
                              >
                                Invited
                              </span>
                            )}

                            {/* Selected Project Role Selector if selected */}
                            {isSelected && (
                              <div
                                style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <span style={{ fontSize: '0.65rem', color: '#64748B', fontWeight: 600 }}>Project:</span>
                                <select
                                  value={selectedUsers.get(wm.userId)?.projectRole || 'PROJECT_MEMBER'}
                                  onChange={(e) => handleUpdateRole(wm.userId, e.target.value as any)}
                                  style={{
                                    fontSize: '0.71875rem',
                                    padding: '0.15rem 0.45rem',
                                    borderRadius: '6px',
                                    border: '1px solid #CBD5E1',
                                    backgroundColor:
                                      selectedUsers.get(wm.userId)?.projectRole === 'PROJECT_ADMIN'
                                        ? '#EFF6FF'
                                        : '#FFFFFF',
                                    color:
                                      selectedUsers.get(wm.userId)?.projectRole === 'PROJECT_ADMIN'
                                        ? '#1D4ED8'
                                        : '#334155',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                  }}
                                >
                                  <option value="PROJECT_MEMBER">Project Member</option>
                                  <option value="PROJECT_ADMIN">Project Admin</option>
                                </select>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))
              )}
            </div>

            {/* Personal Message (Optional) */}
            <div>
              <label htmlFor="invite-message" style={{ display: 'block', fontWeight: 600, fontSize: '0.8125rem', color: '#334155', marginBottom: '0.35rem' }}>
                Personal Message (Optional)
              </label>
              <textarea
                id="invite-message"
                className="im-textarea-input"
                rows={2}
                maxLength={500}
                placeholder="Add a welcoming note or details about this project..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
              <div style={{ textAlign: 'right', fontSize: '0.7rem', color: '#94A3B8', marginTop: '2px' }}>
                {message.length}/500
              </div>
            </div>
          </div>

          {/* Modal Actions Footer */}
          <div className="im-modal-footer" style={{ flexShrink: 0, borderTop: '1px solid #F1F5F9', padding: '1rem 1.5rem' }}>
            <button
              type="button"
              className="im-cancel-btn"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="im-submit-btn"
              disabled={isSubmitting || selectedUsers.size === 0}
            >
              <UserPlusIcon size={16} />
              <span>
                {isSubmitting
                  ? 'Adding...'
                  : selectedUsers.size > 1
                  ? `Add ${selectedUsers.size} Members to Project`
                  : 'Add Member to Project'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
