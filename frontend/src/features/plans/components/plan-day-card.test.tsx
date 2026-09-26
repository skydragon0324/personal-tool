import { MantineProvider } from "@mantine/core";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";

import type { PlanDay } from "../types";
import { PlanDayCard } from "./plan-day-card";

const DAY: PlanDay = {
  id: "day-1",
  plan_id: "plan-1",
  day: "2026-09-21",
  title: "",
  created_at: "2026-09-21T09:00:00Z",
  updated_at: "2026-09-21T09:00:00Z",
  items: [
    {
      id: "item-1",
      day_id: "day-1",
      title: "Study React for 1 hour",
      is_completed: true,
      completed_at: "2026-09-21T10:00:00Z",
      position: 0,
      created_at: "2026-09-21T09:00:00Z",
      updated_at: "2026-09-21T09:00:00Z",
    },
    {
      id: "item-2",
      day_id: "day-1",
      title: "Read 20 pages",
      is_completed: false,
      completed_at: null,
      position: 1,
      created_at: "2026-09-21T09:00:00Z",
      updated_at: "2026-09-21T09:00:00Z",
    },
  ],
};

function renderCard(overrides: Partial<Parameters<typeof PlanDayCard>[0]> = {}) {
  const props = {
    day: DAY,
    onToggleItem: vi.fn(),
    onRenameItem: vi.fn(),
    onDeleteItem: vi.fn(),
    onAddItem: vi.fn(async () => undefined),
    onEditDay: vi.fn(),
    onDeleteDay: vi.fn(),
    ...overrides,
  };
  render(createElement(MantineProvider, { env: "test" }, createElement(PlanDayCard, props)));
  return props;
}

describe("PlanDayCard", () => {
  it("strikes through completed items only and shows progress", () => {
    renderCard();
    expect(screen.getByRole("heading", { name: /Monday, September 21/ })).toBeInTheDocument();
    expect(screen.getByLabelText("1 of 2 done")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Study React for 1 hour" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Read 20 pages" })).not.toBeChecked();
    expect(screen.getByText("Study React for 1 hour")).toHaveClass("line-through");
    expect(screen.getByText("Read 20 pages")).not.toHaveClass("line-through");
  });

  it("toggles items from the checkbox and the text", async () => {
    const props = renderCard();
    await userEvent.click(screen.getByRole("checkbox", { name: "Read 20 pages" }));
    expect(props.onToggleItem).toHaveBeenCalledWith(DAY.items[1], true);
    await userEvent.click(screen.getByText("Study React for 1 hour"));
    expect(props.onToggleItem).toHaveBeenCalledWith(DAY.items[0], false);
  });

  it("adds, renames and deletes items", async () => {
    const props = renderCard();
    const input = screen.getByRole("textbox", { name: /Add an item/ });
    await userEvent.type(input, "Practice TypeScript{Enter}");
    await waitFor(() => expect(props.onAddItem).toHaveBeenCalledWith(DAY, "Practice TypeScript"));
    await waitFor(() => expect(input).toHaveValue(""));

    await userEvent.click(screen.getByRole("button", { name: "Edit Read 20 pages" }));
    const editor = screen.getByRole("textbox", { name: "Item text" });
    await userEvent.clear(editor);
    await userEvent.type(editor, "Read 30 pages{Enter}");
    expect(props.onRenameItem).toHaveBeenCalledWith(DAY.items[1], "Read 30 pages");

    await userEvent.click(screen.getByRole("button", { name: "Delete Study React for 1 hour" }));
    expect(props.onDeleteItem).toHaveBeenCalledWith(DAY.items[0]);
  });
});
