// TypeScript 5.0 (the newest that runs on Node 12) has no built-in NoInfer, which TanStack Query's
// types use; without it query updaters lose their types. This is the standard pre-5.4 equivalent.
type NoInfer<T> = [T][T extends any ? 0 : never];
