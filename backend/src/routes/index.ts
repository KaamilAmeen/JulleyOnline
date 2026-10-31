import { Router } from 'express';
import { presence } from '../controllers/activity.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/role.js';
import { requireTenant } from '../middleware/tenant.js';
import activityRoutes from './activity.routes.js';
import aiRoutes from './ai.routes.js';
import authRoutes from './auth.routes.js';
import boardRoutes from './board.routes.js';
import columnRoutes from './column.routes.js';
import organizationRoutes from './organization.routes.js';
import taskRoutes from './task.routes.js';
import tenantRoutes from './tenant.routes.js';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({
    data: {
      status: 'ok',
      service: 'kanban-api',
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    },
  });
});

router.use('/auth', authRoutes);
router.use('/organizations', organizationRoutes);
router.use('/tenants', tenantRoutes);
router.use('/boards', boardRoutes);
router.use('/columns', columnRoutes);
router.use('/tasks', taskRoutes);
router.use('/activity', activityRoutes);
router.use('/ai', aiRoutes);

router.get('/presence', requireAuth, requireTenant, requirePermission('activity:read'), presence);

export default router;
