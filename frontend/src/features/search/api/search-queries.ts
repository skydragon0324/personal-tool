export const searchKeys = {
  all: ["search"] as const,
  query: (query: string) => ["search", query] as const,
};
