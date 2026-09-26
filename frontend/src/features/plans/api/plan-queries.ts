export const planKeys = {
  all: ["plans"] as const,
  list: ["plans", "list"] as const,
  detail: (planId: string) => ["plans", "detail", planId] as const,
  overview: ["plans", "overview"] as const,
};
