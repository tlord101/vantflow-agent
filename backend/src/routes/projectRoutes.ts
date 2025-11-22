import { Router } from 'express';
import {
  createProject,
  listProjects,
  getProject,
  updateProject,
  deleteProject,
} from '../controllers/projectController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.post('/create', authenticate, createProject);
router.get('/list', authenticate, listProjects);
router.get('/:id', authenticate, getProject);
router.put('/:id/update', authenticate, updateProject);
router.delete('/:id/delete', authenticate, deleteProject);

export default router;
