"use client";

import { RichTextEditor } from "@mantine/tiptap";
import { Select, Group } from "@mantine/core";
import { useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import { TextStyle } from "@tiptap/extension-text-style";
import FontFamily from "@tiptap/extension-font-family";
import Placeholder from "@tiptap/extension-placeholder";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Image from "@tiptap/extension-image";
import { Extension } from "@tiptap/core";
import { useEffect, useMemo } from "react";
import type { Editor } from "@tiptap/react";

import type { TiptapJSON } from "@/features/board/types";

const FONT_SIZES = ["12", "14", "16", "18", "24", "32"];
const FONTS = [
  { value: "inherit", label: "Default" },
  { value: "Georgia, serif", label: "Georgia" },
  { value: "Courier New, monospace", label: "Courier" },
  { value: "Trebuchet MS, sans-serif", label: "Trebuchet" },
];

const FontSize = Extension.create({
  name: "fontSize",
  addGlobalAttributes() {
    return [
      {
        types: ["textStyle"],
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element) =>
              element.style.fontSize?.replace("px", "") || null,
            renderHTML: (attributes) => {
              if (!attributes.fontSize) return {};
              return { style: `font-size: ${attributes.fontSize}px` };
            },
          },
        },
      },
    ];
  },
});

interface TaskRichTextEditorProps {
  value: TiptapJSON | null;
  onChange: (value: TiptapJSON) => void;
  placeholder?: string;
  onEditorReady?: (editor: Editor | null) => void;
}

export function TaskRichTextEditor({
  value,
  onChange,
  placeholder = "Write task details…",
  onEditorReady,
}: TaskRichTextEditorProps) {
  const extensions = useMemo(
    () => [
      StarterKit,
      Underline,
      Link.configure({ openOnClick: false }),
      TextStyle,
      FontSize,
      FontFamily,
      Placeholder.configure({ placeholder }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Image.configure({ inline: false, allowBase64: false }),
    ],
    [placeholder],
  );

  const editor = useEditor({
    extensions,
    content: value ?? { type: "doc", content: [{ type: "paragraph" }] },
    onUpdate: ({ editor: current }) => {
      if (current.isDestroyed) return;
      onChange(current.getJSON() as TiptapJSON);
    },
    immediatelyRender: false,
  });

  useEffect(() => {
    onEditorReady?.(editor ?? null);
    return () => {
      onEditorReady?.(null);
    };
  }, [editor, onEditorReady]);

  useEffect(() => {
    if (!editor || editor.isDestroyed || value == null) return;
    const current = JSON.stringify(editor.getJSON());
    const next = JSON.stringify(value);
    if (current !== next) {
      editor.commands.setContent(value, false);
    }
  }, [editor, value]);

  if (!editor || editor.isDestroyed) {
    return (
      <div className="min-h-[220px] rounded-md border border-slate-200 bg-slate-50" />
    );
  }

  const currentSize = editor.getAttributes("textStyle").fontSize || "";
  const currentFont = editor.getAttributes("textStyle").fontFamily || "inherit";

  return (
    <RichTextEditor editor={editor}>
      <RichTextEditor.Toolbar sticky stickyOffset={0}>
        <RichTextEditor.ControlsGroup>
          <RichTextEditor.Undo />
          <RichTextEditor.Redo />
        </RichTextEditor.ControlsGroup>

        <RichTextEditor.ControlsGroup>
          <RichTextEditor.Bold />
          <RichTextEditor.Italic />
          <RichTextEditor.Underline />
          <RichTextEditor.Strikethrough />
          <RichTextEditor.ClearFormatting />
        </RichTextEditor.ControlsGroup>

        <RichTextEditor.ControlsGroup>
          <RichTextEditor.H1 />
          <RichTextEditor.H2 />
          <RichTextEditor.H3 />
        </RichTextEditor.ControlsGroup>

        <Group gap={6} wrap="nowrap">
          <Select
            size="xs"
            w={90}
            placeholder="Size"
            data={FONT_SIZES.map((s) => ({ value: s, label: `${s}px` }))}
            value={currentSize || null}
            onChange={(size) => {
              if (!editor || editor.isDestroyed) return;
              if (!size) {
                editor.chain().focus().setMark("textStyle", { fontSize: null }).run();
                return;
              }
              editor.chain().focus().setMark("textStyle", { fontSize: size }).run();
            }}
            allowDeselect
            comboboxProps={{ withinPortal: true, zIndex: 400 }}
          />
          <Select
            size="xs"
            w={130}
            placeholder="Font"
            data={FONTS}
            value={currentFont}
            onChange={(font) => {
              if (!editor || editor.isDestroyed) return;
              if (!font || font === "inherit") {
                editor.chain().focus().unsetFontFamily().run();
                return;
              }
              editor.chain().focus().setFontFamily(font).run();
            }}
            comboboxProps={{ withinPortal: true, zIndex: 400 }}
          />
        </Group>

        <RichTextEditor.ControlsGroup>
          <RichTextEditor.BulletList />
          <RichTextEditor.OrderedList />
          <RichTextEditor.TaskList />
        </RichTextEditor.ControlsGroup>

        <RichTextEditor.ControlsGroup>
          <RichTextEditor.Link />
          <RichTextEditor.Unlink />
        </RichTextEditor.ControlsGroup>
      </RichTextEditor.Toolbar>

      <RichTextEditor.Content mih={220} />
    </RichTextEditor>
  );
}
