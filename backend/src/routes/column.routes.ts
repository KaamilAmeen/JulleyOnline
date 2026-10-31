import { Router } from 'express';
import { remove, reorder, update } from '../controllers/column.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/role.js';
import { requireTenant } from '../middleware/tenant.js';
import { validate } from '../middleware/validate.js';
import { reorderColumnsSchema, updateColumnSchema } from '../schemas/board.js';
import { idParamsSchema } from '../schemas/common.js';

const router = Router();

router.use(requireAuth, requireTenant, requirePermission('column:manage'));

router.post('/reorder', validate({ body: reorderColumnsSchema }), reorder);
router.patch('/:id', validate({ params: idParamsSchema, body: updateColumnSchema }), update);
router.delete('/:id', validate({ params: idParamsSchema }), remove);

export default router;
