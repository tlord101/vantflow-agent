import { Router } from 'express';
import { getMe, updateUser, createApiKey, getApiKeys, deleteApiKey } from '../controllers/userController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.get('/me', authenticate, getMe);
router.put('/update', authenticate, updateUser);
router.post('/api-key', authenticate, createApiKey);
router.get('/api-keys', authenticate, getApiKeys);
router.delete('/api-key/:id', authenticate, deleteApiKey);

export default router;
