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

const router = Router();

router.use(authenticate);

// Nested subroutes for work items, activities, members, invitations, notes, calendar, and files
router.use('/:projectId/work', workRoutes);
router.use('/:projectId/activity', activityRoutes);
router.use('/:projectId/members', memberRoutes);
router.use('/:projectId/invitations', projectInvitationRoutes);
router.use('/:projectId/notes', noteRoutes);
router.use('/:projectId/calendar', calendarRoutes);
router.use('/:projectId/files', fileRoutes);

router.post('/', validate(createProjectSchema), projectController.createProject);
router.get('/', projectController.getUserProjects);
router.get('/:projectId', projectController.getProjectById);
router.patch('/:projectId', validate(updateProjectSchema), projectController.updateProject);
router.delete('/:projectId', projectController.deleteProject);

export const projectRoutes = router;


