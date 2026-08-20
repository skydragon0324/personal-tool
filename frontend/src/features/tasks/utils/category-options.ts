import type { Category } from "@/features/board/types";

export const CATEGORY_COLORS = [
  "slate",
  "teal",
  "blue",
  "indigo",
  "violet",
  "pink",
  "red",
  "orange",
  "yellow",
  "lime",
  "green",
  "cyan",
  "gray",
] as const;

export type CategoryColor = (typeof CATEGORY_COLORS)[number];

const BADGE_CLASSES: Record<string, string> = {
  gray: "bg-slate-100 text-slate-800 dark:bg-slate-500/25 dark:text-slate-100",
  slate: "bg-slate-100 text-slate-800 dark:bg-slate-500/25 dark:text-slate-100",
  teal: "bg-teal-100 text-teal-900 dark:bg-teal-500/20 dark:text-teal-100",
  blue: "bg-sky-100 text-sky-900 dark:bg-sky-500/20 dark:text-sky-100",
  indigo: "bg-indigo-100 text-indigo-900 dark:bg-indigo-500/20 dark:text-indigo-100",
  violet: "bg-violet-100 text-violet-900 dark:bg-violet-500/20 dark:text-violet-100",
  pink: "bg-pink-100 text-pink-900 dark:bg-pink-500/20 dark:text-pink-100",
  red: "bg-rose-100 text-rose-900 dark:bg-rose-500/20 dark:text-rose-100",
  orange: "bg-orange-100 text-orange-900 dark:bg-orange-500/20 dark:text-orange-100",
  yellow: "bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-100",
  lime: "bg-lime-100 text-lime-900 dark:bg-lime-500/20 dark:text-lime-100",
  green: "bg-emerald-100 text-emerald-900 dark:bg-emerald-500/20 dark:text-emerald-100",
  cyan: "bg-cyan-100 text-cyan-900 dark:bg-cyan-500/20 dark:text-cyan-100",
};

export function categoryBadgeClass(color: string): string {
  return BADGE_CLASSES[color] ?? BADGE_CLASSES.gray;
}

export function nextCategoryColor(existing: Pick<Category, "color">[]): string {
  const used = new Set(existing.map((item) => item.color));
  return CATEGORY_COLORS.find((color) => !used.has(color)) ?? "teal";
}

export function matchingCategory(
  categories: Category[],
  search: string,
): Category | undefined {
  const query = search.trim().toLowerCase();
  if (!query) return undefined;
  return categories.find((category) => category.name.toLowerCase() === query);
}

export function buildCategoryComboboxOptions(
  categories: Category[],
  search: string,
): { items: Category[]; showCreate: boolean; createLabel: string } {
  const query = search.trim().toLowerCase();
  const items = query
    ? categories.filter((category) => category.name.toLowerCase().includes(query))
    : categories;
  const exact = Boolean(matchingCategory(categories, search));
  const showCreate = query.length > 0 && !exact;
  const trimmed = search.trim();
  return {
    items,
    showCreate,
    createLabel: trimmed ? `Create “${trimmed}”` : "",
  };
}
