import { Router } from 'express';
import { register, login, logout, getSession } from '../controllers/authController';
import { authenticate } from '../middleware/auth';
import { rateLimitLogin, rateLimitRegister } from '../middleware/rateLimiter';

const router = Router();

router.post('/register', rateLimitRegister, register);
router.post('/login', rateLimitLogin, login);
router.post('/logout', authenticate, logout);
router.get('/session', authenticate, getSession);

export default router;
