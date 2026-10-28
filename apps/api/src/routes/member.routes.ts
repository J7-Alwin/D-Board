import { Router } from 'express';
import { memberController } from '../controllers/member.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import { updateMemberRoleSchema, executeHandoverSchema, addMemberSchema } from '../schemas/member.schema.js';

const router = Router({ mergeParams: true });

router.use(authenticate);

router.get('/', memberController.getProjectMembers);
router.post('/', validate(addMemberSchema), memberController.addMember);
router.get('/:memberId/handover-summary', memberController.getHandoverSummary);
router.post('/:memberId/handover', validate(executeHandoverSchema), memberController.executeHandover);
router.patch('/:memberId', validate(updateMemberRoleSchema), memberController.updateMemberRole);
router.delete('/:memberId', memberController.removeMember);

export const memberRoutes = router;
