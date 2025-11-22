import { Router } from 'express';
import { chatController } from '../controllers/chatController';
import { authenticate } from '../middleware/auth';
import { rateLimitGeneral } from '../middleware/rateLimiter';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Chat operations
router.get('/projects/:projectId/chat', chatController.getChatHistory);
router.post('/projects/:projectId/chat', rateLimitGeneral, chatController.sendMessage);
router.delete('/projects/:projectId/chat', chatController.clearHistory);

export default router;
