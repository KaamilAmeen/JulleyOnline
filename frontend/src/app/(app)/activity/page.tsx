"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity as ActivityIcon,
  ArrowRight,
  Building2,
  GitBranch,
  KanbanSquare,
  LayoutGrid,
  ListTodo,
  Radio,
  UserPlus,
} from "lucide-react";
import { useWorkspace } from "@/context/workspace-context";
import { useSocket } from "@/context/socket-context";
import { useActivity, useBoards } from "@/hooks/use-data";
import type { Activity } from "@/lib/types";
import { ACTION_LABEL, formatDate, relativeTime } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { EmptyState, LoadingBlock, PageHeader } from "@/components/ui/feedback";
import { Select } from "@/components/ui/input";

const ENTITY_ICONS: Record<string, React.ReactNode> = {
  task: <ListTodo className="size-3.5" />,
  board: <KanbanSquare className="size-3.5" />,
  column: <LayoutGrid className="size-3.5" />,
  member: <UserPlus className="size-3.5" />,
  tenant: <GitBranch className="size-3.5" />,
  organization: <Building2 className="size-3.5" />,
};

function describe(entry: Activity) {
  const title = typeof entry.details.title === "string" ? entry.details.title : null;
  const memberEmail = typeof entry.details.memberEmail === "string" ? entry.details.memberEmail : null;
  const name = typeof entry.details.name === "string" ? entry.details.name : null;
  const action = ACTION_LABEL[entry.action] ?? entry.action.toLowerCase();

  switch (entry.entityType) {
    case "task":
      return (
        <>
          {action} task{title ? <span className="text-ink"> “{title}”</span> : null}
        </>
      );
    case "member":
      return (
        <>
          {entry.action === "MEMBER_ADDED"
            ? "added"
            : entry.action === "MEMBER_REMOVED"
              ? "removed"
              : "changed the role of"}{" "}
          <span className="text-ink">{memberEmail ?? "a member"}</span>
        </>
      );
    case "board":
      return (
        <>
          {action} board{name || title ? <span className="text-ink"> “{name ?? title}”</span> : null}
        </>
      );
    case "column":
      return (
        <>
          {action} column{name ? <span className="text-ink"> “{name}”</span> : null}
        </>
      );
    case "tenant":
      return (
        <>
          {action} branch{name ? <span className="text-ink"> “{name}”</span> : null}
        </>
      );
    case "organization":
      return (
        <>
          {action} organization{name ? <span className="text-ink"> “{name}”</span> : null}
        </>
      );
    default:
      return <>{action} {entry.entityType}</>;
  }
}

function ChangeList({ details }: { details: Record<string, unknown> }) {
  const changes = details.changes;
  if (!changes || typeof changes !== "object") return null;
  const entries = Object.entries(changes as Record<string, { from?: unknown; to?: unknown }>);
  if (entries.length === 0) return null;

  return (
    <div className="mt-1.5 flex flex-wrap gap-1">
      {entries.slice(0, 4).map(([field, value]) => (
        <span
          key={field}
          className="inline-flex max-w-full items-center gap-1 rounded border border-line-soft bg-surface px-1.5 py-0.5 text-[10px] text-faint"
        >
          <span className="text-muted">{field}</span>
          <span className="max-w-24 truncate line-through">{String(value.from ?? "—")}</span>
          <ArrowRight className="size-2.5" />
          <span className="max-w-24 truncate text-ink">{String(value.to ?? "—")}</span>
        </span>
      ))}
    </div>
  );
}

