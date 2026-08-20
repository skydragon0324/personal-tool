"use client";

import { RichTextEditor } from "@mantine/tiptap";
import { Group, Select } from "@mantine/core";
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
import { Color } from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import TextAlign from "@tiptap/extension-text-align";
import { Extension } from "@tiptap/core";
import { type ReactNode, useEffect, useMemo } from "react";
import type { Editor } from "@tiptap/react";

import type { TiptapJSON } from "@/features/board/types";

const FONT_SIZES = ["12", "14", "16", "18", "24", "32"];
const FONTS = [
  { value: "inherit", label: "Default" },
  { value: "Georgia, serif", label: "Georgia" },
  { value: "Courier New, monospace", label: "Courier" },
  { value: "Trebuchet MS, sans-serif", label: "Trebuchet" },
];

const TEXT_COLORS = [
  "#25262b",
  "#868e96",
  "#fa5252",
  "#e64980",
  "#be4bdb",
  "#7950f2",
  "#4c6ef5",
  "#228be6",
  "#15aabf",
  "#12b886",
  "#40c057",
  "#82c91e",
  "#fab005",
  "#fd7e14",
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

const TaskImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      alt: {
        default: null,
        parseHTML: (element) => element.getAttribute("alt"),
        renderHTML: (attributes) => (attributes.alt ? { alt: attributes.alt } : {}),
      },
      pendingId: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-pending-id"),
        renderHTML: (attributes) =>
          attributes.pendingId ? { "data-pending-id": attributes.pendingId } : {},
      },
    };
  },
});

interface TaskRichTextEditorProps {
  value: TiptapJSON | null;
  onChange: (value: TiptapJSON) => void;
  placeholder?: string;
  onEditorReady?: (editor: Editor | null) => void;
  extraToolbar?: ReactNode;
}

export function TaskRichTextEditor({
  value,
  onChange,
  placeholder = "Write task details…",
  onEditorReady,
  extraToolbar,
}: TaskRichTextEditorProps) {
  const extensions = useMemo(
    () => [
      StarterKit,
      Underline,
      Link.configure({ openOnClick: false }),
      TextStyle,
      FontSize,
      FontFamily,
      Color,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Placeholder.configure({ placeholder }),
      TaskList,
      TaskItem.configure({ nested: true }),
      TaskImage.configure({ inline: false, allowBase64: false }),
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
      <div className="min-h-[220px] rounded-md border border-[var(--app-border)] bg-[var(--app-surface-muted)]" />
    );
  }

  const currentSize = editor.getAttributes("textStyle").fontSize || "";
  const currentFont = editor.getAttributes("textStyle").fontFamily || "inherit";

  return (
    <RichTextEditor editor={editor}>
      <RichTextEditor.Toolbar sticky stickyOffset={0} className="flex flex-wrap gap-y-1">
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

        <Group gap={6} wrap="wrap">
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
          <RichTextEditor.Blockquote />
          <RichTextEditor.Code />
          <RichTextEditor.CodeBlock />
          <RichTextEditor.Hr />
        </RichTextEditor.ControlsGroup>

        <RichTextEditor.ControlsGroup>
          <RichTextEditor.AlignLeft />
          <RichTextEditor.AlignCenter />
          <RichTextEditor.AlignRight />
        </RichTextEditor.ControlsGroup>

        <RichTextEditor.ControlsGroup>
          <RichTextEditor.ColorPicker colors={TEXT_COLORS} />
          <RichTextEditor.UnsetColor />
          <RichTextEditor.Highlight />
        </RichTextEditor.ControlsGroup>

        <RichTextEditor.ControlsGroup>
          <RichTextEditor.Link />
          <RichTextEditor.Unlink />
        </RichTextEditor.ControlsGroup>

        {extraToolbar ? (
          <Group gap={6} wrap="wrap">
            {extraToolbar}
          </Group>
        ) : null}
      </RichTextEditor.Toolbar>

      <RichTextEditor.Content mih={220} />
    </RichTextEditor>
  );
}
