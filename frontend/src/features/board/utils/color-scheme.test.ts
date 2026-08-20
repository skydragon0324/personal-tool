import { describe, expect, it } from "vitest";

import {
  NORMALIZE_COLOR_SCHEME_SCRIPT,
  normalizeStoredColorScheme,
} from "./color-scheme";

describe("color scheme storage", () => {
  it("normalizes a stored auto value to light", () => {
    const store = new Map<string, string>([["mantine-color-scheme", "auto"]]);
    const storage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
    };
    normalizeStoredColorScheme(storage);
    expect(store.get("mantine-color-scheme")).toBe("light");
  });

  it("leaves light and dark values unchanged", () => {
    const store = new Map<string, string>([["mantine-color-scheme", "dark"]]);
    const storage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
    };
    normalizeStoredColorScheme(storage);
    expect(store.get("mantine-color-scheme")).toBe("dark");
  });

  it("rewrites auto before Mantine reads localStorage", () => {
    expect(NORMALIZE_COLOR_SCHEME_SCRIPT).toContain('"auto"');
    expect(NORMALIZE_COLOR_SCHEME_SCRIPT).toContain('"light"');
  });
});
