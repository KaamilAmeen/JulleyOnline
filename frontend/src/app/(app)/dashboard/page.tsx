"use client";

import Link from "next/link";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Activity as ActivityIcon,
  ArrowUpRight,
  Building2,
  CheckCircle2,
  GitBranch,
  KanbanSquare,
  LayoutGrid,
  ListTodo,
  Plus,
  Sparkles,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/auth-context";
import { useWorkspace } from "@/context/workspace-context";
import { useActivity, useBoards, usePeople } from "@/hooks/use-data";
import { api, apiErrorMessage, tenantHeaders } from "@/lib/api";
import type { BoardSummary } from "@/lib/types";
import { cn, formatDate, relativeTime } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { EmptyState, LoadingBlock, PageHeader } from "@/components/ui/feedback";
import { Modal } from "@/components/ui/modal";
import { Menu, MenuItem } from "@/components/ui/menu";
import {
  CreateBoardDialog,
  CreateOrganizationDialog,
  CreateTenantDialog,
} from "@/components/workspace-dialogs";

function StatCard({
  label,
  value,
  icon,
  hint,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="card flex items-center gap-3 p-4">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent-strong">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wide text-faint">{label}</p>
        <p className="text-xl font-semibold leading-tight">{value}</p>
        {hint ? <p className="truncate text-[11px] text-faint">{hint}</p> : null}
      </div>
    </div>
  );
}

