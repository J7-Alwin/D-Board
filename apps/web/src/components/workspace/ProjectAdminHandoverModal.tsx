import React, { useState, useEffect } from 'react';
import { membersApi, type ProjectMemberDetail, type HandoverSummary } from '../../api/members.api';
import { CloseIcon, AlertCircleIcon, UsersIcon, CheckSquareIcon, ArrowRightIcon } from '../ui/Icons';
import { Button } from '../ui/Button';

interface ProjectAdminHandoverModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  projectName?: string;
  targetMember: ProjectMemberDetail;
  action: 'DEMOTE' | 'REMOVE';
  onSuccess: () => void;
}

export const ProjectAdminHandoverModal: React.FC<ProjectAdminHandoverModalProps> = ({
  isOpen,
  onClose,
  projectId,
  projectName = 'this project',
  targetMember,
  action,
  onSuccess,
}) => {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [summary, setSummary] = useState<HandoverSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [replacementUserId, setReplacementUserId] = useState<string>('');
  const [reassignTasksToUserId, setReassignTasksToUserId] = useState<string>('');
  const [note, setNote] = useState<string>('');

  useEffect(() => {
    if (!isOpen) return;

    let mounted = true;
    setLoading(true);
    setError(null);

    membersApi
      .getHandoverSummary(projectId, targetMember.id)
      .then((res) => {
        if (!mounted) return;
        if (res.success && res.data) {
          setSummary(res.data);
          // If there are eligible replacements and last admin, pre-select first eligible
          if (res.data.isLastAdmin && res.data.eligibleReplacements.length > 0) {
            setReplacementUserId(res.data.eligibleReplacements[0].userId);
            setReassignTasksToUserId(res.data.eligibleReplacements[0].userId);
          } else if (res.data.projectMembers.length > 0) {
            setReassignTasksToUserId(res.data.projectMembers[0].userId);
          }
        }
      })
      .catch((err: any) => {
        if (!mounted) return;
        setError(err.message || 'Failed to load handover details');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [isOpen, projectId, targetMember.id]);

  // Accessibility: Escape key and body scroll lock
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !submitting) {
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
  }, [isOpen, onClose, submitting]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (summary?.isLastAdmin && !replacementUserId) {
      setError('Please select an active workspace member to become the new Project Administrator.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await membersApi.executeHandover(projectId, targetMember.id, {
        action,
        replacementUserId: replacementUserId || undefined,
        reassignTasksToUserId: reassignTasksToUserId || undefined,
        note: note.trim() || undefined,
      });

      if (res.success) {
        onSuccess();
        onClose();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to complete administrator handover');
    } finally {
      setSubmitting(false);
    }
  };

  const departingName = targetMember.user.fullName || targetMember.user.username;
  const isLastAdmin = summary?.isLastAdmin ?? false;

  return (
    <div className="modal-backdrop" onClick={() => !submitting && onClose()} role="dialog" aria-modal="true">
      <div
        className="modal-container modal-md"
        onClick={(e) => e.stopPropagation()}
        style={{
          borderRadius: '24px',
          padding: '2rem',
          maxWidth: '580px',
          backgroundColor: '#FFFFFF',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '14px',
                backgroundColor: isLastAdmin ? '#FEF2F2' : '#EFF6FF',
                color: isLastAdmin ? '#DC2626' : '#2563EB',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              {isLastAdmin ? <AlertCircleIcon size={24} /> : <UsersIcon size={22} />}
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#0F172A' }}>
                {isLastAdmin
                  ? 'Last Project Administrator Handover'
                  : action === 'DEMOTE'
                  ? 'Change Admin Role & Handover'
                  : 'Remove Admin & Handover'}
              </h2>
              <p style={{ margin: '3px 0 0 0', fontSize: '0.8125rem', color: '#64748B' }}>
                {projectName} • Transition responsibilities cleanly
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#94A3B8',
              padding: '4px',
              borderRadius: '8px',
            }}
            aria-label="Close"
          >
            <CloseIcon size={18} />
          </button>
        </div>

        {error && (
          <div
            className="form-error-banner"
            style={{
              marginBottom: '1.25rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.75rem 1rem',
              borderRadius: '10px',
            }}
          >
            <AlertCircleIcon size={16} />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '2.5rem 0' }}>
            <div className="btn-spinner" />
            <p style={{ marginTop: '0.75rem', fontSize: '0.875rem', color: '#64748B' }}>
              Loading administrator responsibilities...
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Departing Admin Info Card */}
            <div
              style={{
                backgroundColor: '#F8FAFC',
                border: '1px solid #E2E8F0',
                borderRadius: '14px',
                padding: '1rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    backgroundColor: '#7C3AED',
                    color: '#FFFFFF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '0.875rem',
                  }}
                >
                  {departingName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontWeight: 600, color: '#0F172A', fontSize: '0.9375rem' }}>{departingName}</div>
                  <div style={{ fontSize: '0.75rem', color: '#64748B' }}>{targetMember.user.email}</div>
                </div>
              </div>
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  backgroundColor: '#EFF6FF',
                  color: '#2563EB',
                  padding: '0.25rem 0.65rem',
                  borderRadius: '9999px',
                }}
              >
                Departing Admin
              </span>
            </div>

            {/* Last Admin Warning Alert if applicable */}
            {isLastAdmin && (
              <div
                style={{
                  backgroundColor: '#FFFBEB',
                  border: '1px solid #FCD34D',
                  borderRadius: '12px',
                  padding: '0.85rem 1rem',
                  fontSize: '0.8125rem',
                  color: '#92400E',
                  lineHeight: 1.45,
                }}
              >
                <strong>Last Administrator Protection:</strong> {departingName} is currently the only designated Project
                Administrator. To prevent project administrative gaps, an active workspace member must be appointed as
                replacement administrator.
              </div>
            )}

            {/* Outstanding Work Section */}
            <div
              style={{
                backgroundColor: '#F8FAFC',
                border: '1px solid #E2E8F0',
                borderRadius: '14px',
                padding: '1rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600, color: '#334155', fontSize: '0.875rem' }}>
                  <CheckSquareIcon size={16} />
                  <span>Assigned Tasks ({summary?.incompleteTasks.length ?? 0} active)</span>
                </div>
                <span style={{ fontSize: '0.75rem', color: '#16A34A', fontWeight: 500 }}>
                  {summary?.completedTasksCount ?? 0} completed preserved
                </span>
              </div>

              {summary?.incompleteTasks && summary.incompleteTasks.length > 0 ? (
                <div style={{ maxHeight: '110px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  {summary.incompleteTasks.map((task) => (
                    <div
                      key={task.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        backgroundColor: '#FFFFFF',
                        border: '1px solid #E2E8F0',
                        borderRadius: '8px',
                        padding: '0.4rem 0.65rem',
                        fontSize: '0.8125rem',
                      }}
                    >
                      <span style={{ color: '#0F172A', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '300px' }}>
                        {task.title}
                      </span>
                      <span
                        style={{
                          fontSize: '0.7rem',
                          fontWeight: 600,
                          padding: '0.15rem 0.45rem',
                          borderRadius: '6px',
                          backgroundColor: task.priority === 'HIGH' || task.priority === 'URGENT' ? '#FEE2E2' : '#F1F5F9',
                          color: task.priority === 'HIGH' || task.priority === 'URGENT' ? '#DC2626' : '#475569',
                        }}
                      >
                        {task.priority}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ margin: 0, fontSize: '0.8125rem', color: '#64748B' }}>
                  No incomplete tasks currently assigned to this administrator.
                </p>
              )}
            </div>

            {/* Replacement Administrator Picker (Required if isLastAdmin, optional otherwise) */}
            <div>
              <label style={{ display: 'block', fontWeight: 600, fontSize: '0.8125rem', color: '#334155', marginBottom: '0.35rem' }}>
                Replacement Project Administrator {isLastAdmin ? <span style={{ color: '#DC2626' }}>*</span> : '(Optional)'}
              </label>
              <select
                value={replacementUserId}
                onChange={(e) => {
                  setReplacementUserId(e.target.value);
                  if (!reassignTasksToUserId && e.target.value) {
                    setReassignTasksToUserId(e.target.value);
                  }
                }}
                required={isLastAdmin}
                style={{
                  width: '100%',
                  padding: '0.65rem 0.85rem',
                  borderRadius: '10px',
                  border: '1px solid #CBD5E1',
                  backgroundColor: '#FFFFFF',
                  fontSize: '0.875rem',
                  color: '#0F172A',
                }}
              >
                <option value="">{isLastAdmin ? '-- Select replacement administrator --' : '-- Keep existing administrators --'}</option>
                {summary?.eligibleReplacements.map((cand) => {
                  const name = cand.user.fullName || cand.user.username;
                  const isProjMem = cand.isProjectMember ? 'Project Member' : 'Workspace Member';
                  return (
                    <option key={cand.userId} value={cand.userId}>
                      {name} ({cand.user.email}) — [{cand.workspaceRole}] • {isProjMem}
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Task Reassignment Picker */}
            {summary?.incompleteTasks && summary.incompleteTasks.length > 0 && (
              <div>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.8125rem', color: '#334155', marginBottom: '0.35rem' }}>
                  Reassign Active Tasks To
                </label>
                <select
                  value={reassignTasksToUserId}
                  onChange={(e) => setReassignTasksToUserId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    borderRadius: '10px',
                    border: '1px solid #CBD5E1',
                    backgroundColor: '#FFFFFF',
                    fontSize: '0.875rem',
                    color: '#0F172A',
                  }}
                >
                  <option value="">-- Unassign tasks --</option>
                  {replacementUserId && (
                    <option value={replacementUserId}>
                      ★ New Administrator ({summary?.eligibleReplacements.find((r) => r.userId === replacementUserId)?.user.fullName || 'Designated Replacement'})
                    </option>
                  )}
                  {summary?.projectMembers.map((pm) => (
                    <option key={pm.userId} value={pm.userId}>
                      {pm.user.fullName || pm.user.username} ({pm.role === 'PROJECT_ADMIN' ? 'Admin' : 'Member'})
                    </option>
                  ))}
                </select>
                <span style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '0.25rem', display: 'block' }}>
                  Completed work and original author attributions remain untouched.
                </span>
              </div>
            )}

            {/* Optional Handoff Note */}
            <div>
              <label style={{ display: 'block', fontWeight: 600, fontSize: '0.8125rem', color: '#334155', marginBottom: '0.35rem' }}>
                Handover Note (Optional)
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                maxLength={500}
                placeholder="Details about active items or context for the handover..."
                style={{
                  width: '100%',
                  padding: '0.65rem 0.85rem',
                  borderRadius: '10px',
                  border: '1px solid #CBD5E1',
                  backgroundColor: '#FFFFFF',
                  fontSize: '0.875rem',
                  color: '#0F172A',
                  resize: 'none',
                }}
              />
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                style={{
                  padding: '0.65rem 1.35rem',
                  borderRadius: '9999px',
                  border: '1px solid #E2E8F0',
                  backgroundColor: '#FFFFFF',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                  color: '#334155',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <Button
                type="submit"
                variant="primary"
                disabled={submitting || (isLastAdmin && !replacementUserId)}
                style={{
                  borderRadius: '9999px',
                  padding: '0.65rem 1.45rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  backgroundColor: action === 'REMOVE' ? '#DC2626' : undefined,
                  borderColor: action === 'REMOVE' ? '#DC2626' : undefined,
                }}
              >
                <span>{submitting ? 'Executing Handover...' : action === 'REMOVE' ? 'Complete Handover & Remove' : 'Complete Handover & Demote'}</span>
                <ArrowRightIcon size={14} />
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
