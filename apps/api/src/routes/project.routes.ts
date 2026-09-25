import { Router } from 'express';
import { projectController } from '../controllers/project.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import { createProjectSchema, updateProjectSchema } from '../schemas/project.schema.js';
import { workRoutes } from './work.routes.js';
import { activityRoutes } from './activity.routes.js';
import { memberRoutes } from './member.routes.js';
import { projectInvitationRoutes } from './invitation.routes.js';
import noteRoutes from './note.routes.js';
import calendarRoutes from './calendar.routes.js';
import { fileRoutes } from './file.routes.js';
import folderRoutes from './folder.routes.js';
import { folderController } from '../controllers/folder.controller.js';

import { calendarController } from '../controllers/calendar.controller.js';
import { optionalAuthenticate } from '../middlewares/auth.middleware.js';

const router = Router();

// Calendar feed subscription (supports revocable ?token=... without browser session cookie)
router.get('/:projectId/calendar/feed.ics', optionalAuthenticate, (req, res, next) => {
  calendarController.getICalFeed(req as any, res, next);
});

router.use(authenticate);

// Nested subroutes for work items, activities, members, invitations, notes, calendar, files, and folders
router.use('/:projectId/work', workRoutes);
router.use('/:projectId/activity', activityRoutes);
router.use('/:projectId/members', memberRoutes);
router.use('/:projectId/invitations', projectInvitationRoutes);
router.use('/:projectId/notes', noteRoutes);
router.use('/:projectId/calendar', calendarRoutes);
router.use('/:projectId/files', fileRoutes);
router.use('/:projectId/folders', folderRoutes);
router.patch('/:projectId/files/:fileId/move', (req, res, next) => {
  folderController.moveFile(req as any, res, next);
});

router.post('/', validate(createProjectSchema), projectController.createProject);
router.get('/', projectController.getUserProjects);
router.get('/:projectId', projectController.getProjectById);
router.patch('/:projectId', validate(updateProjectSchema), projectController.updateProject);
router.post('/:projectId/archive', projectController.archiveProject);
router.post('/:projectId/unarchive', projectController.unarchiveProject);
router.post('/:projectId/transfer-ownership', projectController.transferOwnership);
router.delete('/:projectId', projectController.deleteProject);

export const projectRoutes = router;


