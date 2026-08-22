"use client";

import { Alert, Button, Center, Loader, Modal } from "@mantine/core";
import { useEffect, useState } from "react";

import { useRecurrenceSeriesDetail } from "../hooks/use-recurrence-series";
import { useUpdateRecurrenceSeries } from "../hooks/use-update-recurrence-series";
import type { RecurrenceSeriesUpdatePayload } from "../types";
import { isStaleSeriesVersion } from "../utils/series-edit";
import { RecurringSeriesEditForm } from "./recurring-series-edit-form";

export function RecurringSeriesEditModal({
  seriesId,
  boardId,
  onClose,
}: {
  seriesId: string | null;
  boardId: string | null;
  onClose: () => void;
}) {
  const opened = seriesId !== null;
  const detailQuery = useRecurrenceSeriesDetail(seriesId ?? "", opened);
  const update = useUpdateRecurrenceSeries();
  const [formEpoch, setFormEpoch] = useState(0);
  const [conflict, setConflict] = useState(false);

  useEffect(() => {
    setFormEpoch(0);
    setConflict(false);
  }, [seriesId]);

  const detail = detailQuery.data && detailQuery.data.id === seriesId ? detailQuery.data : undefined;
  const loading = opened && (detailQuery.isLoading || (detailQuery.isFetching && !detail));
  const failed = opened && detailQuery.isError && !detail;
  const saving = update.isPending;

  async function handleSubmit(payload: RecurrenceSeriesUpdatePayload) {
    if (!seriesId || !boardId) return;
    try {
      await update.mutateAsync({ seriesId, boardId, payload });
      onClose();
    } catch (error) {
      if (isStaleSeriesVersion(error)) {
        setConflict(true);
        return;
      }
    }
  }

  async function reloadLatest() {
    const result = await detailQuery.refetch();
    if (result.data) {
      setFormEpoch((current) => current + 1);
      setConflict(false);
    }
  }

  return (
    <Modal
      opened={opened}
      onClose={() => {
        if (saving) return;
        onClose();
      }}
      title="Edit recurring task"
      size="xl"
      radius="lg"
      padding="lg"
      lockScroll
      closeOnClickOutside={!saving}
      closeOnEscape={!saving}
      classNames={{
        content: "max-w-4xl w-[min(100vw,56rem)]",
        body: "p-0 sm:p-1",
      }}
    >
      {loading ? (
        <Center py="xl" role="status" aria-label="Loading recurring task">
          <Loader />
        </Center>
      ) : null}
      {failed ? (
        <Alert color="red" m="md" title="Could not load recurring task.">
          <Button size="xs" variant="light" mt="sm" onClick={() => void detailQuery.refetch()}>
            Retry
          </Button>
        </Alert>
      ) : null}
      {!loading && !failed && detail ? (
        <div className="px-1 pb-2 sm:px-2">
          <RecurringSeriesEditForm
            key={`${detail.id}-${formEpoch}`}
            detail={detail}
            submitting={saving}
            conflict={conflict}
            onSubmit={handleSubmit}
            onCancel={onClose}
            onReloadLatest={() => void reloadLatest()}
          />
        </div>
      ) : null}
    </Modal>
  );
}
