import { Router } from 'express';
import { memberController } from '../controllers/member.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import { updateMemberRoleSchema } from '../schemas/member.schema.js';

const router = Router({ mergeParams: true });

router.use(authenticate);

router.get('/', memberController.getProjectMembers);
router.patch('/:memberId', validate(updateMemberRoleSchema), memberController.updateMemberRole);
router.delete('/:memberId', memberController.removeMember);

export const memberRoutes = router;
