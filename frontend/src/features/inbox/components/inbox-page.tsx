import { Button, Loader, SegmentedControl, Text } from "@mantine/core";
import { useEffect, useState } from "react";

import { NotificationRow } from "@/features/notifications/components/notification-bell";
import { NotificationSettingsModal } from "@/features/notifications/components/notification-settings-modal";
import { useNotificationFeed, useNotificationMutations } from "@/features/notifications/hooks/use-notifications";
import { useOpenNotification } from "@/features/notifications/hooks/use-open-notification";
import { PageHeader } from "@/features/shell/components/page-header";
import { t } from "@/i18n";

/** Every notification on one page, with the same actions as the bell. */
export function InboxPage() {
  const feed = useNotificationFeed();
  const { markAllRead, dismiss, dismissAll } = useNotificationMutations();
  const openNotification = useOpenNotification();
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    document.title = `${t("shell.inbox")} · ${t("common.appName")}`;
    return () => {
      document.title = t("common.appName");
    };
  }, []);

  const items = feed.data?.items ?? [];
  const unread = feed.data?.unread_count ?? 0;
  const visible = filter === "unread" ? items.filter((item) => item.read_at === null) : items;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader title={t("shell.inbox")} description={t("workspace.inboxHint")}>
        <SegmentedControl
          size="sm"
          value={filter}
          onChange={(value) => setFilter(value as "all" | "unread")}
          aria-label={t("workspace.inboxFilter")}
          data={[
            { value: "all", label: `${t("dashboard.all")} (${items.length})` },
            { value: "unread", label: `${t("workspace.unread")} (${unread})` },
          ]}
        />
        <Button variant="default" disabled={unread === 0} onClick={() => markAllRead.mutate()}>
          {t("notifications.markAllRead")}
        </Button>
        <Button variant="default" disabled={items.length === 0} onClick={() => dismissAll.mutate()}>
          {t("notifications.clearAll")}
        </Button>
        <Button variant="default" onClick={() => setSettingsOpen(true)}>
          {t("notifications.settings")}
        </Button>
      </PageHeader>
      <div className="flex min-h-0 flex-1 flex-col px-4 py-4 sm:px-6 lg:px-8">
        <div className="mx-auto flex min-h-0 w-full max-w-4xl flex-1 flex-col overflow-hidden rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)]">
          {feed.isLoading ? (
            <div className="flex flex-1 items-center justify-center">
              <Loader size="sm" />
            </div>
          ) : feed.isError ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3">
              <Text>{t("notifications.couldNotLoad")}</Text>
              <Button variant="light" onClick={() => void feed.refetch()}>
                {t("common.retry")}
              </Button>
            </div>
          ) : visible.length === 0 ? (
            <div className="flex flex-1 items-center justify-center px-4 text-center">
              <Text c="dimmed">
                {filter === "unread" ? t("workspace.noUnread") : t("notifications.allCaughtUp")}
              </Text>
            </div>
          ) : (
            <ul
              aria-label={t("notifications.listLabel")}
              className="min-h-0 flex-1 divide-y divide-[var(--app-border)] overflow-y-auto"
            >
              {visible.map((item) => (
                <NotificationRow
                  key={item.id}
                  item={item}
                  onOpen={() => openNotification(item)}
                  onDismiss={() => dismiss.mutate(item.id)}
                />
              ))}
            </ul>
          )}
        </div>
      </div>
      <NotificationSettingsModal opened={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
