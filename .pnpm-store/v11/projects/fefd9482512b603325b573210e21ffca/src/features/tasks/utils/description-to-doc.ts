import type { TiptapJSON } from "@/features/board/types";

export function descriptionToDoc(description: string): TiptapJSON {
  return {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: description
          ? [{ type: "text", text: description }]
          : [],
      },
    ],
  };
}