export default function ActivityPage() {
  const { selectedOrg, selectedTenant } = useWorkspace();
  const { connected } = useSocket();
  const [entityType, setEntityType] = useState("");
  const [boardId, setBoardId] = useState("");
  const { data: boards } = useBoards(selectedTenant?.id ?? null);
  const { data: activity, isLoading } = useActivity(selectedTenant?.id ?? null, {
    limit: 100,
    ...(entityType ? { entityType } : {}),
    ...(boardId ? { boardId } : {}),
  });

  const grouped = useMemo(() => {
    const groups = new Map<string, Activity[]>();
    for (const entry of activity ?? []) {
      const key = new Date(entry.createdAt).toDateString();
      const list = groups.get(key) ?? [];
      list.push(entry);
      groups.set(key, list);
    }
    return [...groups.entries()];
  }, [activity]);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={`${selectedOrg?.name ?? "Workspace"} · ${selectedTenant?.name ?? "No branch"}`}
        title="Activity log"
        description="Every mutation is recorded with the actor, entity and before/after values. Events arrive live over the tenant room."
        actions={
          <Badge tone={connected ? "success" : "warning"}>
            <Radio className="size-3" /> {connected ? "Live" : "Reconnecting"}
          </Badge>
        }
      />

      {!selectedTenant ? (
        <EmptyState
          icon={<GitBranch className="size-5" />}
          title="No branch selected"
          description="Pick a branch to see its audit trail."
        />
      ) : (
        <>
          <div className="card flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2 text-xs text-muted">
              <ActivityIcon className="size-4 text-accent-strong" />
              Filter
            </div>
            <Select
              value={entityType}
              onChange={(event) => setEntityType(event.target.value)}
              className="h-9 sm:max-w-44"
            >
              <option value="">All entities</option>
              <option value="task">Tasks</option>
              <option value="board">Boards</option>
              <option value="column">Columns</option>
              <option value="member">Members</option>
              <option value="tenant">Branches</option>
              <option value="organization">Organization</option>
            </Select>
            <Select
              value={boardId}
              onChange={(event) => setBoardId(event.target.value)}
              className="h-9 sm:max-w-56"
            >
              <option value="">All boards</option>
              {boards?.map((board) => (
                <option key={board.id} value={board.id}>
                  {board.name}
                </option>
              ))}
            </Select>
            <span className="text-xs text-faint sm:ml-auto">
              {activity?.length ?? 0} events · newest first
            </span>
          </div>

          {isLoading ? (
            <LoadingBlock label="Loading activity" />
          ) : grouped.length === 0 ? (
            <EmptyState
              icon={<ActivityIcon className="size-5" />}
              title="No activity matches"
              description="Try clearing the filters, or create a task to generate the first event."
            />
          ) : (
            <div className="space-y-6">
              {grouped.map(([day, entries]) => (
                <section key={day}>
                  <div className="mb-2 flex items-center gap-3">
                    <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">
                      {day === new Date().toDateString() ? "Today" : formatDate(entries[0]!.createdAt)}
                    </h2>
                    <span className="h-px flex-1 bg-line-soft" />
                    <span className="text-[10px] text-faint">{entries.length} events</span>
                  </div>

                  <ul className="space-y-1.5">
                    {entries.map((entry) => (
                      <li
                        key={entry.id}
                        className="flex items-start gap-3 rounded-xl border border-line-soft bg-surface/50 px-3 py-2.5 transition-colors hover:border-line"
                      >
                        <Avatar name={entry.user.name} color={entry.user.avatarColor} size="sm" />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted">
                            <span className="font-medium text-ink">{entry.user.name}</span>
                            <span>{describe(entry)}</span>
                            <span className="inline-flex items-center gap-1 rounded-full border border-line-soft bg-surface-2 px-1.5 py-0.5 text-[10px] text-faint">
                              {ENTITY_ICONS[entry.entityType] ?? <ActivityIcon className="size-3" />}
                              {entry.entityType}
                            </span>
                          </div>
                          <ChangeList details={entry.details} />
                          <p className="mt-1 text-[10px] text-faint">
                            {relativeTime(entry.createdAt)} · {formatDate(entry.createdAt, true)}
                          </p>
                        </div>
                        {entry.entityType === "task" && entry.details.boardId ? (
                          <Link
                            href={`/boards/${String(entry.details.boardId)}`}
                            className="hidden shrink-0 items-center gap-1 text-[10px] text-accent-strong hover:underline sm:inline-flex"
                          >
                            Open board <ArrowRight className="size-3" />
                          </Link>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
