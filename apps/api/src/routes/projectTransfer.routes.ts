import { Router } from 'express';
import { projectTransferController } from '../controllers/projectTransfer.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';

const router = Router();

router.use(authenticate);

// List user's pending transfers across all workspaces where they are owner/admin
router.get('/pending', (req, res, next) =>
  projectTransferController.getUserPendingTransfers(req as any, res, next)
);

// View details of a transfer request (workspace boundary enforced)
router.get('/:transferId', (req, res, next) =>
  projectTransferController.getTransferDetails(req as any, res, next)
);

// Approve a cross-owner transfer request (destination workspace authority required)
router.post('/:transferId/approve', (req, res, next) =>
  projectTransferController.approveTransfer(req as any, res, next)
);

// Reject a cross-owner transfer request (destination workspace authority required)
router.post('/:transferId/reject', (req, res, next) =>
  projectTransferController.rejectTransfer(req as any, res, next)
);

// Cancel a pending transfer request (initiator or source workspace authority required)
router.post('/:transferId/cancel', (req, res, next) =>
  projectTransferController.cancelTransfer(req as any, res, next)
);

export const projectTransferRoutes = router;
