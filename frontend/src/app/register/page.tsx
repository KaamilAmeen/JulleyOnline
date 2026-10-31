"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, KanbanSquare, Sparkles } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { apiErrorMessage } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";

export default function RegisterPage() {
  const { user, loading, register } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) router.replace("/dashboard");
  }, [loading, user, router]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    setSubmitting(true);
    try {
      await register(name.trim(), email.trim().toLowerCase(), password);
      router.replace("/dashboard");
    } catch (caught) {
      setError(apiErrorMessage(caught));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between px-6 py-5 sm:px-10">
        <Link href="/login" className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-xl bg-accent text-white">
            <KanbanSquare className="size-5" />
          </span>
          <span className="text-sm font-semibold">Julley Board</span>
        </Link>
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-xs text-muted transition-colors hover:text-ink"
        >
          <ArrowLeft className="size-3.5" /> Back to sign in
        </Link>
      </header>

      <main className="flex flex-1 items-center justify-center px-5 pb-16">
        <div className="w-full max-w-md">
          <div className="mb-7 text-center">
            <span className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-accent/15 text-accent-strong">
              <Sparkles className="size-6" />
            </span>
            <h1 className="text-2xl font-semibold tracking-tight">Create your account</h1>
            <p className="mt-1.5 text-sm text-muted">
              Start solo, then create an organization or ask an admin for an invite.
            </p>
          </div>

          <form onSubmit={onSubmit} className="card space-y-4 p-6">
            <Field label="Full name">
              <Input
                required
                minLength={2}
                maxLength={120}
                autoComplete="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Aarav Sharma"
              />
            </Field>
            <Field label="Work email">
              <Input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@company.com"
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Password" hint="At least 8 characters">
                <Input
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="••••••••"
                />
              </Field>
              <Field label="Confirm password">
                <Input
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(event) => setConfirm(event.target.value)}
                  placeholder="••••••••"
                />
              </Field>
            </div>

            {error ? (
              <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
                {error}
              </p>
            ) : null}

            <Button type="submit" size="lg" className="w-full" loading={submitting}>
              {submitting ? "Creating account" : "Create account"}
            </Button>
            <p className="text-center text-[11px] leading-relaxed text-faint">
              By continuing you agree to keep your workspace data tidy and your passwords strong.
            </p>
          </form>
        </div>
      </main>
    </div>
  );
}
