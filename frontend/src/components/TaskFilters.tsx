import type { TaskFilters } from "@/lib/types";

interface TaskFiltersProps {
  filters: TaskFilters;
  onChange: (next: TaskFilters) => void;
  onResetToday: () => void;
}

export function TaskFiltersBar({
  filters,
  onChange,
  onResetToday,
}: TaskFiltersProps) {
  return (
    <section className="mb-6 rounded-2xl border border-slate-200/80 bg-white/80 p-4 shadow-sm backdrop-blur">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="font-display text-lg text-ink">Filters</h2>
        <button
          type="button"
          onClick={onResetToday}
          className="text-sm font-medium text-teal-700 transition hover:text-teal-900"
        >
          Show today
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block text-sm">
          <span className="mb-1 block text-slate-600">Due date</span>
          <input
            type="date"
            value={filters.due_date}
            onChange={(e) =>
              onChange({ ...filters, due_date: e.target.value })
            }
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-ink outline-none ring-teal-600/30 focus:ring-2"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-slate-600">Status</span>
          <select
            value={filters.completed}
            onChange={(e) =>
              onChange({
                ...filters,
                completed: e.target.value as TaskFilters["completed"],
              })
            }
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-ink outline-none ring-teal-600/30 focus:ring-2"
          >
            <option value="">All</option>
            <option value="false">Incomplete</option>
            <option value="true">Completed</option>
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-slate-600">Priority</span>
          <select
            value={filters.priority}
            onChange={(e) =>
              onChange({
                ...filters,
                priority: e.target.value as TaskFilters["priority"],
              })
            }
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-ink outline-none ring-teal-600/30 focus:ring-2"
          >
            <option value="">All</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </label>
      </div>
    </section>
  );
}
