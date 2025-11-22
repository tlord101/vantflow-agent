import { Router } from 'express';
import { chat, run, getExecutionStatus } from '../controllers/agentController';
import { authenticate } from '../middleware/auth';
import { rateLimitChat } from '../middleware/rateLimiter';

const router = Router();

router.post('/chat', authenticate, rateLimitChat, chat);
router.post('/run', authenticate, run);
router.get('/execution/:executionId', authenticate, getExecutionStatus);

export default router;
