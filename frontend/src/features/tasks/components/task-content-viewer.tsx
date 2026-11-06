import { Modal } from "@mantine/core";
import { RichTextEditor } from "@mantine/tiptap";
import { useEditor, type Editor } from "@tiptap/react";
import { useEffect, useMemo, useRef, useState } from "react";

import type { TiptapJSON } from "@/features/board/types";
import { t } from "@/i18n";
import { editorLabels } from "@/i18n/editor-labels";
import { screenHeight } from "@/lib/viewport";
import { createTaskEditorExtensions } from "../utils/task-editor-extensions";

const EMPTY: TiptapJSON = { type: "doc", content: [{ type: "paragraph" }] };

interface OpenImage {
  src: string;
  alt: string;
}

/**
 * The task's details, read-only. Images show as small thumbnails; clicking one (or pressing Enter
 * on it) opens it at full size in a modal.
 */
export function TaskContentViewer({ value }: { value: TiptapJSON | null }) {
  const extensions = useMemo(() => createTaskEditorExtensions(), []);
  const [openImage, setOpenImage] = useState<OpenImage | null>(null);
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

  function imageFrom(target: EventTarget | null): OpenImage | null {
    if (!(target instanceof HTMLImageElement) || !wrapper.current?.contains(target)) return null;
    return { src: target.currentSrc || target.src, alt: target.alt };
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
          if (image) setOpenImage(image);
        }}
        onKeyDown={(event) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          const image = imageFrom(event.target);
          if (!image) return;
          event.preventDefault();
          setOpenImage(image);
        }}
      >
        <RichTextEditor editor={editor} className="pointer-events-auto" labels={editorLabels()}>
          <RichTextEditor.Content mih={120} />
        </RichTextEditor>
      </div>
      <Modal
        opened={openImage !== null}
        onClose={() => setOpenImage(null)}
        title={openImage?.alt || t("tasks.imagePreview")}
        size="auto"
        centered
        radius="lg"
        zIndex={400}
      >
        {openImage ? (
          <img
            src={openImage.src}
            alt={openImage.alt}
            className="mx-auto block h-auto w-auto max-w-full object-contain"
            style={{ maxHeight: `calc(${screenHeight(90)} - 8rem)` }}
          />
        ) : null}
      </Modal>
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
