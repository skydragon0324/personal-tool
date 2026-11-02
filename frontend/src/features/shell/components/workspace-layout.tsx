import { useRouter } from "@/lib/navigation";
import { useEffect, type ReactElement } from "react";

import { useAuth } from "@/features/auth/components/auth-provider";
import { WorkspaceLoadingScreen } from "@/features/auth/components/workspace-loading-screen";
import { LifeManagementShell } from "@/features/shell/components/life-management-shell";

export function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading, sessionCheckFailed, retrySessionCheck } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Only a confirmed 401 (user === null without an error) means signed out; a network blip or 5xx
    // must not bounce an authenticated user to the login page.
    if (!isLoading && !sessionCheckFailed && !user) router.replace("/login");
  }, [isLoading, router, sessionCheckFailed, user]);

  if (!isLoading && sessionCheckFailed && !user) {
    return <WorkspaceLoadingScreen onRetry={retrySessionCheck} />;
  }
  if (isLoading || !user) return <WorkspaceLoadingScreen />;
  return <LifeManagementShell>{children}</LifeManagementShell>;
}

/** `getLayout` for pages inside the signed-in workspace. */
export function getWorkspaceLayout(page: ReactElement) {
  return <WorkspaceLayout>{page}</WorkspaceLayout>;
}
