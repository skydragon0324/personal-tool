import { clearUserLocalState } from "./clear-user-state";
import {
  browserTimezone,
  isAuthPath,
  validateConfirmPassword,
  validateLoginId,
  validateName,
  validatePassword,
} from "./validation";

describe("auth validation", () => {
  it("requires name, login ID, password confirmation, and a long enough password", () => {
    expect(validateName("")).toBe("Name is required");
    expect(validateName("Ada")).toBeNull();
    expect(validateLoginId("")).toBe("Login ID is required");
    expect(validateLoginId("ab")).toContain("3-32");
    expect(validateLoginId("ada@example.com")).toContain("3-32");
    expect(validateLoginId("Ada.Lovelace-1")).toBeNull();
    expect(validatePassword("1234567")).toBe("Password must be at least 8 characters");
    expect(validatePassword("12345678")).toBeNull();
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
