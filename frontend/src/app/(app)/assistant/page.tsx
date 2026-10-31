"use client";

import {
  Bot,
  Database,
  GitBranch,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
  Wand2,
} from "lucide-react";
import { useWorkspace } from "@/context/workspace-context";
import { AssistantConsole } from "@/components/assistant-console";
import { Badge } from "@/components/ui/badge";
import { EmptyState, PageHeader } from "@/components/ui/feedback";

const CAPABILITIES = [
  {
    icon: Database,
    title: "Tenant-scoped snapshot",
    body: "The Node API sends only the active branch's boards, tasks and recent activity. No other tenant is ever included.",
  },
  {
    icon: LockKeyhole,
    title: "Read-only by design",
    body: "The assistant has no database credentials and no write tools. It can summarize and answer, never mutate.",
  },
  {
    icon: ShieldCheck,
    title: "Optional LLM",
    body: "Add an API key to let a model write the answer, or keep the deterministic local fallback with zero external calls.",
  },
];

export default function AssistantPage() {
  const { selectedOrg, selectedTenant } = useWorkspace();

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={`${selectedOrg?.name ?? "Workspace"} · ${selectedTenant?.name ?? "No branch"}`}
        title="Branch assistant"
        description="Ask natural-language questions about the selected branch. Answers are generated from a read-only snapshot built by the API."
        actions={
          <Badge tone="accent">
            <Sparkles className="size-3" /> Read-only AI
          </Badge>
        }
      />

      {!selectedTenant ? (
        <EmptyState
          icon={<GitBranch className="size-5" />}
          title="No branch selected"
          description="Choose a branch to give the assistant its context."
        />
      ) : (
        <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
          <section className="card flex h-[65vh] min-h-[420px] flex-col p-4">
            <div className="mb-2 flex items-center justify-between border-b border-line-soft pb-3">
              <div className="flex items-center gap-2">
                <span className="flex size-8 items-center justify-center rounded-lg bg-accent/15 text-accent-strong">
                  <Bot className="size-4" />
                </span>
                <div>
                  <p className="text-sm font-semibold">Assistant</p>
                  <p className="text-[10px] text-faint">
                    Context: {selectedTenant.name} · {selectedTenant.boardCount} boards
                  </p>
                </div>
              </div>
              <Badge tone="muted">
                <Wand2 className="size-3" /> snapshot
              </Badge>
            </div>
            <AssistantConsole />
          </section>

          <aside className="space-y-3">
            {CAPABILITIES.map(({ icon: Icon, title, body }) => (
              <div key={title} className="card p-4">
                <div className="flex items-center gap-2">
                  <span className="flex size-8 items-center justify-center rounded-lg bg-surface-3 text-accent-strong">
                    <Icon className="size-4" />
                  </span>
                  <h2 className="text-sm font-semibold">{title}</h2>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-muted">{body}</p>
              </div>
            ))}

            <div className="card border-accent/20 bg-accent/5 p-4">
              <h2 className="text-sm font-semibold text-indigo-100">Good questions</h2>
              <ul className="mt-2 space-y-1.5 text-xs text-muted">
                <li>· What is overdue and who owns it?</li>
                <li>· Summarize the workload per assignee.</li>
                <li>· Which column has the most work in progress?</li>
                <li>· Give me a stand-up summary for today.</li>
              </ul>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
