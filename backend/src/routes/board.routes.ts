import { Router } from 'express';
import { create as createColumn, listForBoard } from '../controllers/column.controller.js';
import {
  create,
  get,
  list,
  remove,
  update,
} from '../controllers/board.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/role.js';
import { requireTenant } from '../middleware/tenant.js';
import { validate } from '../middleware/validate.js';
import { createBoardSchema, createColumnSchema, updateBoardSchema } from '../schemas/board.js';
import { idParamsSchema } from '../schemas/common.js';

const router = Router();

router.use(requireAuth, requireTenant);

router.get('/', list);
router.post('/', requirePermission('board:create'), validate({ body: createBoardSchema }), create);

router.get('/:id', validate({ params: idParamsSchema }), get);
router.patch(
  '/:id',
  requirePermission('board:update'),
  validate({ params: idParamsSchema, body: updateBoardSchema }),
  update,
);
router.delete('/:id', requirePermission('board:delete'), validate({ params: idParamsSchema }), remove);

router.get('/:id/columns', validate({ params: idParamsSchema }), listForBoard);
router.post(
  '/:id/columns',
  requirePermission('column:manage'),
  validate({ params: idParamsSchema, body: createColumnSchema }),
  createColumn,
);

export default router;
