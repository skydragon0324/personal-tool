"use client";

import { Extension } from "@tiptap/core";
import { Color } from "@tiptap/extension-color";
import FontFamily from "@tiptap/extension-font-family";
import Highlight from "@tiptap/extension-highlight";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import Underline from "@tiptap/extension-underline";
import StarterKit from "@tiptap/starter-kit";

const FontSize = Extension.create({
  name: "fontSize",
  addGlobalAttributes() {
    return [
      {
        types: ["textStyle"],
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element) => element.style.fontSize?.replace("px", "") || null,
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

/** Tiptap TaskList/TaskItem is the in-document checklist, not persisted TaskSubtask rows. */
export function createTaskEditorExtensions(placeholder?: string, openOnClick = true) {
  return [
    StarterKit,
    Underline,
    Link.configure({ openOnClick }),
    TextStyle,
    FontSize,
    FontFamily,
    Color,
    Highlight.configure({ multicolor: true }),
    TextAlign.configure({ types: ["heading", "paragraph"] }),
    Placeholder.configure({ placeholder: placeholder ?? "Write task details…" }),
    TaskList,
    TaskItem.configure({ nested: true }),
    TaskImage.configure({ inline: false, allowBase64: false }),
  ];
}
