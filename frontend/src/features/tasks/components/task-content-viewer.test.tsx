import { MantineProvider } from "@mantine/core";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement } from "react";

import type { TaskAttachment, TiptapJSON } from "@/features/board/types";

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
    expect(screen.queryByRole("button", { name: "Next image" })).not.toBeInTheDocument();
  });

  it("opens the clicked image in a slideshow of all the task's images, without other files", async () => {
    const user = userEvent.setup();
    const content: TiptapJSON = {
      type: "doc",
      content: [
        { type: "image", attrs: { src: "/files/a", alt: "First" } },
        { type: "image", attrs: { src: "/files/b", alt: "Second" } },
      ],
    };
    const file = (id: string, kind: string, name: string): TaskAttachment => ({
      id,
      original_name: name,
      content_type: kind === "image" ? "image/png" : "application/pdf",
      size_bytes: 1,
      attachment_kind: kind,
      created_at: "2026-11-01T00:00:00Z",
      download_url: `/files/${id}`,
    });
    const attachments = [file("a", "image", "a.png"), file("spec", "file", "spec.pdf"), file("c", "image", "Third.png")];
    render(
      createElement(
        MantineProvider,
        { env: "test" },
        createElement(TaskContentViewer, { value: content, attachments }),
      ),
    );

    await user.click(await screen.findByRole("button", { name: "Open full image: Second" }));
    const dialog = await screen.findByRole("dialog");
    await waitFor(() => expect(dialog.querySelector("img")?.getAttribute("src")).toBe("/files/b"));
    expect(dialog).toHaveTextContent("2 of 3");

    await user.click(screen.getByRole("button", { name: "Next image" }));
    expect(dialog.querySelector("img")?.getAttribute("src")).toBe("/files/c");
    expect(dialog).toHaveTextContent("3 of 3");
    expect(screen.getByRole("button", { name: "Next image" })).toHaveAttribute("aria-disabled", "true");
  });
});
