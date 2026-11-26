export type SearchType = "task" | "board" | "note" | "plan";

export interface SearchResult {
  type: SearchType;
  id: string;
  label: string;
  secondary: string | null;
  board_id: string | null;
  board_name: string | null;
  board_color: string | null;
  due_date: string | null;
  is_done: boolean | null;
}

export interface SearchGroup {
  type: SearchType;
  items: SearchResult[];
  /** More matches of this type exist than were returned. */
  has_more: boolean;
}

export interface SearchResponse {
  query: string;
  groups: SearchGroup[];
}
