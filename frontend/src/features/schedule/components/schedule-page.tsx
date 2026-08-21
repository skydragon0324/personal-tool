"use client";

import { Button, Group, Loader, Modal, SegmentedControl, Text } from "@mantine/core";
import { useEffect, useMemo, useState } from "react";

import { PageHeader } from "@/features/shell/components/page-header";
import { todayISO } from "@/lib/dates";
import { notifyApiError } from "@/lib/notify";

import { useSchedule, useScheduleMutations } from "../hooks/use-schedule";
import { useScheduleOccurrence } from "../hooks/use-schedule-occurrence";
import type { ScheduleEntry, ScheduleEntryCreate, ScheduleView } from "../types";
import {
  mondayOf,
  shiftIso,
  weekDates,
  weekdayIndex,
} from "../utils/schedule-time";
import { ScheduleGrid } from "./schedule-grid";
import { ScheduleModal, type SchedulePrefill } from "./schedule-modal";

export function SchedulePage() {
  const today = todayISO();
  const [view, setView] = useState<ScheduleView>("week");
  const [anchor, setAnchor] = useState(today);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ScheduleEntry | null>(null);
  const [prefill, setPrefill] = useState<SchedulePrefill | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ScheduleEntry | null>(null);

  const weekStart = mondayOf(anchor);
  const dates = useMemo(
    () => (view === "day" ? [anchor] : weekDates(weekStart)),
    [anchor, view, weekStart],
  );
  const scheduleQuery = useSchedule(weekStart, today);
  const mutations = useScheduleMutations(weekStart, today);
  const occurrence = useScheduleOccurrence();
  const entries = scheduleQuery.data?.entries ?? [];
  const occurrences = scheduleQuery.data?.occurrences ?? [];
  const empty = !scheduleQuery.isLoading && entries.length === 0;

  useEffect(() => {
    document.title = "Schedule · Life Management";
    return () => {
      document.title = "Life Management";
    };
  }, []);

  function openCreate(nextPrefill?: SchedulePrefill) {
    setEditing(null);
    setPrefill(nextPrefill ?? { weekday: weekdayIndex(anchor), start_time: "09:00:00", end_time: "09:30:00" });
    setModalOpen(true);
  }

  async function handleCreate(payload: ScheduleEntryCreate) {
    try {
      await mutations.create.mutateAsync({
        ...payload,
        week_start: payload.kind === "this_week" ? weekStart : null,
      });
      setModalOpen(false);
    } catch (error) {
      notifyApiError(error, "Could not create schedule");
    }
  }

  async function handleUpdate(entryId: string, payload: ScheduleEntryCreate) {
    try {
      await mutations.update.mutateAsync({
        entryId,
        payload: {
          ...payload,
          week_start: payload.kind === "this_week" ? weekStart : null,
        },
      });
      setModalOpen(false);
      setEditing(null);
    } catch (error) {
      notifyApiError(error, "Could not update schedule");
    }
  }

  async function handleDelete() {
    if (!pendingDelete) return;
    try {
      await mutations.remove.mutateAsync(pendingDelete.id);
      setPendingDelete(null);
      setModalOpen(false);
      setEditing(null);
    } catch (error) {
      notifyApiError(error, "Could not delete schedule");
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader title="Schedule">
        <SegmentedControl
          value={view}
          onChange={(value) => setView(value as ScheduleView)}
          data={[
            { value: "day", label: "Day" },
            { value: "week", label: "Week" },
          ]}
        />
        <Button variant="default" onClick={() => setAnchor(today)}>
          Today
        </Button>
        <Button
          variant="default"
          aria-label={view === "week" ? "Previous week" : "Previous day"}
          onClick={() => setAnchor((current) => shiftIso(current, view, -1))}
        >
          Previous
        </Button>
        <Button
          variant="default"
          aria-label={view === "week" ? "Next week" : "Next day"}
          onClick={() => setAnchor((current) => shiftIso(current, view, 1))}
        >
          Next
        </Button>
        <Button onClick={() => openCreate()}>New schedule</Button>
      </PageHeader>
      <div className="min-h-0 flex-1 overflow-auto">
        <div className="mx-auto max-w-[1400px] px-4 py-5 sm:px-6">
          {scheduleQuery.isLoading ? (
            <Group justify="center" py="xl">
              <Loader />
            </Group>
          ) : null}
          {scheduleQuery.isError ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <Text>Could not load schedule.</Text>
              <Button variant="light" onClick={() => void scheduleQuery.refetch()}>
                Retry
              </Button>
            </div>
          ) : null}
          {empty ? (
            <div className="mb-6 flex flex-col items-center gap-3 py-8 text-center">
              <h2 className="font-display text-2xl text-[var(--app-text)]">No schedules yet</h2>
              <Text c="dimmed" maw={420}>
                Add a repeating routine or a one-week block by using the button or clicking an empty time slot.
              </Text>
              <Button onClick={() => openCreate()}>Add your first schedule</Button>
            </div>
          ) : null}
          {!scheduleQuery.isLoading && !scheduleQuery.isError ? (
            <ScheduleGrid
              view={view}
              dates={view === "day" ? dates : weekDates(weekStart)}
              entries={entries}
              occurrences={occurrences}
              pendingKey={occurrence.pendingKey}
              onSlotClick={(weekday, startTime, endTime) =>
                openCreate({ weekday, start_time: startTime, end_time: endTime })
              }
              onEntryClick={(entry) => {
                setEditing(entry);
                setPrefill(null);
                setModalOpen(true);
              }}
              onToggleComplete={(entry, occurrenceDate, isCompleted) => {
                occurrence.mutate({ entryId: entry.id, occurrenceDate, isCompleted });
              }}
            />
          ) : null}
        </div>
      </div>
      <ScheduleModal
        opened={modalOpen}
        entry={editing}
        prefill={prefill}
        weekStart={weekStart}
        submitting={mutations.create.isPending || mutations.update.isPending}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
        }}
        onCreate={handleCreate}
        onUpdate={handleUpdate}
        onDelete={setPendingDelete}
      />
      <Modal
        opened={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        title="Delete this schedule?"
        radius="lg"
      >
        <Text size="sm" c="dimmed">
          “{pendingDelete?.title}” will be permanently removed.
        </Text>
        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={() => setPendingDelete(null)}>
            Cancel
          </Button>
          <Button color="red" onClick={() => void handleDelete()} loading={mutations.remove.isPending}>
            Delete
          </Button>
        </Group>
      </Modal>
    </div>
  );
}
