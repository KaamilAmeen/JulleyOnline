"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  Activity as ActivityIcon,
  Building2,
  ChevronDown,
  GitBranch,
  KanbanSquare,
  LayoutDashboard,
  LogOut,
  Menu as MenuIcon,
  Plus,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { useWorkspace } from "@/context/workspace-context";
import { useSocket } from "@/context/socket-context";
import { useBoards } from "@/hooks/use-data";
import { cn, ROLE_LABEL } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Menu, MenuItem } from "@/components/ui/menu";
import { Spinner } from "@/components/ui/feedback";
import {
  CreateBoardDialog,
  CreateOrganizationDialog,
  CreateTenantDialog,
} from "@/components/workspace-dialogs";
import { AssistantPanel } from "@/components/assistant-console";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/activity", label: "Activity", icon: ActivityIcon },
  { href: "/members", label: "Members", icon: Users },
  { href: "/assistant", label: "AI assistant", icon: Sparkles },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const {
    organizations,
    selectedOrg,
    selectedTenant,
    selectOrg,
    selectTenant,
    loading: workspaceLoading,
  } = useWorkspace();
  const { connected, presence } = useSocket();
  const { data: boards } = useBoards(selectedTenant?.id ?? null);
  const pathname = usePathname();
  const router = useRouter();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [orgDialog, setOrgDialog] = useState(false);
  const [tenantDialog, setTenantDialog] = useState(false);
  const [boardDialog, setBoardDialog] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);

  const pageTitle =
    NAV.find((item) => pathname.startsWith(item.href))?.label ??
    (pathname.startsWith("/boards/") ? "Board" : "Workspace");

  async function signOut() {
    await logout();
    router.replace("/login");
  }

  return (
    <div className="flex min-h-screen">
      {mobileOpen ? (
        <div
          className="fixed inset-0 z-30 bg-canvas/80 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden
        />
      ) : null}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-line-soft bg-surface/95 backdrop-blur-xl transition-transform duration-200 lg:static lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between px-4 py-4">
          <Link href="/dashboard" className="flex items-center gap-2.5" onClick={() => setMobileOpen(false)}>
            <span className="flex size-9 items-center justify-center rounded-xl bg-accent text-white shadow-lg shadow-accent/25">
              <KanbanSquare className="size-5" />
            </span>
            <span>
              <span className="block text-sm font-semibold leading-tight tracking-tight">Julley Board</span>
              <span className="block text-[10px] uppercase tracking-[0.16em] text-faint">Multi-tenant kanban</span>
            </span>
          </Link>
          <button
            type="button"
            className="rounded-lg p-1.5 text-faint hover:bg-surface-3 hover:text-ink lg:hidden"
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-3 pb-4">
          <div>
            <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-faint">
              Organization
            </p>
            <Menu
              className="w-[264px]"
              trigger={({ toggle }) => (
                <button
                  type="button"
                  onClick={toggle}
                  className="flex w-full items-center gap-2.5 rounded-xl border border-line-soft bg-surface-2 px-3 py-2.5 text-left transition-colors hover:border-line hover:bg-surface-3"
                >
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent-strong">
                    <Building2 className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-ink">
                      {selectedOrg?.name ?? "No organization"}
                    </span>
                    <span className="block text-[10px] text-faint">
                      {selectedOrg ? ROLE_LABEL[selectedOrg.role] : "Create or join one"}
                    </span>
                  </span>
                  <ChevronDown className="size-3.5 shrink-0 text-faint" />
                </button>
              )}
            >
              {({ close }) => (
                <>
                  {organizations.map((organization) => (
                    <MenuItem
                      key={organization.id}
                      active={organization.id === selectedOrg?.id}
                      onClick={() => {
                        selectOrg(organization.id);
                        close();
                      }}
                    >
                      <Building2 className="size-4 text-faint" />
                      <span className="flex-1 truncate">{organization.name}</span>
                      <span className="text-[10px] text-faint">{organization.tenants.length}</span>
                    </MenuItem>
                  ))}
                  <div className="my-1 h-px bg-line-soft" />
                  <MenuItem
                    onClick={() => {
                      setOrgDialog(true);
                      close();
                    }}
                  >
                    <Plus className="size-4 text-accent-strong" />
                    Create organization
                  </MenuItem>
                </>
              )}
            </Menu>
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between px-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-faint">Branches</p>
              {selectedOrg?.role === "ORG_ADMIN" ? (
                <button
                  type="button"
                  onClick={() => setTenantDialog(true)}
                  className="rounded p-0.5 text-faint transition-colors hover:text-ink"
                  aria-label="Create branch"
                >
                  <Plus className="size-3.5" />
                </button>
              ) : null}
            </div>
            <div className="space-y-1">
              {workspaceLoading && !selectedOrg ? (
                <div className="flex items-center gap-2 px-2 py-3 text-xs text-faint">
                  <Spinner className="size-3.5" /> Loading branches
                </div>
              ) : null}
              {selectedOrg?.tenants.length === 0 ? (
                <p className="px-2 py-2 text-xs text-faint">No branches yet.</p>
              ) : null}
              {selectedOrg?.tenants.map((tenant) => (
                <button
                  key={tenant.id}
                  type="button"
                  onClick={() => {
                    selectTenant(tenant.id);
                    setMobileOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors",
                    tenant.id === selectedTenant?.id
                      ? "bg-accent/12 text-ink ring-1 ring-inset ring-accent/30"
                      : "text-muted hover:bg-surface-2 hover:text-ink",
                  )}
                >
                  <GitBranch
                    className={cn(
                      "size-3.5 shrink-0",
                      tenant.id === selectedTenant?.id ? "text-accent-strong" : "text-faint",
                    )}
                  />
                  <span className="min-w-0 flex-1 truncate">{tenant.name}</span>
                  <span className="text-[10px] text-faint">{tenant.boardCount}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-faint">
              Navigate
            </p>
            <nav className="space-y-1">
              {NAV.map(({ href, label, icon: Icon }) => {
                const active = pathname === href || pathname.startsWith(`${href}/`);
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors",
                      active
                        ? "bg-surface-3 font-medium text-ink"
                        : "text-muted hover:bg-surface-2 hover:text-ink",
                    )}
                  >
                    <Icon className={cn("size-4", active ? "text-accent-strong" : "text-faint")} />
                    {label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between px-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-faint">Boards</p>
              {selectedTenant ? (
                <button
                  type="button"
                  onClick={() => setBoardDialog(true)}
                  className="rounded p-0.5 text-faint transition-colors hover:text-ink"
                  aria-label="Create board"
                >
                  <Plus className="size-3.5" />
                </button>
              ) : null}
            </div>
            <div className="space-y-0.5">
              {boards?.length === 0 ? (
                <p className="px-2 py-2 text-xs text-faint">No boards yet.</p>
              ) : null}
              {boards?.map((board) => {
                const href = `/boards/${board.id}`;
                const active = pathname === href;
                return (
                  <Link
                    key={board.id}
                    href={href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[13px] transition-colors",
                      active ? "bg-surface-3 text-ink" : "text-muted hover:bg-surface-2 hover:text-ink",
                    )}
                  >
                    <span
                      className={cn(
                        "size-1.5 shrink-0 rounded-full",
                        active ? "bg-accent-strong" : "bg-faint/60",
                      )}
                    />
                    <span className="min-w-0 flex-1 truncate">{board.name}</span>
                    <span className="text-[10px] text-faint">{board._count.tasks}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>

        <div className="border-t border-line-soft p-3">
          <div className="mb-2 flex items-center gap-1.5 px-1 text-[10px]">
            <span
              className={cn(
                "size-1.5 rounded-full",
                connected ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]" : "bg-amber-400",
              )}
            />
            <span className="text-faint">{connected ? "Realtime connected" : "Reconnecting to realtime"}</span>
            {presence.length > 0 ? (
              <span className="ml-auto text-faint">{presence.length} online</span>
            ) : null}
          </div>
          <Menu
            align="left"
            className="bottom-full mb-2 w-[264px]"
            trigger={({ toggle }) => (
              <button
                type="button"
                onClick={toggle}
                className="flex w-full items-center gap-2.5 rounded-xl border border-line-soft bg-surface-2 px-2.5 py-2 text-left transition-colors hover:bg-surface-3"
              >
                <Avatar name={user?.name ?? "?"} color={user?.avatarColor} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-medium text-ink">{user?.name}</span>
                  <span className="block truncate text-[10px] text-faint">{user?.email}</span>
                </span>
                <ChevronDown className="size-3.5 text-faint" />
              </button>
            )}
          >
            {({ close }) => (
              <>
                <div className="px-3 py-2 text-[11px] text-faint">
                  Signed in as <span className="text-ink">{user?.email}</span>
                </div>
                <div className="my-1 h-px bg-line-soft" />
                <MenuItem
                  onClick={() => {
                    close();
                    void signOut();
                  }}
                >
                  <LogOut className="size-4" />
                  Sign out
                </MenuItem>
              </>
            )}
          </Menu>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-line-soft bg-canvas/75 px-4 backdrop-blur-xl sm:px-6">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="rounded-lg p-2 text-muted hover:bg-surface-3 hover:text-ink lg:hidden"
            aria-label="Open navigation"
          >
            <MenuIcon className="size-5" />
          </button>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-[11px] text-faint">
              <span className="truncate">{selectedOrg?.name ?? "Workspace"}</span>
              <span>/</span>
              <span className="truncate text-muted">{selectedTenant?.name ?? "No branch"}</span>
            </div>
            <p className="truncate text-sm font-semibold text-ink">{pageTitle}</p>
          </div>

          <div className="hidden items-center gap-2 sm:flex">
            {presence.slice(0, 4).map((person) => (
              <Avatar
                key={person.userId}
                name={person.name}
                color={person.avatarColor}
                size="sm"
                ring
                title={`${person.name} — online`}
              />
            ))}
            {presence.length > 4 ? (
              <span className="text-[11px] text-faint">+{presence.length - 4}</span>
            ) : null}
          </div>

          <Badge tone={connected ? "success" : "warning"} className="hidden sm:inline-flex">
            <span
              className={cn("size-1.5 rounded-full", connected ? "bg-emerald-400" : "bg-amber-400")}
            />
            {connected ? "Live" : "Reconnecting"}
          </Badge>

          <Button variant="ghost" size="icon" onClick={() => setAssistantOpen(true)} aria-label="Open AI assistant">
            <Sparkles className="size-4 text-accent-strong" />
          </Button>

          {selectedTenant ? (
            <Button size="sm" onClick={() => setBoardDialog(true)}>
              <Plus className="size-3.5" />
              <span className="hidden sm:inline">New board</span>
            </Button>
          ) : null}
        </header>

        <main className="mx-auto w-full max-w-[1700px] flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>

      <CreateOrganizationDialog open={orgDialog} onOpenChange={setOrgDialog} />
      <CreateTenantDialog open={tenantDialog} onOpenChange={setTenantDialog} />
      <CreateBoardDialog open={boardDialog} onOpenChange={setBoardDialog} />
      <AssistantPanel open={assistantOpen} onClose={() => setAssistantOpen(false)} />
    </div>
  );
}
