"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, KanbanSquare, Radio, ShieldCheck, Users } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { apiErrorMessage } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/feedback";

const highlights = [
  { icon: ShieldCheck, text: "Organization → branch isolation enforced on every query" },
  { icon: Radio, text: "Live boards over WebSockets with presence and recovery" },
  { icon: Users, text: "Role-aware collaboration for admins and members" },
];

export default function LoginPage() {
  const { user, loading, login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("rahul@abctech.dev");
  const [password, setPassword] = useState("Password123!");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) router.replace("/dashboard");
  }, [loading, user, router]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email.trim().toLowerCase(), password);
      router.replace("/dashboard");
    } catch (caught) {
      setError(apiErrorMessage(caught));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <section className="relative hidden flex-col justify-between overflow-hidden border-r border-line-soft p-12 lg:flex">
        <div
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            background:
              "radial-gradient(600px 300px at 20% 10%, rgba(99,102,241,0.25), transparent 60%), radial-gradient(500px 300px at 80% 90%, rgba(14,165,233,0.16), transparent 60%)",
          }}
        />
        <div className="relative">
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-xl bg-accent text-white shadow-lg shadow-accent/30">
              <KanbanSquare className="size-6" />
            </span>
            <div>
              <p className="text-base font-semibold tracking-tight">Julley Board</p>
              <p className="text-xs text-muted">Multi-tenant collaboration</p>
            </div>
          </div>

          <h1 className="mt-16 max-w-lg text-4xl font-semibold leading-tight tracking-tight text-balance">
            One workspace. Many organizations. Zero data leaks.
          </h1>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-muted">
            Plan work across branches with a shared real-time Kanban, optimistic drag-and-drop,
            conflict-safe edits and an auditable activity trail.
          </p>

          <ul className="mt-10 space-y-4">
            {highlights.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-3 text-sm text-muted">
                <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface-3 text-accent-strong">
                  <Icon className="size-4" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative rounded-2xl border border-line-soft bg-surface/60 p-4 text-xs text-muted">
          <p className="font-medium text-ink">Demo workspace</p>
          <p className="mt-1">
            Sign in as <span className="text-ink">rahul@abctech.dev</span> to explore ABC Technologies
            (Hyderabad, Bangalore, Chennai) and XYZ Solutions.
          </p>
        </div>
      </section>

      <section className="flex items-center justify-center px-5 py-12 sm:px-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <span className="flex size-10 items-center justify-center rounded-xl bg-accent text-white">
              <KanbanSquare className="size-5" />
            </span>
            <span className="text-base font-semibold">Julley Board</span>
          </div>

          <h2 className="text-2xl font-semibold tracking-tight">Welcome back</h2>
          <p className="mt-1.5 text-sm text-muted">Sign in to continue to your boards.</p>

          <form onSubmit={onSubmit} className="mt-7 space-y-4">
            <Field label="Email">
              <Input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@company.com"
              />
            </Field>
            <Field label="Password">
              <Input
                type="password"
                autoComplete="current-password"
                required
                minLength={8}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
              />
            </Field>

            {error ? (
              <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
                {error}
              </p>
            ) : null}

            <Button type="submit" className="w-full" size="lg" loading={submitting}>
              {submitting ? "Signing in" : "Sign in"}
              {!submitting ? <ArrowRight className="size-4" /> : null}
            </Button>
          </form>

          <div className="mt-6 flex items-center gap-3 text-xs text-faint">
            <span className="h-px flex-1 bg-line-soft" />
            or
            <span className="h-px flex-1 bg-line-soft" />
          </div>

          <div className="mt-6 space-y-3 text-sm">
            <Link
              href="/register"
              className="flex h-11 w-full items-center justify-center rounded-xl border border-line text-ink transition-colors hover:bg-surface-3"
            >
              Create a new account
            </Link>
            <button
              type="button"
              onClick={() => {
                setEmail("rahul@abctech.dev");
                setPassword("Password123!");
              }}
              className="flex w-full items-center justify-center gap-1.5 text-xs text-muted transition-colors hover:text-ink"
            >
              <CheckCircle2 className="size-3.5" />
              Use seeded demo credentials
            </button>
          </div>

          {loading ? (
            <div className="mt-6 flex items-center justify-center gap-2 text-xs text-faint">
              <Spinner className="size-3.5" /> Checking your session
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
