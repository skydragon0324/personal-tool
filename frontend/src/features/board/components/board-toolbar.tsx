import { Button, Input, Select, Text, TextInput } from "@mantine/core";

import { DatePickerInput, DateRangePickerInput, MonthPickerInput, YearPickerInput } from "@/lib/date-pickers";
import { formatLongDate } from "@/lib/dates";
import { UNASSIGNED } from "../utils/filter-tasks";
import type { BoardFilters, BoardPerson, Category, Priority } from "../types";
import { commitCustomRange, normalizeCustomDraft } from "../utils/board-range";
import {
  dayRange,
  formatMonthLabel,
  formatWeekRangeLabel,
  formatYearLabel,
  monthRange,
  parseISODate,
  pickerToISO,
  weekRange,
  yearRange,
  type DateField,
  type DateRangeMode,
  type DateRangeValue,
} from "../utils/date-presets";
import { t } from "@/i18n";

interface BoardToolbarProps {
  range: DateRangeValue;
  onRangeChange: (range: DateRangeValue) => void;
  rangeMode: DateRangeMode;
  onRangeModeChange: (mode: DateRangeMode) => void;
  dateField: DateField;
  onDateFieldChange: (field: DateField) => void;
  filters: BoardFilters;
  onFiltersChange: (next: BoardFilters) => void;
  categories: Category[];
  /** People on the board, for the assignee filter. */
  people?: BoardPerson[];
  currentUserId?: string;
  onReset: () => void;
  customError: string | null;
  onCustomError: (message: string | null) => void;
  onApplyCustom: (range: [string, string]) => void;
}

function rangeOptions(): { value: DateRangeMode; label: string }[] {
  return [
    { value: "year", label: t("filters.rangeYear") },
    { value: "month", label: t("filters.rangeMonth") },
    { value: "week", label: t("filters.rangeWeek") },
    { value: "day", label: t("filters.rangeDay") },
    { value: "custom", label: t("filters.rangeCustom") },
    { value: "all", label: t("filters.rangeAll") },
  ];
}

function rangeSummary(mode: DateRangeMode, range: DateRangeValue, dateField: DateField): string {
  if (mode === "all") return t("filters.noDateFilter");
  if (!range[0] || !range[1]) {
    return mode === "custom" ? t("filters.chooseStartAndEnd") : t("filters.pickDate");
  }
  if (mode === "year") return formatYearLabel(range[0]);
  if (mode === "month") return formatMonthLabel(range[0]);
  if (mode === "week") return formatWeekRangeLabel(range[0], range[1]);
  if (range[0] === range[1]) {
    const date = formatLongDate(range[0]);
    return dateField === "created_at" ? t("filters.createdOn", { date }) : t("filters.dueOn", { date });
  }
  return `${formatLongDate(range[0])} – ${formatLongDate(range[1])}`;
}

function DateRangeControl({
  mode,
  range,
  dateField,
  onRangeChange,
  customError,
  onCustomError,
  onApplyCustom,
}: {
  mode: DateRangeMode;
  range: DateRangeValue;
  dateField: DateField;
  onRangeChange: (range: DateRangeValue) => void;
  customError: string | null;
  onCustomError: (message: string | null) => void;
  onApplyCustom: (range: [string, string]) => void;
}) {
  const label = dateField === "created_at" ? t("filters.createdDate") : t("filters.dueDate");

  if (mode === "all") {
    return (
      <div className="min-w-0">
        <Input.Label>{label}</Input.Label>
        <Text size="sm" mt={8}>
          {t("filters.noDateFilter")}
        </Text>
      </div>
    );
  }

  if (mode === "year") {
    return (
      <YearPickerInput
        label={t("filters.rangeYear")}
        placeholder={t("filters.selectYear")}
        value={range[0]}
        valueFormat="YYYY"
        onChange={(value) => {
          const iso = pickerToISO(value);
          if (!iso) return;
          onRangeChange(yearRange(parseISODate(iso).getFullYear()));
        }}
      />
    );
  }

  if (mode === "month") {
    return (
      <MonthPickerInput
        label={t("filters.rangeMonth")}
        placeholder={t("filters.selectMonth")}
        value={range[0]}
        valueFormat="MMMM YYYY"
        monthsListFormat="MMMM"
        onChange={(value) => {
          const iso = pickerToISO(value);
          if (!iso) return;
          onRangeChange(monthRange(iso));
        }}
      />
    );
  }

  if (mode === "week") {
    return (
      <DatePickerInput
        label={t("filters.rangeWeek")}
        placeholder={t("filters.selectWeek")}
        value={range[0]}
        valueFormat="MMM D, YYYY"
        firstDayOfWeek={1}
        withWeekNumbers
        weekendDays={[0, 6]}
        getDayProps={(date) => {
          const iso = pickerToISO(date);
          if (!iso || !range[0] || !range[1]) return {};
          const inWeek = iso >= range[0] && iso <= range[1];
          return {
            selected: inWeek,
            inRange: inWeek,
            firstInRange: iso === range[0],
            lastInRange: iso === range[1],
          };
        }}
        onChange={(value) => {
          const iso = pickerToISO(value);
          if (!iso) return;
          onRangeChange(weekRange(iso));
        }}
      />
    );
  }

  if (mode === "day") {
    return (
      <DatePickerInput
        label={t("filters.rangeDay")}
        placeholder={t("filters.selectDate")}
        value={range[0]}
        valueFormat="MMM D, YYYY"
        onChange={(value) => {
          const iso = pickerToISO(value);
          if (!iso) return;
          onRangeChange(dayRange(iso));
        }}
      />
    );
  }

  const canApply = Boolean(range[0] && range[1]);
  return (
    <div className="min-w-0">
      <DateRangePickerInput
        label={dateField === "created_at" ? t("filters.createdRange") : t("filters.dueRange")}
        placeholder={t("filters.pickRange")}
        value={range}
        onChange={(value: DateRangeValue) => {
          const start = pickerToISO(value?.[0] ?? null);
          const end = pickerToISO(value?.[1] ?? null);
          onCustomError(null);
          onRangeChange(normalizeCustomDraft([start, end], range));
        }}
        valueFormat="MMM D, YYYY"
        allowSingleDateInRange={false}
        numberOfColumns={2}
      />
      <Button
        className="mt-2"
        size="xs"
        disabled={!canApply}
        onClick={() => {
          const result = commitCustomRange(range);
          if (!result.ok) {
            onCustomError(result.error);
            return;
          }
          onCustomError(null);
          onApplyCustom(result.range);
        }}
      >
        {t("filters.apply")}
      </Button>
      {customError ? (
        <Text size="xs" c="red" mt={6}>
          {customError}
        </Text>
      ) : null}
    </div>
  );
}

