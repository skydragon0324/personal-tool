import { Button, Group, Modal, Text } from "@mantine/core";
import { useEffect, useState } from "react";

import { parseISODate } from "@/features/board/utils/date-presets";
import { DatePicker } from "@/lib/date-pickers";
import { formatLongDate } from "@/lib/dates";
import { t } from "@/i18n";

import type { CalendarTask } from "../types";

interface RescheduleDialogProps {
  task: CalendarTask | null;
  /** Date picked already (by a drop); otherwise the task's current due date. */
  initialDate?: string | null;
  submitting?: boolean;
  onClose: () => void;
  onConfirm: (task: CalendarTask, dueDate: string) => void;
}

/**
 * Pick a new due date for a task: the keyboard-friendly alternative to dragging.
 */
export function RescheduleDialog({ task, initialDate, submitting, onClose, onConfirm }: RescheduleDialogProps) {
  const [date, setDate] = useState<string | null>(null);

  useEffect(() => {
    setDate(task ? initialDate ?? task.due_date : null);
  }, [task, initialDate]);

  const unchanged = !task || !date || date === task.due_date;

  return (
    <Modal
      opened={task !== null}
      onClose={onClose}
      title={t("calendar.changeDate")}
      radius="lg"
      centered
    >
      {task ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (date && !unchanged) onConfirm(task, date);
          }}
        >
          <Text size="sm" fw={600} mb={4}>
            {task.title}
          </Text>
          <Text size="sm" c="dimmed" mb="sm">
            {t("calendar.currentDue", { date: formatLongDate(task.due_date) })}
          </Text>
          <Group justify="center">
            <DatePicker
              key={`${task.id}:${initialDate ?? ""}`}
              value={date}
              onChange={setDate}
              // Open on the month of the date being changed, not on the current month.
              defaultDate={parseISODate(initialDate ?? task.due_date)}
              aria-label={t("calendar.newDueDate")}
            />
          </Group>
          <Group justify="flex-end" mt="lg">
            <Button variant="default" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={unchanged} loading={submitting}>
              {date && !unchanged
                ? t("calendar.moveTo", { date: formatLongDate(date) })
                : t("calendar.move")}
            </Button>
          </Group>
        </form>
      ) : null}
    </Modal>
  );
}
