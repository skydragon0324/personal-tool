import { readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";

const SRC_ROOT = join(__dirname, "..");
// The one place allowed to choose between dvh and vh.
const ALLOWED = join(SRC_ROOT, "lib", "viewport.ts");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx|css)$/.test(name) && !name.endsWith(".test.ts") && !name.endsWith(".test.tsx") ? [full] : [];
  });
}

describe("older browsers (Chrome 105 and similar)", () => {
  it("never uses the dvh unit directly; screenHeight() falls back to vh", () => {
    const hits = sourceFiles(SRC_ROOT)
      .filter((file) => file !== ALLOWED)
      .flatMap((file) =>
        readFileSync(file, "utf8")
          .split(/\r?\n/)
          .map((line, index) => ({ line: line.trim(), at: `${file}:${index + 1}` }))
          // Comments may mention the unit.
          .filter(({ line }) => !line.startsWith("//") && !line.startsWith("*") && !line.startsWith("/*"))
          .filter(({ line }) => /\d+dvh\b|-dvh\b/.test(line))
          .map(({ at, line }) => `${at}: ${line}`),
      );
    expect(hits).toEqual([]);
  });
});
