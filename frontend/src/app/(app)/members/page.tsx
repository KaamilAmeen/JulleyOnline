"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  GitBranch,
  Mail,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/auth-context";
import { useWorkspace } from "@/context/workspace-context";
import { useOrgMembers, usePeople, useTenantMembers, type OrgMember, type TenantMember } from "@/hooks/use-data";
import { api, apiErrorMessage, tenantHeaders } from "@/lib/api";
import { formatDate, ROLE_LABEL } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, LoadingBlock, PageHeader } from "@/components/ui/feedback";
import { Field, Input, Select } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";

const ROLE_TONE = {
  ORG_ADMIN: "accent",
  TENANT_ADMIN: "success",
  MEMBER: "muted",
} as const;

export default function MembersPage() {
  const { user } = useAuth();
  const { selectedOrg, selectedTenant, canManageTenant } = useWorkspace();
  const queryClient = useQueryClient();
  const tenantId = selectedTenant?.id ?? null;
  const canManage = selectedTenant ? canManageTenant(selectedTenant.id) : false;

  const membersQuery = useTenantMembers(canManage ? tenantId : null);
  const peopleQuery = usePeople(tenantId);
  const orgMembersQuery = useOrgMembers(selectedOrg?.role === "ORG_ADMIN" ? selectedOrg.id : null);

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"TENANT_ADMIN" | "MEMBER">("MEMBER");
  const [inviting, setInviting] = useState(false);
  const [removing, setRemoving] = useState<TenantMember | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["tenant-members", tenantId] });
    void queryClient.invalidateQueries({ queryKey: ["people", tenantId] });
    void queryClient.invalidateQueries({ queryKey: ["org-members", selectedOrg?.id] });
    void queryClient.invalidateQueries({ queryKey: ["organizations"] });
  }

  async function invite(event: React.FormEvent) {
    event.preventDefault();
    if (!tenantId || !email.trim()) return;
    setInviting(true);
    try {
      await api.post(
        `/tenants/${tenantId}/members`,
        { email: email.trim().toLowerCase(), role },
        tenantHeaders(tenantId),
      );
      toast.success("Member added to this branch");
      setEmail("");
      refresh();
    } catch (caught) {
      toast.error(apiErrorMessage(caught));
    } finally {
      setInviting(false);
    }
  }

  async function changeRole(member: TenantMember, nextRole: "TENANT_ADMIN" | "MEMBER") {
    if (!tenantId) return;
    setBusyId(member.id);
    try {
      await api.patch(
        `/tenants/${tenantId}/members/${member.id}`,
        { role: nextRole },
        tenantHeaders(tenantId),
      );
      toast.success(`${member.user.name} is now ${ROLE_LABEL[nextRole]}`);
      refresh();
    } catch (caught) {
      toast.error(apiErrorMessage(caught));
    } finally {
      setBusyId(null);
    }
  }

  async function removeMember() {
    if (!tenantId || !removing) return;
    setBusyId(removing.id);
    try {
      await api.delete(`/tenants/${tenantId}/members/${removing.id}`, tenantHeaders(tenantId));
      toast.success(`${removing.user.name} removed from this branch`);
      setRemoving(null);
      refresh();
    } catch (caught) {
      toast.error(apiErrorMessage(caught));
    } finally {
      setBusyId(null);
    }
  }

  if (!selectedTenant) {
    return (
      <EmptyState
        icon={<GitBranch className="size-5" />}
        title="No branch selected"
        description="Members are scoped to a branch. Pick one from the sidebar."
      />
    );
  }

  const members = membersQuery.data;
  const people = peopleQuery.data ?? [];
  const orgAdmins =
    orgMembersQuery.data?.filter((member) => member.role === "ORG_ADMIN" && !member.tenantId) ?? [];

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={`${selectedOrg?.name ?? "Workspace"} · ${selectedTenant.name}`}
        title="Members & access"
        description="Roles are enforced server-side on every request. Organization admins inherit access to every branch; tenant admins manage one branch."
        actions={
          <Badge tone="accent">
            <ShieldCheck className="size-3" /> {canManage ? "You can manage access" : "Read-only view"}
          </Badge>
        }
      />

      {canManage ? (
        <form onSubmit={invite} className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Field label="Add an existing account" hint="The person must register first, then you can add them by email.">
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
                <Input
                  type="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="teammate@company.com"
                  className="pl-9"
                />
              </div>
            </Field>
          </div>
          <Field label="Role" className="sm:w-44">
            <Select value={role} onChange={(event) => setRole(event.target.value as "TENANT_ADMIN" | "MEMBER")}>
              <option value="MEMBER">Member</option>
              <option value="TENANT_ADMIN">Tenant Admin</option>
            </Select>
          </Field>
          <Button type="submit" loading={inviting} disabled={!email.trim()}>
            <UserPlus className="size-4" /> Add member
          </Button>
        </form>
      ) : null}

      <section className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-line-soft px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold">Branch members</h2>
            <p className="text-[11px] text-faint">
              {canManage ? members?.length ?? 0 : people.length} people can access {selectedTenant.name}
            </p>
          </div>
          <Badge tone="muted">
            <Users className="size-3" /> {selectedTenant.name}
          </Badge>
        </div>

        {canManage ? (
          membersQuery.isLoading ? (
            <LoadingBlock label="Loading members" />
          ) : members && members.length > 0 ? (
            <ul className="divide-y divide-line-soft">
              {members.map((member) => (
                <li key={member.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <Avatar name={member.user.name} color={member.user.avatarColor} />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 truncate text-sm font-medium text-ink">
                      {member.user.name}
                      {member.user.id === user?.id ? (
                        <span className="text-[10px] font-normal text-faint">you</span>
                      ) : null}
                    </p>
                    <p className="truncate text-[11px] text-faint">
                      {member.user.email} · joined {formatDate(member.createdAt)}
                    </p>
                  </div>
                  <Badge tone={ROLE_TONE[member.role]}>{ROLE_LABEL[member.role]}</Badge>
                  <Select
                    value={member.role}
                    disabled={busyId === member.id}
                    onChange={(event) =>
                      void changeRole(member, event.target.value as "TENANT_ADMIN" | "MEMBER")
                    }
                    className="h-8 w-36 text-xs"
                    aria-label={`Role for ${member.user.name}`}
                  >
                    <option value="MEMBER">Member</option>
                    <option value="TENANT_ADMIN">Tenant Admin</option>
                  </Select>
                  <Button
                    size="icon"
                    variant="ghost"
                    disabled={busyId === member.id || member.user.id === user?.id}
                    title={member.user.id === user?.id ? "You cannot remove yourself" : "Remove member"}
                    onClick={() => setRemoving(member)}
                    aria-label={`Remove ${member.user.name}`}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              className="border-0"
              icon={<Users className="size-5" />}
              title="No branch members yet"
              description="Add an existing account by email above. Organization admins already have access."
            />
          )
        ) : peopleQuery.isLoading ? (
          <LoadingBlock label="Loading people" />
        ) : people.length > 0 ? (
          <ul className="divide-y divide-line-soft">
            {people.map((person) => (
              <li key={person.id} className="flex items-center gap-3 px-4 py-3">
                <Avatar name={person.name} color={person.avatarColor} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">{person.name}</p>
                  <p className="truncate text-[11px] text-faint">{person.email}</p>
                </div>
                <Badge tone={ROLE_TONE[person.role]}>{ROLE_LABEL[person.role]}</Badge>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            className="border-0"
            icon={<Users className="size-5" />}
            title="No teammates yet"
            description="Ask an admin to add you to the branch roster."
          />
        )}
      </section>

      {selectedOrg?.role === "ORG_ADMIN" ? (
        <section className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-line-soft px-4 py-3">
            <div>
              <h2 className="flex items-center gap-1.5 text-sm font-semibold">
                <Building2 className="size-4 text-accent-strong" /> Organization roster
              </h2>
              <p className="text-[11px] text-faint">
                Every membership in {selectedOrg.name}. Organization admins can access all branches.
              </p>
            </div>
            <Badge tone="muted">{orgMembersQuery.data?.length ?? 0} memberships</Badge>
          </div>

          {orgMembersQuery.isLoading ? (
            <LoadingBlock label="Loading organization roster" />
          ) : orgMembersQuery.data && orgMembersQuery.data.length > 0 ? (
            <ul className="divide-y divide-line-soft">
              {orgMembersQuery.data.map((member: OrgMember) => (
                <li key={member.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                  <Avatar name={member.user.name} color={member.user.avatarColor} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-ink">{member.user.name}</p>
                    <p className="truncate text-[10px] text-faint">{member.user.email}</p>
                  </div>
                  <Badge tone="muted">
                    {member.tenant ? member.tenant.name : "All branches"}
                  </Badge>
                  <Badge tone={ROLE_TONE[member.role]}>{ROLE_LABEL[member.role]}</Badge>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-6 text-center text-xs text-faint">No memberships found.</p>
          )}
        </section>
      ) : (
        <section className="card flex items-start gap-3 p-4">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-surface-3 text-accent-strong">
            <Building2 className="size-4" />
          </span>
          <div>
            <h2 className="text-sm font-semibold">Organization admins</h2>
            <p className="mt-0.5 text-xs text-muted">
              {orgAdmins.length > 0
                ? `${orgAdmins.map((member) => member.user.name).join(", ")} can manage every branch in ${selectedOrg?.name}.`
                : "Ask your organization admin to manage branch access."}
            </p>
          </div>
        </section>
      )}

      <Modal
        open={Boolean(removing)}
        onClose={() => setRemoving(null)}
        title="Remove branch member?"
        description={`${removing?.user.name} will immediately lose access to ${selectedTenant.name}. Their account and other memberships are unaffected.`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setRemoving(null)}>
              Cancel
            </Button>
            <Button variant="danger" loading={Boolean(removing && busyId === removing.id)} onClick={() => void removeMember()}>
              <Trash2 className="size-4" /> Remove member
            </Button>
          </>
        }
      />
    </div>
  );
}
