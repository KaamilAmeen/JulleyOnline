"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Building2, GitBranch, Plus } from "lucide-react";
import { toast } from "sonner";
import { api, apiErrorMessage, tenantHeaders } from "@/lib/api";
import { useWorkspace } from "@/context/workspace-context";
import type { Board, Organization, TenantSummary } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";

export function CreateOrganizationDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { reload, selectWorkspace } = useWorkspace();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const response = await api.post("/organizations", { name: name.trim() });
      const organization = response.data.data as Organization;
      await reload();
      selectWorkspace(organization.id, organization.tenants[0]?.id ?? null);
      await queryClient.invalidateQueries();
      toast.success(`${organization.name} is ready`);
      setName("");
      onOpenChange(false);
      router.push("/dashboard");
    } catch (caught) {
      setError(apiErrorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => onOpenChange(false)}
      title="Create organization"
      description="An organization groups branches (tenants) under one admin boundary. A starter branch and board are created for you."
    >
      <form onSubmit={submit} className="space-y-4">
        <Field label="Organization name">
          <Input
            autoFocus
            required
            minLength={2}
            maxLength={120}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Northwind Labs"
          />
        </Field>
        {error ? <p className="text-xs text-rose-300">{error}</p> : null}
        <div className="flex items-center gap-2 rounded-xl border border-line-soft bg-surface/60 p-3 text-xs text-muted">
          <Building2 className="size-4 shrink-0 text-accent-strong" />
          You become the organization admin and can invite tenant admins later.
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" loading={saving}>
            <Plus className="size-4" /> Create organization
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function CreateTenantDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { selectedOrg, reload, selectWorkspace } = useWorkspace();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedOrg) return;
    setSaving(true);
    setError(null);
    try {
      const response = await api.post(`/organizations/${selectedOrg.id}/tenants`, {
        name: name.trim(),
      });
      const tenant = response.data.data as TenantSummary;
      await reload();
      selectWorkspace(selectedOrg.id, tenant.id);
      await queryClient.invalidateQueries();
      toast.success(`Branch ${tenant.name} created with a starter board`);
      setName("");
      onOpenChange(false);
    } catch (caught) {
      setError(apiErrorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => onOpenChange(false)}
      title="Create branch"
      description={`Add a tenant to ${selectedOrg?.name ?? "this organization"}. Each branch is an isolated workspace with its own boards and members.`}
    >
      <form onSubmit={submit} className="space-y-4">
        <Field label="Branch name">
          <Input
            autoFocus
            required
            minLength={2}
            maxLength={120}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Hyderabad"
          />
        </Field>
        {error ? <p className="text-xs text-rose-300">{error}</p> : null}
        <div className="flex items-center gap-2 rounded-xl border border-line-soft bg-surface/60 p-3 text-xs text-muted">
          <GitBranch className="size-4 shrink-0 text-accent-strong" />
          A “Getting Started” board with four columns will be created automatically.
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" loading={saving}>
            <Plus className="size-4" /> Create branch
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function CreateBoardDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { selectedTenant } = useWorkspace();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [columns, setColumns] = useState("To Do, In Progress, Testing, Done");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedTenant) return;
    setSaving(true);
    setError(null);
    try {
      const templateColumns = columns
        .split(",")
        .map((column) => column.trim())
        .filter(Boolean)
        .slice(0, 10);
      const response = await api.post(
        "/boards",
        {
          name: name.trim(),
          description: description.trim() || null,
          ...(templateColumns.length ? { templateColumns } : {}),
        },
        tenantHeaders(selectedTenant.id),
      );
      const board = response.data.data as Board;
      await queryClient.invalidateQueries({ queryKey: ["boards", selectedTenant.id] });
      toast.success(`Board “${board.name}” created`);
      setName("");
      setDescription("");
      onOpenChange(false);
      router.push(`/boards/${board.id}`);
    } catch (caught) {
      setError(apiErrorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => onOpenChange(false)}
      title="Create board"
      description={`New board in ${selectedTenant?.name ?? "this branch"}.`}
    >
      <form onSubmit={submit} className="space-y-4">
        <Field label="Board name">
          <Input
            autoFocus
            required
            minLength={2}
            maxLength={160}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Sprint 24"
          />
        </Field>
        <Field label="Description" hint="Optional — what is this board for?">
          <Textarea
            rows={3}
            maxLength={2000}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Track the release checklist for the mobile app."
          />
        </Field>
        <Field label="Columns" hint="Comma separated. Leave the default to start with four columns.">
          <Input value={columns} onChange={(event) => setColumns(event.target.value)} />
        </Field>
        {error ? <p className="text-xs text-rose-300">{error}</p> : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" loading={saving}>
            <Plus className="size-4" /> Create board
          </Button>
        </div>
      </form>
    </Modal>
  );
}
