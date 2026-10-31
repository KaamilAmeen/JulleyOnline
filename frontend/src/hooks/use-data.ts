"use client";

import { useQuery } from "@tanstack/react-query";
import { api, tenantHeaders } from "@/lib/api";
import type {
  Activity,
  Board,
  BoardSummary,
  TenantPerson,
} from "@/lib/types";

export function useBoards(tenantId: string | null) {
  return useQuery({
    queryKey: ["boards", tenantId],
    enabled: Boolean(tenantId),
    queryFn: async () => {
      const response = await api.get("/boards", tenantHeaders(tenantId!));
      return response.data.data as BoardSummary[];
    },
  });
}

export function useBoard(tenantId: string | null, boardId: string | null) {
  return useQuery({
    queryKey: ["board", tenantId, boardId],
    enabled: Boolean(tenantId && boardId),
    queryFn: async () => {
      const response = await api.get(`/boards/${boardId}`, tenantHeaders(tenantId!));
      return response.data.data as Board;
    },
  });
}

export function usePeople(tenantId: string | null) {
  return useQuery({
    queryKey: ["people", tenantId],
    enabled: Boolean(tenantId),
    staleTime: 60_000,
    queryFn: async () => {
      const response = await api.get(`/tenants/${tenantId}/people`, tenantHeaders(tenantId!));
      return response.data.data as TenantPerson[];
    },
  });
}

export interface TenantMember {
  id: string;
  role: "ORG_ADMIN" | "TENANT_ADMIN" | "MEMBER";
  tenantId: string | null;
  createdAt: string;
  user: { id: string; name: string; email: string; avatarColor: string };
}

export function useTenantMembers(tenantId: string | null) {
  return useQuery({
    queryKey: ["tenant-members", tenantId],
    enabled: Boolean(tenantId),
    queryFn: async () => {
      const response = await api.get(`/tenants/${tenantId}/members`, tenantHeaders(tenantId!));
      return response.data.data as TenantMember[];
    },
  });
}

export function useActivity(
  tenantId: string | null,
  filters: { entityType?: string; boardId?: string; limit?: number } = {},
) {
  return useQuery({
    queryKey: ["activity", tenantId, filters],
    enabled: Boolean(tenantId),
    queryFn: async () => {
      const response = await api.get("/activity", {
        ...tenantHeaders(tenantId!),
        params: {
          limit: filters.limit ?? 50,
          ...(filters.entityType ? { entityType: filters.entityType } : {}),
          ...(filters.boardId ? { boardId: filters.boardId } : {}),
        },
      });
      return response.data.data as Activity[];
    },
  });
}

export function useTaskActivity(tenantId: string | null, taskId: string | null) {
  return useQuery({
    queryKey: ["task-activity", tenantId, taskId],
    enabled: Boolean(tenantId && taskId),
    queryFn: async () => {
      const response = await api.get(`/tasks/${taskId}/activity`, {
        ...tenantHeaders(tenantId!),
        params: { limit: 20 },
      });
      return response.data.data as Activity[];
    },
  });
}

export interface OrgMember {
  id: string;
  role: "ORG_ADMIN" | "TENANT_ADMIN" | "MEMBER";
  tenantId: string | null;
  createdAt: string;
  user: { id: string; name: string; email: string; avatarColor: string };
  tenant: { id: string; name: string } | null;
}

export function useOrgMembers(organizationId: string | null) {
  return useQuery({
    queryKey: ["org-members", organizationId],
    enabled: Boolean(organizationId),
    queryFn: async () => {
      const response = await api.get(`/organizations/${organizationId}/members`);
      return response.data.data as OrgMember[];
    },
  });
}
