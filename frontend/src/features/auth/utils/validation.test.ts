import { describe, expect, it } from "vitest";

import { clearUserLocalState } from "./clear-user-state";
import {
  browserTimezone,
  isAuthPath,
  validateConfirmPassword,
  validateEmail,
  validateName,
  validatePassword,
} from "./validation";

describe("auth validation", () => {
  it("requires name, email, password confirmation, and a long enough password", () => {
    expect(validateName("")).toBe("Name is required");
    expect(validateName("Ada")).toBeNull();
    expect(validateEmail("")).toBe("Email is required");
    expect(validateEmail("not-an-email")).toBe("Enter a valid email address");
    expect(validateEmail("ada@example.com")).toBeNull();
    expect(validatePassword("short")).toBe("Password must be at least 10 characters");
    expect(validatePassword("long-enough")).toBeNull();
    expect(validateConfirmPassword("long-enough", "other")).toBe("Passwords do not match");
    expect(validateConfirmPassword("long-enough", "long-enough")).toBeNull();
  });

  it("treats login and register as auth routes", () => {
    expect(isAuthPath("/login")).toBe(true);
    expect(isAuthPath("/register")).toBe(true);
    expect(isAuthPath("/today")).toBe(false);
    expect(browserTimezone()).toBeTruthy();
  });
});

describe("user local state", () => {
  it("clears workspace keys and leaves the color scheme intact", () => {
    const store = new Map<string, string>([
      ["life-management:last-board-id", "board-a"],
      ["life-management.view-mode", "table"],
      ["mantine-color-scheme-value", "dark"],
    ]);
    const storage = {
      get length() {
        return store.size;
      },
      key(index: number) {
        return [...store.keys()][index] ?? null;
      },
      removeItem(key: string) {
        store.delete(key);
      },
    };
    clearUserLocalState(storage);
    expect(store.has("life-management:last-board-id")).toBe(false);
    expect(store.has("life-management.view-mode")).toBe(false);
    expect(store.get("mantine-color-scheme-value")).toBe("dark");
  });
});
