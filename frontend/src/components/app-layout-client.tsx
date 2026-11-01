"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { KanbanSquare } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { AppShell } from "@/components/app-shell";
import { Spinner } from "@/components/ui/feedback";

/**
 * Client shell for the authenticated area.
 *
 * The whole subtree is gated on `/api/auth/me` resolving in the browser, so the
 * server can never render a page here. `(app)/layout.tsx` opts the subtree out
 * of instant-navigation validation for that reason; keep the auth gate in this
 * client component.
 */
export function AppLayoutClient({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-accent/15 text-accent-strong">
          <KanbanSquare className="size-7" />
        </span>
        <div className="flex items-center gap-2 text-sm text-muted">
          <Spinner className="size-4" /> Loading your workspace
        </div>
      </div>
    );
  }

  if (!user) return null;

  return <AppShell>{children}</AppShell>;
}
