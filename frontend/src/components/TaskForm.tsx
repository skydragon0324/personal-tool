"use client";

import { FormEvent, useEffect, useState } from "react";

import type { Priority, Task, TaskCreate } from "@/lib/types";
import { todayISO } from "@/lib/dates";

interface TaskFormProps {
  initial?: Task | null;
  onSubmit: (payload: TaskCreate) => Promise<void>;
  onCancel?: () => void;
  submitting?: boolean;
}

function createEmptyForm() {
  return {
    title: "",
    description: "",
    due_date: "",
    priority: "medium" as Priority,
  };
}

export function TaskForm({
  initial,
  onSubmit,
  onCancel,
  submitting = false,
}: TaskFormProps) {
  const [form, setForm] = useState(createEmptyForm);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initial) {
      setForm({
        title: initial.title,
        description: initial.description ?? "",
        due_date: initial.due_date,
        priority: initial.priority,
      });
    } else {
      setForm({ ...createEmptyForm(), due_date: todayISO() });
    }
  }, [initial]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!form.title.trim()) {
      setError("Title is required.");
      return;
    }

    try {
      await onSubmit({
        title: form.title.trim(),
        description: form.description.trim() || null,
        due_date: form.due_date,
        priority: form.priority,
      });
      if (!initial) {
        setForm({ ...createEmptyForm(), due_date: todayISO() });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save task");
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-slate-200/80 bg-white/80 p-4 shadow-sm backdrop-blur"
    >
      <h2 className="mb-4 font-display text-lg text-ink">
        {initial ? "Edit task" : "Add a task"}
      </h2>
      <div className="grid gap-3">
        <label className="block text-sm">
          <span className="mb-1 block text-slate-600">Title</span>
          <input
            type="text"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="What needs doing?"
            maxLength={200}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-ink outline-none ring-teal-600/30 focus:ring-2"
            required
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-slate-600">Description (optional)</span>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={3}
            maxLength={2000}
            placeholder="Notes, context, links…"
            className="w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2 text-ink outline-none ring-teal-600/30 focus:ring-2"
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block text-slate-600">Due date</span>
            <input
              type="date"
              value={form.due_date}
              onChange={(e) => setForm({ ...form, due_date: e.target.value })}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-ink outline-none ring-teal-600/30 focus:ring-2"
              required
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-slate-600">Priority</span>
            <select
              value={form.priority}
              onChange={(e) =>
                setForm({ ...form, priority: e.target.value as Priority })
              }
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-ink outline-none ring-teal-600/30 focus:ring-2"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </label>
        </div>
      </div>

      {error ? (
        <p className="mt-3 text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-xl bg-teal-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "Saving…" : initial ? "Save changes" : "Add task"}
        </button>
        {initial && onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  );
}
