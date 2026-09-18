import { Router } from 'express';
import { invitationController } from '../controllers/invitation.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import { createInvitationSchema } from '../schemas/invitation.schema.js';

// Router for /api/projects/:projectId/invitations
export const projectInvitationRoutes = Router({ mergeParams: true })
  .use(authenticate)
  .post('/', validate(createInvitationSchema), invitationController.createInvitation)
  .get('/', invitationController.getProjectInvitations)
  .post('/:invitationId/resend', invitationController.resendInvitation)
  .post('/:invitationId/cancel', invitationController.cancelInvitation);

// Router for /api/invitations (User perspective)
export const userInvitationRoutes = Router()
  .use(authenticate)
  .get('/', invitationController.getUserInvitations)
  .get('/count', invitationController.getPendingCount)
  .post('/:invitationId/accept', invitationController.acceptInvitation)
  .post('/:invitationId/decline', invitationController.declineInvitation);
