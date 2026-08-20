"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ApiError, apiClient } from "@/lib/api-client";
import { notifyApiError } from "@/lib/notify";

import { noteKeys } from "../api/note-queries";
import type { Note, NoteCreate, NoteListParams, NoteUpdate } from "../types";
import { removeNoteFromLists, replaceNoteInLists, sortNotes } from "../utils/note-cache";

export function useNotes(params: NoteListParams) {
  return useQuery({
    queryKey: noteKeys.list(params),
    queryFn: () => apiClient.listNotes(params),
  });
}

export function useNoteMutations() {
  const queryClient = useQueryClient();

  const invalidateLists = async () => {
    await queryClient.invalidateQueries({ queryKey: noteKeys.all });
  };

  const create = useMutation({
    mutationFn: (payload: NoteCreate) => apiClient.createNote(payload),
    onSuccess: () => invalidateLists(),
  });

  const update = useMutation({
    mutationFn: ({ noteId, payload }: { noteId: string; payload: NoteUpdate }) =>
      apiClient.updateNote(noteId, payload),
    onSuccess: () => invalidateLists(),
  });

  const pin = useMutation({
    mutationFn: ({ noteId, isPinned }: { noteId: string; isPinned: boolean }) =>
      apiClient.updateNote(noteId, { is_pinned: isPinned }),
    onMutate: async ({ noteId, isPinned }) => {
      await queryClient.cancelQueries({ queryKey: noteKeys.all });
      const previous = queryClient.getQueriesData<Note[]>({ queryKey: noteKeys.all });
      queryClient.setQueriesData<Note[]>({ queryKey: noteKeys.all }, (current) => {
        if (!Array.isArray(current)) return current;
        return sortNotes(
          current.map((item) =>
            item.id === noteId
              ? { ...item, is_pinned: isPinned, updated_at: new Date().toISOString() }
              : item,
          ),
        );
      });
      return { previous };
    },
    onError: (error, variables, context) => {
      context?.previous.forEach(([key, data]) => {
        queryClient.setQueryData(key, data);
      });
      if (error instanceof ApiError && error.status === 404) {
        queryClient.setQueriesData<Note[]>({ queryKey: noteKeys.all }, (current) =>
          removeNoteFromLists(current, variables.noteId),
        );
        void invalidateLists();
      }
      notifyApiError(error, "Could not update note");
    },
    onSuccess: (note) => {
      queryClient.setQueriesData<Note[]>({ queryKey: noteKeys.all }, (current) =>
        replaceNoteInLists(current, note),
      );
    },
    onSettled: () => invalidateLists(),
  });

  const remove = useMutation({
    mutationFn: (noteId: string) => apiClient.deleteNote(noteId),
    onSuccess: () => invalidateLists(),
  });

  return { create, update, pin, remove };
}
