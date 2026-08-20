import { MantineProvider } from "@mantine/core";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement, type ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";

import type { Note } from "../types";
import { NoteCard } from "./note-card";
import { NoteTable } from "./note-table";

const note: Note = {
  id: "note-1",
  title: "Pin me",
  body: "Body text",
  priority: "high",
  is_pinned: false,
  created_at: "2026-08-19T10:00:00Z",
  updated_at: "2026-08-19T10:00:00Z",
};

function renderWithMantine(ui: ReactElement) {
  return render(createElement(MantineProvider, { env: "test" }, ui));
}

describe("note pin actions", () => {
  it("pins from a card without opening the drawer", async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    const onTogglePin = vi.fn();
    renderWithMantine(
      createElement(NoteCard, {
        note,
        onOpen,
        onTogglePin,
        onDelete: vi.fn(),
      }),
    );
    await user.click(screen.getByLabelText("Note actions"));
    await user.click(await screen.findByRole("menuitem", { name: "Pin" }));
    expect(onTogglePin).toHaveBeenCalledTimes(1);
    expect(onTogglePin.mock.calls[0][0].id).toBe("note-1");
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("pins from a table row without opening the row", async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    const onTogglePin = vi.fn();
    renderWithMantine(
      createElement(NoteTable, {
        notes: [note],
        onOpen,
        onTogglePin,
        onDelete: vi.fn(),
      }),
    );
    await user.click(screen.getByLabelText("Note actions"));
    await user.click(await screen.findByRole("menuitem", { name: "Pin" }));
    expect(onTogglePin).toHaveBeenCalledTimes(1);
    expect(onTogglePin.mock.calls[0][0].id).toBe("note-1");
    expect(onOpen).not.toHaveBeenCalled();
  });
});
