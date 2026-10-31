"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import type { Membership, User } from "@/lib/types";

interface AuthContextValue {
  user: User | null;
  memberships: Membership[];
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  reload: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      const response = await api.get("/auth/me");
      setUser(response.data.data.user as User);
      setMemberships(response.data.data.memberships as Membership[]);
    } catch {
      setUser(null);
      setMemberships([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const login = useCallback(async (email: string, password: string) => {
    const response = await api.post("/auth/login", { email, password });
    setUser(response.data.data.user as User);
    setMemberships(response.data.data.memberships as Membership[]);
  }, []);

  const register = useCallback(async (name: string, email: string, password: string) => {
    const response = await api.post("/auth/register", { name, email, password });
    setUser(response.data.data.user as User);
    setMemberships(response.data.data.memberships as Membership[]);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } finally {
      setUser(null);
      setMemberships([]);
    }
  }, []);

  const value = useMemo(
    () => ({ user, memberships, loading, login, register, logout, reload }),
    [user, memberships, loading, login, register, logout, reload],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
