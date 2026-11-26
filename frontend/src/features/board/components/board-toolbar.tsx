import { ActionIcon, Button, MultiSelect, Select, Text, TextInput } from "@mantine/core";
import { useId, useState, type ReactNode } from "react";

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
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  FlagIcon,
  PersonIcon,
  ResetIcon,
  SearchIcon,
  SlidersIcon,
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
  const [filtersExpanded, setFiltersExpanded] = useState(true);
  const controlsId = useId();
  const canStep = rangeMode !== "custom" && rangeMode !== "all";
  const step = (direction: -1 | 1) => {
    const next = shiftRange(rangeMode, range, direction);
    if (next) onRangeChange(next);
  };

  return (
    <section
      className={`z-20 shrink-0 border-b border-[var(--app-border)] bg-[var(--app-surface-elevated)] ${
        filtersExpanded ? "max-h-[min(44vh,24rem)] overflow-y-auto" : ""
      }`}
    >
      <div className={`${BOARD_CONTENT_GUTTER} py-2.5`}>
        <button
          type="button"
          aria-expanded={filtersExpanded}
          aria-controls={controlsId}
          aria-label={filtersExpanded ? t("filters.collapseControls") : t("filters.expandControls")}
          onClick={() => setFiltersExpanded((current) => !current)}
          className="flex w-full items-center justify-between gap-3 rounded-lg px-1.5 py-1 text-left text-sm font-semibold text-[var(--app-text)] transition-colors hover:bg-[var(--app-surface-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--app-primary)]"
        >
          <span className="flex items-center gap-2">
            <SlidersIcon />
            {t("filters.controls")}
          </span>
          <span className="flex items-center gap-1.5 text-xs font-medium text-[var(--app-text-muted)]">
            {filtersExpanded ? t("filters.collapse") : t("filters.expand")}
            {filtersExpanded ? <ChevronUpIcon /> : <ChevronDownIcon />}
          </span>
        </button>

        {filtersExpanded ? (
          <div id={controlsId} role="group" aria-label={t("filters.controls")} className="mt-2.5 flex flex-col gap-2.5">
            <div
              data-testid="primary-filter-row"
              className="grid min-w-0 grid-cols-1 items-center gap-2 md:grid-cols-2 xl:grid-cols-[minmax(0,3fr)_minmax(0,4fr)_minmax(0,3fr)]"
            >
              <div className="min-w-0" data-testid="board-search-field">
                <TextInput
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
              </div>
              <FilterField
                label={t("filters.assignee")}
                className="min-w-0"
                testId="assignee-filter-field"
              >
                <MultiSelect
                  aria-label={t("filters.assignee")}
                  leftSection={<PersonIcon />}
                  placeholder={filters.assigneeIds.length ? undefined : t("filters.allAssignees")}
                  data={[
                    ...(currentUserId ? [{ value: currentUserId, label: t("filters.assignedToMe") }] : []),
                    { value: UNASSIGNED, label: t("filters.unassigned") },
                    ...people
                      .filter((person) => person.user_id !== currentUserId)
                      .map((person) => ({ value: person.user_id, label: person.display_name })),
                  ]}
                  value={filters.assigneeIds}
                  onChange={(value) => onFiltersChange({ ...filters, assigneeIds: value })}
                  clearable
                  hidePickedOptions={false}
                  searchable
                />
              </FilterField>
              <FilterField
                label={t("task.priority")}
                className="min-w-0"
                testId="priority-filter-field"
              >
                <MultiSelect
                  aria-label={t("task.priority")}
                  leftSection={<FlagIcon />}
                  placeholder={filters.priorities.length ? undefined : t("filters.allPriorities")}
                  data={[
                    { value: "high", label: t("task.priorityHigh") },
                    { value: "medium", label: t("task.priorityMedium") },
                    { value: "low", label: t("task.priorityLow") },
                  ]}
                  value={filters.priorities}
                  onChange={(value) =>
                    onFiltersChange({
                      ...filters,
                      priorities: value as Priority[],
                    })
                  }
                  clearable
                  hidePickedOptions={false}
                />
              </FilterField>
            </div>

            <div
              data-testid="secondary-filter-row"
              className="grid min-w-0 grid-cols-1 items-center gap-2 xl:grid-cols-[minmax(20rem,2fr)_minmax(30rem,3fr)_auto]"
            >
              <FilterField
                label={t("filters.list")}
                className="min-w-0"
                testId="category-filter-field"
              >
                <MultiSelect
                  aria-label={t("filters.list")}
                  leftSection={<TagIcon />}
                  placeholder={filters.categoryIds.length ? undefined : t("filters.allLists")}
                  data={categories.map((category) => ({
                    value: category.id,
                    label: category.name,
                  }))}
                  value={filters.categoryIds}
                  onChange={(value) => onFiltersChange({ ...filters, categoryIds: value })}
                  clearable
                  hidePickedOptions={false}
                  searchable
                />
              </FilterField>

              <div className="flex min-w-0 flex-col gap-1.5 sm:flex-row sm:items-center" data-testid="date-search-field">
                <span className="shrink-0 text-sm font-semibold text-[var(--app-text)]">{t("filters.dateSearch")}</span>
                <div className="grid min-w-0 flex-1 grid-cols-1 gap-2 md:grid-cols-[9rem_8rem_minmax(12rem,1fr)]">
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
                  <Select
                    aria-label={t("filters.range")}
                    data={rangeOptions()}
                    value={rangeMode}
                    onChange={(value) => {
                      if (value) onRangeModeChange(value as DateRangeMode);
                    }}
                    allowDeselect={false}
                  />
                  <div className="flex min-w-0 items-center rounded-[var(--mantine-radius-lg)] border border-[var(--app-border)] px-1">
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
                </div>
              </div>

              <Button className="w-full xl:w-auto" variant="light" leftSection={<ResetIcon />} onClick={onReset}>
                {t("filters.resetSearch")}
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function FilterField({
  label,
  className = "",
  testId,
  children,
}: {
  label: string;
  className?: string;
  testId?: string;
  children: ReactNode;
}) {
  return (
    <div className={`flex min-w-0 items-center gap-2.5 ${className}`} data-testid={testId}>
      <span className="shrink-0 text-sm font-semibold text-[var(--app-text)]">{label}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
