import type { DashboardSummary, Task, TaskCreate, TaskUpdate } from "./types";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    let detail = "Something went wrong";
    try {
      const data = (await response.json()) as { detail?: string };
      if (typeof data.detail === "string") {
        detail = data.detail;
      }
    } catch {
      // ignore JSON parse errors
    }
    throw new Error(detail);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export function buildTasksQuery(params: {
  due_date?: string;
  completed?: string;
  priority?: string;
}): string {
  const query = new URLSearchParams();
  if (params.due_date) query.set("due_date", params.due_date);
  if (params.completed === "true" || params.completed === "false") {
    query.set("completed", params.completed);
  }
  if (params.priority) query.set("priority", params.priority);
  const qs = query.toString();
  return qs ? `?${qs}` : "";
}

export const api = {
  getTasks(params: {
    due_date?: string;
    completed?: string;
    priority?: string;
  }): Promise<Task[]> {
    return request<Task[]>(`/tasks${buildTasksQuery(params)}`);
  },

  getSummary(day?: string): Promise<DashboardSummary> {
    const qs = day ? `?day=${encodeURIComponent(day)}` : "";
    return request<DashboardSummary>(`/tasks/summary${qs}`);
  },

  createTask(payload: TaskCreate): Promise<Task> {
    return request<Task>("/tasks", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  updateTask(id: number, payload: TaskUpdate): Promise<Task> {
    return request<Task>(`/tasks/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },

  deleteTask(id: number): Promise<void> {
    return request<void>(`/tasks/${id}`, { method: "DELETE" });
  },
};
