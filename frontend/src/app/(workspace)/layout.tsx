"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { useAuth } from "@/features/auth/components/auth-provider";
import { WorkspaceLoadingScreen } from "@/features/auth/components/workspace-loading-screen";
import { LifeManagementShell } from "@/features/shell/components/life-management-shell";

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) router.replace("/login");
  }, [isLoading, router, user]);

  if (isLoading || !user) return <WorkspaceLoadingScreen />;
  return <LifeManagementShell>{children}</LifeManagementShell>;
}
