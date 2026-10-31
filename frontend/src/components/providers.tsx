"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { Toaster } from "sonner";
import { AuthProvider } from "@/context/auth-context";
import { SocketProvider } from "@/context/socket-context";
import { WorkspaceProvider } from "@/context/workspace-context";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 10_000,
            retry: 1,
            refetchOnWindowFocus: true,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <WorkspaceProvider>
          <SocketProvider>{children}</SocketProvider>
        </WorkspaceProvider>
      </AuthProvider>
      <Toaster
        theme="dark"
        position="bottom-right"
        toastOptions={{
          style: {
            background: "#151d31",
            border: "1px solid #22304e",
            color: "#e8eefc",
          },
        }}
      />
    </QueryClientProvider>
  );
}
