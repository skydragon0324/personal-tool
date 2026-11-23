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

const TINT: Record<string, string> = {
  slate: "bg-slate-500/20 text-slate-700 dark:bg-slate-400/20 dark:text-slate-200",
  gray: "bg-slate-500/20 text-slate-700 dark:bg-slate-400/20 dark:text-slate-200",
  teal: "bg-teal-500/20 text-teal-800 dark:bg-teal-400/20 dark:text-teal-200",
  blue: "bg-sky-500/20 text-sky-800 dark:bg-sky-400/20 dark:text-sky-200",
  indigo: "bg-indigo-500/20 text-indigo-800 dark:bg-indigo-400/20 dark:text-indigo-200",
  violet: "bg-violet-500/20 text-violet-800 dark:bg-violet-400/20 dark:text-violet-200",
  pink: "bg-pink-500/20 text-pink-800 dark:bg-pink-400/20 dark:text-pink-200",
  red: "bg-rose-500/20 text-rose-800 dark:bg-rose-400/20 dark:text-rose-200",
  orange: "bg-orange-500/20 text-orange-800 dark:bg-orange-400/20 dark:text-orange-200",
  yellow: "bg-amber-500/20 text-amber-800 dark:bg-amber-400/20 dark:text-amber-200",
  lime: "bg-lime-500/20 text-lime-800 dark:bg-lime-400/20 dark:text-lime-200",
  green: "bg-emerald-500/20 text-emerald-800 dark:bg-emerald-400/20 dark:text-emerald-200",
  cyan: "bg-cyan-500/20 text-cyan-800 dark:bg-cyan-400/20 dark:text-cyan-200",
};

/** Soft header background with matching text, for the board's column headers. */
export function statusTintClass(color: string): string {
  return TINT[color] ?? TINT.slate;
}

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
