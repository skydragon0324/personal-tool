import { useDebouncedValue } from "@mantine/hooks";
import { useQuery } from "@tanstack/react-query";

import { apiClient } from "@/lib/api-client";

import { searchKeys } from "../api/search-queries";

export const SEARCH_DEBOUNCE_MS = 200;
export const SEARCH_RESULTS_PER_TYPE = 5;

/**
 * Debounced global search. Each query text has its own cache entry, so a slow answer for
 * an older text can never replace the results of the current one; a request whose text is no
 * longer wanted is aborted (TanStack Query cancels a query that loses its last observer when its
 * fetch uses the abort signal).
 */
export function useGlobalSearch(input: string, enabled = true) {
  const text = input.trim().replace(/\s+/g, " ");
  const [debounced] = useDebouncedValue(text, SEARCH_DEBOUNCE_MS);
  const active = enabled && debounced.length > 0;
  const query = useQuery({
    queryKey: searchKeys.query(debounced),
    queryFn: ({ signal }) => apiClient.search({ query: debounced, limit: SEARCH_RESULTS_PER_TYPE }, signal),
    enabled: active,
    staleTime: 30000,
  });
  const settling = text !== debounced;
  return {
    /** The text the shown results are for. */
    query: debounced,
    groups: active && !settling ? query.data?.groups ?? [] : [],
    isLoading: text.length > 0 && (settling || (active && query.isPending)),
    isError: active && !settling && query.isError,
    retry: () => void query.refetch(),
  };
}
