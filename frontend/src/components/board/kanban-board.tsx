"use client";

import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import type { Board, BoardColumn, Task } from "@/lib/types";
import { KanbanColumn } from "./kanban-column";
import { TaskCardContent } from "./task-card";

export function KanbanBoard({
  board,
  onMove,
  onOpenTask,
  onAddTask,
  onRenameColumn,
  onDeleteColumn,
  canManage,
}: {
  board: Board;
  onMove: (taskId: string, columnId: string, index: number) => void;
  onOpenTask: (task: Task) => void;
  onAddTask: (columnId: string) => void;
  onRenameColumn: (column: BoardColumn) => void;
  onDeleteColumn: (column: BoardColumn) => void;
  canManage: boolean;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const tasksByColumn = useMemo(() => {
    const grouped = new Map<string, Task[]>();
    for (const column of board.columns) grouped.set(column.id, []);
    for (const task of board.tasks) {
      const list = grouped.get(task.columnId);
      if (list) list.push(task);
    }
    return grouped;
  }, [board.columns, board.tasks]);

  const activeTask = activeId ? board.tasks.find((task) => task.id === activeId) ?? null : null;

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const task = board.tasks.find((candidate) => candidate.id === active.id);
    if (!task) return;

    const overType = over.data.current?.type;
    let targetColumnId: string;
    let targetIndex: number;

    if (overType === "task") {
      const overTask = board.tasks.find((candidate) => candidate.id === over.id);
      if (!overTask) return;
      targetColumnId = overTask.columnId;
      const columnTasks = board.tasks.filter((candidate) => candidate.columnId === targetColumnId);
      const overIndex = columnTasks.findIndex((candidate) => candidate.id === overTask.id);

      if (targetColumnId === task.columnId) {
        const activeIndex = columnTasks.findIndex((candidate) => candidate.id === task.id);
        targetIndex = overIndex > activeIndex ? overIndex - 1 : overIndex;
      } else {
        targetIndex = overIndex;
      }
    } else if (overType === "column" || board.columns.some((column) => column.id === over.id)) {
      targetColumnId = String(over.id);
      targetIndex = board.tasks.filter(
        (candidate) => candidate.columnId === targetColumnId && candidate.id !== task.id,
      ).length;
    } else {
      return;
    }

    if (targetColumnId === task.columnId) {
      const currentIndex = board.tasks
        .filter((candidate) => candidate.columnId === task.columnId && candidate.id !== task.id)
        .length;
      const fromIndex = board.tasks
        .filter((candidate) => candidate.columnId === task.columnId)
        .findIndex((candidate) => candidate.id === task.id);
      if (targetIndex === fromIndex && currentIndex >= 0) return;
    }

    onMove(task.id, targetColumnId, targetIndex);
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="flex h-full items-start gap-3 overflow-x-auto pb-4">
        {board.columns.map((column) => (
          <KanbanColumn
            key={column.id}
            column={column}
            tasks={tasksByColumn.get(column.id) ?? []}
            onOpenTask={onOpenTask}
            onAddTask={onAddTask}
            onRename={onRenameColumn}
            onDelete={onDeleteColumn}
            canManage={canManage}
          />
        ))}
        {board.columns.length === 0 ? (
          <div className="flex h-48 w-full items-center justify-center rounded-2xl border border-dashed border-line text-sm text-faint">
            This board has no columns yet. Add one from the board menu.
          </div>
        ) : null}
      </div>

      <DragOverlay dropAnimation={{ duration: 180, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }}>
        {activeTask ? (
          <div className="w-[284px]">
            <TaskCardContent task={activeTask} dragging />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
