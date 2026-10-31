"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export function Menu({
  trigger,
  children,
  align = "left",
  className,
}: {
  trigger: (props: { open: boolean; toggle: () => void }) => React.ReactNode;
  children: (props: { close: () => void }) => React.ReactNode;
  align?: "left" | "right";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      {trigger({ open, toggle: () => setOpen((value) => !value) })}
      {open ? (
        <div
          className={cn(
            "animate-in-fade absolute z-40 mt-2 min-w-56 overflow-hidden rounded-xl border border-line bg-surface-2 p-1.5 shadow-2xl shadow-black/50",
            align === "right" ? "right-0" : "left-0",
            className,
          )}
        >
          {children({ close: () => setOpen(false) })}
        </div>
      ) : null}
    </div>
  );
}

export function MenuItem({
  className,
  active,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      type="button"
      className={cn(
        "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-muted transition-colors hover:bg-surface-3 hover:text-ink disabled:opacity-50",
        active && "bg-surface-3 text-ink",
        className,
      )}
      {...props}
    />
  );
}
