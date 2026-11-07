import React, { useState, useMemo } from 'react';
import {
  projectTransferApi,
  type ProjectTransfer,
  type ApproveProjectTransferPayload,
} from '../../api/projectTransfer.api';
import {
  CloseIcon,
  CheckIcon,
  AlertCircleIcon,
  UsersIcon,
  ShieldCheckIcon,
  UserPlusIcon,
} from '../ui/Icons';
import './ProjectTransferAcceptModal.css';

export interface ProjectTransferAcceptModalProps {
  isOpen: boolean;
  onClose: () => void;
  transfer: ProjectTransfer | null;
  onSuccess: (newProjectId?: string) => void;
}

export const ProjectTransferAcceptModal: React.FC<ProjectTransferAcceptModalProps> = ({
  isOpen,
  onClose,
  transfer,
  onSuccess,
}) => {
  const [memberAction, setMemberAction] = useState<'INVITE_ALL' | 'DECIDE_LATER' | 'REMOVE_ALL'>('DECIDE_LATER');
  const [sharedDecisions, setSharedDecisions] = useState<Record<string, 'KEEP' | 'REMOVE'>>({});
  const [newProjectKey, setNewProjectKey] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Extract shared members and previous members
  const { sharedMembers, previousMembers } = useMemo(() => {
    if (!transfer?.project?.members) {
      return { sharedMembers: [], previousMembers: [] };
    }

    const destMembers = transfer.destinationWorkspace?.members || [];
    const destOwnerId = transfer.destinationWorkspace?.ownerId;
    const destUserIds = new Set(destMembers.map((m) => m.userId));
    if (destOwnerId) destUserIds.add(destOwnerId);

    const shared: Array<{
      userId: string;
      role: string;
      user: { fullName?: string | null; username: string; email?: string; avatarUrl?: string | null };
      destRole: string;
    }> = [];

    const previous: Array<{
      userId: string;
      role: string;
      user: { fullName?: string | null; username: string; email?: string; avatarUrl?: string | null };
    }> = [];

    for (const pm of transfer.project.members) {
      if (destUserIds.has(pm.userId)) {
        const destM = destMembers.find((dm) => dm.userId === pm.userId);
        const destRole = pm.userId === destOwnerId ? 'Workspace Owner' : destM?.role === 'WORKSPACE_ADMIN' ? 'Workspace Admin' : 'Workspace Member';
        shared.push({
          userId: pm.userId,
          role: pm.role,
          user: pm.user,
          destRole,
        });
      } else {
        previous.push({
          userId: pm.userId,
          role: pm.role,
          user: pm.user,
        });
      }
    }

    return { sharedMembers: shared, previousMembers: previous };
  }, [transfer]);

  if (!isOpen || !transfer) return null;

  const projectName = transfer.project?.name || transfer.projectName || 'Project';
  const projectKey = transfer.project?.key || transfer.projectKey || '';
  const sourceWsName = transfer.sourceWorkspace?.name || 'Previous Workspace';
  const destWsName = transfer.destinationWorkspace?.name || transfer.destinationWorkspaceName || 'Destination Workspace';

  const handleDecisionToggle = (userId: string, decision: 'KEEP' | 'REMOVE') => {
    setSharedDecisions((prev) => ({ ...prev, [userId]: decision }));
  };

  const handleConfirmAccept = async () => {
    try {
      setIsSubmitting(true);
      setError(null);

      const payload: ApproveProjectTransferPayload = {
        memberAction,
        sharedMemberDecisions: Object.keys(sharedDecisions).length > 0 ? sharedDecisions : undefined,
        newProjectKey: newProjectKey.trim() ? newProjectKey.trim().toUpperCase() : undefined,
      };

      const res = await projectTransferApi.approveTransfer(transfer.id, payload);

      if (res.success) {
        onSuccess(res.data?.newProjectId);
        onClose();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to complete project transfer');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="ptam-overlay" onClick={onClose}>
      <div className="ptam-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="ptam-header">
          <div>
            <h3 className="ptam-title">Accept Project Transfer</h3>
            <p className="ptam-subtitle">
              Configure member permissions before transferring &ldquo;{projectName}&rdquo; into {destWsName}.
            </p>
          </div>
          <button
            type="button"
            className="ptam-close-btn"
            onClick={onClose}
            aria-label="Close modal"
          >
            <CloseIcon size={18} />
          </button>
        </div>

        <div className="ptam-body">
          {error && (
            <div className="ptam-alert ptam-alert-error">
              <AlertCircleIcon size={16} />
              <span>{error}</span>
            </div>
          )}

          {/* Transfer Summary Badge */}
          <div className="ptam-summary-banner">
            <div className="ptam-summary-project">
              <span className="ptam-project-name">{projectName}</span>
              {projectKey && <span className="ptam-project-key">[{projectKey}]</span>}
            </div>
            <div className="ptam-summary-route">
              Transferred from: <strong>{sourceWsName}</strong> &rarr; <strong>{destWsName}</strong>
            </div>
          </div>

          {/* Project Key Customization (Optional) */}
          <div className="ptam-section">
            <label className="ptam-section-title">
              Project Key (Optional Override)
            </label>
            <p className="ptam-section-desc">
              Current key is <strong>{projectKey || 'None'}</strong>. Leave blank to keep existing key or specify a new unique identifier in {destWsName}.
            </p>
            <input
              type="text"
              className="ptam-input"
              placeholder={projectKey || 'e.g. PRJ'}
              maxLength={10}
              value={newProjectKey}
              onChange={(e) => setNewProjectKey(e.target.value.toUpperCase())}
            />
          </div>

          {/* Section: Shared Members (in both workspaces) */}
          {sharedMembers.length > 0 && (
            <div className="ptam-section">
              <div className="ptam-section-header">
                <ShieldCheckIcon size={16} />
                <span className="ptam-section-title">
                  Shared Members ({sharedMembers.length})
                </span>
              </div>
              <p className="ptam-section-desc">
                These users already belong to <strong>{destWsName}</strong>. Choose whether to retain their project membership:
              </p>

              <div className="ptam-members-list">
                {sharedMembers.map((sm) => {
                  const decision = sharedDecisions[sm.userId] || 'KEEP';
                  return (
                    <div key={sm.userId} className="ptam-member-row">
                      <div className="ptam-member-info">
                        <div className="ptam-member-avatar">
                          {sm.user.fullName?.charAt(0).toUpperCase() || sm.user.username.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="ptam-member-name">
                            {sm.user.fullName || sm.user.username}
                          </div>
                          <div className="ptam-member-role">
                            {sm.destRole} &middot; Previous Project Role: {sm.role === 'PROJECT_ADMIN' ? 'Project Admin' : 'Member'}
                          </div>
                        </div>
                      </div>

                      <div className="ptam-decision-toggle">
                        <button
                          type="button"
                          className={`ptam-toggle-btn ${decision === 'KEEP' ? 'active-keep' : ''}`}
                          onClick={() => handleDecisionToggle(sm.userId, 'KEEP')}
                        >
                          Keep
                        </button>
                        <button
                          type="button"
                          className={`ptam-toggle-btn ${decision === 'REMOVE' ? 'active-remove' : ''}`}
                          onClick={() => handleDecisionToggle(sm.userId, 'REMOVE')}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Section: Previous Members (only in source workspace) */}
          <div className="ptam-section">
            <div className="ptam-section-header">
              <UsersIcon size={16} />
              <span className="ptam-section-title">
                Previous Project Members ({previousMembers.length})
              </span>
            </div>
            <p className="ptam-section-desc">
              {previousMembers.length > 0
                ? `These ${previousMembers.length} users were members in the previous workspace and do not belong to ${destWsName}. Choose how to handle them:`
                : `All project members already belong to ${destWsName}.`}
            </p>

            {previousMembers.length > 0 && (
              <div className="ptam-action-options">
                {/* Option 1: Invite All */}
                <label className={`ptam-action-card ${memberAction === 'INVITE_ALL' ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="memberAction"
                    value="INVITE_ALL"
                    checked={memberAction === 'INVITE_ALL'}
                    onChange={() => setMemberAction('INVITE_ALL')}
                  />
                  <div className="ptam-action-content">
                    <div className="ptam-action-label">
                      <UserPlusIcon size={15} />
                      <strong>Invite All to Workspace</strong>
                    </div>
                    <p className="ptam-action-detail">
                      Send workspace invitations via email to all {previousMembers.length} members so they can join {destWsName} and continue collaborating seamlessly.
                    </p>
                  </div>
                </label>

                {/* Option 2: Decide Later (Recommended) */}
                <label className={`ptam-action-card ${memberAction === 'DECIDE_LATER' ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="memberAction"
                    value="DECIDE_LATER"
                    checked={memberAction === 'DECIDE_LATER'}
                    onChange={() => setMemberAction('DECIDE_LATER')}
                  />
                  <div className="ptam-action-content">
                    <div className="ptam-action-label">
                      <UsersIcon size={15} />
                      <strong>Decide Later (Recommended)</strong>
                      <span className="ptam-badge-recommended">Recommended</span>
                    </div>
                    <p className="ptam-action-detail">
                      Transfer the project now. A review banner will appear on the Project Overview page where you can invite them when ready.
                    </p>
                  </div>
                </label>

                {/* Option 3: Remove Members */}
                <label className={`ptam-action-card ${memberAction === 'REMOVE_ALL' ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="memberAction"
                    value="REMOVE_ALL"
                    checked={memberAction === 'REMOVE_ALL'}
                    onChange={() => setMemberAction('REMOVE_ALL')}
                  />
                  <div className="ptam-action-content">
                    <div className="ptam-action-label">
                      <CloseIcon size={15} />
                      <strong>Remove Members from Project</strong>
                    </div>
                    <p className="ptam-action-detail">
                      Do not invite them. Assigned tasks will retain their avatar and name with a <em>Previous Member</em> tag. Private files will stay safely locked.
                    </p>
                  </div>
                </label>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="ptam-footer">
          <button
            type="button"
            className="ptam-btn-secondary"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="ptam-btn-primary"
            onClick={handleConfirmAccept}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <div className="ptam-spinner" />
                <span>Transferring Project...</span>
              </>
            ) : (
              <>
                <CheckIcon size={15} />
                <span>Confirm &amp; Accept Transfer</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

