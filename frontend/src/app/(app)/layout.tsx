import type { ReactNode } from "react";
import { AppLayoutClient } from "@/components/app-layout-client";

/**
 * Every route below this layout is gated on the client: the shell only renders
 * after `/api/auth/me` resolves in the browser, so the server never renders a
 * page segment here. That makes instant-navigation validation impossible for
 * these routes (Next.js reports them as "dropped segments"), and they are
 * client-rendered SPA transitions anyway.
 *
 * `instant` can only be exported from a Server Component, which is why the
 * auth-gated shell lives in `AppLayoutClient` and this file stays a server
 * layout. See node_modules/next/dist/docs/.../route-segment-config/instant.
 */
export const instant = false;

export default function AppLayout({ children }: { children: ReactNode }) {
  return <AppLayoutClient>{children}</AppLayoutClient>;
}
