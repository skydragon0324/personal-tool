"use client";

import {
  ActionIcon,
  Button,
  Group,
  Indicator,
  Popover,
  ScrollArea,
  Text,
  UnstyledButton,
} from "@mantine/core";
import { useState } from "react";

import {
  useNotificationFeed,
  useNotificationMutations,
} from "../hooks/use-notifications";
import { useOpenNotification } from "../hooks/use-open-notification";
import type { AppNotification, NotificationKind } from "../types";
import { formatNotificationTime } from "../utils/notification-utils";
import { NotificationSettingsModal } from "./notification-settings-modal";
import { TaskAlertActions, isTaskAlert } from "./task-alert-actions";

const KIND_LABEL: Record<NotificationKind, string> = {
  daily_digest: "Daily digest",
  schedule_start: "Schedule",
  task_reminder: "Reminder",
  board_shared: "Shared board",
  task_assigned: "Assigned to you",
  task_overdue: "Overdue",
};

const KIND_DOT: Record<NotificationKind, string> = {
  daily_digest: "bg-teal-500",
  schedule_start: "bg-blue-500",
  task_reminder: "bg-orange-500",
  board_shared: "bg-violet-500",
  task_assigned: "bg-indigo-500",
  task_overdue: "bg-red-500",
};

export function NotificationBell() {
  const [opened, setOpened] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const feed = useNotificationFeed();
  const { markAllRead, dismiss, dismissAll } = useNotificationMutations();
  const open = useOpenNotification();
  const items = feed.data?.items ?? [];
  const unread = feed.data?.unread_count ?? 0;

  return (
    <>
      <Popover
        opened={opened}
        onChange={setOpened}
        position="bottom-start"
        width={380}
        shadow="md"
        withinPortal
      >
        <Popover.Target>
          <Indicator
            label={unread > 99 ? "99+" : unread}
            size={16}
            color="red"
            disabled={unread === 0}
            offset={4}
          >
            <ActionIcon
              variant="subtle"
              color="gray"
              size="lg"
              aria-label={
                unread ? `Notifications (${unread} unread)` : "Notifications"
              }
              onClick={() => setOpened((value) => !value)}
            >
              <BellIcon />
            </ActionIcon>
          </Indicator>
        </Popover.Target>
        <Popover.Dropdown p={0}>
          <Group
            justify="space-between"
            px="sm"
            py="xs"
            className="border-b border-[var(--app-border)]"
          >
            <Text fw={600} size="sm">
              Notifications
            </Text>
            <Group gap={4}>
              <Button
                size="compact-xs"
                variant="subtle"
                disabled={unread === 0}
                onClick={() => markAllRead.mutate()}
              >
                Mark all read
              </Button>
              <Button
                size="compact-xs"
                variant="subtle"
                color="gray"
                onClick={() => {
                  setOpened(false);
                  setSettingsOpen(true);
                }}
              >
                Settings
              </Button>
            </Group>
          </Group>
          <ScrollArea.Autosize mah={380} type="auto">
            {items.length === 0 ? (
              <Text size="sm" c="dimmed" ta="center" py="lg" px="sm">
                {feed.isError
                  ? "Could not load notifications."
                  : "You're all caught up."}
              </Text>
            ) : (
              <ul
                aria-label="Notification list"
                className="divide-y divide-[var(--app-border)]"
              >
                {items.map((item) => (
                  <NotificationRow
                    key={item.id}
                    item={item}
                    onOpen={() => {
                      setOpened(false);
                      open(item);
                    }}
                    onDismiss={() => dismiss.mutate(item.id)}
                  />
                ))}
              </ul>
            )}
          </ScrollArea.Autosize>
          {items.length > 0 ? (
            <Group
              justify="flex-end"
              px="sm"
              py={6}
              className="border-t border-[var(--app-border)]"
            >
              <Button
                size="compact-xs"
                variant="subtle"
                color="gray"
                onClick={() => dismissAll.mutate()}
              >
                Clear all
              </Button>
            </Group>
          ) : null}
        </Popover.Dropdown>
      </Popover>
      <NotificationSettingsModal
        opened={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </>
  );
}

function NotificationRow({
  item,
  onOpen,
  onDismiss,
}: {
  item: AppNotification;
  onOpen: () => void;
  onDismiss: () => void;
}) {
  const unread = item.read_at === null;
  return (
    <li
      className={`group flex items-start gap-2 px-3 py-2 ${unread ? "bg-[var(--app-primary)]/5" : ""}`}
    >
      <span
        aria-hidden
        className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${unread ? KIND_DOT[item.kind] : "bg-transparent"}`}
      />
      <div className="min-w-0 flex-1">
        <UnstyledButton onClick={onOpen} className="w-full text-left">
          <Text size="xs" c="dimmed">
            {KIND_LABEL[item.kind]} · {formatNotificationTime(item.fire_at)}
          </Text>
          <Text size="sm" fw={unread ? 600 : 400} lineClamp={2}>
            {item.title}
          </Text>
          {item.body ? (
            <Text size="xs" c="dimmed" lineClamp={2}>
              {item.body}
            </Text>
          ) : null}
        </UnstyledButton>
        {isTaskAlert(item) ? <TaskAlertActions item={item} /> : null}
      </div>
      <ActionIcon
        variant="subtle"
        color="gray"
        size="sm"
        aria-label={`Dismiss ${item.title}`}
        onClick={onDismiss}
      >
        <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden>
          <path
            d="M4 4l8 8M12 4l-8 8"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      </ActionIcon>
    </li>
  );
}

function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden>
      <path
        d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15L6 16Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="M10 20.5a2.2 2.2 0 0 0 4 0"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}
