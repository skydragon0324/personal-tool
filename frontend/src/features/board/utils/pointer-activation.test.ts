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

    it("blocks native interactive controls and data-no-dnd, but not card body text", () => {
    const root = document.createElement("div");
    root.innerHTML = `
      <h2 class="title">Title</h2>
      <p class="content">Details</p>
      <button class="native">Native button</button>
      <input class="field" />
      <div data-no-dnd="true"><button>Menu</button></div>
      <a href="#">Link</a>
    `;
    expect(isNoDragTarget(root.querySelector(".title"))).toBe(false);
    expect(isNoDragTarget(root.querySelector(".content"))).toBe(false);
    expect(isNoDragTarget(root.querySelector(".native"))).toBe(true);
    expect(isNoDragTarget(root.querySelector(".field"))).toBe(true);
    expect(isNoDragTarget(root.querySelector("[data-no-dnd] button"))).toBe(true);
    expect(isNoDragTarget(root.querySelector("a"))).toBe(true);
  });
});
