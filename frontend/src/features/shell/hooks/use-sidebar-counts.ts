import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/features/auth/components/auth-provider";
import { dashboardKeys } from "@/features/dashboard/hooks/use-dashboard";
import { isMyTask } from "@/features/dashboard/utils/my-tasks";
import { useNotificationFeed } from "@/features/notifications/hooks/use-notifications";
import { apiClient } from "@/lib/api-client";

export function useSidebarCounts() {
  const { user } = useAuth();
  const tasks = useQuery({
    queryKey: [...dashboardKeys.all, "tasks", "open"] as const,
    queryFn: () => apiClient.getDashboardTasks({ state: "open" }),
  });
  const feed = useNotificationFeed();
  return {
    myTasks: (tasks.data?.items ?? []).filter((row) => isMyTask(row, user?.id)).length,
    inbox: feed.data?.unread_count ?? 0,
  };
}
