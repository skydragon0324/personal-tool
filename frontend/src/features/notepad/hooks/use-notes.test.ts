import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-client";

import { noteKeys } from "../api/note-queries";
import type { Note } from "../types";
import { useNoteMutations } from "./use-notes";

const updateNote = vi.fn();
const listNotes = vi.fn();
const notifyApiError = vi.fn();

vi.mock("@/lib/api-client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api-client")>("@/lib/api-client");
  return {
    ...actual,
    apiClient: {
      ...actual.apiClient,
      updateNote: (...args: unknown[]) => updateNote(...args),
      listNotes: (...args: unknown[]) => listNotes(...args),
    },
  };
});

vi.mock("@/lib/notify", () => ({
  notifyApiError: (...args: unknown[]) => notifyApiError(...args),
}));

const sample: Note = {
  id: "note-1",
  title: "Keep title",
  body: "Keep body",
  priority: "high",
  is_pinned: false,
  created_at: "2026-08-19T10:00:00Z",
  updated_at: "2026-08-19T10:00:00Z",
};

function wrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client }, children);
  };
}

describe("note pin mutation", () => {
  beforeEach(() => {
    updateNote.mockReset();
    listNotes.mockReset();
    notifyApiError.mockReset();
  });

  it("sends only is_pinned and updates the list cache", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(noteKeys.list({}), [sample]);
    updateNote.mockResolvedValue({ ...sample, is_pinned: true });
    listNotes.mockResolvedValue([{ ...sample, is_pinned: true }]);
    const { result } = renderHook(() => useNoteMutations(), { wrapper: wrapper(client) });

    await act(async () => {
      await result.current.pin.mutateAsync({ noteId: "note-1", isPinned: true });
    });

    expect(updateNote).toHaveBeenCalledWith("note-1", { is_pinned: true });
    await waitFor(() => {
      const cached = client.getQueryData<Note[]>(noteKeys.list({}));
      expect(cached?.[0].is_pinned).toBe(true);
      expect(cached?.[0].title).toBe("Keep title");
    });
  });

  it("rolls back and drops stale notes on 404", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(noteKeys.list({}), [sample]);
    updateNote.mockRejectedValue(new ApiError("Note not found", 404));
    listNotes.mockResolvedValue([]);
    const { result } = renderHook(() => useNoteMutations(), { wrapper: wrapper(client) });

    await act(async () => {
      await result.current.pin.mutateAsync({ noteId: "note-1", isPinned: true }).catch(() => undefined);
    });

    await waitFor(() => {
      expect(notifyApiError).toHaveBeenCalled();
      const cached = client.getQueryData<Note[]>(noteKeys.list({}));
      expect(cached?.some((item) => item.id === "note-1")).toBe(false);
    });
  });
});
