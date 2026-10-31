"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, Send, Sparkles, User as UserIcon, X } from "lucide-react";
import { api, apiErrorMessage, tenantHeaders } from "@/lib/api";
import { useWorkspace } from "@/context/workspace-context";
import type { AiAnswer } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/feedback";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  meta?: Pick<AiAnswer, "toolsUsed" | "provider" | "model">;
  error?: boolean;
}

const SUGGESTIONS = [
  "What is overdue and who owns it?",
  "Summarize the workload per assignee.",
  "Which column has the most work in progress?",
  "Give me a stand-up summary for today.",
];

export function AssistantConsole({ compact = false }: { compact?: boolean }) {
  const { selectedTenant } = useWorkspace();
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState("");
  const [pending, setPending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, pending]);

  useEffect(() => {
    setMessages([]);
  }, [selectedTenant?.id]);

  async function ask(value: string) {
    const trimmed = value.trim();
    if (!trimmed || !selectedTenant || pending) return;

    const userMessage: Message = { id: crypto.randomUUID(), role: "user", content: trimmed };
    setMessages((current) => [...current, userMessage]);
    setQuestion("");
    setPending(true);

    try {
      const response = await api.post(
        "/ai/assistant",
        { question: trimmed },
        tenantHeaders(selectedTenant.id),
      );
      const answer = response.data.data as AiAnswer;
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: answer.answer,
          meta: {
            toolsUsed: answer.toolsUsed,
            provider: answer.provider,
            model: answer.model,
          },
        },
      ]);
    } catch (caught) {
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: apiErrorMessage(caught),
          error: true,
        },
      ]);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div ref={scrollRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-1 py-2">
        {messages.length === 0 ? (
          <div className="rounded-2xl border border-line-soft bg-surface/50 p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-ink">
              <Sparkles className="size-4 text-accent-strong" />
              Ask about {selectedTenant?.name ?? "your branch"}
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-muted">
              The assistant only sees a read-only snapshot of this branch. It cannot change tasks and
              never receives database credentials.
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => void ask(suggestion)}
                  disabled={!selectedTenant || pending}
                  className="rounded-full border border-line bg-surface-2 px-2.5 py-1 text-[11px] text-muted transition-colors hover:border-accent/40 hover:text-ink disabled:opacity-50"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {messages.map((message) => (
          <div
            key={message.id}
            className={cn("flex gap-2.5", message.role === "user" ? "justify-end" : "justify-start")}
          >
            {message.role === "assistant" ? (
              <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent-strong">
                <Bot className="size-4" />
              </span>
            ) : null}
            <div
              className={cn(
                "max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                message.role === "user"
                  ? "bg-accent text-white"
                  : message.error
                    ? "border border-rose-500/30 bg-rose-500/10 text-rose-200"
                    : "border border-line-soft bg-surface-2 text-ink",
              )}
            >
              {message.content}
              {message.meta ? (
                <div className="mt-2 flex flex-wrap items-center gap-1 border-t border-line-soft pt-2 text-[10px] text-faint">
                  <span className="rounded bg-surface-3 px-1.5 py-0.5">{message.meta.provider}</span>
                  {message.meta.model ? <span>{message.meta.model}</span> : null}
                  {message.meta.toolsUsed?.length ? (
                    <span>tools: {message.meta.toolsUsed.join(", ")}</span>
                  ) : null}
                </div>
              ) : null}
            </div>
            {message.role === "user" ? (
              <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-surface-3 text-muted">
                <UserIcon className="size-4" />
              </span>
            ) : null}
          </div>
        ))}

        {pending ? (
          <div className="flex items-center gap-2 text-xs text-muted">
            <Spinner className="size-3.5" /> Reading the branch snapshot...
          </div>
        ) : null}
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void ask(question);
        }}
        className={cn("mt-3 flex items-end gap-2 border-t border-line-soft pt-3", compact && "pb-1")}
      >
        <textarea
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void ask(question);
            }
          }}
          rows={compact ? 2 : 3}
          maxLength={1000}
          placeholder={selectedTenant ? "Ask a question about this branch..." : "Select a branch first"}
          disabled={!selectedTenant || pending}
          className="min-h-10 flex-1 resize-none rounded-xl border border-line bg-surface/80 px-3 py-2 text-sm text-ink placeholder:text-faint focus:border-accent/70 focus:outline-none focus:ring-2 focus:ring-accent/25 disabled:opacity-60"
        />
        <Button type="submit" size="icon" disabled={!selectedTenant || pending || !question.trim()}>
          <Send className="size-4" />
        </Button>
      </form>
    </div>
  );
}

export function AssistantPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

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
          "fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-line bg-surface p-4 shadow-2xl shadow-black/50 transition-transform duration-200",
          open ? "translate-x-0" : "translate-x-full",
        )}
        aria-hidden={!open}
      >
        <header className="mb-2 flex items-start justify-between">
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold">
              <Sparkles className="size-4 text-accent-strong" /> Branch assistant
            </p>
            <p className="mt-0.5 text-xs text-muted">Read-only insights over the active tenant.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-faint hover:bg-surface-3 hover:text-ink"
            aria-label="Close assistant"
          >
            <X className="size-4" />
          </button>
        </header>
        <AssistantConsole compact />
      </aside>
    </>
  );
}
