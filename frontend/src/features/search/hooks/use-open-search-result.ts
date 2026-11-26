import { useCallback } from "react";

import { useRouter } from "@/lib/navigation";
import { useOpenTask } from "@/lib/use-open-task";

import type { SearchResult } from "../types";
import { resultHref } from "../utils/search-results";

/** Opens what a search result points at: a task opens its detail on its board. */
export function useOpenSearchResult() {
  const router = useRouter();
  const openTask = useOpenTask();
  return useCallback(
    (result: SearchResult) => {
      if (result.type === "task" && result.board_id) {
        openTask(result.board_id, result.id);
        return;
      }
      void router.push(resultHref(result));
    },
    [openTask, router],
  );
}
