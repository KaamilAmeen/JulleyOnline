import type { Request, Response } from 'express';
import {
  addOrganizationMember,
  createOrganization,
  deleteOrganization,
  getOrganizationForUser,
  listOrganizationMembers,
  listOrganizationsForUser,
  removeOrganizationMember,
  updateOrganization,
  updateOrganizationMember,
} from '../services/organization.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { noContent, ok } from '../utils/http.js';

export const list = asyncHandler(async (req: Request, res: Response) => {
  ok(res, await listOrganizationsForUser(req.user!.id));
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  ok(res, await createOrganization(req.user!.id, req.body.name), 201);
});

export const get = asyncHandler(async (req: Request, res: Response) => {
  ok(res, await getOrganizationForUser(req.organization!.id, req.user!.id));
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  ok(res, await updateOrganization(req.organization!.id, req.body.name));
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  await deleteOrganization(req.organization!.id);
  noContent(res);
});

export const listMembers = asyncHandler(async (req: Request, res: Response) => {
  ok(res, await listOrganizationMembers(req.organization!.id));
});

export const addMember = asyncHandler(async (req: Request, res: Response) => {
  ok(
    res,
    await addOrganizationMember(req.organization!.id, req.body, req.user!.id),
    201,
  );
});

export const updateMember = asyncHandler(async (req: Request, res: Response) => {
  ok(
    res,
    await updateOrganizationMember(
      req.organization!.id,
      req.params.membershipId as string,
      req.body.role,
      req.user!.id,
    ),
  );
});

export const removeMember = asyncHandler(async (req: Request, res: Response) => {
  await removeOrganizationMember(req.organization!.id, req.params.membershipId as string, req.user!.id);
  noContent(res);
});
