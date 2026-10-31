import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("size-5 animate-spin text-muted", className)} aria-label="Loading" />;
}

export function LoadingBlock({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center gap-3 text-sm text-muted">
      <Spinner />
      <span>{label}...</span>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-xl bg-surface-3/70", className)} />;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-line px-6 py-12 text-center",
        className,
      )}
    >
      {icon ? <div className="rounded-2xl bg-surface-3 p-3 text-accent-strong">{icon}</div> : null}
      <div>
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
        {description ? <p className="mt-1 max-w-sm text-sm text-muted">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow ? (
          <p className="mb-1 text-xs font-medium uppercase tracking-[0.18em] text-accent-strong">{eyebrow}</p>
        ) : null}
        <h1 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">{title}</h1>
        {description ? <p className="mt-1.5 max-w-2xl text-sm text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
