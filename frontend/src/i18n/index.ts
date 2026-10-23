/**
 * App translations (English and Simplified Chinese).
 *
 * `t("section.key", { name })` returns the text in the current language. It is a plain function so
 * it also works outside React (validation, date helpers, notifications). Switching language
 * re-renders the whole app (see I18nProvider), so every `t` call picks up the new language.
 *
 * English (`en.ts`) is the source of truth; `zh.ts` must have exactly the same keys.
 */
import { en, type Messages } from "./en";
import { zh } from "./zh";

export type Language = "en" | "zh";

export const LANGUAGES: { value: Language; label: string }[] = [
  { value: "en", label: "English" },
  { value: "zh", label: "简体中文" },
];

export const LANGUAGE_STORAGE_KEY = "app-language";

const DICTIONARIES: Record<Language, Messages> = { en, zh };

/** A text with English singular/plural forms; picked by the `count` parameter. */
export interface Plural {
  one: string;
  other: string;
}

type Leaf = string | Plural;

/** Every "section.key" path that leads to a text. */
export type MessageKey = KeyPaths<Messages>;
type KeyPaths<T, Prefix extends string = ""> = {
  [K in keyof T & string]: T[K] extends Leaf ? `${Prefix}${K}` : KeyPaths<T[K], `${Prefix}${K}.`>;
}[keyof T & string];

export type MessageParams = Record<string, string | number>;

let current: Language = "en";

export function getLanguage(): Language {
  return current;
}

/** Use I18nProvider's setter in the app; this only changes what `t` returns. */
export function setActiveLanguage(language: Language): void {
  current = language;
}

/** The BCP 47 locale for dates and numbers in the current language. */
export function dateLocale(): string {
  return current === "zh" ? "zh-CN" : "en-US";
}

function lookup(dictionary: Messages, key: string): Leaf | undefined {
  let node: unknown = dictionary;
  for (const part of key.split(".")) {
    if (node === null || typeof node !== "object") return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  if (typeof node === "string") return node;
  if (node && typeof node === "object" && "other" in node) return node as Plural;
  return undefined;
}

function fill(template: string, params?: MessageParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}

function resolve(leaf: Leaf, params?: MessageParams): string {
  const template = typeof leaf === "string" ? leaf : params?.count === 1 ? leaf.one : leaf.other;
  return fill(template, params);
}

export function t(key: MessageKey, params?: MessageParams): string {
  const leaf = lookup(DICTIONARIES[current], key) ?? lookup(en, key);
  return leaf === undefined ? key : resolve(leaf, params);
}

/**
 * A text the server sent, in the current language: the translation of its code when there is
 * one, else the server's English text. Used for API error messages and notification bodies.
 * `english` may be null when the server sent no readable text (e.g. a list of field errors).
 */
export function translateServerText(
  section: "serverErrors" | "notificationBodies",
  code: string | null | undefined,
  params: Record<string, unknown> | null | undefined,
  english: string | null,
): string {
  if (current === "en" && english) return english;
  const key = `${section}.${code}`;
  const leaf = code ? lookup(DICTIONARIES[current], key) ?? (english ? undefined : lookup(en, key)) : undefined;
  if (leaf === undefined) return english ?? t("common.requestFailed");
  const values: MessageParams = {};
  for (const [name, value] of Object.entries(params ?? {})) {
    if (typeof value === "string" || typeof value === "number") values[name] = value;
  }
  return resolve(leaf, values);
}

/** The display name of a palette color ("teal" -> "Teal"); unknown colors pass through. */
export function colorName(color: string): string {
  const key = `colors.${color}`;
  return lookup(en, key) === undefined ? color : t(key as MessageKey);
}

const WEEKDAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
const MONTH_KEYS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"] as const;

/** Weekday name for 0 = Monday … 6 = Sunday. */
export function weekdayName(index: number, form: "short" | "long" = "short"): string {
  const key = WEEKDAY_KEYS[index];
  if (!key) return "";
  return t(`repeat.${form === "short" ? "weekdaysShort" : "weekdaysLong"}.${key}` as MessageKey);
}

/** Month name for 1 = January … 12 = December. */
export function monthName(month: number): string {
  const key = MONTH_KEYS[month - 1];
  return key ? t(`repeat.months.${key}` as MessageKey) : "";
}

/** "A", "A and B", "A, B, and C" in the current language. */
export function formatList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  if (items.length === 2) return t("repeat.listTwo", { first: items[0], second: items[1] });
  const rest = items.slice(0, -1).join(t("repeat.listSeparator"));
  return t("repeat.listMany", { rest, last: items[items.length - 1] });
}
