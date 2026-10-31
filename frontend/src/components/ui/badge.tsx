import { cn } from "@/lib/utils";

type Tone = "default" | "accent" | "success" | "warning" | "danger" | "muted";

const tones: Record<Tone, string> = {
  default: "border-line bg-surface-3 text-ink",
  accent: "border-accent/30 bg-accent/10 text-indigo-200",
  success: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  warning: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  danger: "border-rose-500/30 bg-rose-500/10 text-rose-300",
  muted: "border-line-soft bg-surface text-muted",
};

export function Badge({
  tone = "default",
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
