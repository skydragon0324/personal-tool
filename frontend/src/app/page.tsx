"use client";

import { useCallback, useEffect, useState } from "react";

import { DashboardSummaryCard } from "@/components/DashboardSummary";
import { TaskFiltersBar } from "@/components/TaskFilters";
import { TaskForm } from "@/components/TaskForm";
import { TaskList } from "@/components/TaskList";
import { api } from "@/lib/api";
import { formatDisplayDate, todayISO } from "@/lib/dates";
import type {
  DashboardSummary,
  Task,
  TaskCreate,
  TaskFilters,
} from "@/lib/types";

export default function HomePage() {
  // Dates are set after mount so SSR HTML matches the first client render.
  const [filters, setFilters] = useState<TaskFilters | null>(null);
  const [dateLabel, setDateLabel] = useState("");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [editing, setEditing] = useState<Task | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const today = todayISO();
    setFilters({ due_date: today, completed: "", priority: "" });
    setDateLabel(formatDisplayDate(today));
  }, []);

  const loadTasks = useCallback(async () => {
    if (!filters) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.getTasks({
        due_date: filters.due_date || undefined,
        completed: filters.completed || undefined,
        priority: filters.priority || undefined,
      });
      setTasks(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tasks");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const loadSummary = useCallback(async () => {
    setSummaryLoading(true);
    try {
      const data = await api.getSummary(todayISO());
      setSummary(data);
    } catch {
      setSummary(null);
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!filters) return;
    void loadTasks();
  }, [filters, loadTasks]);

  useEffect(() => {
    if (!filters) return;
    void loadSummary();
  }, [filters, loadSummary]);

  async function refreshAll() {
    await Promise.all([loadTasks(), loadSummary()]);
  }

  async function handleCreate(payload: TaskCreate) {
    setSubmitting(true);
    try {
      await api.createTask(payload);
      setEditing(null);
      await refreshAll();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUpdate(payload: TaskCreate) {
    if (!editing) return;
    setSubmitting(true);
    try {
      await api.updateTask(editing.id, payload);
      setEditing(null);
      await refreshAll();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggle(task: Task) {
    setBusyId(task.id);
    setError(null);
    try {
      await api.updateTask(task.id, { completed: !task.completed });
      await refreshAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update task");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(task: Task) {
    const confirmed = window.confirm(`Delete “${task.title}”?`);
    if (!confirmed) return;

    setBusyId(task.id);
    setError(null);
    try {
      await api.deleteTask(task.id);
      if (editing?.id === task.id) setEditing(null);
      await refreshAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete task");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-4 py-10 sm:px-6">
      <header className="mb-8">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-teal-800">
          Daily To-Do
        </p>
        <h1 className="mt-2 font-display text-4xl text-ink sm:text-5xl">
          Your day, clearly.
        </h1>
        <p className="mt-3 max-w-xl text-slate-600">
          Capture today’s tasks, filter by priority or status, and keep a
          simple pulse on what’s left.
        </p>
      </header>

      <DashboardSummaryCard
        summary={summary}
        loading={summaryLoading || !filters}
        dateLabel={dateLabel}
      />

      <div className="mb-6">
        <TaskForm
          key={editing ? `edit-${editing.id}` : "create"}
          initial={editing}
          submitting={submitting}
          onSubmit={editing ? handleUpdate : handleCreate}
          onCancel={editing ? () => setEditing(null) : undefined}
        />
      </div>

      {filters ? (
        <TaskFiltersBar
          filters={filters}
          onChange={setFilters}
          onResetToday={() =>
            setFilters({ due_date: todayISO(), completed: "", priority: "" })
          }
        />
      ) : null}

      {error ? (
        <div
          className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
          role="alert"
        >
          {error}
          <button
            type="button"
            onClick={() => void refreshAll()}
            className="ml-2 font-medium underline"
          >
            Retry
          </button>
        </div>
      ) : null}

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-xl text-ink">Tasks</h2>
          <p className="text-sm text-slate-500">
            {loading ? "…" : `${tasks.length} shown`}
          </p>
        </div>
        <TaskList
          tasks={tasks}
          loading={loading}
          busyId={busyId}
          onToggle={handleToggle}
          onEdit={setEditing}
          onDelete={handleDelete}
        />
      </section>
    </main>
  );
}
