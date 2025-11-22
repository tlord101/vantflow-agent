import { Router } from 'express';
import { runController } from '../controllers/runController';
import { authenticate } from '../middleware/auth';
import { requireProjectAccess } from '../middleware/permissions';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Project runs
router.get('/projects/:projectId/runs', requireProjectAccess('viewer'), runController.getProjectRuns);
router.get('/projects/:projectId/runs/stats', requireProjectAccess('viewer'), runController.getRunStats);

// Plan execution (handled via plan routes now)
// router.post('/plans/:planId/run', runController.startRun);

// Individual run operations
router.get('/runs/:id', runController.getRun);
router.get('/runs/:id/logs', runController.getRunLogs);
router.post('/runs/:id/cancel', runController.cancelRun);

export default router;
