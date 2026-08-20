import type { TiptapJSON } from "@/features/board/types";

const UNSAFE_SRC = /^(blob:|data:|javascript:|vbscript:|file:)/i;

export interface PendingInlineImage {
  pendingId: string;
  file: File;
  alt: string;
  blobUrl: string;
  error?: string;
}

type UnknownNode = Record<string, unknown>;

function isNode(value: unknown): value is UnknownNode {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function mapNodes(
  node: unknown,
  mapper: (current: UnknownNode) => UnknownNode | null,
): unknown {
  if (!isNode(node)) return node;
  const mapped = mapper(node);
  if (mapped == null) return null;
  const content = mapped.content;
  if (!Array.isArray(content)) return mapped;
  return {
    ...mapped,
    content: content
      .map((child) => mapNodes(child, mapper))
      .filter((child) => child != null),
  };
}

export function createPendingImageId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `pending-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function findPendingImageNodes(
  content: TiptapJSON | null,
): { pendingId: string; src: string; alt: string }[] {
  const found: { pendingId: string; src: string; alt: string }[] = [];
  mapNodes(content, (node) => {
    if (node.type === "image") {
      const attrs = (node.attrs as Record<string, unknown> | undefined) ?? {};
      const pendingId = typeof attrs.pendingId === "string" ? attrs.pendingId : "";
      if (pendingId) {
        found.push({
          pendingId,
          src: typeof attrs.src === "string" ? attrs.src : "",
          alt: typeof attrs.alt === "string" ? attrs.alt : "",
        });
      }
    }
    return node;
  });
  return found;
}

export function replacePendingImageSrc(
  content: TiptapJSON | null,
  pendingId: string,
  src: string,
): TiptapJSON | null {
  if (!content) return content;
  return mapNodes(content, (node) => {
    if (node.type !== "image") return node;
    const attrs = { ...((node.attrs as Record<string, unknown> | undefined) ?? {}) };
    if (attrs.pendingId !== pendingId) return node;
    const nextAttrs: Record<string, unknown> = { ...attrs, src };
    delete nextAttrs.pendingId;
    return { ...node, attrs: nextAttrs };
  }) as TiptapJSON;
}

export function sanitizeContentForPersist(
  content: TiptapJSON | null,
): TiptapJSON | null {
  if (!content) return content;
  return mapNodes(content, (node) => {
    if (node.type !== "image") return node;
    const attrs = { ...((node.attrs as Record<string, unknown> | undefined) ?? {}) };
    const src = typeof attrs.src === "string" ? attrs.src : "";
    if (!src || UNSAFE_SRC.test(src) || attrs.pendingId) {
      return null;
    }
    delete attrs.pendingId;
    return { ...node, attrs };
  }) as TiptapJSON;
}

export function applyUploadedImageSrcs(
  content: TiptapJSON | null,
  replacements: { pendingId: string; src: string }[],
): TiptapJSON | null {
  let next = content;
  for (const item of replacements) {
    next = replacePendingImageSrc(next, item.pendingId, item.src);
  }
  return sanitizeContentForPersist(next);
}
