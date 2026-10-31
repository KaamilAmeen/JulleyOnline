"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { KanbanSquare } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { Spinner } from "@/components/ui/feedback";

export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    router.replace(user ? "/dashboard" : "/login");
  }, [loading, user, router]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-accent/15 text-accent-strong">
        <KanbanSquare className="size-7" />
      </div>
      <div className="flex items-center gap-2 text-sm text-muted">
        <Spinner className="size-4" />
        Opening your workspace
      </div>
    </div>
  );
}
