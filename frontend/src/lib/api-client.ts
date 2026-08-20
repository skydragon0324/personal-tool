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

const CSRF_COOKIE = "life_csrf";
const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const PUBLIC_MUTATIONS = new Set(["/api/v1/auth/login", "/api/v1/auth/register"]);

let csrfToken: string | null = null;
let unauthorizedHandler: (() => void) | null = null;
let csrfInflight: Promise<string> | null = null;

export function setCsrfToken(token: string | null) {
  csrfToken = token;
}

export function getCsrfToken(): string | null {
  return csrfToken ?? readCsrfCookie();
}

export function setUnauthorizedHandler(handler: (() => void) | null) {
  unauthorizedHandler = handler;
}

function readCsrfCookie(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${CSRF_COOKIE}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function isAuthApiPath(path: string): boolean {
  return path.startsWith("/api/v1/auth/");
}

async function fetchCsrfToken(): Promise<string> {
  const body = await request<{ csrf_token: string }>("/api/v1/auth/csrf");
  setCsrfToken(body.csrf_token);
  return body.csrf_token;
}

async function ensureCsrfToken(): Promise<string | null> {
  const existing = getCsrfToken();
  if (existing) return existing;
  if (!csrfInflight) {
    csrfInflight = fetchCsrfToken().finally(() => {
      csrfInflight = null;
    });
  }
  try {
    return await csrfInflight;
  } catch {
    return getCsrfToken();
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

  const method = (init?.method ?? "GET").toUpperCase();
  if (
    MUTATING.has(method) &&
    !headers.has("X-CSRF-Token") &&
    !PUBLIC_MUTATIONS.has(path)
  ) {
    const token = await ensureCsrfToken();
    if (token) headers.set("X-CSRF-Token", token);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
    cache: "no-store",
    credentials: "include",
  });

  if (!response.ok) {
    if (response.status === 401 && !isAuthApiPath(path)) {
      unauthorizedHandler?.();
    }
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
  getBoardView: (params: import("@/features/board/types").BoardQueryParams) => {
    const search = new URLSearchParams();
    search.set("date_field", params.dateField);
    search.set("limit", "500");
    if (params.unbounded) {
      search.set("unbounded", "true");
    } else {
      search.set("start_date", params.startDate);
      search.set("end_date", params.endDate);
    }
    return request<import("@/features/board/types").BoardView>(
      `/api/v1/boards/${params.boardId}/view?${search.toString()}`,
    );
  },

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

  listCategories: (boardId: string) =>
    request<import("@/features/board/types").CategoryDetail[]>(
      `/api/v1/boards/${boardId}/categories`,
    ),

  createCategory: (
    boardId: string,
    payload: { name: string; color: string },
  ) =>
    request<import("@/features/board/types").CategoryDetail>(
      `/api/v1/boards/${boardId}/categories`,
      { method: "POST", body: JSON.stringify(payload) },
    ),

  health: () => request<{ status: string }>("/api/v1/health"),

  listColumns: (boardId: string, includeArchived = true) =>
    request<import("@/features/board/types").ColumnDetail[]>(
      `/api/v1/boards/${boardId}/columns?include_archived=${includeArchived ? "true" : "false"}`,
    ),

  createColumn: (
    boardId: string,
    payload: { name: string; color?: string; icon_name?: string | null; is_done?: boolean },
  ) =>
    request<import("@/features/board/types").ColumnDetail>(
      `/api/v1/boards/${boardId}/columns`,
      { method: "POST", body: JSON.stringify(payload) },
    ),

  updateColumn: (
    columnId: string,
    payload: { name?: string; color?: string; icon_name?: string | null; is_done?: boolean },
  ) =>
    request<import("@/features/board/types").ColumnDetail>(
      `/api/v1/columns/${columnId}`,
      { method: "PATCH", body: JSON.stringify(payload) },
    ),

  reorderColumn: (columnId: string, targetPosition: number) =>
    request<import("@/features/board/types").ColumnDetail>(
      `/api/v1/columns/${columnId}/reorder`,
      { method: "PATCH", body: JSON.stringify({ target_position: targetPosition }) },
    ),

  archiveColumn: (columnId: string, moveToColumnId?: string | null) =>
    request<import("@/features/board/types").ColumnDetail>(
      `/api/v1/columns/${columnId}/archive`,
      {
        method: "POST",
        body: JSON.stringify({ move_to_column_id: moveToColumnId ?? null }),
      },
    ),

  restoreColumn: (columnId: string) =>
    request<import("@/features/board/types").ColumnDetail>(
      `/api/v1/columns/${columnId}/restore`,
      { method: "POST" },
    ),

  deleteColumn: (columnId: string) =>
    request<void>(`/api/v1/columns/${columnId}`, { method: "DELETE" }),

  listBoards: (includeArchived = true) =>
    request<import("@/features/board/types").BoardListItem[]>(
      `/api/v1/boards?include_archived=${includeArchived ? "true" : "false"}`,
    ),

  getBoard: (boardId: string) =>
    request<import("@/features/board/types").BoardListItem>(`/api/v1/boards/${boardId}`),

  createBoard: (payload: import("@/features/board/types").BoardCreate) =>
    request<import("@/features/board/types").BoardListItem>(`/api/v1/boards`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  updateBoard: (
    boardId: string,
    payload: {
      name?: string;
      color?: string;
      icon_name?: string | null;
      timezone?: string;
    },
  ) =>
    request<import("@/features/board/types").BoardListItem>(`/api/v1/boards/${boardId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),

  reorderBoard: (boardId: string, targetPosition: number) =>
    request<import("@/features/board/types").BoardListItem>(
      `/api/v1/boards/${boardId}/reorder`,
      { method: "PATCH", body: JSON.stringify({ target_position: targetPosition }) },
    ),

  archiveBoard: (boardId: string) =>
    request<import("@/features/board/types").BoardListItem>(
      `/api/v1/boards/${boardId}/archive`,
      { method: "POST" },
    ),

  restoreBoard: (boardId: string) =>
    request<import("@/features/board/types").BoardListItem>(
      `/api/v1/boards/${boardId}/restore`,
      { method: "POST" },
    ),

  deleteBoard: (boardId: string) =>
    request<void>(`/api/v1/boards/${boardId}`, { method: "DELETE" }),

  listNotes: (params: import("@/features/notepad/types").NoteListParams = {}) => {
    const search = new URLSearchParams();
    if (params.query) search.set("query", params.query);
    if (params.priority) search.set("priority", params.priority);
    if (params.pinned !== undefined) search.set("pinned", String(params.pinned));
    const query = search.toString();
    return request<import("@/features/notepad/types").Note[]>(
      `/api/v1/notes${query ? `?${query}` : ""}`,
    );
  },

  getDashboardSummary: (today: string) =>
    request<import("@/features/dashboard/types").DashboardSummary>(
      `/api/v1/dashboard/summary?today=${encodeURIComponent(today)}`,
    ),

  listSchedule: (weekStart: string, today: string) =>
    request<import("@/features/schedule/types").ScheduleEntry[]>(
      `/api/v1/schedule?week_start=${encodeURIComponent(weekStart)}&today=${encodeURIComponent(today)}`,
    ),

  setScheduleOccurrence: (
    entryId: string,
    occurrenceDate: string,
    payload: { is_completed: boolean },
  ) =>
    request<{
      schedule_entry_id: string;
      occurrence_date: string;
      is_completed: boolean;
      completed_at: string | null;
    }>(`/api/v1/schedule/${entryId}/occurrences/${occurrenceDate}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),

  getToday: (date: string) =>
    request<import("@/features/today/types").TodayResponse>(
      `/api/v1/today?date=${encodeURIComponent(date)}`,
    ),

  createSchedule: (payload: import("@/features/schedule/types").ScheduleEntryCreate) =>
    request<import("@/features/schedule/types").ScheduleEntry>(`/api/v1/schedule`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  updateSchedule: (
    entryId: string,
    payload: import("@/features/schedule/types").ScheduleEntryUpdate,
  ) =>
    request<import("@/features/schedule/types").ScheduleEntry>(`/api/v1/schedule/${entryId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),

  deleteSchedule: (entryId: string) =>
    request<void>(`/api/v1/schedule/${entryId}`, { method: "DELETE" }),

  getNote: (noteId: string) =>
    request<import("@/features/notepad/types").Note>(`/api/v1/notes/${noteId}`),

  createNote: (payload: import("@/features/notepad/types").NoteCreate) =>
    request<import("@/features/notepad/types").Note>(`/api/v1/notes`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  updateNote: (noteId: string, payload: import("@/features/notepad/types").NoteUpdate) =>
    request<import("@/features/notepad/types").Note>(`/api/v1/notes/${noteId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),

  deleteNote: (noteId: string) =>
    request<void>(`/api/v1/notes/${noteId}`, { method: "DELETE" }),

  createSubtask: (taskId: string, payload: { title: string }) =>
    request<import("@/features/board/types").TaskSubtask>(
      `/api/v1/tasks/${taskId}/subtasks`,
      { method: "POST", body: JSON.stringify(payload) },
    ),

  updateSubtask: (
    taskId: string,
    subtaskId: string,
    payload: { title?: string; is_completed?: boolean },
  ) =>
    request<import("@/features/board/types").TaskSubtask>(
      `/api/v1/tasks/${taskId}/subtasks/${subtaskId}`,
      { method: "PATCH", body: JSON.stringify(payload) },
    ),

  deleteSubtask: (taskId: string, subtaskId: string) =>
    request<void>(`/api/v1/tasks/${taskId}/subtasks/${subtaskId}`, {
      method: "DELETE",
    }),

  reorderSubtasks: (
    taskId: string,
    payload: {
      subtask_id: string;
      before_subtask_id?: string | null;
      after_subtask_id?: string | null;
    },
  ) =>
    request<import("@/features/board/types").TaskSubtask[]>(
      `/api/v1/tasks/${taskId}/subtasks/reorder`,
      { method: "PATCH", body: JSON.stringify(payload) },
    ),

  me: () => request<import("@/features/auth/types").AuthUser>("/api/v1/auth/me"),

  getCsrf: () => fetchCsrfToken(),

  register: (payload: import("@/features/auth/types").RegisterPayload) =>
    request<import("@/features/auth/types").AuthResponse>("/api/v1/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    }).then((body) => {
      setCsrfToken(body.csrf_token);
      return body;
    }),

  login: (payload: import("@/features/auth/types").LoginPayload) =>
    request<import("@/features/auth/types").AuthResponse>("/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    }).then((body) => {
      setCsrfToken(body.csrf_token);
      return body;
    }),

  logout: () =>
    request<void>("/api/v1/auth/logout", { method: "POST" }).finally(() => {
      setCsrfToken(null);
    }),
};
