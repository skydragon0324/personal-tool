/** macOS (and iOS with a keyboard) use ⌘K; everything else uses Ctrl+K. */
export function isApplePlatform(nav: Pick<Navigator, "platform" | "userAgent"> | undefined = typeof navigator === "undefined" ? undefined : navigator): boolean {
  if (!nav) return false;
  return /Mac|iPhone|iPad|iPod/i.test(nav.platform || nav.userAgent || "");
}

export function shortcutLabel(apple = isApplePlatform()): string {
  return apple ? "⌘K" : "Ctrl+K";
}

/** The shortcut as `aria-keyshortcuts` spells it. */
export function shortcutAria(apple = isApplePlatform()): string {
  return apple ? "Meta+K" : "Control+K";
}

type ShortcutEvent = Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey" | "altKey" | "shiftKey">;

/** Ctrl+K on Windows/Linux, Cmd+K on macOS (no Shift or Alt). */
export function isSearchShortcut(event: ShortcutEvent, apple = isApplePlatform()): boolean {
  if (event.key?.toLowerCase() !== "k" || event.altKey || event.shiftKey) return false;
  return apple ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey;
}

const TEXT_INPUT_TYPES = new Set(["", "text", "search", "email", "url", "tel", "password", "number", "date", "datetime-local", "month", "time", "week"]);

/**
 * Whether the key press happened where the user is typing: a text field, a select, or a rich-text
 * editor (where Ctrl/Cmd+K usually inserts a link). The search shortcut leaves those alone.
 */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!target || typeof Element === "undefined" || !(target instanceof Element)) return false;
  if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return true;
  if (target instanceof HTMLInputElement) return TEXT_INPUT_TYPES.has(target.type.toLowerCase());
  if (target instanceof HTMLElement && target.isContentEditable) return true;
  return Boolean(target.closest("[contenteditable]:not([contenteditable='false']), [role='textbox'], .ProseMirror"));
}
