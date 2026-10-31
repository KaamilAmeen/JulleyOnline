"use client";

import { useEffect, useState } from "react";
import {
  CalendarDays,
  Clock,
  History,
  Save,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import type { Activity, Priority, Task, TenantPerson } from "@/lib/types";
import {
  ACTION_LABEL,
  cn,
  formatDate,
  PRIORITY_META,
  relativeTime,
  toDateInputValue,
} from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Spinner } from "@/components/ui/feedback";

export interface TaskSaveInput {
  title: string;
  description: string | null;
  priority: Priority;
  assignedTo: string | null;
  dueDate: string | null;
}

export function TaskDrawer({
  task,
  open,
  people,
  activity,
  activityLoading,
  saving,
  canDelete,
  onClose,
  onSave,
  onDelete,
}: {
  task: Task | null;
  open: boolean;
  people: TenantPerson[];
  activity?: Activity[];
  activityLoading?: boolean;
  saving: boolean;
  canDelete: boolean;
  onClose: () => void;
  onSave: (input: TaskSaveInput) => void;
  onDelete: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>("MEDIUM");
  const [assignedTo, setAssignedTo] = useState("");
  const [dueDate, setDueDate] = useState("");

  useEffect(() => {
    if (!task) return;
    setTitle(task.title);
    setDescription(task.description ?? "");
    setPriority(task.priority);
    setAssignedTo(task.assignedTo ?? "");
    setDueDate(toDateInputValue(task.dueDate));
  }, [task?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!task) return null;

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!task || !title.trim()) return;
    onSave({
      title: title.trim(),
      description: description.trim() ? description.trim() : null,
      priority,
      assignedTo: assignedTo || null,
      dueDate: dueDate ? new Date(`${dueDate}T00:00:00`).toISOString() : null,
    });
  }

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-40 bg-canvas/70 backdrop-blur-sm transition-opacity",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={onClose}
        aria-hidden
      />
      <aside
        className={cn(
          "fixed right-0 top-0 z-50 flex h-full w-full max-w-lg flex-col border-l border-line bg-surface shadow-2xl shadow-black/50 transition-transform duration-200",
          open ? "translate-x-0" : "translate-x-full",
        )}
        aria-hidden={!open}
      >
        <header className="flex items-start gap-3 border-b border-line-soft p-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge tone="accent">Task</Badge>
              <Badge tone="muted">v{task.version}</Badge>
              <Badge tone="muted">
                <Clock className="size-3" /> updated {relativeTime(task.updatedAt)}
              </Badge>
            </div>
            <p className="mt-2 truncate text-sm font-semibold text-ink">{task.title}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-faint hover:bg-surface-3 hover:text-ink"
            aria-label="Close task"
          >
            <X className="size-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-4">
          <form id="task-form" onSubmit={submit} className="space-y-4">
            <Field label="Title">
              <Input
                required
                maxLength={200}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
            </Field>

            <Field label="Description">
              <Textarea
                rows={4}
                maxLength={10_000}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Add context, acceptance criteria or links..."
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Priority">
                <Select value={priority} onChange={(event) => setPriority(event.target.value as Priority)}>
                  {Object.entries(PRIORITY_META).map(([value, meta]) => (
                    <option key={value} value={value}>
                      {meta.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Due date">
                <Input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
              </Field>
            </div>

            <Field label="Assignee">
              <Select value={assignedTo} onChange={(event) => setAssignedTo(event.target.value)}>
                <option value="">Unassigned</option>
                {people.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.name} · {person.email}
                  </option>
                ))}
              </Select>
            </Field>

            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line-soft bg-surface-2 p-3 text-[11px] text-faint">
              <CalendarDays className="size-3.5" />
              Created {formatDate(task.createdAt, true)} by
              <Avatar name={task.creator.name} color={task.creator.avatarColor} size="xs" />
              {task.creator.name}
            </div>
          </form>

          <section className="mt-6">
            <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
              <History className="size-3.5" /> Task activity
            </h3>
            <div className="mt-3 space-y-3">
              {activityLoading ? (
                <div className="flex items-center gap-2 text-xs text-faint">
                  <Spinner className="size-3.5" /> Loading history
                </div>
              ) : activity && activity.length > 0 ? (
                activity.map((entry) => (
                  <div key={entry.id} className="flex items-start gap-2.5">
                    <Avatar name={entry.user.name} color={entry.user.avatarColor} size="xs" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] leading-relaxed text-muted">
                        <span className="font-medium text-ink">{entry.user.name}</span>{" "}
                        {ACTION_LABEL[entry.action] ?? entry.action.toLowerCase()} this task
                      </p>
                      <p className="text-[10px] text-faint">{relativeTime(entry.createdAt)}</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-faint">No task activity yet.</p>
              )}
            </div>
          </section>
        </div>

        <footer className="flex items-center justify-between gap-2 border-t border-line-soft p-4">
          {canDelete ? (
            <Button type="button" variant="danger" size="sm" onClick={onDelete}>
              <Trash2 className="size-3.5" /> Delete
            </Button>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-[11px] text-faint">
              <UserRound className="size-3.5" /> Only the creator or an admin can delete
            </span>
          )}
          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Close
            </Button>
            <Button type="submit" form="task-form" loading={saving}>
              <Save className="size-4" /> Save changes
            </Button>
          </div>
        </footer>
      </aside>
    </>
  );
}
