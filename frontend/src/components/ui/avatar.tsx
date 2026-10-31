import { cn, initials } from "@/lib/utils";

const sizes = {
  xs: "size-6 text-[10px]",
  sm: "size-7 text-[11px]",
  md: "size-9 text-xs",
  lg: "size-11 text-sm",
};

export function Avatar({
  name,
  color = "#6366f1",
  size = "md",
  className,
  ring = false,
  title,
}: {
  name: string;
  color?: string;
  size?: keyof typeof sizes;
  className?: string;
  ring?: boolean;
  title?: string;
}) {
  return (
    <span
      title={title ?? name}
      aria-label={name}
      className={cn(
        "inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold uppercase text-white",
        ring && "ring-2 ring-canvas",
        sizes[size],
        className,
      )}
      style={{ backgroundColor: color }}
    >
      {initials(name)}
    </span>
  );
}
