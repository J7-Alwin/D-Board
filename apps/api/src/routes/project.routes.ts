import { Router } from 'express';
import prisma from '../prisma.js';
import { projectController } from '../controllers/project.controller.js';
import { projectTransferController } from '../controllers/projectTransfer.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { resolveWorkspaceContext } from '../middlewares/workspace.middleware.js';
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
router.use(resolveWorkspaceContext);

// Project-workspace boundary enforcement: Ensure project exists and belongs to active workspace
router.param('projectId', async (req, res, next, projectId) => {
  try {
    if (!projectId || typeof projectId !== 'string') {
      return res.status(400).json({ success: false, message: 'Invalid project ID' });
    }
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        workspaceId: true,
        status: true,
        workspace: { select: { deletedAt: true } },
      },
    });
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }
    if (project.workspace?.deletedAt && !req.originalUrl.includes('/transfer')) {
      return res.status(404).json({ success: false, message: 'The workspace containing this project has been deleted' });
    }
    const explicitWorkspaceId =
      (req.headers['x-workspace-id'] as string) ||
      (req.query.workspaceId as string) ||
      (req.body?.workspaceId as string);

    if (explicitWorkspaceId && explicitWorkspaceId.trim()) {
      if (project.workspaceId !== explicitWorkspaceId.trim()) {
        return res.status(404).json({ success: false, message: 'Project not found in the active workspace' });
      }
    } else {
      (req as any).workspaceId = project.workspaceId;
    }
    (req as any).project = project;
    next();
  } catch (err) {
    next(err);
  }
});

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
router.post('/:projectId/complete', (req, res, next) => projectController.completeProject(req, res, next));
router.post('/:projectId/reactivate', (req, res, next) => projectController.reactivateProject(req, res, next));
router.get('/:projectId/completion-status', (req, res, next) => projectController.getCompletionStatus(req, res, next));
router.post('/:projectId/transfer-ownership', projectController.transferOwnership);

// Project Transfer between workspaces (Phase 4)
router.get('/:projectId/transfer-eligibility', (req, res, next) =>
  projectTransferController.getTransferEligibility(req as any, res, next)
);
router.post('/:projectId/transfer', (req, res, next) =>
  projectTransferController.requestTransfer(req as any, res, next)
);
router.get('/:projectId/transfers', (req, res, next) =>
  projectTransferController.getProjectTransfers(req as any, res, next)
);

router.delete('/:projectId', projectController.deleteProject);

export const projectRoutes = router;


