import { Button, Loader, Text } from "@mantine/core";
import { t } from "@/i18n";

export function WorkspaceLoadingScreen({ onRetry }: { onRetry?: () => void } = {}) {
  if (onRetry) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-[var(--app-bg)]">
        <Text c="dimmed">{t("auth.serverUnreachable")}</Text>
        <Button variant="light" color="teal" onClick={onRetry}>
          {t("common.retry")}
        </Button>
      </div>
    );
  }
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-[var(--app-bg)]">
      <Loader color="teal" />
      <Text c="dimmed">{t("auth.loadingWorkspace")}</Text>
    </div>
  );
}
