export const todayKeys = {
  all: ["today"] as const,
  day: (date: string) => ["today", date] as const,
};
