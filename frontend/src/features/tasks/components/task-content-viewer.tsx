"use client";

import { RichTextEditor } from "@mantine/tiptap";
import { useEditor } from "@tiptap/react";
import { useEffect, useMemo } from "react";

import type { TiptapJSON } from "@/features/board/types";
import { createTaskEditorExtensions } from "../utils/task-editor-extensions";

export function TaskContentViewer({ value }: { value: TiptapJSON | null }) {
  const extensions = useMemo(() => createTaskEditorExtensions(), []);
  const editor = useEditor({
    extensions,
    content: value ?? { type: "doc", content: [{ type: "paragraph" }] },
    editable: false,
    immediatelyRender: false,
  });

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    editor.setEditable(false);
    editor.commands.setContent(value ?? { type: "doc", content: [{ type: "paragraph" }] }, false);
  }, [editor, value]);

  if (!editor || editor.isDestroyed) {
    return (
      <div className="min-h-[8rem] rounded-md border border-[var(--app-border)] bg-[var(--app-surface-muted)]" />
    );
  }

  return (
    <RichTextEditor editor={editor} className="pointer-events-auto">
      <RichTextEditor.Content mih={120} />
    </RichTextEditor>
  );
}
