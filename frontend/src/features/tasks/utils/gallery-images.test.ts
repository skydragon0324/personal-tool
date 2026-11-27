import type { TaskAttachment, TiptapJSON } from "@/features/board/types";

import { galleryIndexOf, taskGalleryImages } from "./gallery-images";

function attachment(id: string, kind: string, url: string | null = `/files/${id}`): TaskAttachment {
  return {
    id,
    original_name: `${id}.${kind === "image" ? "png" : "pdf"}`,
    content_type: kind === "image" ? "image/png" : "application/pdf",
    size_bytes: 10,
    attachment_kind: kind,
    created_at: "2026-11-01T00:00:00Z",
    download_url: url,
  };
}

const CONTENT: TiptapJSON = {
  type: "doc",
  content: [
    { type: "image", attrs: { src: "/files/b", alt: "Second upload" } },
    { type: "paragraph", content: [{ type: "text", text: "text" }] },
    { type: "bulletList", content: [{ type: "listItem", content: [{ type: "image", attrs: { src: "https://example.com/x.png", alt: "" } }] }] },
  ],
};

describe("taskGalleryImages", () => {
  it("lists images in the text first, then other image attachments, each once", () => {
    const images = taskGalleryImages(CONTENT, [attachment("a", "image"), attachment("b", "image"), attachment("c", "image")]);
    expect(images.map((image) => image.src)).toEqual(["/files/b", "https://example.com/x.png", "/files/a", "/files/c"]);
    expect(images[0].alt).toBe("Second upload");
    expect(images[2].alt).toBe("a.png");
  });

  it("leaves out non-image attachments and attachments without a URL", () => {
    const images = taskGalleryImages(null, [attachment("doc", "file"), attachment("a", "image"), attachment("n", "image", null)]);
    expect(images).toEqual([{ src: "/files/a", alt: "a.png" }]);
  });

  it("finds an image's position by its URL", () => {
    const images = taskGalleryImages(CONTENT, [attachment("a", "image")]);
    expect(galleryIndexOf(images, "/files/a")).toBe(2);
    expect(galleryIndexOf(images, "/missing")).toBe(-1);
    expect(galleryIndexOf(images, null)).toBe(-1);
  });
});
