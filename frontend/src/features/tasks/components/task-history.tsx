import { Alert, Loader, Text } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";

import { taskKeys } from "@/features/board/api/board-queries";
import { t, type MessageKey } from "@/i18n";
import { apiClient } from "@/lib/api-client";
import { formatDateTime, formatDisplayDate } from "@/lib/dates";

import type { TaskChange, TaskHistoryEntry, TaskValueChange } from "../types";

const FIELD_LABELS: Record<TaskChange["field"], MessageKey> = {
  title: "history.fieldTitle",
  board: "history.fieldBoard",
  status: "history.fieldStatus",
  category: "history.fieldCategory",
  priority: "history.fieldPriority",
  start_date: "history.fieldStartDate",
  due_date: "history.fieldDueDate",
  reminder: "history.fieldReminder",
  repeat: "history.fieldRepeat",
  assignees: "history.fieldAssignees",
  subtasks: "history.fieldSubtasks",
  links: "history.fieldLinks",
  files: "history.fieldFiles",
  details: "taskForm.details",
};

const PRIORITY_LABELS: Record<string, MessageKey> = {
  high: "task.priorityHigh",
  medium: "task.priorityMedium",
  low: "task.priorityLow",
};

/** A value from the history in the user's language. */
export function historyValue(field: TaskValueChange["field"], value: string | boolean | null): string {
  if (field === "repeat") return value ? t("history.repeatOn") : t("history.repeatOff");
  if (value === null || value === "" || typeof value === "boolean") return t("history.emptyValue");
  if (field === "priority") return PRIORITY_LABELS[value] ? t(PRIORITY_LABELS[value]) : value;
  if (field === "start_date" || field === "due_date") return formatDisplayDate(value);
  if (field === "reminder") return formatDateTime(value);
  return value;
}

/** Who changed what on the task and when, newest first. */
export function TaskHistory({ taskId }: { taskId: string }) {
  const query = useQuery({
    queryKey: taskKeys.history(taskId),
    queryFn: () => apiClient.getTaskHistory(taskId),
  });

  if (query.isLoading) {
    return (
      <div className="flex justify-center py-4">
        <Loader size="sm" />
      </div>
    );
  }
  if (query.isError) {
    return (
      <Alert color="red" variant="light">
        {t("history.couldNotLoad")}
      </Alert>
    );
  }
  const entries = query.data ?? [];
  if (!entries.length) {
    return (
      <Text size="sm" c="dimmed">
        {t("history.empty")}
      </Text>
    );
  }
  return (
    <ol className="m-0 list-none space-y-0 p-0">
      {entries.map((entry, index) => (
        <HistoryItem key={entry.id} entry={entry} last={index === entries.length - 1} />
      ))}
    </ol>
  );
}

function HistoryItem({ entry, last }: { entry: TaskHistoryEntry; last: boolean }) {
  return (
    <li className="relative pb-4 pl-5">
      {/* The timeline: a dot per entry joined by a line. */}
      <span
        className={`absolute left-[4px] top-1.5 h-2 w-2 rounded-full ${
          entry.action === "created" ? "bg-[var(--app-primary)]" : "bg-[var(--app-text-muted)]"
        }`}
        aria-hidden
      />
      {last ? null : (
        <span className="absolute bottom-0 left-[7px] top-4 w-px bg-[var(--app-border)]" aria-hidden />
      )}
      <p className="m-0 text-sm text-[var(--app-text)]">
        {entry.action === "created"
          ? t("history.created", { name: entry.actor_name })
          : t("history.updated", { name: entry.actor_name })}
      </p>
      <time dateTime={entry.created_at} className="block text-xs text-[var(--app-text-muted)]">
        {formatDateTime(entry.created_at)}
      </time>
      {entry.changes.length ? (
        <ul className="mt-1.5 list-none space-y-1 p-0 text-xs text-[var(--app-text)]">
          {entry.changes.map((change, index) => (
            <li key={`${change.field}-${index}`} className="break-words">
              <ChangeLine change={change} />
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function ChangeLine({ change }: { change: TaskChange }) {
  const label = <span className="font-semibold">{t(FIELD_LABELS[change.field])}: </span>;
  if (change.field === "details") {
    return <span className="text-[var(--app-text-muted)]">{t("history.detailsEdited")}</span>;
  }
  if ("added" in change) {
    return (
      <>
        {label}
        {change.added.length ? (
          <span>
            {t("history.added")} {change.added.join(", ")}
          </span>
        ) : null}
        {change.added.length && change.removed.length ? <span>; </span> : null}
        {change.removed.length ? (
          <span className="text-[var(--app-text-muted)]">
            {t("history.removed")} <s>{change.removed.join(", ")}</s>
          </span>
        ) : null}
      </>
    );
  }
  return (
    <>
      {label}
      <s className="text-[var(--app-text-muted)]">{historyValue(change.field, change.from)}</s>
      <span aria-hidden> → </span>
      <span>{historyValue(change.field, change.to)}</span>
    </>
  );
}
