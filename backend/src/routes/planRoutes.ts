import { Router } from 'express';
import { planController } from '../controllers/planController';
import { authenticate } from '../middleware/auth';
import { requireProjectAccess, requirePlanModify } from '../middleware/permissions';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Project plans
router.get('/projects/:projectId/plans', requireProjectAccess('viewer'), planController.getProjectPlans);
router.post('/projects/:projectId/plans', requireProjectAccess('collaborator'), planController.createPlan);

// Individual plan operations
router.get('/plans/:id', planController.getPlan);
router.put('/plans/:id', requirePlanModify(), planController.updatePlan);
router.delete('/plans/:id', requirePlanModify(), planController.deletePlan);
router.post('/plans/:id/approve', requirePlanModify(), planController.approvePlan);
router.post('/plans/:id/run', planController.runPlan);

export default router;
