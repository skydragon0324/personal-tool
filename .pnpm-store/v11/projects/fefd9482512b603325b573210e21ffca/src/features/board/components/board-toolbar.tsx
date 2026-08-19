"use client";

import { DatePickerInput } from "@mantine/dates";
import { Select, TextInput } from "@mantine/core";

import type { Priority } from "../types";

export interface BoardFilters {
  priority: Priority | "";
  query: string;
}

interface BoardToolbarProps {
  range: [string | null, string | null];
  onRangeChange: (range: [string | null, string | null]) => void;
  boardName: string;
  filters: BoardFilters;
  onFiltersChange: (next: BoardFilters) => void;
}

export function BoardToolbar({
  range,
  onRangeChange,
  boardName,
  filters,
  onFiltersChange,
}: BoardToolbarProps) {
  return (
    <header className="mb-6 space-y-5">
      <div>
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-teal-800">
          Daily To-Do
        </p>
        <h1 className="mt-1 font-display text-4xl text-ink">{boardName}</h1>
      </div>

      <div className="grid gap-3 rounded-2xl border border-slate-200/80 bg-white/80 p-4 shadow-sm lg:grid-cols-[minmax(16rem,22rem)_minmax(10rem,12rem)_1fr]">
        <DatePickerInput
          type="range"
          label="Board dates"
          placeholder="Pick date range"
          value={range}
          onChange={(value) => {
            const next = value as [string | null, string | null];
            onRangeChange(next);
          }}
          valueFormat="MMM D, YYYY"
          allowSingleDateInRange
        />
        <Select
          label="Priority"
          placeholder="All priorities"
          data={[
            { value: "", label: "All priorities" },
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
          placeholder="Filter by title or details…"
          value={filters.query}
          onChange={(event) =>
            onFiltersChange({
              ...filters,
              query: event.currentTarget.value,
            })
          }
        />
      </div>
    </header>
  );
}
