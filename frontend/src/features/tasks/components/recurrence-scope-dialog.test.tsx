import { MantineProvider } from "@mantine/core";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { RecurrenceScopeDialog } from "./recurrence-scope-dialog";

function wrap(ui: ReactNode) {
  return render(createElement(MantineProvider, null, ui));
}

describe("RecurrenceScopeDialog delete", () => {
  it("shows all three choices for an open occurrence", () => {
    wrap(
      createElement(RecurrenceScopeDialog, {
        open: true,
        mode: "delete",
        taskTitle: "Weekly standup",
        onClose: vi.fn(),
        onConfirm: vi.fn(),
      }),
    );
    expect(screen.getByRole("alertdialog", { name: "Delete repeating task" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "This task only" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "This and following tasks" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "All unfinished tasks in the series" })).toBeInTheDocument();
    expect(screen.getByText("Completed and individually customized tasks are kept.")).toBeInTheDocument();
  });

  it("shows only This task only for a completed occurrence", () => {
    wrap(
      createElement(RecurrenceScopeDialog, {
        open: true,
        mode: "delete",
        taskTitle: "Weekly standup",
        completed: true,
        onClose: vi.fn(),
        onConfirm: vi.fn(),
      }),
    );
    expect(screen.getByRole("radio", { name: "This task only" })).toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: "This and following tasks" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("radio", { name: "All unfinished tasks in the series" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText("This completed task will be permanently removed. Other repeats are kept."),
    ).toBeInTheDocument();
  });

  it("passes the selected scope on confirm", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    wrap(
      createElement(RecurrenceScopeDialog, {
        open: true,
        mode: "delete",
        taskTitle: "Weekly standup",
        onClose: vi.fn(),
        onConfirm,
      }),
    );
    await user.click(screen.getByRole("radio", { name: "This and following tasks" }));
    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(onConfirm).toHaveBeenCalledWith("this_and_future", false);
  });

  it("passes completed confirmation for a completed occurrence", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    wrap(
      createElement(RecurrenceScopeDialog, {
        open: true,
        mode: "delete",
        taskTitle: "Weekly standup",
        completed: true,
        onClose: vi.fn(),
        onConfirm,
      }),
    );
    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(onConfirm).toHaveBeenCalledWith("this", true);
  });

  it("does not delete when cancelled", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    wrap(
      createElement(RecurrenceScopeDialog, {
        open: true,
        mode: "delete",
        taskTitle: "Weekly standup",
        onClose,
        onConfirm,
      }),
    );
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("keeps English accessible names and labels", () => {
    wrap(
      createElement(RecurrenceScopeDialog, {
        open: true,
        mode: "delete",
        taskTitle: "Weekly standup",
        onClose: vi.fn(),
        onConfirm: vi.fn(),
      }),
    );
    expect(screen.getByRole("alertdialog", { name: "Delete repeating task" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Delete a repeating task" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
  });
});
