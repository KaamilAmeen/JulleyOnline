import { Router } from 'express';
import { query } from '../controllers/ai.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/role.js';
import { requireTenant } from '../middleware/tenant.js';
import { validate } from '../middleware/validate.js';
import { aiQuerySchema } from '../schemas/activity.js';

const router = Router();

router.post(
  '/assistant',
  requireAuth,
  requireTenant,
  requirePermission('activity:read'),
  validate({ body: aiQuerySchema }),
  query,
);

export default router;
