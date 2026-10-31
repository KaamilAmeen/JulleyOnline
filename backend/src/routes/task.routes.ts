import { Router } from 'express';
import {
  activity,
  create,
  get,
  list,
  move,
  remove,
  update,
} from '../controllers/task.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/role.js';
import { requireTenant } from '../middleware/tenant.js';
import { validate } from '../middleware/validate.js';
import { idParamsSchema } from '../schemas/common.js';
import {
  createTaskSchema,
  moveTaskSchema,
  taskQuerySchema,
  updateTaskSchema,
} from '../schemas/task.js';

const router = Router();

router.use(requireAuth, requireTenant);

router.get('/', requirePermission('activity:read'), validate({ query: taskQuerySchema }), list);
router.post('/', requirePermission('task:create'), validate({ body: createTaskSchema }), create);

router.get('/:id', validate({ params: idParamsSchema }), get);
router.get(
  '/:id/activity',
  requirePermission('activity:read'),
  validate({ params: idParamsSchema }),
  activity,
);
router.patch(
  '/:id/move',
  requirePermission('task:move'),
  validate({ params: idParamsSchema, body: moveTaskSchema }),
  move,
);
router.patch(
  '/:id',
  requirePermission('task:update'),
  validate({ params: idParamsSchema, body: updateTaskSchema }),
  update,
);
router.delete(
  '/:id',
  requirePermission('task:delete'),
  validate({ params: idParamsSchema }),
  remove,
);

export default router;
