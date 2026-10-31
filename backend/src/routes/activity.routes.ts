import { Router } from 'express';
import { list } from '../controllers/activity.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/role.js';
import { requireTenant } from '../middleware/tenant.js';
import { validate } from '../middleware/validate.js';
import { activityQuerySchema } from '../schemas/activity.js';

const router = Router();

router.get(
  '/',
  requireAuth,
  requireTenant,
  requirePermission('activity:read'),
  validate({ query: activityQuerySchema }),
  list,
);

export default router;
