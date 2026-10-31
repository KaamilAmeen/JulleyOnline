"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import type { BoardColumn, Priority, TenantPerson } from "@/lib/types";
import { api, apiErrorMessage, tenantHeaders } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";

export function CreateTaskDialog({
  open,
  onClose,
  tenantId,
  boardId,
  columns,
  people,
  initialColumnId,
}: {
  open: boolean;
  onClose: () => void;
  tenantId: string;
  boardId: string;
  columns: BoardColumn[];
  people: TenantPerson[];
  initialColumnId: string | null;
}) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [columnId, setColumnId] = useState("");
  const [priority, setPriority] = useState<Priority>("MEDIUM");
  const [assignedTo, setAssignedTo] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTitle("");
    setDescription("");
    setPriority("MEDIUM");
    setAssignedTo("");
    setDueDate("");
    setError(null);
    setColumnId(initialColumnId ?? columns[0]?.id ?? "");
  }, [open, initialColumnId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!columnId) {
      setError("Choose a column");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.post(
        "/tasks",
        {
          boardId,
          columnId,
          title: title.trim(),
          description: description.trim() || null,
          priority,
          assignedTo: assignedTo || null,
          dueDate: dueDate ? new Date(`${dueDate}T00:00:00`).toISOString() : null,
        },
        tenantHeaders(tenantId),
      );
      await queryClient.invalidateQueries({ queryKey: ["board", tenantId, boardId] });
      await queryClient.invalidateQueries({ queryKey: ["boards", tenantId] });
      toast.success("Task created");
      onClose();
    } catch (caught) {
      setError(apiErrorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New task"
      description="Capture the work, then drag it across the board as it progresses."
    >
      <form onSubmit={submit} className="space-y-4">
        <Field label="Title">
          <Input
            autoFocus
            required
            maxLength={200}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Ship the tenant switcher"
          />
        </Field>
        <Field label="Description" hint="Optional">
          <Textarea
            rows={3}
            maxLength={10_000}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="What does done look like?"
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Column">
            <Select value={columnId} onChange={(event) => setColumnId(event.target.value)}>
              {columns.map((column) => (
                <option key={column.id} value={column.id}>
                  {column.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Priority">
            <Select value={priority} onChange={(event) => setPriority(event.target.value as Priority)}>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </Select>
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Assignee">
            <Select value={assignedTo} onChange={(event) => setAssignedTo(event.target.value)}>
              <option value="">Unassigned</option>
              {people.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Due date">
            <Input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
          </Field>
        </div>
        {error ? <p className="text-xs text-rose-300">{error}</p> : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={saving}>
            <Plus className="size-4" /> Create task
          </Button>
        </div>
      </form>
    </Modal>
  );
}
