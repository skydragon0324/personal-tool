"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "@/lib/api-client";

import { notificationKeys } from "../api/notification-queries";
import type { NotificationFeed, NotificationPreferencesUpdate } from "../types";

export const NOTIFICATION_POLL_MS = 60_000;

type FeedContext = { previous?: NotificationFeed };

/**
 * Polls the feed. Each poll also makes the server generate whatever became due, so this keeps
 * running in background tabs to deliver desktop notifications while the app is open.
 */
export function useNotificationFeed(enabled = true) {
  return useQuery({
    queryKey: notificationKeys.feed,
    queryFn: () => apiClient.getNotifications(),
    enabled,
    staleTime: 0,
    refetchInterval: NOTIFICATION_POLL_MS,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
  });
}

function patchFeed(
  current: NotificationFeed | undefined,
  update: (feed: NotificationFeed) => NotificationFeed,
): NotificationFeed | undefined {
  return current ? update(current) : current;
}

export function useNotificationMutations() {
  const queryClient = useQueryClient();

  async function optimistic(update: (feed: NotificationFeed) => NotificationFeed) {
    await queryClient.cancelQueries({ queryKey: notificationKeys.feed });
    const previous = queryClient.getQueryData<NotificationFeed>(notificationKeys.feed);
    queryClient.setQueryData<NotificationFeed>(notificationKeys.feed, (current) =>
      patchFeed(current, update),
    );
    return { previous };
  }

  function rollback(_error: unknown, _vars: unknown, context?: FeedContext) {
    if (context?.previous) queryClient.setQueryData(notificationKeys.feed, context.previous);
  }

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: notificationKeys.feed });
  }

  const now = () => new Date().toISOString();

  const markRead = useMutation({
    mutationFn: (id: string) => apiClient.markNotificationRead(id),
    onMutate: (id: string) =>
      optimistic((feed) => {
        const target = feed.items.find((item) => item.id === id);
        if (!target || target.read_at) return feed;
        return {
          ...feed,
          unread_count: Math.max(feed.unread_count - 1, 0),
          items: feed.items.map((item) => (item.id === id ? { ...item, read_at: now() } : item)),
        };
      }),
    onError: rollback,
    onSettled: refresh,
  });

  const markAllRead = useMutation<void, Error, void, FeedContext>({
    mutationFn: () => apiClient.markAllNotificationsRead(),
    onMutate: () =>
      optimistic((feed) => ({
        ...feed,
        unread_count: 0,
        items: feed.items.map((item) => (item.read_at ? item : { ...item, read_at: now() })),
      })),
    onError: rollback,
    onSettled: refresh,
  });

  const dismiss = useMutation({
    mutationFn: (id: string) => apiClient.dismissNotification(id),
    onMutate: (id: string) =>
      optimistic((feed) => {
        const target = feed.items.find((item) => item.id === id);
        return {
          ...feed,
          unread_count:
            target && !target.read_at ? Math.max(feed.unread_count - 1, 0) : feed.unread_count,
          items: feed.items.filter((item) => item.id !== id),
        };
      }),
    onError: rollback,
    onSettled: refresh,
  });

  const dismissAll = useMutation<void, Error, void, FeedContext>({
    mutationFn: () => apiClient.dismissAllNotifications(),
    onMutate: () => optimistic((feed) => ({ ...feed, unread_count: 0, items: [] })),
    onError: rollback,
    onSettled: refresh,
  });

  const removeFromFeed = (id: string) =>
    optimistic((feed) => {
      const target = feed.items.find((item) => item.id === id);
      return {
        ...feed,
        unread_count:
          target && !target.read_at ? Math.max(feed.unread_count - 1, 0) : feed.unread_count,
        items: feed.items.filter((item) => item.id !== id),
      };
    });

  // Snoozing and completing change the task too, so refresh the views that show it.
  function refreshTaskViews() {
    refresh();
    void queryClient.invalidateQueries({ queryKey: ["board"] });
    void queryClient.invalidateQueries({ queryKey: ["task"] });
    void queryClient.invalidateQueries({ queryKey: ["today"] });
    void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  }

  const snooze = useMutation({
    mutationFn: ({ id, remindAt }: { id: string; remindAt: string }) =>
      apiClient.snoozeNotification(id, remindAt),
    onMutate: ({ id }) => removeFromFeed(id),
    onError: rollback,
    onSettled: refreshTaskViews,
  });

  const completeTask = useMutation({
    mutationFn: (id: string) => apiClient.completeNotificationTask(id),
    onMutate: (id: string) => removeFromFeed(id),
    onError: rollback,
    onSettled: refreshTaskViews,
  });

  return { markRead, markAllRead, dismiss, dismissAll, snooze, completeTask };
}

export function useNotificationPreferences(enabled = true) {
  return useQuery({
    queryKey: notificationKeys.preferences,
    queryFn: () => apiClient.getNotificationPreferences(),
    enabled,
  });
}

export function useUpdateNotificationPreferences() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: NotificationPreferencesUpdate) =>
      apiClient.updateNotificationPreferences(payload),
    onSuccess: (prefs) => {
      queryClient.setQueryData(notificationKeys.preferences, prefs);
      void queryClient.invalidateQueries({ queryKey: notificationKeys.feed });
    },
  });
}
