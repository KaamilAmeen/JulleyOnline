"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import type { Board, BoardColumn } from "@/lib/types";
import { api, apiErrorMessage, tenantHeaders } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";

export function ColumnManagerDialog({
  open,
  onClose,
  board,
  tenantId,
}: {
  open: boolean;
  onClose: () => void;
  board: Board;
  tenantId: string;
}) {
  const queryClient = useQueryClient();
  const [newName, setNewName] = useState("");
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["board", tenantId, board.id] });
    void queryClient.invalidateQueries({ queryKey: ["boards", tenantId] });
  }

  async function addColumn(event: React.FormEvent) {
    event.preventDefault();
    if (!newName.trim()) return;
    setBusy(true);
    try {
      await api.post(
        `/boards/${board.id}/columns`,
        { name: newName.trim() },
        tenantHeaders(tenantId),
      );
      setNewName("");
      refresh();
      toast.success("Column added");
    } catch (caught) {
      toast.error(apiErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  async function rename(column: BoardColumn) {
    if (!renameValue.trim() || renameValue.trim() === column.name) {
      setRenameId(null);
      return;
    }
    setBusy(true);
    try {
      await api.patch(
        `/columns/${column.id}`,
        { name: renameValue.trim() },
        tenantHeaders(tenantId),
      );
      setRenameId(null);
      refresh();
      toast.success("Column renamed");
    } catch (caught) {
      toast.error(apiErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  async function remove(column: BoardColumn) {
    setBusy(true);
    try {
      await api.delete(`/columns/${column.id}`, tenantHeaders(tenantId));
      setConfirmId(null);
      refresh();
      toast.success("Column deleted");
    } catch (caught) {
      toast.error(apiErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  async function move(column: BoardColumn, direction: -1 | 1) {
    const ordered = [...board.columns].sort((a, b) => a.position - b.position);
    const index = ordered.findIndex((item) => item.id === column.id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= ordered.length) return;
    const [moved] = ordered.splice(index, 1);
    ordered.splice(target, 0, moved!);
    setBusy(true);
    try {
      await api.post(
        "/columns/reorder",
        { boardId: board.id, orderedIds: ordered.map((item) => item.id) },
        tenantHeaders(tenantId),
      );
      refresh();
    } catch (caught) {
      toast.error(apiErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Manage columns"
      description="Rename, reorder or remove columns. A column must be empty before it can be deleted."
    >
      <div className="space-y-2">
        {board.columns.map((column, index) => {
          const taskCount = board.tasks.filter((task) => task.columnId === column.id).length;
          return (
            <div
              key={column.id}
              className="flex items-center gap-2 rounded-xl border border-line-soft bg-surface-2 px-3 py-2"
            >
              <span className="text-[10px] text-faint">{index + 1}</span>
              {renameId === column.id ? (
                <>
                  <Input
                    autoFocus
                    value={renameValue}
                    onChange={(event) => setRenameValue(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") void rename(column);
                      if (event.key === "Escape") setRenameId(null);
                    }}
                    className="h-8 flex-1"
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => void rename(column)}
                    aria-label="Save name"
                  >
                    <Check className="size-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setRenameId(null)}
                    aria-label="Cancel rename"
                  >
                    <X className="size-4" />
                  </Button>
                </>
              ) : (
                <>
                  <span className="min-w-0 flex-1 truncate text-sm text-ink">{column.name}</span>
                  <span className="text-[10px] text-faint">{taskCount} tasks</span>
                  <Button
                    size="icon"
                    variant="ghost"
                    disabled={index === 0 || busy}
                    onClick={() => void move(column, -1)}
                    aria-label="Move column left"
                  >
                    <ArrowUp className="size-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    disabled={index === board.columns.length - 1 || busy}
                    onClick={() => void move(column, 1)}
                    aria-label="Move column right"
                  >
                    <ArrowDown className="size-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => {
                      setRenameId(column.id);
                      setRenameValue(column.name);
                    }}
                    aria-label="Rename column"
                  >
                    <Pencil className="size-4" />
                  </Button>
                  {confirmId === column.id ? (
                    <Button
                      size="sm"
                      variant="danger"
                      disabled={busy}
                      onClick={() => void remove(column)}
                    >
                      Confirm
                    </Button>
                  ) : (
                    <Button
                      size="icon"
                      variant="ghost"
                      disabled={taskCount > 0}
                      title={taskCount > 0 ? "Move or delete the tasks first" : "Delete column"}
                      onClick={() => setConfirmId(column.id)}
                      aria-label="Delete column"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>

      <form onSubmit={addColumn} className="mt-4 flex gap-2">
        <Input
          value={newName}
          onChange={(event) => setNewName(event.target.value)}
          maxLength={80}
          placeholder="New column name"
        />
        <Button type="submit" disabled={busy || !newName.trim()}>
          <Plus className="size-4" /> Add
        </Button>
      </form>
    </Modal>
  );
}
