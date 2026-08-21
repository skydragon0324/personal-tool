import { describe, expect, it } from "vitest";

import { nextCliCommand, resolveNextDistDir } from "./resolve-next-dist-dir";

const nextBin = "E:/personal project/daily-todo/frontend/node_modules/next/dist/bin/next";

describe("resolveNextDistDir", () => {
  it("keeps next dev on .next-dev even with leftover NEXT_DIST_DIR or NODE_ENV", () => {
    expect(resolveNextDistDir("production", ".next-prod", [nextBin, "dev", "--port", "3000"])).toBe(
      ".next-dev",
    );
    expect(resolveNextDistDir("development", undefined, [nextBin, "dev"])).toBe(".next-dev");
  });

  it("keeps next build off the live dev cache even if NODE_ENV is development", () => {
    expect(resolveNextDistDir("development", undefined, [nextBin, "build"])).toBe(".next");
    expect(resolveNextDistDir("production", ".next-prod", [nextBin, "build"])).toBe(".next-prod");
    expect(resolveNextDistDir(undefined, undefined, [nextBin, "build"])).toBe(".next");
  });

  it("does not use .next-dev when NODE_ENV is unset and the CLI is not next dev", () => {
    expect(resolveNextDistDir(undefined, undefined, ["vitest"])).toBe(".next");
    expect(resolveNextDistDir("", undefined, [])).toBe(".next");
    expect(resolveNextDistDir(undefined, ".next-prod", [])).toBe(".next-prod");
    expect(resolveNextDistDir("development", undefined, [])).toBe(".next-dev");
  });

  it("reads the next CLI command from Windows and POSIX argv", () => {
    expect(nextCliCommand([nextBin.replace(/\//g, "\\"), "build"])).toBe("build");
    expect(nextCliCommand(["node", nextBin, "dev", "--port", "3000"])).toBe("dev");
  });
});
