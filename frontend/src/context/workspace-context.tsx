"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import type { Organization, Role, TenantSummary } from "@/lib/types";
import { useAuth } from "./auth-context";

interface WorkspaceContextValue {
  organizations: Organization[];
  loading: boolean;
  selectedOrg: Organization | null;
  selectedTenant: TenantSummary | null;
  selectedOrgId: string | null;
  selectedTenantId: string | null;
  selectOrg: (organizationId: string) => void;
  selectTenant: (tenantId: string) => void;
  selectWorkspace: (organizationId: string, tenantId: string | null) => void;
  reload: () => Promise<void>;
  roleForTenant: (tenantId: string) => Role;
  canManageTenant: (tenantId: string) => boolean;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

const storageKey = (userId: string) => `kanban.workspace.${userId}`;

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const { user, memberships } = useAuth();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const response = await api.get("/organizations");
      const next = response.data.data as Organization[];
      setOrganizations(next);
      setSelectedOrgId((current) => {
        if (current && next.some((organization) => organization.id === current)) return current;
        return next[0]?.id ?? null;
      });
      setSelectedTenantId((current) => {
        if (current) {
          const owner = next.find((organization) =>
            organization.tenants.some((tenant) => tenant.id === current),
          );
          if (owner) return current;
        }
        return next[0]?.tenants[0]?.id ?? null;
      });
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      setOrganizations([]);
      setSelectedOrgId(null);
      setSelectedTenantId(null);
      return;
    }

    let cancelled = false;
    const stored = localStorage.getItem(storageKey(user.id));
    const preferred = stored ? (JSON.parse(stored) as { orgId?: string; tenantId?: string }) : null;

    setLoading(true);
    api
      .get("/organizations")
      .then((response) => {
        if (cancelled) return;
        const next = response.data.data as Organization[];
        setOrganizations(next);

        const organization =
          next.find((item) => item.id === preferred?.orgId) ?? next[0] ?? null;
        const tenant =
          organization?.tenants.find((item) => item.id === preferred?.tenantId) ??
          organization?.tenants[0] ??
          null;

        setSelectedOrgId(organization?.id ?? null);
        setSelectedTenantId(tenant?.id ?? null);
      })
      .catch(() => {
        if (!cancelled) setOrganizations([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (!user || !selectedOrgId) return;
    localStorage.setItem(
      storageKey(user.id),
      JSON.stringify({ orgId: selectedOrgId, tenantId: selectedTenantId }),
    );
  }, [user, selectedOrgId, selectedTenantId]);

  const selectedOrg = useMemo(
    () => organizations.find((organization) => organization.id === selectedOrgId) ?? null,
    [organizations, selectedOrgId],
  );

  const selectedTenant = useMemo(
    () => selectedOrg?.tenants.find((tenant) => tenant.id === selectedTenantId) ?? null,
    [selectedOrg, selectedTenantId],
  );

  const selectOrg = useCallback(
    (organizationId: string) => {
      const organization = organizations.find((item) => item.id === organizationId);
      if (!organization) return;
      setSelectedOrgId(organizationId);
      setSelectedTenantId((current) =>
        organization.tenants.some((tenant) => tenant.id === current)
          ? current
          : organization.tenants[0]?.id ?? null,
      );
    },
    [organizations],
  );

  const selectTenant = useCallback((tenantId: string) => {
    setSelectedTenantId(tenantId);
  }, []);

  const selectWorkspace = useCallback((organizationId: string, tenantId: string | null) => {
    setSelectedOrgId(organizationId);
    setSelectedTenantId(tenantId);
  }, []);

  const roleForTenant = useCallback(
    (tenantId: string): Role => {
      if (selectedOrg?.role === "ORG_ADMIN") return "ORG_ADMIN";
      const membership = memberships.find((item) => item.tenantId === tenantId);
      return membership?.role ?? "MEMBER";
    },
    [memberships, selectedOrg],
  );

  const canManageTenant = useCallback(
    (tenantId: string) => roleForTenant(tenantId) !== "MEMBER",
    [roleForTenant],
  );

  const value = useMemo(
    () => ({
      organizations,
      loading,
      selectedOrg,
      selectedTenant,
      selectedOrgId,
      selectedTenantId,
      selectOrg,
      selectTenant,
      selectWorkspace,
      reload,
      roleForTenant,
      canManageTenant,
    }),
    [
      organizations,
      loading,
      selectedOrg,
      selectedTenant,
      selectedOrgId,
      selectedTenantId,
      selectOrg,
      selectTenant,
      selectWorkspace,
      reload,
      roleForTenant,
      canManageTenant,
    ],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error("useWorkspace must be used inside WorkspaceProvider");
  return context;
}
