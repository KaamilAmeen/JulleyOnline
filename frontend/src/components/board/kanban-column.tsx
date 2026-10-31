"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import type { BoardColumn, Task } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Menu, MenuItem } from "@/components/ui/menu";
import { TaskCard } from "./task-card";

export function KanbanColumn({
  column,
  tasks,
  onOpenTask,
  onAddTask,
  onRename,
  onDelete,
  canManage,
}: {
  column: BoardColumn;
  tasks: Task[];
  onOpenTask: (task: Task) => void;
  onAddTask: (columnId: string) => void;
  onRename: (column: BoardColumn) => void;
  onDelete: (column: BoardColumn) => void;
  canManage: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
    data: { type: "column", column },
  });

  return (
    <section className="flex max-h-full w-[300px] shrink-0 flex-col rounded-2xl border border-line-soft bg-surface/60">
      <header className="flex items-center gap-2 px-3 py-2.5">
        <span className="size-2 rounded-full bg-accent-strong" />
        <h3 className="min-w-0 flex-1 truncate text-xs font-semibold uppercase tracking-wide text-muted">
          {column.name}
        </h3>
        <span className="rounded-full bg-surface-3 px-1.5 py-0.5 text-[10px] text-faint">{tasks.length}</span>
        {canManage ? (
          <Menu
            align="right"
            trigger={({ toggle }) => (
              <button
                type="button"
                onClick={toggle}
                className="rounded-md p-1 text-faint transition-colors hover:bg-surface-3 hover:text-ink"
                aria-label={`Column actions for ${column.name}`}
              >
                <MoreHorizontal className="size-4" />
              </button>
            )}
          >
            {({ close }) => (
              <>
                <MenuItem
                  onClick={() => {
                    close();
                    onAddTask(column.id);
                  }}
                >
                  <Plus className="size-4" /> Add task
                </MenuItem>
                <MenuItem
                  onClick={() => {
                    close();
                    onRename(column);
                  }}
                >
                  <Pencil className="size-4" /> Rename column
                </MenuItem>
                <MenuItem
                  className="text-rose-300 hover:bg-rose-500/10 hover:text-rose-200"
                  onClick={() => {
                    close();
                    onDelete(column);
                  }}
                >
                  <Trash2 className="size-4" /> Delete column
                </MenuItem>
              </>
            )}
          </Menu>
        ) : null}
      </header>

      <SortableContext items={tasks.map((task) => task.id)} strategy={verticalListSortingStrategy}>
        <div
          ref={setNodeRef}
          className={cn(
            "min-h-24 flex-1 space-y-2 overflow-y-auto px-2 pb-2 transition-colors",
            isOver && "bg-accent/5",
          )}
        >
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} onOpen={onOpenTask} />
          ))}
          {tasks.length === 0 ? (
            <div className="flex h-24 items-center justify-center rounded-xl border border-dashed border-line/70 text-[11px] text-faint">
              Drop tasks here
            </div>
          ) : null}
        </div>
      </SortableContext>

      <button
        type="button"
        onClick={() => onAddTask(column.id)}
        className="m-2 mt-0 flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-line/70 py-2 text-[11px] text-faint transition-colors hover:border-accent/40 hover:bg-accent/5 hover:text-ink"
      >
        <Plus className="size-3.5" /> Add task
      </button>
    </section>
  );
}
