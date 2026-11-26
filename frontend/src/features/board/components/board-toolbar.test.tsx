import { MantineProvider } from "@mantine/core";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement, useState } from "react";

import type { BoardFilters } from "../types";
import { BoardToolbar } from "./board-toolbar";

function Harness({ initial, onChange }: { initial: BoardFilters; onChange: (next: BoardFilters) => void }) {
  const [filters, setFilters] = useState(initial);
  return createElement(BoardToolbar, {
    range: ["2026-08-01", "2026-08-31"],
    onRangeChange: jest.fn(),
    rangeMode: "month",
    onRangeModeChange: jest.fn(),
    dateField: "due_date",
    onDateFieldChange: jest.fn(),
    filters,
    onFiltersChange: (next: BoardFilters) => {
      setFilters(next);
      onChange(next);
    },
    categories: [
      { id: "cat-work", name: "Work", color: "blue" },
      { id: "cat-home", name: "Home", color: "teal" },
    ],
    people: [
      { user_id: "user-me", display_name: "Ada", login_id: "ada", role: "owner" },
      { user_id: "user-ann", display_name: "Ann", login_id: "ann", role: "member" },
    ],
    currentUserId: "user-me",
    onReset: () => {
      const cleared = { ...filters, priorities: [], categoryIds: [], assigneeIds: [], query: "" };
      setFilters(cleared);
      onChange(cleared);
    },
    customError: null,
    onCustomError: jest.fn(),
    onApplyCustom: jest.fn(),
  });
}

function renderToolbar(initial: Partial<BoardFilters> = {}) {
  const onChange = jest.fn();
  const filters: BoardFilters = {
    priorities: [],
    query: "",
    categoryIds: [],
    assigneeIds: [],
    ...initial,
  };
  render(createElement(MantineProvider, { env: "test" }, createElement(Harness, { initial: filters, onChange })));
  return onChange;
}

describe("board toolbar multi-select filters", () => {
  it("lets several categories be selected together", async () => {
    const user = userEvent.setup();
    const onChange = renderToolbar();
    const input = screen.getByRole("textbox", { name: "List" });
    expect(input).toHaveAttribute("placeholder", "All lists");

    await user.click(input);
    await user.click(await screen.findByRole("option", { name: "Work" }));
    await user.click(await screen.findByRole("option", { name: "Home" }));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ categoryIds: ["cat-work", "cat-home"] }));
  });

  it("lets several priorities be selected together", async () => {
    const user = userEvent.setup();
    const onChange = renderToolbar();
    const input = screen.getByRole("textbox", { name: "Priority" });
    expect(input).toHaveAttribute("placeholder", "All priorities");

    await user.click(input);
    await user.click(await screen.findByRole("option", { name: "High" }));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ priorities: ["high"] }));

    await user.click(await screen.findByRole("option", { name: "Low" }));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ priorities: ["high", "low"] }));
  });

  it("lets people and unassigned be selected together", async () => {
    const user = userEvent.setup();
    const onChange = renderToolbar();
    const input = screen.getByRole("textbox", { name: "Assignee" });
    expect(input).toHaveAttribute("placeholder", "All assignees");

    await user.click(input);
    await user.click(await screen.findByRole("option", { name: "Assigned to me" }));
    await user.click(await screen.findByRole("option", { name: "Unassigned" }));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ assigneeIds: ["user-me", "unassigned"] }));
  });

  it("deselects a priority and keeps the other filters", async () => {
    const user = userEvent.setup();
    const onChange = renderToolbar({
      priorities: ["high", "medium"],
      query: "ship",
      categoryIds: ["cat-work"],
      assigneeIds: ["user-ann"],
    });
    await user.click(screen.getByRole("textbox", { name: "Priority" }));
    await user.click(await screen.findByRole("option", { name: "High" }));
    expect(onChange).toHaveBeenLastCalledWith({
      priorities: ["medium"],
      query: "ship",
      categoryIds: ["cat-work"],
      assigneeIds: ["user-ann"],
    });
  });

  it("keeps field widths stable as selections are added", () => {
    renderToolbar({ priorities: ["high", "medium", "low"] });
    const priority = screen.getByTestId("priority-filter-field");
    const search = screen.getByTestId("board-search-field");
    expect(priority.style.flexGrow).toBe("");
    expect(search.style.flexGrow).toBe("");
    expect(screen.getByTestId("primary-filter-row").className).toContain(
      "xl:grid-cols-[minmax(0,3fr)_minmax(0,4fr)_minmax(0,3fr)]",
    );
    expect(screen.getByTestId("secondary-filter-row").className).toContain(
      "xl:grid-cols-[minmax(20rem,2fr)_minmax(30rem,3fr)_auto]",
    );
  });

  it("uses the requested two-row control order", () => {
    renderToolbar();
    const primary = screen.getByTestId("primary-filter-row");
    expect(within(primary).getAllByRole("textbox").map((input) => input.getAttribute("aria-label"))).toEqual([
      "Search",
      "Assignee",
      "Priority",
    ]);

    const secondary = screen.getByTestId("secondary-filter-row");
    expect(within(secondary).getByRole("textbox", { name: "List" })).toBeInTheDocument();
    expect(within(secondary).getByText("Date search")).toBeInTheDocument();
    expect(within(secondary).getByRole("button", { name: "Reset search" })).toBeInTheDocument();
  });

  it("collapses and expands both rows of controls", async () => {
    const user = userEvent.setup();
    renderToolbar();
    const collapse = screen.getByRole("button", { name: "Collapse filters and search" });
    expect(collapse).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("textbox", { name: "List" })).toBeInTheDocument();

    await user.click(collapse);
    const expand = screen.getByRole("button", { name: "Expand filters and search" });
    expect(expand).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("textbox", { name: "List" })).not.toBeInTheDocument();

    await user.click(expand);
    expect(screen.getByRole("textbox", { name: "List" })).toBeInTheDocument();
  });

  it("clears every multi-select and search on reset", async () => {
    const user = userEvent.setup();
    const onChange = renderToolbar({
      priorities: ["high", "low"],
      categoryIds: ["cat-work"],
      assigneeIds: ["user-ann"],
      query: "ship",
    });
    await user.click(screen.getByRole("button", { name: "Reset search" }));
    expect(onChange).toHaveBeenLastCalledWith({ priorities: [], categoryIds: [], assigneeIds: [], query: "" });
    expect(screen.getByRole("textbox", { name: "Priority" })).toHaveAttribute("placeholder", "All priorities");
  });
});
