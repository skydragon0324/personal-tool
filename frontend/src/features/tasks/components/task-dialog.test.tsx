import { MantineProvider } from "@mantine/core";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement } from "react";

import { TaskDialog } from "./task-dialog";

// A stand-in form: one button makes an unsaved edit, the other is the form's Cancel.
jest.mock("./task-form", () => ({
  TaskForm: ({ onCancel, onDirtyChange }: { onCancel: () => void; onDirtyChange: (dirty: boolean) => void }) =>
    createElement(
      "div",
      null,
      createElement("button", { type: "button", onClick: () => onDirtyChange(true) }, "Make an edit"),
      createElement("button", { type: "button", onClick: onCancel }, "Cancel"),
    ),
}));

function renderDialog(onClose = jest.fn()) {
  render(
    createElement(
      MantineProvider,
      { env: "test" },
      createElement(TaskDialog, {
        open: true,
        title: "New task",
        boardId: "board-1",
        columnId: "col-todo",
        dueDate: "2026-10-22",
        onClose,
        onSubmit: jest.fn(),
      }),
    ),
  );
  return onClose;
}

describe("TaskDialog", () => {
  it("closes right away when nothing was edited", async () => {
    const onClose = renderDialog();
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalled();
    expect(screen.queryByText("Discard changes?")).not.toBeInTheDocument();
  });

  it("asks before throwing away unsaved edits", async () => {
    const onClose = renderDialog();
    await userEvent.click(screen.getByRole("button", { name: "Make an edit" }));
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(await screen.findByText("Discard changes?")).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Keep editing" }));
    expect(onClose).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await userEvent.click(await screen.findByRole("button", { name: "Discard" }));
    expect(onClose).toHaveBeenCalled();
  });
});