export function BoardToolbar({
  range,
  onRangeChange,
  rangeMode,
  onRangeModeChange,
  dateField,
  onDateFieldChange,
  filters,
  onFiltersChange,
  categories,
  people = [],
  currentUserId,
  onReset,
  customError,
  onCustomError,
  onApplyCustom,
}: BoardToolbarProps) {
  return (
    <section className="border-b border-[var(--app-border)] bg-[var(--app-surface)]">
      <div className="mx-auto grid max-w-[1400px] items-start gap-3 px-4 py-3 sm:px-6 lg:grid-cols-[minmax(8rem,10rem)_minmax(9rem,12rem)_minmax(16rem,1.4fr)_minmax(9rem,12rem)_minmax(8rem,10rem)_minmax(9rem,12rem)_1fr_auto]">
        <Select
          label={t("filters.dateField")}
          data={[
            { value: "due_date", label: t("filters.dueDate") },
            { value: "created_at", label: t("filters.createdDate") },
          ]}
          value={dateField}
          onChange={(value) => {
            if (value === "due_date" || value === "created_at") onDateFieldChange(value);
          }}
          allowDeselect={false}
        />
        <Select
          label={t("filters.range")}
          data={rangeOptions()}
          value={rangeMode}
          onChange={(value) => {
            if (value) onRangeModeChange(value as DateRangeMode);
          }}
          allowDeselect={false}
        />
        <div className="min-w-0">
          <DateRangeControl
            mode={rangeMode}
            range={range}
            dateField={dateField}
            onRangeChange={onRangeChange}
            customError={customError}
            onCustomError={onCustomError}
            onApplyCustom={onApplyCustom}
          />
          <Text size="xs" c="dimmed" mt={6}>
            {rangeSummary(rangeMode, range, dateField)}
          </Text>
        </div>
        <Select
          label={t("task.category")}
          placeholder={t("filters.all")}
          data={[
            { value: "", label: t("filters.all") },
            ...categories.map((category) => ({
              value: category.id,
              label: category.name,
            })),
          ]}
          value={filters.categoryId}
          onChange={(value) =>
            onFiltersChange({
              ...filters,
              categoryId: value ?? "",
            })
          }
          clearable
          searchable
        />
        <Select
          label={t("task.priority")}
          placeholder={t("filters.all")}
          data={[
            { value: "", label: t("filters.all") },
            { value: "high", label: t("task.priorityHigh") },
            { value: "medium", label: t("task.priorityMedium") },
            { value: "low", label: t("task.priorityLow") },
          ]}
          value={filters.priority}
          onChange={(value) =>
            onFiltersChange({
              ...filters,
              priority: (value ?? "") as Priority | "",
            })
          }
          clearable
        />
        <Select
          label={t("filters.assignee")}
          placeholder={t("filters.anyone")}
          data={[
            { value: "", label: t("filters.anyone") },
            ...(currentUserId ? [{ value: currentUserId, label: t("filters.assignedToMe") }] : []),
            { value: UNASSIGNED, label: t("filters.unassigned") },
            ...people
              .filter((person) => person.user_id !== currentUserId)
              .map((person) => ({ value: person.user_id, label: person.display_name })),
          ]}
          value={filters.assigneeId ?? ""}
          onChange={(value) => onFiltersChange({ ...filters, assigneeId: value ?? "" })}
          clearable
          searchable
        />
        <TextInput
          label={t("filters.search")}
          placeholder={t("filters.searchPlaceholder")}
          value={filters.query}
          onChange={(event) =>
            onFiltersChange({
              ...filters,
              query: event.currentTarget.value,
            })
          }
        />
        <div>
          <Input.Label className="invisible">{t("filters.reset")}</Input.Label>
          <Button variant="default" fullWidth onClick={onReset}>
            {t("filters.reset")}
          </Button>
        </div>
      </div>
    </section>
  );
}
