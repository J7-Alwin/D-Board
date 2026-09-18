import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware.js';
import * as userController from '../controllers/user.controller.js';

const router = Router();

// All user routes require authentication
router.use(authenticate);

router.get('/profile', userController.getProfileHandler);
router.put('/profile', userController.updateProfileHandler);
router.put('/password', userController.changePasswordHandler);
router.put('/notifications', userController.updateNotificationPreferencesHandler);
router.get('/export-data', userController.exportDataHandler);
router.delete('/account', userController.deleteAccountHandler);

export default router;
