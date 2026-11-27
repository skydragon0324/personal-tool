import type { TaskAttachment, TiptapJSON } from "@/features/board/types";

/** One picture in the image viewer. */
export interface GalleryImage {
  src: string;
  alt: string;
}

/**
 * Every image of a task, in the order the viewer steps through them: images in the details text
 * (as they appear there), then image attachments that are not already in the text. Inline images
 * are uploaded as attachments, so the same picture is listed once, matched by its URL.
 * Non-image attachments are left out.
 */
export function taskGalleryImages(
  content: TiptapJSON | null | undefined,
  attachments: TaskAttachment[] = [],
): GalleryImage[] {
  const images: GalleryImage[] = [];
  const seen = new Set<string>();
  const add = (src: unknown, alt: unknown) => {
    if (typeof src !== "string" || !src || seen.has(src)) return;
    seen.add(src);
    images.push({ src, alt: typeof alt === "string" ? alt : "" });
  };

  const walk = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    const { type, attrs, content: children } = node as { type?: unknown; attrs?: Record<string, unknown>; content?: unknown };
    if (type === "image") add(attrs?.src, attrs?.alt);
    if (Array.isArray(children)) children.forEach(walk);
  };
  walk(content);

  for (const attachment of attachments) {
    if (attachment.attachment_kind === "image") add(attachment.download_url, attachment.original_name);
  }
  return images;
}

/** Position of `src` in `images`, or -1. */
export function galleryIndexOf(images: GalleryImage[], src: string | null | undefined): number {
  return src ? images.findIndex((image) => image.src === src) : -1;
}
