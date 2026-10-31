"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Columns3,
  KanbanSquare,
  LayoutGrid,
  ListTodo,
  Plus,
  Redo2,
  Settings2,
  Undo2,
  Users,
  Wifi,
  WifiOff,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/auth-context";
import { useWorkspace } from "@/context/workspace-context";
import { useSocket } from "@/context/socket-context";
import { useBoard, usePeople, useTaskActivity } from "@/hooks/use-data";
import { useHistory } from "@/hooks/use-history";
import {
  api,
  apiErrorMessage,
  conflictCurrentTask,
  tenantHeaders,
} from "@/lib/api";
import type { Board, BoardColumn, Task } from "@/lib/types";
import { relativeTime } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, LoadingBlock, Skeleton } from "@/components/ui/feedback";
import { Field, Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { KanbanBoard } from "@/components/board/kanban-board";
import { TaskDrawer, type TaskSaveInput } from "@/components/board/task-drawer";
import { CreateTaskDialog } from "@/components/board/create-task-dialog";
import { ColumnManagerDialog } from "@/components/board/column-manager";
import { BoardSettingsDialog } from "@/components/board/board-settings-dialog";

interface MoveEntry {
  taskId: string;
  fromColumnId: string;
  fromIndex: number;
  toColumnId: string;
  toIndex: number;
}

interface ConflictState {
  message: string;
  currentTask: Task | null;
  retry?: () => void;
}

/** Reorders the cached board optimistically. */
function moveInBoard(board: Board, taskId: string, toColumnId: string, toIndex: number): Board {
  const tasks = [...board.tasks];
  const from = tasks.findIndex((task) => task.id === taskId);
  if (from === -1) return board;
  const [task] = tasks.splice(from, 1);
  if (!task) return board;
  const updated = { ...task, columnId: toColumnId };
  const columnIndices = tasks
    .map((candidate, index) => ({ candidate, index }))
    .filter((entry) => entry.candidate.columnId === toColumnId);
  const insertAt =
    toIndex >= columnIndices.length ? tasks.length : columnIndices[toIndex]?.index ?? tasks.length;
  tasks.splice(insertAt, 0, updated);
  return { ...board, tasks };
}

export default function BoardPage() {
  const params = useParams<{ boardId: string }>();
  const boardId = Array.isArray(params.boardId) ? params.boardId[0]! : params.boardId;
  const { user } = useAuth();
  const { selectedTenant, canManageTenant, selectedOrg } = useWorkspace();
  const { presence, connected } = useSocket();
  const tenantId = selectedTenant?.id ?? null;
  const queryClient = useQueryClient();
  const cacheKey = useMemo(() => ["board", tenantId, boardId] as const, [tenantId, boardId]);

  const { data: board, isLoading, isError, error } = useBoard(tenantId, boardId);
  const { data: people = [] } = usePeople(tenantId);
  const { push: pushHistory, undo, redo, canUndo, canRedo } = useHistory<MoveEntry>();

  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [createTaskOpen, setCreateTaskOpen] = useState(false);
  const [createColumnId, setCreateColumnId] = useState<string | null>(null);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [renamingColumn, setRenamingColumn] = useState<BoardColumn | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deletingColumn, setDeletingColumn] = useState<BoardColumn | null>(null);
  const [deletingTask, setDeletingTask] = useState<Task | null>(null);
  const [savingTask, setSavingTask] = useState(false);
  const [columnBusy, setColumnBusy] = useState(false);
  const [conflict, setConflict] = useState<ConflictState | null>(null);

  const selectedTask = board?.tasks.find((task) => task.id === selectedTaskId) ?? null;
  const { data: taskActivity, isLoading: taskActivityLoading } = useTaskActivity(
    tenantId,
    selectedTaskId,
  );

  const canManage = selectedTenant ? canManageTenant(selectedTenant.id) : false;

  useEffect(() => {
    setSelectedTaskId(null);
    setConflict(null);
  }, [boardId, tenantId]);

  function refreshBoard() {
    if (!tenantId) return;
    void queryClient.invalidateQueries({ queryKey: ["board", tenantId, boardId] });
    void queryClient.invalidateQueries({ queryKey: ["boards", tenantId] });
    void queryClient.invalidateQueries({ queryKey: ["activity", tenantId] });
  }

  async function runMove(
    taskId: string,
    toColumnId: string,
    toIndex: number,
    options: { recordHistory?: boolean; version?: number } = {},
  ) {
    if (!tenantId) return;
    const current = queryClient.getQueryData<Board>(cacheKey);
    if (!current) return;
    const task = current.tasks.find((candidate) => candidate.id === taskId);
    if (!task) return;

    const fromColumnId = task.columnId;
    const fromIndex = current.tasks
      .filter((candidate) => candidate.columnId === fromColumnId)
      .findIndex((candidate) => candidate.id === taskId);

    const snapshot = current;
    queryClient.setQueryData(cacheKey, moveInBoard(current, taskId, toColumnId, toIndex));

    try {
      const response = await api.patch(
        `/tasks/${taskId}/move`,
        { columnId: toColumnId, index: toIndex, version: options.version ?? task.version },
        tenantHeaders(tenantId),
      );
      const updated = response.data.data as Task;
      queryClient.setQueryData<Board>(cacheKey, (existing) =>
        existing
          ? { ...existing, tasks: existing.tasks.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)) }
          : existing,
      );
      if (options.recordHistory) {
        pushHistory({ taskId, fromColumnId, fromIndex, toColumnId, toIndex });
      }
      refreshBoard();
    } catch (caught) {
      queryClient.setQueryData(cacheKey, snapshot);
      const currentTask = conflictCurrentTask(caught) as Task | null;
      if (currentTask) {
        setConflict({
          message: "Another teammate moved or edited this task before your drop landed.",
          currentTask,
          retry: () => {
            setConflict(null);
            void runMove(taskId, toColumnId, toIndex, {
              recordHistory: options.recordHistory,
              version: currentTask.version,
            });
          },
        });
      } else {
        toast.error(apiErrorMessage(caught));
      }
    }
  }

  function handleMove(taskId: string, toColumnId: string, toIndex: number) {
    void runMove(taskId, toColumnId, toIndex, { recordHistory: true });
  }

  async function handleUndo() {
    const entry = undo();
    if (!entry) return;
    const current = queryClient.getQueryData<Board>(cacheKey);
    const task = current?.tasks.find((candidate) => candidate.id === entry.taskId);
    if (!task) return;
    await runMove(entry.taskId, entry.fromColumnId, entry.fromIndex, { version: task.version });
    toast.message("Move undone");
  }

  async function handleRedo() {
    const entry = redo();
    if (!entry) return;
    const current = queryClient.getQueryData<Board>(cacheKey);
    const task = current?.tasks.find((candidate) => candidate.id === entry.taskId);
    if (!task) return;
    await runMove(entry.taskId, entry.toColumnId, entry.toIndex, { version: task.version });
    toast.message("Move reapplied");
  }

  async function executeUpdate(input: TaskSaveInput, taskId: string, version: number) {
    if (!tenantId) return;
    setSavingTask(true);
    try {
      const response = await api.patch(
        `/tasks/${taskId}`,
        { ...input, version },
        tenantHeaders(tenantId),
      );
      const updated = response.data.data as Task;
      queryClient.setQueryData<Board>(cacheKey, (existing) =>
        existing
          ? { ...existing, tasks: existing.tasks.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)) }
          : existing,
      );
      toast.success("Task saved");
      refreshBoard();
      setConflict(null);
    } catch (caught) {
      const currentTask = conflictCurrentTask(caught) as Task | null;
      if (currentTask) {
        setConflict({
          message: "This task changed while you were editing it.",
          currentTask,
          retry: () => {
            setConflict(null);
            void executeUpdate(input, taskId, currentTask.version);
          },
        });
      } else {
        toast.error(apiErrorMessage(caught));
      }
    } finally {
      setSavingTask(false);
    }
  }

  function saveTask(input: TaskSaveInput) {
    if (!selectedTask) return;
    void executeUpdate(input, selectedTask.id, selectedTask.version);
  }

  async function confirmDeleteTask() {
    if (!deletingTask || !tenantId) return;
    try {
      await api.delete(`/tasks/${deletingTask.id}`, tenantHeaders(tenantId));
      setDeletingTask(null);
      setSelectedTaskId(null);
      toast.success("Task deleted");
      refreshBoard();
    } catch (caught) {
      toast.error(apiErrorMessage(caught));
    }
  }

  async function renameColumn() {
    if (!renamingColumn || !tenantId) return;
    const name = renameValue.trim();
    if (!name || name === renamingColumn.name) {
      setRenamingColumn(null);
      return;
    }
    setColumnBusy(true);
    try {
      await api.patch(`/columns/${renamingColumn.id}`, { name }, tenantHeaders(tenantId));
      setRenamingColumn(null);
      toast.success("Column renamed");
      refreshBoard();
    } catch (caught) {
      toast.error(apiErrorMessage(caught));
    } finally {
      setColumnBusy(false);
    }
  }

  async function deleteColumn() {
    if (!deletingColumn || !tenantId) return;
    setColumnBusy(true);
    try {
      await api.delete(`/columns/${deletingColumn.id}`, tenantHeaders(tenantId));
      setDeletingColumn(null);
      toast.success("Column deleted");
      refreshBoard();
    } catch (caught) {
      toast.error(apiErrorMessage(caught));
    } finally {
      setColumnBusy(false);
    }
  }

  if (!selectedTenant) {
    return (
      <EmptyState
        icon={<KanbanSquare className="size-5" />}
        title="Pick a branch first"
        description="Boards live inside a branch (tenant). Choose one from the sidebar."
        action={
          <Link href="/dashboard">
            <Button size="sm" variant="secondary">
              <ArrowLeft className="size-3.5" /> Back to dashboard
            </Button>
          </Link>
        }
      />
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16 w-full" />
        <div className="flex gap-3">
          {[0, 1, 2, 3].map((index) => (
            <Skeleton key={index} className="h-96 w-[300px] shrink-0" />
          ))}
        </div>
        <LoadingBlock label="Loading board" />
      </div>
    );
  }

  if (isError || !board) {
    return (
      <EmptyState
        icon={<KanbanSquare className="size-5" />}
        title="Board unavailable"
        description={apiErrorMessage(error)}
        action={
          <Link href="/dashboard">
            <Button size="sm" variant="secondary">
              <ArrowLeft className="size-3.5" /> Back to dashboard
            </Button>
          </Link>
        }
      />
    );
  }

  return (
    <div className="flex h-[calc(100vh-7.5rem)] flex-col gap-4">
      <header className="shrink-0">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-faint">
              <Link href="/dashboard" className="inline-flex items-center gap-1 hover:text-ink">
                <ArrowLeft className="size-3" /> Dashboard
              </Link>
              <span>/</span>
              <span>{selectedOrg?.name}</span>
              <span>/</span>
              <span className="text-muted">{selectedTenant.name}</span>
            </div>
            <h1 className="mt-1 truncate text-xl font-semibold tracking-tight sm:text-2xl">{board.name}</h1>
            <p className="mt-1 line-clamp-1 max-w-2xl text-xs text-muted">
              {board.description || "No description yet."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <Button
              size="icon"
              variant="ghost"
              onClick={() => void handleUndo()}
              disabled={!canUndo}
              aria-label="Undo last move"
              title="Undo last move"
            >
              <Undo2 className="size-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => void handleRedo()}
              disabled={!canRedo}
              aria-label="Redo move"
              title="Redo move"
            >
              <Redo2 className="size-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setColumnsOpen(true)}
              disabled={!canManage}
              title={canManage ? "Manage columns" : "Only admins can manage columns"}
            >
              <Columns3 className="size-3.5" /> <span className="hidden sm:inline">Columns</span>
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setSettingsOpen(true)}
              disabled={!canManage}
              title={canManage ? "Board settings" : "Only admins can edit the board"}
            >
              <Settings2 className="size-3.5" />
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setCreateColumnId(board.columns[0]?.id ?? null);
                setCreateTaskOpen(true);
              }}
              disabled={board.columns.length === 0}
            >
              <Plus className="size-3.5" /> <span className="hidden sm:inline">New task</span>
            </Button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Badge tone="muted">
            <LayoutGrid className="size-3" /> {board.columns.length} columns
          </Badge>
          <Badge tone="muted">
            <ListTodo className="size-3" /> {board.tasks.length} tasks
          </Badge>
          <Badge tone="muted">
            <Users className="size-3" /> {presence.length} online
          </Badge>
          <Badge tone={connected ? "success" : "warning"}>
            {connected ? <Wifi className="size-3" /> : <WifiOff className="size-3" />}
            {connected ? "Live sync" : "Offline — changes will retry"}
          </Badge>
          <div className="ml-auto flex items-center gap-1.5">
            {presence.slice(0, 5).map((person) => (
              <Avatar
                key={person.userId}
                name={person.name}
                color={person.avatarColor}
                size="xs"
                ring
                title={`${person.name} — active`}
              />
            ))}
            {presence.length === 0 ? (
              <span className="text-[10px] text-faint">Only you here right now</span>
            ) : null}
          </div>
        </div>
      </header>

      <div className="min-h-0 flex-1">
        <KanbanBoard
          board={board}
          onMove={handleMove}
          onOpenTask={(task) => setSelectedTaskId(task.id)}
          onAddTask={(columnId) => {
            setCreateColumnId(columnId);
            setCreateTaskOpen(true);
          }}
          onRenameColumn={(column) => {
            setRenamingColumn(column);
            setRenameValue(column.name);
          }}
          onDeleteColumn={(column) => setDeletingColumn(column)}
          canManage={canManage}
        />
      </div>

      <p className="shrink-0 text-[10px] text-faint">
        Drag cards to reorder · undo/redo tracks your last 50 moves · board updated{" "}
        {relativeTime(board.updatedAt)}
      </p>

      <TaskDrawer
        task={selectedTask}
        open={Boolean(selectedTask)}
        people={people}
        activity={taskActivity}
        activityLoading={taskActivityLoading}
        saving={savingTask}
        canDelete={Boolean(selectedTask && (canManage || selectedTask.createdBy === user?.id))}
        onClose={() => setSelectedTaskId(null)}
        onSave={saveTask}
        onDelete={() => selectedTask && setDeletingTask(selectedTask)}
      />

      <CreateTaskDialog
        open={createTaskOpen}
        onClose={() => setCreateTaskOpen(false)}
        tenantId={selectedTenant.id}
        boardId={board.id}
        columns={board.columns}
        people={people}
        initialColumnId={createColumnId}
      />

      <ColumnManagerDialog
        open={columnsOpen}
        onClose={() => setColumnsOpen(false)}
        board={board}
        tenantId={selectedTenant.id}
      />

      <BoardSettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        board={board}
        tenantId={selectedTenant.id}
      />

      <Modal
        open={Boolean(renamingColumn)}
        onClose={() => setRenamingColumn(null)}
        title="Rename column"
        footer={
          <>
            <Button variant="ghost" onClick={() => setRenamingColumn(null)}>
              Cancel
            </Button>
            <Button loading={columnBusy} onClick={() => void renameColumn()}>
              Save name
            </Button>
          </>
        }
      >
        <Field label="Column name">
          <Input
            autoFocus
            maxLength={80}
            value={renameValue}
            onChange={(event) => setRenameValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void renameColumn();
            }}
          />
        </Field>
      </Modal>

      <Modal
        open={Boolean(deletingColumn)}
        onClose={() => setDeletingColumn(null)}
        title="Delete column?"
        description={`“${deletingColumn?.name}” must be empty before it can be removed. This cannot be undone.`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeletingColumn(null)}>
              Cancel
            </Button>
            <Button variant="danger" loading={columnBusy} onClick={() => void deleteColumn()}>
              Delete column
            </Button>
          </>
        }
      />

      <Modal
        open={Boolean(deletingTask)}
        onClose={() => setDeletingTask(null)}
        title="Delete task?"
        description={`“${deletingTask?.title}” and its activity history will be permanently removed.`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeletingTask(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => void confirmDeleteTask()}>
              Delete task
            </Button>
          </>
        }
      />

      <Modal
        open={Boolean(conflict)}
        onClose={() => setConflict(null)}
        title="This task changed on another device"
        description={conflict?.message}
      >
        <div className="space-y-4">
          {conflict?.currentTask ? (
            <div className="rounded-xl border border-line-soft bg-surface-2 p-3 text-xs text-muted">
              <p className="font-medium text-ink">{conflict.currentTask.title}</p>
              <p className="mt-1">
                Server version v{conflict.currentTask.version} · updated{" "}
                {relativeTime(conflict.currentTask.updatedAt)}
              </p>
              {conflict.currentTask.assignee ? (
                <p className="mt-1">Assigned to {conflict.currentTask.assignee.name}</p>
              ) : null}
            </div>
          ) : null}
          <p className="text-xs leading-relaxed text-faint">
            Choose “Use latest” to discard your pending change and reload the board, or retry your
            change against the newest version.
          </p>
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => {
                setConflict(null);
                refreshBoard();
              }}
            >
              Use latest
            </Button>
            <Button
              onClick={() => {
                const retry = conflict?.retry;
                setConflict(null);
                retry?.();
              }}
              disabled={!conflict?.retry}
            >
              Retry my change
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
