import { Router } from 'express';
import { login, logout, me, refresh, register, updateMe } from '../controllers/auth.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { authRateLimiter } from '../middleware/rateLimit.js';
import { validate } from '../middleware/validate.js';
import { loginSchema, registerSchema, updateProfileSchema } from '../schemas/auth.js';

const router = Router();

router.post('/register', authRateLimiter, validate({ body: registerSchema }), register);
router.post('/login', authRateLimiter, validate({ body: loginSchema }), login);
router.post('/refresh', refresh);
router.post('/logout', logout);
router.get('/me', requireAuth, me);
router.patch('/me', requireAuth, validate({ body: updateProfileSchema }), updateMe);

export default router;
