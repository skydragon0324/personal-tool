export const STATUS_COLORS = [
  "slate",
  "gray",
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
] as const;

export type StatusColor = (typeof STATUS_COLORS)[number];

const HEADER: Record<string, string> = {
  slate: "bg-slate-500",
  gray: "bg-slate-500",
  teal: "bg-teal-600",
  blue: "bg-sky-600",
  indigo: "bg-indigo-600",
  violet: "bg-violet-600",
  pink: "bg-pink-600",
  red: "bg-rose-600",
  orange: "bg-orange-500",
  yellow: "bg-amber-500",
  lime: "bg-lime-600",
  green: "bg-emerald-600",
  cyan: "bg-cyan-600",
};

const SOFT: Record<string, string> = {
  slate: "bg-slate-500/10 dark:bg-slate-400/10",
  gray: "bg-slate-500/10 dark:bg-slate-400/10",
  teal: "bg-teal-500/10 dark:bg-teal-400/10",
  blue: "bg-sky-500/10 dark:bg-sky-400/10",
  indigo: "bg-indigo-500/10 dark:bg-indigo-400/10",
  violet: "bg-violet-500/10 dark:bg-violet-400/10",
  pink: "bg-pink-500/10 dark:bg-pink-400/10",
  red: "bg-rose-500/10 dark:bg-rose-400/10",
  orange: "bg-orange-500/10 dark:bg-orange-400/10",
  yellow: "bg-amber-500/10 dark:bg-amber-400/10",
  lime: "bg-lime-500/10 dark:bg-lime-400/10",
  green: "bg-emerald-500/10 dark:bg-emerald-400/10",
  cyan: "bg-cyan-500/10 dark:bg-cyan-400/10",
};

export function statusHeaderClass(color: string): string {
  return HEADER[color] ?? HEADER.slate;
}

export function statusSoftClass(color: string): string {
  return SOFT[color] ?? SOFT.slate;
}

export const STATUS_COLOR_OPTIONS = STATUS_COLORS.map((color) => ({
  value: color,
  label: color,
}));
