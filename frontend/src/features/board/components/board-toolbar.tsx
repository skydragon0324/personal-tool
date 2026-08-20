"use client";

import { Button, Input, Select, Text, TextInput } from "@mantine/core";
import { DatePickerInput, MonthPickerInput, YearPickerInput } from "@mantine/dates";

import { formatLongDate } from "@/lib/dates";
import type { BoardFilters, Category, Priority } from "../types";
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
  onReset: () => void;
  customError: string | null;
  onCustomError: (message: string | null) => void;
  onApplyCustom: (range: [string, string]) => void;
}

const RANGE_OPTIONS: { value: DateRangeMode; label: string }[] = [
  { value: "year", label: "Year" },
  { value: "month", label: "Month" },
  { value: "week", label: "Week" },
  { value: "day", label: "Day" },
  { value: "custom", label: "Custom" },
  { value: "all", label: "All" },
];

function rangeSummary(mode: DateRangeMode, range: DateRangeValue, dateField: DateField): string {
  if (mode === "all") return "No date filter";
  if (!range[0] || !range[1]) {
    return mode === "custom" ? "Choose a start date and an end date" : "Pick a date";
  }
  if (mode === "year") return formatYearLabel(range[0]);
  if (mode === "month") return formatMonthLabel(range[0]);
  if (mode === "week") return formatWeekRangeLabel(range[0], range[1]);
  const fieldLabel = dateField === "created_at" ? "Created" : "Due";
  if (range[0] === range[1]) return `${fieldLabel}: ${formatLongDate(range[0])}`;
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
  const label = dateField === "created_at" ? "Created date" : "Due date";

  if (mode === "all") {
    return (
      <div className="min-w-0">
        <Input.Label>{label}</Input.Label>
        <Text size="sm" mt={8}>
          No date filter
        </Text>
      </div>
    );
  }

  if (mode === "year") {
    return (
      <YearPickerInput
        label="Year"
        placeholder="Select year"
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
        label="Month"
        placeholder="Select month"
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
        type="default"
        label="Week"
        placeholder="Select week"
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
        type="default"
        label="Day"
        placeholder="Select date"
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
      <DatePickerInput
        type="range"
        label={dateField === "created_at" ? "Created date range" : "Due date range"}
        placeholder="Pick a range"
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
        Apply
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
  onReset,
  customError,
  onCustomError,
  onApplyCustom,
}: BoardToolbarProps) {
  return (
    <section className="border-b border-[var(--app-border)] bg-[var(--app-surface)]">
      <div className="mx-auto grid max-w-[1400px] items-start gap-3 px-4 py-3 sm:px-6 lg:grid-cols-[minmax(8rem,10rem)_minmax(9rem,12rem)_minmax(16rem,1.4fr)_minmax(9rem,12rem)_minmax(8rem,10rem)_1fr_auto]">
        <Select
          label="Date field"
          data={[
            { value: "due_date", label: "Due date" },
            { value: "created_at", label: "Created date" },
          ]}
          value={dateField}
          onChange={(value) => {
            if (value === "due_date" || value === "created_at") onDateFieldChange(value);
          }}
          allowDeselect={false}
        />
        <Select
          label="Range"
          data={RANGE_OPTIONS}
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
          label="Category"
          placeholder="All"
          data={[
            { value: "", label: "All" },
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
          label="Priority"
          placeholder="All"
          data={[
            { value: "", label: "All" },
            { value: "high", label: "High" },
            { value: "medium", label: "Medium" },
            { value: "low", label: "Low" },
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
        <TextInput
          label="Search"
          placeholder="Title or details"
          value={filters.query}
          onChange={(event) =>
            onFiltersChange({
              ...filters,
              query: event.currentTarget.value,
            })
          }
        />
        <div>
          <Input.Label className="invisible">Reset</Input.Label>
          <Button variant="default" fullWidth onClick={onReset}>
            Reset
          </Button>
        </div>
      </div>
    </section>
  );
}
