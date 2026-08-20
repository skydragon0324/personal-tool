"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from "react";

import { authKeys } from "@/features/auth/api/auth-queries";
import type { AuthUser, LoginPayload, RegisterPayload } from "@/features/auth/types";
import { clearUserLocalState } from "@/features/auth/utils/clear-user-state";
import { ApiError, apiClient, setCsrfToken, setUnauthorizedHandler } from "@/lib/api-client";

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  const meQuery = useQuery({
    queryKey: authKeys.me,
    queryFn: async () => {
      try {
        return await apiClient.me();
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) return null;
        throw error;
      }
    },
    retry: false,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!meQuery.data) return;
    void apiClient.getCsrf();
  }, [meQuery.data]);

  const resetWorkspace = useCallback(() => {
    queryClient.clear();
    clearUserLocalState(window.localStorage);
    setCsrfToken(null);
  }, [queryClient]);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      resetWorkspace();
      window.location.assign("/login");
    });
    return () => setUnauthorizedHandler(null);
  }, [resetWorkspace]);

  const finishAuth = useCallback(
    async (user: AuthUser, csrfToken: string) => {
      await queryClient.cancelQueries();
      clearUserLocalState(window.localStorage);
      setCsrfToken(csrfToken);
      queryClient.setQueryData(authKeys.me, user);
      window.location.assign("/today");
    },
    [queryClient],
  );

  const login = useCallback(
    async (payload: LoginPayload) => {
      const body = await apiClient.login(payload);
      await finishAuth(body.user, body.csrf_token);
    },
    [finishAuth],
  );

  const register = useCallback(
    async (payload: RegisterPayload) => {
      const body = await apiClient.register(payload);
      await finishAuth(body.user, body.csrf_token);
    },
    [finishAuth],
  );

  const logout = useCallback(async () => {
    try {
      await apiClient.logout();
    } finally {
      await queryClient.cancelQueries();
      resetWorkspace();
      window.location.assign("/login");
    }
  }, [queryClient, resetWorkspace]);

  const value = useMemo(
    () => ({
      user: meQuery.data ?? null,
      isLoading: meQuery.isLoading,
      login,
      register,
      logout,
    }),
    [login, logout, meQuery.data, meQuery.isLoading, register],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used within AuthProvider");
  return value;
}
