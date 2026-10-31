import { Router } from 'express';
import {
  addMember,
  create,
  get,
  list,
  listMembers,
  remove,
  removeMember,
  update,
  updateMember,
} from '../controllers/organization.controller.js';
import { create as createTenant } from '../controllers/tenant.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { requireOrganizationPermission } from '../middleware/role.js';
import { requireOrganization as resolveOrganization } from '../middleware/tenant.js';
import { validate } from '../middleware/validate.js';
import {
  addOrganizationMemberSchema,
  createOrganizationSchema,
  updateMembershipSchema,
  updateOrganizationSchema,
} from '../schemas/organization.js';
import { createTenantSchema } from '../schemas/tenant.js';

const router = Router();

router.use(requireAuth);

router.get('/', list);
router.post('/', validate({ body: createOrganizationSchema }), create);

router.get('/:organizationId', resolveOrganization, get);
router.patch(
  '/:organizationId',
  resolveOrganization,
  requireOrganizationPermission('organization:update'),
  validate({ body: updateOrganizationSchema }),
  update,
);
router.delete(
  '/:organizationId',
  resolveOrganization,
  requireOrganizationPermission('organization:delete'),
  remove,
);

router.get('/:organizationId/members', resolveOrganization, listMembers);
router.post(
  '/:organizationId/members',
  resolveOrganization,
  requireOrganizationPermission('organization:member:manage'),
  validate({ body: addOrganizationMemberSchema }),
  addMember,
);
router.patch(
  '/:organizationId/members/:membershipId',
  resolveOrganization,
  requireOrganizationPermission('organization:member:manage'),
  validate({ body: updateMembershipSchema }),
  updateMember,
);
router.delete(
  '/:organizationId/members/:membershipId',
  resolveOrganization,
  requireOrganizationPermission('organization:member:manage'),
  removeMember,
);

router.post(
  '/:organizationId/tenants',
  resolveOrganization,
  requireOrganizationPermission('tenant:create'),
  validate({ body: createTenantSchema }),
  createTenant,
);

export default router;
