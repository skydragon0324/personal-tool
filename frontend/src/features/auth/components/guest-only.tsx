"use client";

import { useEffect } from "react";

import { useAuth } from "@/features/auth/components/auth-provider";
import { WorkspaceLoadingScreen } from "@/features/auth/components/workspace-loading-screen";

export function GuestOnly({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (user) window.location.replace("/today");
  }, [user]);

  if (isLoading || user) return <WorkspaceLoadingScreen />;
  return children;
}
