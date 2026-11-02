import { readFileSync } from "fs";
import { join } from "path";

import { en } from "./en";
import { colorName, formatList, setActiveLanguage, t, translateServerText, weekdayName } from "./index";
import { zh } from "./zh";

const BACKEND = join(__dirname, "../../../backend/app");

/** Every "a.b.c" path to a text, with the text (plural forms joined). */
function leaves(node: unknown, prefix = ""): Map<string, string> {
  const out = new Map<string, string>();
  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") out.set(path, value);
    else if (value && typeof value === "object" && "other" in value) {
      const plural = value as { one: string; other: string };
      out.set(path, `${plural.one} ${plural.other}`);
    } else {
      leaves(value, path).forEach((text, nested) => out.set(nested, text));
    }
  }
  return out;
}

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();

afterEach(() => setActiveLanguage("en"));

describe("dictionaries", () => {
  const english = leaves(en);
  const chinese = leaves(zh);

  it("have the same keys", () => {
    expect([...chinese.keys()].sort()).toEqual([...english.keys()].sort());
  });

  it("use the same {placeholders} in both languages", () => {
    const mismatched = [...english].filter(
      ([key, text]) => placeholders(text).join() !== placeholders(chinese.get(key) ?? "").join(),
    );
    expect(mismatched.map(([key]) => key)).toEqual([]);
  });

  it("translate every error code the backend can send", () => {
    const registry = readFileSync(join(BACKEND, "core/error_codes.py"), "utf8");
    const codes = [...registry.matchAll(/^ {4}"(\w+)": /gm)].map((match) => match[1]).sort();
    expect(codes.length).toBeGreaterThan(100);
    expect(Object.keys(zh.serverErrors).sort()).toEqual(codes);
  });

  it("translate every notification body the backend stores", () => {
    const service = readFileSync(join(BACKEND, "services/notification_service.py"), "utf8");
    // The keys are the quoted names on the lines that set body_key.
    const bodyKeys = service
      .split("\n")
      .filter((line) => line.includes("body_key"))
      .flatMap((line) => [...line.matchAll(/"([a-z]+(?:_[a-z]+)+)"/g)].map((match) => match[1]))
      .filter((key) => key !== "body_key" && key !== "body_params");
    expect(bodyKeys.length).toBeGreaterThanOrEqual(9);
    // The digest is built from its counts (digestDueToday, digestOverdue…) by notificationBody().
    const known = new Set([...Object.keys(zh.notificationBodies), "daily_digest"]);
    expect(bodyKeys.filter((key) => !known.has(key))).toEqual([]);
  });
});

describe("t", () => {
  it("fills placeholders and picks plural forms", () => {
    expect(t("boards.taskCount", { count: 1 })).toBe("1 task");
    expect(t("boards.taskCount", { count: 3 })).toBe("3 tasks");
    setActiveLanguage("zh");
    expect(t("boards.taskCount", { count: 3 })).toBe("3 个任务");
    expect(t("dates.goodMorning", { name: "Ada" })).toBe("早上好，Ada");
  });

  it("names weekdays, colors and lists in the current language", () => {
    expect(weekdayName(0, "long")).toBe("Monday");
    expect(colorName("teal")).toBe("Teal");
    expect(colorName("not-a-color")).toBe("not-a-color");
    expect(formatList(["A", "B", "C"])).toBe("A, B, and C");
    setActiveLanguage("zh");
    expect(weekdayName(6)).toBe("周日");
    expect(colorName("teal")).toBe("青绿");
    expect(formatList(["甲", "乙", "丙"])).toBe("甲、乙和丙");
  });
});

describe("translateServerText", () => {
  it("keeps the server's English text in English", () => {
    expect(translateServerText("serverErrors", "task_not_found", {}, "Task not found")).toBe("Task not found");
  });

  it("translates by code, with the server's values filled in", () => {
    setActiveLanguage("zh");
    expect(translateServerText("serverErrors", "task_not_found", {}, "Task not found")).toBe("找不到任务");
    expect(
      translateServerText("serverErrors", "already_invited", { email: "a@b.co" }, "a@b.co has already been invited"),
    ).toBe("a@b.co 已被邀请");
  });

  it("falls back to the English text for unknown codes, and to a translation when there is no text", () => {
    setActiveLanguage("zh");
    expect(translateServerText("serverErrors", "brand_new_code", {}, "Something new")).toBe("Something new");
    setActiveLanguage("en");
    expect(translateServerText("serverErrors", "validation_failed", {}, null)).toBe("Some of the values are not valid");
  });
});
