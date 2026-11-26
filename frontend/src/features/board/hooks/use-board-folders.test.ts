import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";

import { boardKeys } from "../api/board-queries";
import { folderKeys, useBoardFolderMutations } from "./use-board-folders";

const mockUpdateBoard = jest.fn();

jest.mock("@/lib/api-client", () => ({
  apiClient: { updateBoard: (...args: unknown[]) => mockUpdateBoard(...args) },
}));

function setup() {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const invalidate = jest.spyOn(queryClient, "invalidateQueries");
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  const { result } = renderHook(() => useBoardFolderMutations(), { wrapper });
  return { result, invalidate };
}

beforeEach(() => mockUpdateBoard.mockReset());

describe("moveBoard", () => {
  it("saves the board's folder and refreshes the board list", async () => {
    mockUpdateBoard.mockResolvedValue({ id: "board-1", folder_id: "folder-1" });
    const { result, invalidate } = setup();
    await act(async () => {
      await result.current.moveBoard.mutateAsync({ boardId: "board-1", folderId: "folder-1" });
    });
    expect(mockUpdateBoard).toHaveBeenCalledWith("board-1", { folder_id: "folder-1" });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: boardKeys.list });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: folderKeys.list });
  });

  it("sends null to take a board out of its folder", async () => {
    mockUpdateBoard.mockResolvedValue({ id: "board-1", folder_id: null });
    const { result } = setup();
    await act(async () => {
      await result.current.moveBoard.mutateAsync({ boardId: "board-1", folderId: null });
    });
    expect(mockUpdateBoard).toHaveBeenCalledWith("board-1", { folder_id: null });
  });

  it("reports a failed move to the caller without refreshing", async () => {
    mockUpdateBoard.mockRejectedValue(new Error("nope"));
    const { result, invalidate } = setup();
    const onError = jest.fn();
    act(() => result.current.moveBoard.mutate({ boardId: "board-1", folderId: "folder-1" }, { onError }));
    await waitFor(() => expect(onError).toHaveBeenCalled());
    expect(invalidate).not.toHaveBeenCalled();
  });
});
