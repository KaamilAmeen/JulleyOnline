"use client";

import { useQueryClient } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import type { PresenceUser } from "@/lib/types";
import { useAuth } from "./auth-context";
import { useWorkspace } from "./workspace-context";

interface JoinAck {
  ok: boolean;
  error?: string;
  role?: string;
  tenantId?: string;
  presence?: PresenceUser[];
}

interface SocketContextValue {
  socket: Socket | null;
  connected: boolean;
  presence: PresenceUser[];
}

const SocketContext = createContext<SocketContextValue>({
  socket: null,
  connected: false,
  presence: [],
});

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:5000";

const INVALIDATE_EVENTS = [
  "task:created",
  "task:updated",
  "task:moved",
  "task:deleted",
  "board:created",
  "board:updated",
  "board:deleted",
  "column:created",
  "column:updated",
  "column:deleted",
  "column:reordered",
] as const;

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { selectedTenantId } = useWorkspace();
  const queryClient = useQueryClient();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [presence, setPresence] = useState<PresenceUser[]>([]);
  const tenantRef = useRef<string | null>(null);

  useEffect(() => {
    if (!user) {
      setSocket(null);
      setConnected(false);
      setPresence([]);
      return;
    }

    const client = io(SOCKET_URL, {
      withCredentials: true,
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 800,
      reconnectionDelayMax: 5000,
    });

    setSocket(client);

    const invalidateBoardData = () => {
      void queryClient.invalidateQueries({ queryKey: ["boards"] });
      void queryClient.invalidateQueries({ queryKey: ["board"] });
    };

    const onConnect = () => {
      setConnected(true);
      // Network recovery: re-join the tenant room and resync authoritative state.
      if (tenantRef.current) {
        client.emit("tenant:join", { tenantId: tenantRef.current }, (ack: JoinAck) => {
          if (ack?.ok) setPresence(ack.presence ?? []);
        });
      }
      invalidateBoardData();
      void queryClient.invalidateQueries({ queryKey: ["activity"] });
      void queryClient.invalidateQueries({ queryKey: ["presence"] });
    };

    const onDisconnect = () => {
      setConnected(false);
      setPresence([]);
    };

    const onConnectError = () => setConnected(false);

    client.on("connect", onConnect);
    client.on("disconnect", onDisconnect);
    client.on("connect_error", onConnectError);

    for (const event of INVALIDATE_EVENTS) {
      client.on(event, invalidateBoardData);
    }
    client.on("activity:created", () => {
      void queryClient.invalidateQueries({ queryKey: ["activity"] });
      void queryClient.invalidateQueries({ queryKey: ["task-activity"] });
    });
    client.on("presence:update", (payload: { users: PresenceUser[] }) => {
      setPresence(payload.users);
    });
    client.on("presence:offline", () => {
      void queryClient.invalidateQueries({ queryKey: ["presence"] });
    });

    return () => {
      client.removeAllListeners();
      client.disconnect();
      setSocket(null);
      setConnected(false);
    };
  }, [user, queryClient]);

  useEffect(() => {
    tenantRef.current = selectedTenantId;
    if (!socket || !socket.connected || !selectedTenantId) {
      if (!selectedTenantId) setPresence([]);
      return;
    }

    socket.emit("tenant:join", { tenantId: selectedTenantId }, (ack: JoinAck) => {
      if (ack?.ok) {
        setPresence(ack.presence ?? []);
      }
    });
  }, [socket, selectedTenantId]);

  const value = useMemo(() => ({ socket, connected, presence }), [socket, connected, presence]);

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}

export function useSocket() {
  return useContext(SocketContext);
}
