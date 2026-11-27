/**
 * jsdom does no layout, so these tests pin down the CSS rules that give the image viewer its
 * fixed stage (globals.css, `.image-gallery-*`). The real sizes were also measured in Chrome.
 */
import { readFileSync } from "fs";
import { join } from "path";

const css = readFileSync(join(__dirname, "../../../styles/globals.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

/** The text between the braces that open at `open`. */
function block(source: string, open: number): string {
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    else if (source[i] === "}" && --depth === 0) return source.slice(open + 1, i);
  }
  throw new Error("unbalanced CSS");
}

const DESKTOP_QUERY = "@media (min-width: 64em)";
const desktop = block(css, css.indexOf("{", css.indexOf(DESKTOP_QUERY)));
const base = css.replace(`${DESKTOP_QUERY} {${desktop}}`, "");

/** Declarations of `selector` (outside media queries unless `source` is one), in order. */
function declarations(selector: string, source = base): [string, string][] {
  const start = source.search(new RegExp(`(^|[\\s}])${selector.replace(/[.[\]]/g, "\\$&")}\\s*\\{`));
  if (start < 0) throw new Error(`no rule for ${selector}`);
  return block(source, source.indexOf("{", start))
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const colon = part.indexOf(":");
      return [part.slice(0, colon).trim(), part.slice(colon + 1).trim()] as [string, string];
    });
}

function value(selector: string, property: string, source = base): string | undefined {
  return declarations(selector, source).find(([name]) => name === property)?.[1];
}

describe("image viewer styles", () => {
  it("only ever scales images down, keeping their proportions", () => {
    const image = Object.fromEntries(declarations(".image-gallery-image"));
    expect(image).toMatchObject({
      width: "auto",
      height: "auto",
      "max-width": "100%",
      "max-height": "100%",
      "object-fit": "contain",
    });
    // A 100% width or height would blow small images up to fill the stage.
    expect(css).not.toMatch(/\.image-gallery-image[^{]*\{[^}]*(?:^|[;\s])(?:width|height)\s*:\s*100%/m);
  });

  it("centres the image on a dark stage whose size depends only on the window", () => {
    const stage = Object.fromEntries(declarations(".image-gallery-stage"));
    expect(stage).toMatchObject({
      display: "flex",
      "align-items": "center",
      "justify-content": "center",
      width: "100%",
      overflow: "hidden",
      background: "#0b0b0c",
    });
    // A share of the screen height (in the unit screenHeight() picks), leaving room for the title
    // bar and the controls.
    expect(value(".image-gallery-stage", "height")).toBe(
      "max(12rem, min(calc(80 * var(--image-gallery-vh, 1vh)), 64rem, calc(100 * var(--image-gallery-vh, 1vh) - 11rem)))",
    );
  });

  it("uses about 70% of the window on desktop and nearly all of it on tablets and phones", () => {
    expect(value(".image-gallery-content", "--modal-content-flex")).toBe("0 0 min(95vw, 100rem)");
    expect(value(".image-gallery-inner", "--modal-inner-x-offset")).toBe("2.5vw");
    expect(value(".image-gallery-content", "--modal-content-flex", desktop)).toBe("0 0 min(70vw, 100rem)");
    expect(value(".image-gallery-stage", "height", desktop)).toBe(
      "max(12rem, min(calc(70 * var(--image-gallery-vh, 1vh)), 64rem, calc(100 * var(--image-gallery-vh, 1vh) - 11rem)))",
    );
  });

  it("keeps the arrows at the edges whatever the counter says, and the title on one line", () => {
    expect(value(".image-gallery-controls", "grid-template-columns")).toBe("auto minmax(0, 1fr) auto");
    expect(Object.fromEntries(declarations(".image-gallery-title"))).toMatchObject({
      "white-space": "nowrap",
      overflow: "hidden",
      "text-overflow": "ellipsis",
    });
  });
});
