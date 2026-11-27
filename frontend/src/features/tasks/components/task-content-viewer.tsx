import { RichTextEditor } from "@mantine/tiptap";
import { useEditor, type Editor } from "@tiptap/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { TaskAttachment, TiptapJSON } from "@/features/board/types";
import { t } from "@/i18n";
import { editorLabels } from "@/i18n/editor-labels";
import { galleryIndexOf, taskGalleryImages, type GalleryImage } from "../utils/gallery-images";
import { createTaskEditorExtensions } from "../utils/task-editor-extensions";
import { ImageGallery } from "./image-gallery";

const EMPTY: TiptapJSON = { type: "doc", content: [{ type: "paragraph" }] };

/**
 * The task's details, read-only. Images show as small thumbnails; clicking one (or pressing Enter
 * on it) opens it at full size in a viewer that also steps through the task's other images (those
 * in the text, then the image attachments).
 */
export function TaskContentViewer({
  value,
  attachments,
}: {
  value: TiptapJSON | null;
  /** The task's attachments; image ones follow the images in the text in the viewer. */
  attachments?: TaskAttachment[];
}) {
  const extensions = useMemo(() => createTaskEditorExtensions(), []);
  const images = useMemo(() => taskGalleryImages(value, attachments), [value, attachments]);
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  // An image missing from the list (not expected) still opens, on its own.
  const [strayImage, setStrayImage] = useState<GalleryImage | null>(null);
  const closeGallery = useCallback(() => {
    setOpenIndex(null);
    setStrayImage(null);
  }, []);
  const editor = useEditor({
    extensions,
    content: value ?? EMPTY,
    editable: false,
    immediatelyRender: false,
    onCreate: ({ editor: created }) => markThumbnails(created),
  });

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    editor.setEditable(false);
    editor.commands.setContent(value ?? EMPTY, false);
    markThumbnails(editor);
  }, [editor, value]);

  const wrapper = useRef<HTMLDivElement>(null);

  function imageFrom(target: EventTarget | null): HTMLImageElement | null {
    if (!(target instanceof HTMLImageElement) || !wrapper.current?.contains(target)) return null;
    return target;
  }

  function openImage(image: HTMLImageElement) {
    const index = galleryIndexOf(images, image.getAttribute("src"));
    setStrayImage(index >= 0 ? null : { src: image.currentSrc || image.src, alt: image.alt });
    setOpenIndex(Math.max(index, 0));
  }

  if (!editor || editor.isDestroyed) {
    return (
      <div className="min-h-[8rem] rounded-md border border-[var(--app-border)] bg-[var(--app-surface-muted)]" />
    );
  }

  return (
    <>
      <div
        ref={wrapper}
        className="task-content-viewer"
        onClick={(event) => {
          const image = imageFrom(event.target);
          if (image) openImage(image);
        }}
        onKeyDown={(event) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          const image = imageFrom(event.target);
          if (!image) return;
          event.preventDefault();
          openImage(image);
        }}
      >
        <RichTextEditor editor={editor} className="pointer-events-auto" labels={editorLabels()}>
          <RichTextEditor.Content mih={120} />
        </RichTextEditor>
      </div>
      <ImageGallery
        images={strayImage ? [strayImage] : images}
        index={openIndex}
        onIndexChange={setOpenIndex}
        onClose={closeGallery}
      />
    </>
  );
}

/** Make each image a keyboard-reachable button that says it opens the full image. */
function markThumbnails(editor: Editor) {
  const root = editor.view.dom as HTMLElement;
  root.querySelectorAll("img").forEach((image) => {
    image.tabIndex = 0;
    image.setAttribute("role", "button");
    image.setAttribute("aria-label", t("tasks.viewImage", { name: image.alt || t("tasks.imagePreview") }));
  });
}
