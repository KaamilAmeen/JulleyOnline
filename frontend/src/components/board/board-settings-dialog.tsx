"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Board } from "@/lib/types";
import { api, apiErrorMessage, tenantHeaders } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";

export function BoardSettingsDialog({
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
  const router = useRouter();
  const [name, setName] = useState(board.name);
  const [description, setDescription] = useState(board.description ?? "");
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(board.name);
    setDescription(board.description ?? "");
    setConfirmDelete(false);
    setError(null);
  }, [open, board.id, board.name, board.description]);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.patch(
        `/boards/${board.id}`,
        { name: name.trim(), description: description.trim() || null },
        tenantHeaders(tenantId),
      );
      await queryClient.invalidateQueries({ queryKey: ["board", tenantId, board.id] });
      await queryClient.invalidateQueries({ queryKey: ["boards", tenantId] });
      toast.success("Board updated");
      onClose();
    } catch (caught) {
      setError(apiErrorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    setSaving(true);
    try {
      await api.delete(`/boards/${board.id}`, tenantHeaders(tenantId));
      await queryClient.invalidateQueries({ queryKey: ["boards", tenantId] });
      toast.success("Board deleted");
      onClose();
      router.push("/dashboard");
    } catch (caught) {
      toast.error(apiErrorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Board settings"
      description={`${board.columns.length} columns · ${board.tasks.length} tasks`}
    >
      {confirmDelete ? (
        <div className="space-y-4">
          <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">
            Deleting “{board.name}” permanently removes all of its columns, tasks and task history.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
              Keep board
            </Button>
            <Button variant="danger" loading={saving} onClick={() => void remove()}>
              <Trash2 className="size-4" /> Delete permanently
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={save} className="space-y-4">
          <Field label="Board name">
            <Input required minLength={2} maxLength={160} value={name} onChange={(event) => setName(event.target.value)} />
          </Field>
          <Field label="Description">
            <Textarea
              rows={3}
              maxLength={2000}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </Field>
          {error ? <p className="text-xs text-rose-300">{error}</p> : null}
          <div className="flex items-center justify-between">
            <Button type="button" variant="danger" size="sm" onClick={() => setConfirmDelete(true)}>
              <Trash2 className="size-3.5" /> Delete board
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" loading={saving}>
                <Save className="size-4" /> Save
              </Button>
            </div>
          </div>
        </form>
      )}
    </Modal>
  );
}
