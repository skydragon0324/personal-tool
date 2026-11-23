import { ActionIcon, Button, Select, Text, TextInput } from "@mantine/core";
import type { ReactNode } from "react";

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
  shiftRange,
  weekRange,
  yearRange,
  type DateField,
  type DateRangeMode,
  type DateRangeValue,
} from "../utils/date-presets";
import { BOARD_CONTENT_GUTTER } from "../utils/board-layout";
import {
  CalendarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  FlagIcon,
  PersonIcon,
  ResetIcon,
  SearchIcon,
  TagIcon,
} from "./board-ui-icons";
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
  const pickerProps = {
    variant: "unstyled" as const,
    classNames: { input: "text-center font-semibold" },
  };

  if (mode === "all") {
    return (
      <Text size="sm" fw={600} ta="center" py={6}>
        {t("filters.noDateFilter")}
      </Text>
    );
  }

  if (mode === "year") {
    return (
      <YearPickerInput
        {...pickerProps}
        aria-label={t("filters.rangeYear")}
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
        {...pickerProps}
        aria-label={t("filters.rangeMonth")}
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
        {...pickerProps}
        aria-label={t("filters.rangeWeek")}
        placeholder={t("filters.selectWeek")}
        value={range[0]}
        valueFormatter={() => rangeSummary(mode, range, dateField)}
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
        {...pickerProps}
        aria-label={t("filters.rangeDay")}
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
    <div className="min-w-0 px-1">
      <div className="flex items-center gap-1">
      <DateRangePickerInput
        {...pickerProps}
        className="min-w-0 flex-1"
        aria-label={dateField === "created_at" ? t("filters.createdRange") : t("filters.dueRange")}
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
        className="shrink-0"
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
      </div>
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
  const canStep = rangeMode !== "custom" && rangeMode !== "all";
  const step = (direction: -1 | 1) => {
    const next = shiftRange(rangeMode, range, direction);
    if (next) onRangeChange(next);
  };

  return (
    <section className="z-20 shrink-0 max-h-[min(44vh,24rem)] overflow-y-auto border-b border-[var(--app-border)] bg-[var(--app-surface-elevated)]">
      <div className={`${BOARD_CONTENT_GUTTER} flex flex-col gap-2.5 py-3`}>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <FilterField label={t("filters.dateLabel")} className="w-full sm:w-[15rem]">
            <Select
              aria-label={t("filters.dateField")}
              leftSection={<CalendarIcon />}
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
          </FilterField>
          <FilterField label={t("filters.range")} className="w-full sm:w-[13rem]">
            <Select
              aria-label={t("filters.range")}
              leftSection={<CalendarIcon />}
              data={rangeOptions()}
              value={rangeMode}
              onChange={(value) => {
                if (value) onRangeModeChange(value as DateRangeMode);
              }}
              allowDeselect={false}
            />
          </FilterField>
          <div className="flex w-full min-w-0 items-center rounded-[var(--mantine-radius-lg)] border border-[var(--app-border)] px-1 sm:w-[18rem]">
            {canStep ? (
              <ActionIcon variant="subtle" color="gray" aria-label={t("filters.previousPeriod")} onClick={() => step(-1)}>
                <ChevronLeftIcon />
              </ActionIcon>
            ) : null}
            <div className="min-w-0 flex-1">
              <DateRangeControl
                mode={rangeMode}
                range={range}
                dateField={dateField}
                onRangeChange={onRangeChange}
                customError={customError}
                onCustomError={onCustomError}
                onApplyCustom={onApplyCustom}
              />
            </div>
            {canStep ? (
              <ActionIcon variant="subtle" color="gray" aria-label={t("filters.nextPeriod")} onClick={() => step(1)}>
                <ChevronRightIcon />
              </ActionIcon>
            ) : null}
          </div>
          <FilterField label={t("task.category")} className="min-w-[15rem] flex-1">
            <Select
              aria-label={t("task.category")}
              leftSection={<TagIcon />}
              placeholder={t("filters.allCategories")}
              data={[
                { value: "", label: t("filters.allCategories") },
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
              clearable={Boolean(filters.categoryId)}
              searchable
            />
          </FilterField>
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <FilterField label={t("task.priority")} className="w-full sm:w-[17rem]">
            <Select
              aria-label={t("task.priority")}
              leftSection={<FlagIcon />}
              placeholder={t("filters.allPriorities")}
              data={[
                { value: "", label: t("filters.allPriorities") },
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
              clearable={Boolean(filters.priority)}
            />
          </FilterField>
          <FilterField label={t("filters.assignee")} className="w-full sm:w-[19rem]">
            <Select
              aria-label={t("filters.assignee")}
              leftSection={<PersonIcon />}
              placeholder={t("filters.allAssignees")}
              data={[
                { value: "", label: t("filters.allAssignees") },
                ...(currentUserId ? [{ value: currentUserId, label: t("filters.assignedToMe") }] : []),
                { value: UNASSIGNED, label: t("filters.unassigned") },
                ...people
                  .filter((person) => person.user_id !== currentUserId)
                  .map((person) => ({ value: person.user_id, label: person.display_name })),
              ]}
              value={filters.assigneeId ?? ""}
              onChange={(value) => onFiltersChange({ ...filters, assigneeId: value ?? "" })}
              clearable={Boolean(filters.assigneeId)}
              searchable
            />
          </FilterField>
          <TextInput
            className="min-w-[14rem] flex-1"
            aria-label={t("filters.search")}
            leftSection={<SearchIcon />}
            placeholder={t("filters.searchTasks")}
            value={filters.query}
            onChange={(event) =>
              onFiltersChange({
                ...filters,
                query: event.currentTarget.value,
              })
            }
          />
          <Button variant="light" leftSection={<ResetIcon />} onClick={onReset}>
            {t("filters.reset")}
          </Button>
        </div>
      </div>
    </section>
  );
}

function FilterField({ label, className = "", children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <div className={`flex min-w-0 items-center gap-2.5 ${className}`}>
      <span className="shrink-0 text-sm font-semibold text-[var(--app-text)]">{label}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
