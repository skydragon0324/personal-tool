export const POINTER_ACTIVATION_DISTANCE = 8;

export function shouldActivatePointerDrag(
  distancePx: number,
  threshold = POINTER_ACTIVATION_DISTANCE,
): boolean {
  return distancePx >= threshold;
}

const INTERACTIVE_SELECTOR =
  "a[href], button, input, textarea, select, option, [role='menuitem'], [contenteditable='true']";

export function isNoDragTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  if (target.closest("[data-no-dnd]")) return true;
  return Boolean(target.closest(INTERACTIVE_SELECTOR));
}

export function wasShortClick(
  start: { x: number; y: number } | null,
  end: { x: number; y: number },
  threshold = POINTER_ACTIVATION_DISTANCE,
): boolean {
  if (!start) return true;
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  return Math.hypot(dx, dy) < threshold;
}
