"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CalendarDays, GripVertical } from "lucide-react";
import type { Task } from "@/lib/types";
import { cn, formatDate, isOverdue, PRIORITY_META } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";

export function TaskCardContent({ task, dragging = false }: { task: Task; dragging?: boolean }) {
  const priority = PRIORITY_META[task.priority];
  const overdue = isOverdue(task.dueDate);

  return (
    <div
      className={cn(
        "group/card rounded-xl border border-line-soft bg-surface-2 p-3 transition-colors",
        dragging ? "rotate-1 border-accent/40 shadow-2xl shadow-black/50" : "hover:border-line",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span
          className={cn(
            "inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium",
            priority.className,
          )}
        >
          {priority.label}
        </span>
        {task.dueDate ? (
          <span
            className={cn(
              "inline-flex items-center gap-1 text-[10px]",
              overdue ? "font-medium text-rose-300" : "text-faint",
            )}
          >
            <CalendarDays className="size-3" />
            {formatDate(task.dueDate)}
          </span>
        ) : null}
      </div>

      <p className="mt-2 line-clamp-2 text-[13px] font-medium leading-snug text-ink">{task.title}</p>
      {task.description ? (
        <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-faint">{task.description}</p>
      ) : null}

      <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-line-soft pt-2">
        {task.assignee ? (
          <span className="flex min-w-0 items-center gap-1.5">
            <Avatar name={task.assignee.name} color={task.assignee.avatarColor} size="xs" />
            <span className="truncate text-[10px] text-muted">{task.assignee.name}</span>
          </span>
        ) : (
          <span className="text-[10px] text-faint">Unassigned</span>
        )}
        <span className="text-[10px] text-faint">v{task.version}</span>
      </div>
    </div>
  );
}

export function TaskCard({
  task,
  onOpen,
  canDrag = true,
}: {
  task: Task;
  onOpen: (task: Task) => void;
  canDrag?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { type: "task", task },
    disabled: !canDrag,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      onClick={() => {
        if (!isDragging) onOpen(task);
      }}
      className={cn(
        "relative cursor-grab touch-none outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas",
        isDragging && "opacity-35",
      )}
    >
      <TaskCardContent task={task} />
      <GripVertical className="absolute right-1 top-1/2 size-3.5 -translate-y-1/2 text-faint/0 transition-colors group-hover/card:text-faint/60" />
    </div>
  );
}
