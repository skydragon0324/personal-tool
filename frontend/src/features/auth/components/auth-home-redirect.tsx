"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { useAuth } from "@/features/auth/components/auth-provider";
import { WorkspaceLoadingScreen } from "@/features/auth/components/workspace-loading-screen";

export function AuthHomeRedirect() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    router.replace(user ? "/today" : "/login");
  }, [isLoading, router, user]);

  return <WorkspaceLoadingScreen />;
}
