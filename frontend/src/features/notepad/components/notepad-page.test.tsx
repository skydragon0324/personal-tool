import { MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { createElement } from "react";

import { NotepadPage } from "./notepad-page";

const mockGetNote = jest.fn();
const mockReplace = jest.fn();
const mockRouter = { isReady: true, query: {} as Record<string, string>, replace: (...args: unknown[]) => mockReplace(...args) };

jest.mock("@/lib/api-client", () => ({
  ApiError: class ApiError extends Error {},
  apiClient: {
    listNotes: () => Promise.resolve([]),
    getNote: (...args: unknown[]) => mockGetNote(...args),
  },
}));

jest.mock("@/lib/navigation", () => ({ useRouter: () => mockRouter }));

jest.mock("./note-modal", () => ({
  NoteModal: ({ opened, note }: { opened: boolean; note: { title: string } | null }) =>
    opened ? createElement("div", { "data-testid": "note-modal" }, note ? `Editing ${note.title}` : "New note") : null,
}));

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    createElement(QueryClientProvider, { client }, createElement(MantineProvider, { env: "test" }, createElement(NotepadPage))),
  );
}

beforeEach(() => {
  mockGetNote.mockReset();
  mockReplace.mockReset();
  mockRouter.query = {};
});

describe("NotepadPage links", () => {
  it("opens the note a link points at (as search results do)", async () => {
    mockRouter.query = { note: "n1" };
    mockGetNote.mockResolvedValue({ id: "n1", title: "Report ideas" });
    renderPage();
    expect(await screen.findByTestId("note-modal")).toHaveTextContent("Editing Report ideas");
    expect(mockGetNote).toHaveBeenCalledWith("n1");
    // The link is consumed so closing the note does not reopen it.
    expect(mockReplace).toHaveBeenCalledWith("/notepad", undefined, { shallow: true });
  });

  it("starts a new note for ?new=1", async () => {
    mockRouter.query = { new: "1" };
    renderPage();
    expect(await screen.findByTestId("note-modal")).toHaveTextContent("New note");
  });

  it("does nothing without a link", async () => {
    renderPage();
    await waitFor(() => expect(screen.queryByTestId("note-modal")).toBeNull());
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
