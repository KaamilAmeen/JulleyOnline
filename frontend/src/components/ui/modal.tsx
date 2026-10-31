"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  className,
  dismissible = true,
}: {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  dismissible?: boolean;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open || !dismissible) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, dismissible, onClose]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  if (!mounted || !open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:items-center">
      <div
        className="fixed inset-0 bg-canvas/80 backdrop-blur-sm"
        onClick={dismissible ? onClose : undefined}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "card animate-in-up relative z-10 my-auto w-full max-w-lg p-6 shadow-2xl shadow-black/50",
          className,
        )}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            {title ? <h2 className="text-lg font-semibold tracking-tight">{title}</h2> : null}
            {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
          </div>
          {dismissible ? (
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-faint transition-colors hover:bg-surface-3 hover:text-ink"
              aria-label="Close dialog"
            >
              <X className="size-4" />
            </button>
          ) : null}
        </div>
        {children ? <div className="mt-5">{children}</div> : null}
        {footer ? <div className="mt-6 flex justify-end gap-2">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  );
}
