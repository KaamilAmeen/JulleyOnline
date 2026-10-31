import type { Request, Response } from 'express';
import {
  addTenantMember,
  createTenant,
  deleteTenant,
  getTenantForUser,
  listTenantMembers,
  listTenantPeople,
  listTenantsForUser,
  removeTenantMember,
  updateTenant,
  updateTenantMember,
} from '../services/tenant.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { noContent, ok } from '../utils/http.js';

export const list = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = typeof req.query.organizationId === 'string' ? req.query.organizationId : undefined;
  ok(res, await listTenantsForUser(req.user!.id, organizationId));
});

export const get = asyncHandler(async (req: Request, res: Response) => {
  ok(res, await getTenantForUser(req.params.tenantId as string, req.user!.id));
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  ok(
    res,
    await createTenant(req.organization!.id, req.body.name, req.user!.id),
    201,
  );
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  ok(
    res,
    await updateTenant(
      req.tenant!.id,
      req.tenant!.organizationId,
      req.body.name,
      req.user!.id,
    ),
  );
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  await deleteTenant(req.tenant!.id);
  noContent(res);
});

export const listMembers = asyncHandler(async (req: Request, res: Response) => {
  ok(res, await listTenantMembers(req.tenant!.id));
});

export const listPeople = asyncHandler(async (req: Request, res: Response) => {
  ok(res, await listTenantPeople(req.tenant!.id, req.tenant!.organizationId));
});

export const addMember = asyncHandler(async (req: Request, res: Response) => {
  ok(
    res,
    await addTenantMember(
      req.tenant!.id,
      req.tenant!.organizationId,
      req.body,
      req.user!.id,
    ),
    201,
  );
});

export const updateMember = asyncHandler(async (req: Request, res: Response) => {
  ok(
    res,
    await updateTenantMember(
      req.tenant!.id,
      req.tenant!.organizationId,
      req.params.membershipId as string,
      req.body.role,
      req.user!.id,
    ),
  );
});

export const removeMember = asyncHandler(async (req: Request, res: Response) => {
  await removeTenantMember(
    req.tenant!.id,
    req.tenant!.organizationId,
    req.params.membershipId as string,
    req.user!.id,
  );
  noContent(res);
});
