import { MantineProvider } from "@mantine/core";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement } from "react";

import type { TiptapJSON } from "@/features/board/types";

import { TaskContentViewer } from "./task-content-viewer";

const CONTENT: TiptapJSON = {
  type: "doc",
  content: [
    { type: "paragraph", content: [{ type: "text", text: "See the sketch" }] },
    { type: "image", attrs: { src: "https://example.com/sketch.png", alt: "Sketch" } },
  ],
};

// jsdom has no layout; ProseMirror asks for the element under the pointer on mouse events.
beforeAll(() => {
  if (!document.elementFromPoint) document.elementFromPoint = () => null;
});

describe("TaskContentViewer", () => {
  it("shows images as thumbnails that open the full image", async () => {
    const user = userEvent.setup();
    render(createElement(MantineProvider, { env: "test" }, createElement(TaskContentViewer, { value: CONTENT })));

    const thumbnail = await screen.findByRole("button", { name: "Open full image: Sketch" });
    expect(thumbnail.closest(".task-content-viewer")).not.toBeNull();
    await user.click(thumbnail);

    const dialog = await screen.findByRole("dialog");
    await waitFor(() => expect(dialog.querySelector("img")?.getAttribute("src")).toBe("https://example.com/sketch.png"));
    expect(dialog).toHaveTextContent("Sketch");
  });
});
