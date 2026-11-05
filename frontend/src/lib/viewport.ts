/**
 * A height relative to the screen: `dvh` where the browser supports it, else `vh`.
 *
 * Chrome before 108 (and other older browsers) ignore `dvh`, which silently drops rules such as
 * Mantine's modal max-height, so tall modals run off the screen. Picking the unit in JS keeps the
 * value valid everywhere. Only call this in the browser (the app renders on the client only).
 */
export function screenHeight(percent: number): string {
  const dvh = typeof CSS !== "undefined" && typeof CSS.supports === "function" && CSS.supports("height", "1dvh");
  return `${percent}${dvh ? "dvh" : "vh"}`;
}
