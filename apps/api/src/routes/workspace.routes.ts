import { Router } from 'express';
import { workspaceController } from '../controllers/workspace.controller.js';
import { projectTransferController } from '../controllers/projectTransfer.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { validateBody } from '../middlewares/validate.middleware.js';
import { createWorkspaceSchema } from '../schemas/workspace.schema.js';

const router = Router();

router.use(authenticate);

// ===========================================================================
// Recipient-level Invitation Endpoints (must come before /:workspaceId)
// ===========================================================================

// List pending invitations for authenticated user
router.get('/invitations/pending', (req, res, next) =>
  workspaceController.getUserPendingInvitations(req, res, next)
);

// Accept invitation by ID or Token (via body or param)
router.post('/invitations/accept', (req, res, next) =>
  workspaceController.acceptInvitation(req, res, next)
);
router.post('/invitations/:invitationIdOrToken/accept', (req, res, next) =>
  workspaceController.acceptInvitation(req, res, next)
);

// Decline invitation by ID or Token (via body or param)
router.post('/invitations/decline', (req, res, next) =>
  workspaceController.declineInvitation(req, res, next)
);
router.post('/invitations/:invitationIdOrToken/decline', (req, res, next) =>
  workspaceController.declineInvitation(req, res, next)
);

// ===========================================================================
// General Workspace Endpoints
// ===========================================================================

// List current user's workspaces categorized into owned and joined
router.get('/', (req, res, next) => workspaceController.getUserWorkspaces(req, res, next));

// List recoverable soft-deleted workspaces owned by authenticated user
router.get('/deleted', (req, res, next) => workspaceController.getDeletedWorkspaces(req, res, next));

// Create a new team workspace
router.post('/', validateBody(createWorkspaceSchema), (req, res, next) =>
  workspaceController.createWorkspace(req, res, next)
);

// Get workspace details by ID
router.get('/:workspaceId', (req, res, next) =>
  workspaceController.getWorkspaceById(req, res, next)
);

// Update workspace settings and member limit (Owner only)
router.patch('/:workspaceId', (req, res, next) =>
  workspaceController.updateWorkspace(req, res, next)
);

// ===========================================================================
// Workspace Member Management Endpoints
// ===========================================================================

// List workspace members
router.get('/:workspaceId/members', (req, res, next) =>
  workspaceController.getWorkspaceMembers(req, res, next)
);

// Update member role (Owner or Admin with canManageRoles)
router.patch('/:workspaceId/members/:memberId', (req, res, next) =>
  workspaceController.updateMemberRole(req, res, next)
);

// Remove member from workspace (Owner or Admin with canRemoveMembers)
router.delete('/:workspaceId/members/:memberId', (req, res, next) =>
  workspaceController.removeMember(req, res, next)
);

// ===========================================================================
// Workspace Invitation Management Endpoints
// ===========================================================================

// Create/send workspace invitation
router.post('/:workspaceId/invitations', (req, res, next) =>
  workspaceController.createInvitation(req, res, next)
);

// List workspace invitations
router.get('/:workspaceId/invitations', (req, res, next) =>
  workspaceController.getWorkspaceInvitations(req, res, next)
);

// Resend workspace invitation
router.post('/:workspaceId/invitations/:invitationId/resend', (req, res, next) =>
  workspaceController.resendInvitation(req, res, next)
);

// Revoke workspace invitation
router.delete('/:workspaceId/invitations/:invitationId', (req, res, next) =>
  workspaceController.revokeInvitation(req, res, next)
);

// ===========================================================================
// Workspace Admin Permissions Endpoints
// ===========================================================================

// Get admin permissions
router.get('/:workspaceId/admin-permissions', (req, res, next) =>
  workspaceController.getAdminPermissions(req, res, next)
);

// Update admin permissions (Owner only)
router.patch('/:workspaceId/admin-permissions', (req, res, next) =>
  workspaceController.updateAdminPermissions(req, res, next)
);

// ===========================================================================
// Workspace Project Transfer Endpoints (Phase 4)
// ===========================================================================

// Get incoming and outgoing pending project transfers for workspace
router.get('/:workspaceId/transfers/pending', (req, res, next) =>
  projectTransferController.getWorkspacePendingTransfers(req as any, res, next)
);

// ===========================================================================
// Workspace Ownership Transfer Endpoints (Phase 5A)
// ===========================================================================

router.post('/:workspaceId/ownership-transfer/request', (req, res, next) =>
  workspaceController.requestOwnershipTransfer(req, res, next)
);

router.get('/:workspaceId/ownership-transfer', (req, res, next) =>
  workspaceController.getPendingOwnershipTransfer(req, res, next)
);

router.post('/:workspaceId/ownership-transfer/cancel', (req, res, next) =>
  workspaceController.cancelOwnershipTransfer(req, res, next)
);

router.post('/:workspaceId/ownership-transfer/reject', (req, res, next) =>
  workspaceController.rejectOwnershipTransfer(req, res, next)
);

router.post('/:workspaceId/ownership-transfer/accept', (req, res, next) =>
  workspaceController.acceptOwnershipTransfer(req, res, next)
);

// ===========================================================================
// Workspace Soft Deletion & Recovery Endpoints (Phase 5B)
// ===========================================================================

router.post('/:workspaceId/delete', (req, res, next) =>
  workspaceController.deleteWorkspace(req, res, next)
);

router.delete('/:workspaceId', (req, res, next) =>
  workspaceController.deleteWorkspace(req, res, next)
);

router.post('/:workspaceId/recover', (req, res, next) =>
  workspaceController.recoverWorkspace(req, res, next)
);

// ===========================================================================
// Workspace Audit Trail Endpoint (Phase 5C)
// ===========================================================================

router.get('/:workspaceId/audit-logs', (req, res, next) =>
  workspaceController.getWorkspaceAuditLogs(req, res, next)
);

export default router;
