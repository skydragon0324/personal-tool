import { useMutation, useQueryClient } from "@tanstack/react-query";

import { boardKeys, taskKeys } from "@/features/board/api/board-queries";
import type { TaskUpdate } from "@/features/board/types";
import { dashboardKeys } from "@/features/dashboard/hooks/use-dashboard";
import { notificationKeys } from "@/features/notifications/api/notification-queries";
import { todayKeys } from "@/features/today/api/today-queries";
import { apiClient } from "@/lib/api-client";
import { notifyApiError } from "@/lib/notify";
import { t } from "@/i18n";

import { calendarKeys } from "../api/calendar-queries";
import type { CalendarTask, CalendarTaskList } from "../types";
import { rescheduledDates } from "../utils/calendar-range";

export interface RescheduleInput {
  task: CalendarTask;
  dueDate: string;
}

/** The update a reschedule sends: the new dates, keeping the task's length. */
export function reschedulePayload({ task, dueDate }: RescheduleInput): TaskUpdate {
  return rescheduledDates(task, dueDate);
}

/**
 * Moves a task to another due day through the regular task update. The calendar shows the move at
 * once; if the server refuses, the previous dates come back and an error is shown.
 */
export function useRescheduleTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: RescheduleInput) => apiClient.updateTask(input.task.id, reschedulePayload(input)),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: calendarKeys.all });
      const snapshots = queryClient.getQueriesData<CalendarTaskList>({ queryKey: calendarKeys.all });
      const dates = rescheduledDates(input.task, input.dueDate);
      queryClient.setQueriesData<CalendarTaskList>({ queryKey: calendarKeys.all }, (current) =>
        current
          ? { ...current, items: current.items.map((item) => (item.id === input.task.id ? { ...item, ...dates } : item)) }
          : current,
      );
      return { snapshots };
    },
    onError: (error, _input, context) => {
      context?.snapshots.forEach(([key, data]) => queryClient.setQueryData(key, data));
      notifyApiError(error, t("calendar.couldNotReschedule"));
    },
    onSuccess: (task) => {
      queryClient.setQueryData(taskKeys.detail(task.id), task);
    },
    onSettled: (_task, _error, input) => {
      // The same refreshes a task edit on a board makes (the calendar is under the dashboard key).
      void queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
      void queryClient.invalidateQueries({ queryKey: todayKeys.all });
      void queryClient.invalidateQueries({ queryKey: boardKeys.views(input.task.board_id) });
      void queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}
