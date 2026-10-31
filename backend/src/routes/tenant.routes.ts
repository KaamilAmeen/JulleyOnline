import { Router } from 'express';
import {
  addMember,
  get,
  list,
  listMembers,
  listPeople,
  remove,
  removeMember,
  update,
  updateMember,
} from '../controllers/tenant.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/role.js';
import { requireTenant } from '../middleware/tenant.js';
import { validate } from '../middleware/validate.js';
import {
  addTenantMemberSchema,
  updateTenantMembershipSchema,
  updateTenantSchema,
} from '../schemas/tenant.js';

const router = Router();

router.use(requireAuth);

router.get('/', list);
router.get('/:tenantId', get);

router.patch(
  '/:tenantId',
  requireTenant,
  requirePermission('tenant:update'),
  validate({ body: updateTenantSchema }),
  update,
);
router.delete('/:tenantId', requireTenant, requirePermission('tenant:delete'), remove);

router.get('/:tenantId/members', requireTenant, requirePermission('tenant:member:manage'), listMembers);
router.get('/:tenantId/people', requireTenant, requirePermission('activity:read'), listPeople);
router.post(
  '/:tenantId/members',
  requireTenant,
  requirePermission('tenant:member:manage'),
  validate({ body: addTenantMemberSchema }),
  addMember,
);
router.patch(
  '/:tenantId/members/:membershipId',
  requireTenant,
  requirePermission('tenant:member:manage'),
  validate({ body: updateTenantMembershipSchema }),
  updateMember,
);
router.delete(
  '/:tenantId/members/:membershipId',
  requireTenant,
  requirePermission('tenant:member:manage'),
  removeMember,
);

export default router;
