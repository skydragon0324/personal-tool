"use client";

import {
  Alert,
  Badge,
  Button,
  NumberInput,
  Select,
  SimpleGrid,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import { useMemo, useState, type FormEvent } from "react";

import { useCategories, useCreateCategory } from "@/features/board/hooks/use-categories";
import { useColumns } from "@/features/board/hooks/use-columns";
import type { ColumnDetail } from "@/features/board/types";
import { CategoryCombobox } from "@/features/tasks/components/category-combobox";
import { RecurrenceFields } from "@/features/tasks/components/recurrence-fields";
import { TaskLinkListEditor } from "@/features/tasks/components/task-link-list-editor";
import { TaskRichTextEditor } from "@/features/tasks/components/task-rich-text-editor";
import { notifySuccess } from "@/lib/notify";

import type { RecurrenceSeriesRead, RecurrenceSeriesUpdatePayload } from "../types";
import {
  AUTOMATIC_COLUMN,
  buildSeriesUpdatePayload,
  formValuesFromDetail,
  type SeriesEditFormValues,
  validateSeriesEditForm,
} from "../utils/series-edit";

const AUTOMATIC_LABEL = "Automatic — first available status";

function selectableColumns(columns: ColumnDetail[]) {
  return columns
    .filter((column) => !column.archived_at && !column.is_done)
    .sort((a, b) => a.position - b.position);
}

export function RecurringSeriesEditForm({
  detail,
  submitting,
  conflict,
  onSubmit,
  onCancel,
  onReloadLatest,
}: {
  detail: RecurrenceSeriesRead;
  submitting?: boolean;
  conflict?: boolean;
  onSubmit: (payload: RecurrenceSeriesUpdatePayload) => Promise<void>;
  onCancel: () => void;
  onReloadLatest: () => void;
}) {
  const [values, setValues] = useState<SeriesEditFormValues>(() => formValuesFromDetail(detail));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const categoriesQuery = useCategories(detail.board_id);
  const createCategory = useCreateCategory(detail.board_id);
  const columnsQuery = useColumns(detail.board_id, true);
  const categories = categoriesQuery.data ?? [];
  const columns = columnsQuery.data ?? [];
  const available = selectableColumns(columns);
  const currentColumn = columns.find((column) => column.id === detail.default_column_id) ?? null;
  const currentUnavailable = Boolean(
    detail.default_column_id &&
      (!currentColumn || currentColumn.archived_at || currentColumn.is_done),
  );

  const columnOptions = useMemo(() => {
    const options = [
      { value: AUTOMATIC_COLUMN, label: AUTOMATIC_LABEL },
      ...available.map((column) => ({ value: column.id, label: column.name })),
    ];
    if (currentUnavailable && detail.default_column_id) {
      const name = currentColumn?.name ?? "Unavailable status";
      const reason = currentColumn?.archived_at ? "archived" : currentColumn?.is_done ? "completed" : "unavailable";
      options.unshift({
        value: detail.default_column_id,
        label: `${name} (${reason})`,
      });
    }
    return options;
  }, [available, currentColumn, currentUnavailable, detail.default_column_id]);

  function patch(next: Partial<SeriesEditFormValues>) {
    setValues((current) => ({ ...current, ...next }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;
    const nextErrors = validateSeriesEditForm(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setFormError("Please fix the highlighted fields.");
      return;
    }
    const payload = buildSeriesUpdatePayload(detail, values);
    if (!payload) {
      notifySuccess("No changes to save.");
      return;
    }
    setFormError(null);
    await onSubmit(payload);
  }

  return (
    <form
      noValidate
      onSubmit={(event) => void handleSubmit(event)}
      className="flex max-h-[min(85vh,900px)] flex-col"
    >
      <fieldset disabled={submitting} className="min-h-0 flex-1 space-y-5 overflow-y-auto border-0 p-0 pr-1">
        <div className="space-y-1">
          <Badge variant="light" color={detail.status === "active" ? "teal" : "gray"}>
            {detail.status === "active" ? "Active" : "Stopped"}
          </Badge>
          <Text size="sm" c="dimmed">
            Pause or resume this series from the recurring tasks list.
          </Text>
        </div>

        {conflict ? (
          <Alert color="yellow" title="This recurring task changed elsewhere.">
            <Button size="xs" variant="light" type="button" onClick={onReloadLatest} mt="xs">
              Reload latest
            </Button>
          </Alert>
        ) : null}

        <section className="space-y-3">
          <Title order={5}>Basics</Title>
          <TextInput
            label="Title"
            value={values.title}
            onChange={(event) => patch({ title: event.currentTarget.value })}
            maxLength={160}
            required
            error={errors.title}
            disabled={submitting}
          />
          <CategoryCombobox
            categories={categories}
            value={values.categoryId}
            onChange={(categoryId) => patch({ categoryId })}
            creating={createCategory.isPending}
            required
            disabled={submitting}
            error={errors.category}
            onCreate={async (input) => createCategory.mutateAsync(input)}
          />
          <Select
            label="Priority"
            data={[
              { value: "low", label: "Low" },
              { value: "medium", label: "Medium" },
              { value: "high", label: "High" },
            ]}
            value={values.priority}
            onChange={(value) => {
              if (value) patch({ priority: value as SeriesEditFormValues["priority"] });
            }}
            disabled={submitting}
          />
          <Select
            label="Starting status"
            data={columnOptions}
            value={values.columnChoice}
            onChange={(value) => {
              if (value) patch({ columnChoice: value });
            }}
            disabled={submitting}
          />
          {currentUnavailable ? (
            <Alert color="yellow">
              The saved starting status is archived or unavailable. Choose another status, or leave it
              unchanged to keep the current value.
            </Alert>
          ) : null}
          <Text size="xs" c="dimmed">
            This status is used for newly generated tasks. Existing tasks will not move.
          </Text>
        </section>

        <section className="space-y-3">
          <Title order={5}>Schedule</Title>
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <DatePickerInput
              label="Series start date"
              value={values.dtstart}
              onChange={(value) => {
                if (typeof value === "string" && value) patch({ dtstart: value });
              }}
              valueFormat="MMM D, YYYY"
              disabled={submitting}
            />
            <NumberInput
              label="Duration in days"
              min={0}
              value={values.durationDays}
              onChange={(value) => patch({ durationDays: typeof value === "number" ? value : 0 })}
              error={errors.duration}
              disabled={submitting}
            />
          </SimpleGrid>
          <Text size="xs" c="dimmed">
            Each occurrence is due this many days after it starts.
          </Text>
          <RecurrenceFields
            allowNone={false}
            preset={values.preset}
            onPresetChange={(preset) => patch({ preset })}
            customInterval={values.customInterval}
            onCustomIntervalChange={(customInterval) => patch({ customInterval })}
            customUnit={values.customUnit}
            onCustomUnitChange={(customUnit) => patch({ customUnit })}
            customWeekdays={values.customWeekdays}
            onCustomWeekdaysChange={(customWeekdays) => patch({ customWeekdays })}
            end={values.end}
            onEndChange={(end) => patch({ end })}
            untilDate={values.untilDate}
            onUntilDateChange={(untilDate) => patch({ untilDate })}
            occurrenceCount={values.occurrenceCount}
            onOccurrenceCountChange={(occurrenceCount) => patch({ occurrenceCount })}
          />
          {errors.interval ? <Text size="sm" c="red">{errors.interval}</Text> : null}
          {errors.weekdays ? <Text size="sm" c="red">{errors.weekdays}</Text> : null}
          {errors.until ? <Text size="sm" c="red">{errors.until}</Text> : null}
          {errors.count ? <Text size="sm" c="red">{errors.count}</Text> : null}
        </section>

        <section className="space-y-3">
          <Title order={5}>Details</Title>
          <TaskRichTextEditor value={values.content} onChange={(content) => patch({ content })} />
          <TaskLinkListEditor
            links={values.links}
            onChange={(links) => patch({ links })}
            disabled={submitting}
            errors={errors}
          />
        </section>
      </fieldset>

      {formError ? (
        <Alert color="red" mt="md">
          {formError}
        </Alert>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2 border-t border-[var(--app-border)] pt-3">
        <Button type="submit" loading={submitting} disabled={submitting}>
          {submitting ? "Saving..." : "Save changes"}
        </Button>
        <Button type="button" variant="default" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
