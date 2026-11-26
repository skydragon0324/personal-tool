import { Button, Text } from "@mantine/core";

import { PlusIcon } from "@/features/board/components/board-ui-icons";
import { formatWeekdayDate } from "@/lib/dates";
import { t } from "@/i18n";

import type { CalendarTask } from "../types";
import { CalendarAgendaItem } from "./calendar-task-item";

interface CalendarAgendaProps {
  days: string[];
  today: string;
  byDay: Map<string, CalendarTask[]>;
  onOpen: (task: CalendarTask) => void;
  onReschedule: (task: CalendarTask) => void;
  onCreate: (day: string) => void;
}

/** The visible days as a list: every day with tasks, plus today. Used for the Agenda view and for
 * small screens, where a seven-column grid would not fit. */
export function CalendarAgenda({ days, today, byDay, onOpen, onReschedule, onCreate }: CalendarAgendaProps) {
  const shown = days.filter((day) => day === today || (byDay.get(day)?.length ?? 0) > 0);
  const hasTasks = shown.some((day) => (byDay.get(day)?.length ?? 0) > 0);

  if (!hasTasks) {
    const day = days.includes(today) ? today : days[0];
    return (
      <div data-calendar-layout="agenda" className="flex flex-col items-center gap-3 py-16 text-center">
        <Text fw={600}>{t("calendar.noTasks")}</Text>
        <Text size="sm" c="dimmed" maw={360}>
          {t("calendar.noTasksHint")}
        </Text>
        {day ? (
          <Button variant="light" leftSection={<PlusIcon size={16} />} onClick={() => onCreate(day)}>
            {t("calendar.addTask")}
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div data-calendar-layout="agenda" className="mx-auto flex w-full flex-col gap-5">
      {shown.map((day) => {
        const tasks = byDay.get(day) ?? [];
        const label = formatWeekdayDate(day);
        const headingId = `calendar-agenda-${day}`;
        return (
          <section key={day} aria-labelledby={headingId} data-calendar-day={day}>
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 id={headingId} className="text-sm font-semibold text-[var(--app-text)]">
                {label}
                {day === today ? (
                  <span className="ml-2 rounded-full bg-[var(--app-primary-soft)] px-2 py-0.5 text-xs font-medium text-[var(--app-primary)]">
                    {t("calendar.today")}
                  </span>
                ) : null}
              </h2>
              <Button
                size="compact-sm"
                variant="subtle"
                leftSection={<PlusIcon size={14} />}
                aria-label={t("calendar.addTaskOn", { date: label })}
                onClick={() => onCreate(day)}
              >
                {t("calendar.addTask")}
              </Button>
            </div>
            {tasks.length ? (
              <ul className="flex flex-col gap-1.5">
                {tasks.map((task) => (
                  <CalendarAgendaItem key={task.id} task={task} onOpen={onOpen} onReschedule={onReschedule} />
                ))}
              </ul>
            ) : (
              <Text size="sm" c="dimmed">
                {t("calendar.nothingDue")}
              </Text>
            )}
          </section>
        );
      })}
    </div>
  );
}
