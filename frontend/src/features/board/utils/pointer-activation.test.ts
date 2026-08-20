import { describe, expect, it } from "vitest";

import {
  POINTER_ACTIVATION_DISTANCE,
  isNoDragTarget,
  shouldActivatePointerDrag,
  wasShortClick,
} from "./pointer-activation";

describe("whole-card pointer drag", () => {
  it("does not treat a short click as a drag", () => {
    expect(shouldActivatePointerDrag(0)).toBe(false);
    expect(shouldActivatePointerDrag(5)).toBe(false);
    expect(shouldActivatePointerDrag(POINTER_ACTIVATION_DISTANCE)).toBe(true);
  });

  it("treats a short title click as a click, not a drag", () => {
    expect(wasShortClick({ x: 10, y: 10 }, { x: 12, y: 11 })).toBe(true);
    expect(wasShortClick({ x: 10, y: 10 }, { x: 20, y: 10 })).toBe(false);
  });

  it("only blocks real interactive controls marked data-no-dnd", () => {
    const root = document.createElement("div");
    root.innerHTML = `
      <button class="title">Title</button>
      <div data-no-dnd="true"><button>Menu</button></div>
      <a data-no-dnd="true" href="#">Link</a>
    `;
    const title = root.querySelector(".title");
    const menu = root.querySelector("[data-no-dnd] button");
    const link = root.querySelector("a");
    expect(isNoDragTarget(title)).toBe(false);
    expect(isNoDragTarget(menu)).toBe(true);
    expect(isNoDragTarget(link)).toBe(true);
  });
});
