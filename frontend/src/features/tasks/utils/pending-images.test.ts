import { describe, expect, it } from "vitest";

import type { TiptapJSON } from "@/features/board/types";
import {
  applyUploadedImageSrcs,
  replacePendingImageSrc,
  sanitizeContentForPersist,
} from "./pending-images";

const pendingDoc = {
  type: "doc",
  content: [
    {
      type: "image",
      attrs: {
        src: "blob:http://localhost/temp",
        alt: "Screenshot",
        pendingId: "pending-1",
      },
    },
    {
      type: "taskList",
      content: [
        {
          type: "taskItem",
          attrs: { checked: true },
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Keep me checked" }],
            },
          ],
        },
      ],
    },
  ],
} as TiptapJSON;

describe("pending inline images", () => {
  it("replaces a pending blob URL with the uploaded download URL", () => {
    const next = replacePendingImageSrc(
      pendingDoc,
      "pending-1",
      "http://localhost:8000/api/v1/tasks/t/attachments/a/download",
    );
    const image = (next?.content as Array<Record<string, unknown>>)[0];
    const attrs = image.attrs as Record<string, unknown>;
    expect(attrs.src).toBe(
      "http://localhost:8000/api/v1/tasks/t/attachments/a/download",
    );
    expect(attrs.pendingId).toBeUndefined();
  });

  it("drops blob URLs before persist and keeps checklist checked state", () => {
    const persisted = sanitizeContentForPersist(pendingDoc);
    const nodes = persisted?.content as Array<Record<string, unknown>>;
    expect(nodes.some((node) => node.type === "image")).toBe(false);
    const item = (nodes[0].content as Array<Record<string, unknown>>)[0];
    expect((item.attrs as { checked: boolean }).checked).toBe(true);
  });

  it("applies successful uploads then sanitizes remaining pending images", () => {
    const next = applyUploadedImageSrcs(pendingDoc, [
      {
        pendingId: "pending-1",
        src: "https://files.example/download",
      },
    ]);
    const image = (next?.content as Array<Record<string, unknown>>)[0];
    expect((image.attrs as { src: string }).src).toBe("https://files.example/download");
  });
});