function BoardCard({
  board,
  canManage,
  onDelete,
}: {
  board: BoardSummary;
  canManage: boolean;
  onDelete: (board: BoardSummary) => void;
}) {
  return (
    <div className="card group relative flex flex-col gap-3 p-4 transition-colors hover:border-line">
      <div className="flex items-start justify-between gap-2">
        <Link href={`/boards/${board.id}`} className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-ink transition-colors group-hover:text-accent-strong">
            {board.name}
          </h3>
          <p className="mt-1 line-clamp-2 min-h-8 text-xs leading-relaxed text-muted">
            {board.description || "No description yet."}
          </p>
        </Link>
        {canManage ? (
          <Menu
            align="right"
            trigger={({ toggle }) => (
              <button
                type="button"
                onClick={toggle}
                className="rounded-lg p-1.5 text-faint opacity-0 transition-opacity hover:bg-surface-3 hover:text-ink group-hover:opacity-100"
                aria-label={`Board actions for ${board.name}`}
              >
                <span className="block text-lg leading-none">⋯</span>
              </button>
            )}
          >
            {({ close }) => (
              <>
                <Link
                  href={`/boards/${board.id}`}
                  onClick={close}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted hover:bg-surface-3 hover:text-ink"
                >
                  <ArrowUpRight className="size-4" /> Open board
                </Link>
                <MenuItem
                  className="text-rose-300 hover:bg-rose-500/10 hover:text-rose-200"
                  onClick={() => {
                    close();
                    onDelete(board);
                  }}
                >
                  <Trash2 className="size-4" /> Delete board
                </MenuItem>
              </>
            )}
          </Menu>
        ) : null}
      </div>

      <div className="flex items-center gap-3 text-[11px] text-faint">
        <span className="inline-flex items-center gap-1">
          <LayoutGrid className="size-3" /> {board._count.columns} columns
        </span>
        <span className="inline-flex items-center gap-1">
          <ListTodo className="size-3" /> {board._count.tasks} tasks
        </span>
      </div>

      <div className="mt-auto flex items-center justify-between border-t border-line-soft pt-3">
        <div className="flex items-center gap-1.5">
          <Avatar name={board.creator.name} color={board.creator.avatarColor} size="xs" />
          <span className="text-[11px] text-faint">{board.creator.name.split(" ")[0]}</span>
        </div>
        <span className="text-[10px] text-faint">updated {relativeTime(board.updatedAt)}</span>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const {
    organizations,
    loading: workspaceLoading,
    selectedOrg,
    selectedTenant,
    canManageTenant,
    selectTenant,
  } = useWorkspace();
  const queryClient = useQueryClient();

  const { data: boards, isLoading } = useBoards(selectedTenant?.id ?? null);
  const { data: activity } = useActivity(selectedTenant?.id ?? null, { limit: 8 });
  const { data: people } = usePeople(selectedTenant?.id ?? null);

  const [boardDialog, setBoardDialog] = useState(false);
  const [orgDialog, setOrgDialog] = useState(false);
  const [tenantDialog, setTenantDialog] = useState(false);
  const [deleting, setDeleting] = useState<BoardSummary | null>(null);
  const [deletePending, setDeletePending] = useState(false);

  const canManage = selectedTenant ? canManageTenant(selectedTenant.id) : false;
  const totalTasks = boards?.reduce((total, board) => total + board._count.tasks, 0) ?? 0;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  async function confirmDelete() {
    if (!deleting || !selectedTenant) return;
    setDeletePending(true);
    try {
      await api.delete(`/boards/${deleting.id}`, tenantHeaders(selectedTenant.id));
      await queryClient.invalidateQueries({ queryKey: ["boards", selectedTenant.id] });
      await queryClient.invalidateQueries({ queryKey: ["activity", selectedTenant.id] });
      toast.success(`Deleted “${deleting.name}”`);
      setDeleting(null);
    } catch (caught) {
      toast.error(apiErrorMessage(caught));
    } finally {
      setDeletePending(false);
    }
  }

  if (!workspaceLoading && organizations.length === 0) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <div className="w-full max-w-xl text-center">
          <span className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-accent/15 text-accent-strong">
            <Building2 className="size-8" />
          </span>
          <h1 className="mt-5 text-2xl font-semibold tracking-tight">Create your first organization</h1>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">
            You are not part of an organization yet. Create one to get a starter branch, a board and
            four columns. You can invite teammates once it exists.
          </p>
          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button size="lg" onClick={() => setOrgDialog(true)}>
              <Plus className="size-4" /> Create organization
            </Button>
            <p className="text-xs text-faint">or ask an admin to invite {user?.email}</p>
          </div>
        </div>
        <CreateOrganizationDialog open={orgDialog} onOpenChange={setOrgDialog} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={`${selectedOrg?.name ?? "Workspace"} · ${selectedTenant?.name ?? "No branch"}`}
        title={`${greeting}, ${user?.name.split(" ")[0] ?? "there"}`}
        description={
          selectedTenant
            ? `Here is what is happening across ${selectedTenant.name} today.`
            : "Choose a branch from the sidebar to see its boards."
        }
        actions={
          selectedTenant ? (
            <>
              <Button variant="outline" size="sm" onClick={() => setBoardDialog(true)}>
                <Plus className="size-3.5" /> New board
              </Button>
              <Link href="/assistant">
                <Button size="sm" variant="secondary">
                  <Sparkles className="size-3.5 text-accent-strong" /> Ask AI
                </Button>
              </Link>
            </>
          ) : null
        }
      />

      {!selectedTenant ? (
        <EmptyState
          icon={<GitBranch className="size-5" />}
          title="No branch selected"
          description="Pick a branch in the sidebar, or create one if you are an organization admin."
          action={
            selectedOrg?.role === "ORG_ADMIN" ? (
              <Button size="sm" onClick={() => setTenantDialog(true)}>
                <Plus className="size-3.5" /> Create branch
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Boards"
              value={boards?.length ?? "—"}
              icon={<KanbanSquare className="size-5" />}
              hint={selectedTenant.name}
            />
            <StatCard
              label="Tasks"
              value={totalTasks}
              icon={<ListTodo className="size-5" />}
              hint="across all boards"
            />
            <StatCard
              label="Teammates"
              value={people?.length ?? selectedTenant.memberCount}
              icon={<Users className="size-5" />}
              hint="with branch access"
            />
            <StatCard
              label="Live now"
              value={activity?.length ? relativeTime(activity[0]!.createdAt) : "—"}
              icon={<ActivityIcon className="size-5" />}
              hint="last activity"
            />
          </section>

          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-ink">Boards</h2>
              <span className="text-xs text-faint">{boards?.length ?? 0} total</span>
            </div>

            {isLoading ? (
              <LoadingBlock label="Loading boards" />
            ) : boards && boards.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {boards.map((board) => (
                  <BoardCard key={board.id} board={board} canManage={canManage} onDelete={setDeleting} />
                ))}
                <button
                  type="button"
                  onClick={() => setBoardDialog(true)}
                  className="flex min-h-40 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-line text-sm text-muted transition-colors hover:border-accent/40 hover:bg-accent/5 hover:text-ink"
                >
                  <span className="flex size-10 items-center justify-center rounded-xl bg-surface-3 text-accent-strong">
                    <Plus className="size-5" />
                  </span>
                  Create a board
                </button>
              </div>
            ) : (
              <EmptyState
                icon={<KanbanSquare className="size-5" />}
                title="No boards in this branch"
                description="Create a board to start tracking work with your team."
                action={
                  <Button size="sm" onClick={() => setBoardDialog(true)}>
                    <Plus className="size-3.5" /> Create board
                  </Button>
                }
              />
            )}
          </section>

          <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
            <section className="card p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold">Recent activity</h2>
                <Link href="/activity" className="text-xs text-accent-strong hover:underline">
                  View all
                </Link>
              </div>
              {activity && activity.length > 0 ? (
                <ul className="space-y-3">
                  {activity.map((entry) => (
                    <li key={entry.id} className="flex items-start gap-2.5">
                      <Avatar name={entry.user.name} color={entry.user.avatarColor} size="xs" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-muted">
                          <span className="font-medium text-ink">{entry.user.name}</span>{" "}
                          {entry.action.toLowerCase()} {entry.entityType}
                          {typeof entry.details.title === "string" ? (
                            <span className="text-ink"> “{entry.details.title}”</span>
                          ) : null}
                        </p>
                        <p className="text-[10px] text-faint">{relativeTime(entry.createdAt)}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="py-6 text-center text-xs text-faint">No activity yet.</p>
              )}
            </section>

            <section className="card p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold">Branches in {selectedOrg?.name}</h2>
                {selectedOrg?.role === "ORG_ADMIN" ? (
                  <button
                    type="button"
                    onClick={() => setTenantDialog(true)}
                    className="text-xs text-accent-strong hover:underline"
                  >
                    Add branch
                  </button>
                ) : null}
              </div>
              <div className="space-y-2">
                {selectedOrg?.tenants.map((tenant) => (
                  <button
                    key={tenant.id}
                    type="button"
                    onClick={() => selectTenant(tenant.id)}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-colors",
                      tenant.id === selectedTenant.id
                        ? "border-accent/35 bg-accent/10"
                        : "border-line-soft bg-surface/50 hover:border-line hover:bg-surface-2",
                    )}
                  >
                    <span className="flex size-8 items-center justify-center rounded-lg bg-surface-3 text-accent-strong">
                      <GitBranch className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-medium text-ink">{tenant.name}</span>
                      <span className="block text-[10px] text-faint">
                        {tenant.boardCount} boards · {tenant.memberCount} members
                      </span>
                    </span>
                    {tenant.id === selectedTenant.id ? (
                      <CheckCircle2 className="size-4 text-emerald-400" />
                    ) : null}
                  </button>
                ))}
              </div>
              {selectedOrg ? (
                <p className="mt-3 border-t border-line-soft pt-3 text-[10px] text-faint">
                  Created {formatDate(selectedOrg.createdAt)} · you are {selectedOrg.role.replace("_", " ").toLowerCase()}
                </p>
              ) : null}
            </section>
          </div>
        </>
      )}

      <CreateBoardDialog open={boardDialog} onOpenChange={setBoardDialog} />
      <CreateTenantDialog open={tenantDialog} onOpenChange={setTenantDialog} />

      <Modal
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title="Delete board?"
        description={`“${deleting?.name}” and all of its tasks and columns will be permanently removed. This cannot be undone.`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button variant="danger" loading={deletePending} onClick={() => void confirmDelete()}>
              <Trash2 className="size-4" /> Delete board
            </Button>
          </>
        }
      />
    </div>
  );
}
