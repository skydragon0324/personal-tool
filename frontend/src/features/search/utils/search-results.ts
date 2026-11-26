import { taskHref } from "@/lib/use-open-task";

import type { SearchGroup, SearchResult, SearchType } from "../types";

/** Results are grouped in this order whatever order the server sends. */
export const SEARCH_TYPE_ORDER: SearchType[] = ["task", "board", "note", "plan"];

export function sortGroups(groups: SearchGroup[]): SearchGroup[] {
  return [...groups]
    .filter((group) => group.items.length > 0)
    .sort((a, b) => SEARCH_TYPE_ORDER.indexOf(a.type) - SEARCH_TYPE_ORDER.indexOf(b.type));
}

export function resultKey(result: Pick<SearchResult, "type" | "id">): string {
  return `${result.type}:${result.id}`;
}

/** Every result, in the order arrow keys walk through them. */
export function flattenResults(groups: SearchGroup[]): SearchResult[] {
  return sortGroups(groups).flatMap((group) => group.items);
}

/** The next active row for an arrow key, wrapping at both ends. */
export function moveActive(current: number, count: number, step: 1 | -1): number {
  if (count <= 0) return -1;
  if (current < 0) return step === 1 ? 0 : count - 1;
  return (current + step + count) % count;
}

/** Where a result opens. Tasks open their detail on the board. */
export function resultHref(result: SearchResult): string {
  switch (result.type) {
    case "task":
      return taskHref(result.board_id ?? "", result.id);
    case "board":
      return `/boards/${result.id}`;
    case "note":
      return `/notepad?note=${encodeURIComponent(result.id)}`;
    case "plan":
      return `/plans/${result.id}`;
  }
}
