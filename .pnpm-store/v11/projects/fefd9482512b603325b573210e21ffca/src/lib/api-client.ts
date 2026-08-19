const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "http://localhost:8000";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  const isFormData =
    typeof FormData !== "undefined" && init?.body instanceof FormData;

  // Let the browser set multipart boundary for FormData uploads.
  if (!isFormData && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });

  if (!response.ok) {
    let detail = response.statusText;
    try {
      const body = (await response.json()) as { detail?: string | unknown };
      if (typeof body.detail === "string") detail = body.detail;
      else if (body.detail) detail = JSON.stringify(body.detail);
    } catch {
      /* ignore */
    }
    throw new ApiError(detail, response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export const apiClient = {
  getBoardView: (boardId: string, startDate: string, endDate: string) =>
    request<import("@/features/board/types").BoardView>(
      `/api/v1/boards/${boardId}/view?start_date=${encodeURIComponent(startDate)}&end_date=${encodeURIComponent(endDate)}`,
    ),

  getTask: (taskId: string) =>
    request<import("@/features/board/types").TaskDetail>(`/api/v1/tasks/${taskId}`),

  createTask: (payload: import("@/features/board/types").TaskCreate) =>
    request<import("@/features/board/types").TaskDetail>(`/api/v1/tasks`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  updateTask: (taskId: string, payload: import("@/features/board/types").TaskUpdate) =>
    request<import("@/features/board/types").TaskDetail>(`/api/v1/tasks/${taskId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),

  moveTask: (taskId: string, payload: import("@/features/board/types").TaskMove) =>
    request<import("@/features/board/types").TaskDetail>(`/api/v1/tasks/${taskId}/move`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),

  deleteTask: (taskId: string) =>
    request<void>(`/api/v1/tasks/${taskId}`, { method: "DELETE" }),

  uploadAttachment: (taskId: string, file: File) => {
    const body = new FormData();
    body.append("file", file);
    return request<import("@/features/board/types").TaskAttachment>(
      `/api/v1/tasks/${taskId}/attachments`,
      { method: "POST", body },
    );
  },

  deleteAttachment: (taskId: string, attachmentId: string) =>
    request<void>(`/api/v1/tasks/${taskId}/attachments/${attachmentId}`, {
      method: "DELETE",
    }),

  health: () => request<{ status: string }>("/api/v1/health"),
};
