import { Button, Loader, Popover, Text, TextInput } from "@mantine/core";
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

import { SearchIcon } from "@/features/board/components/board-ui-icons";
import { boardColorClass } from "@/features/board/utils/board-icons";
import { formatDisplayDate } from "@/lib/dates";
import { t } from "@/i18n";

import { useGlobalSearch } from "../hooks/use-global-search";
import { useOpenSearchResult } from "../hooks/use-open-search-result";
import type { SearchResult, SearchType } from "../types";
import { isSearchShortcut, shortcutAria, shortcutLabel } from "../utils/search-hotkey";
import { flattenResults, moveActive, resultKey, sortGroups } from "../utils/search-results";
import { useGlobalSearchContext, useSearchFocusRequest } from "./global-search-provider";

export function searchTypeLabel(type: SearchType): string {
  if (type === "task") return t("search.typeTasks");
  if (type === "board") return t("search.typeBoards");
  if (type === "note") return t("search.typeNotes");
  return t("search.typePlans");
}

function ResultDetails({ result }: { result: SearchResult }) {
  if (result.type === "task") {
    return (
      <span className="flex min-w-0 flex-wrap items-center gap-x-2 text-xs text-[var(--app-text-muted)]">
        {result.board_name ? (
          <span className="inline-flex min-w-0 items-center gap-1">
            <span aria-hidden className={`h-2 w-2 shrink-0 rounded-sm ${boardColorClass(result.board_color ?? "")}`} />
            <span className="truncate">{result.board_name}</span>
          </span>
        ) : null}
        {result.due_date ? <span>{t("search.due", { date: formatDisplayDate(result.due_date) })}</span> : null}
        {result.is_done ? <span>✓ {t("search.done")}</span> : null}
        {result.secondary ? <span className="w-full truncate">{result.secondary}</span> : null}
      </span>
    );
  }
  return result.secondary ? <span className="truncate text-xs text-[var(--app-text-muted)]">{result.secondary}</span> : null;
}

function optionDomId(listId: string, key: string): string {
  return `${listId}-${key.replace(/[^\w-]/g, "-")}`;
}

interface SearchFieldProps {
  /** Show the results right below the field instead of in a dropdown (used inside a popover). */
  inline?: boolean;
  autoFocus?: boolean;
  placeholder?: string;
  /** Whether this field answers Ctrl/Cmd+K. Off when a parent handles the shortcut itself. */
  answersShortcut?: boolean;
  /** Called just before a result opens, e.g. to close the navigation it sits in. */
  onNavigate?: () => void;
  /** Escape in an empty field. Without it, focus goes back to where it was before Ctrl/Cmd+K. */
  onEscape?: () => void;
}

/**
 * The global search: type in the field and matching tasks, boards, notes and plans appear under
 * it. A combobox: focus stays in the field while arrow keys move through the results and Enter
 * opens the active one.
 */
export function SearchField({ inline = false, autoFocus = false, placeholder, answersShortcut = true, onNavigate, onEscape }: SearchFieldProps) {
  const context = useGlobalSearchContext();
  const inputRef = useRef<HTMLInputElement>(null);
  const [input, setInput] = useState("");
  const [focused, setFocused] = useState(false);
  // The active row is remembered by key, so it survives new results that still contain it and
  // falls back to the first row otherwise.
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [shortcut, setShortcut] = useState({ label: "", aria: "" });
  // Taken when mounting: the small-screen navigation's focus trap gives focus to this field
  // instead of its first button when it opened because of Ctrl/Cmd+K.
  const [focusOnOpen] = useState(() => autoFocus || (answersShortcut && (context?.hasPendingFocus() ?? false)));
  const openResult = useOpenSearchResult();
  const listId = `search-${useId().replace(/:/g, "")}`;

  // The platform is only known in the browser.
  useEffect(() => setShortcut({ label: shortcutLabel(), aria: shortcutAria() }), []);

  useSearchFocusRequest(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, answersShortcut);

  const hasText = input.trim() !== "";
  const search = useGlobalSearch(input, hasText);
  const groups = useMemo(() => sortGroups(search.groups), [search.groups]);
  const results = useMemo(() => flattenResults(search.groups), [search.groups]);
  const showResults = hasText && (inline || focused);

  const active = results.length ? Math.max(0, results.findIndex((result) => resultKey(result) === activeKey)) : -1;
  const activeResult = active >= 0 ? results[active] : undefined;
  const activeId = showResults && activeResult ? optionDomId(listId, resultKey(activeResult)) : undefined;
  const setActive = (index: number) => setActiveKey(results[index] ? resultKey(results[index]) : null);

  useEffect(() => {
    if (!activeId) return;
    document.getElementById(activeId)?.scrollIntoView?.({ block: "nearest" });
  }, [activeId]);

  function leave() {
    if (onEscape) onEscape();
    else if (context) context.restoreFocus();
    else inputRef.current?.blur();
  }

  function choose(result: SearchResult) {
    setInput("");
    inputRef.current?.blur();
    onNavigate?.();
    openResult(result);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (isSearchShortcut(event)) {
      // Ctrl/Cmd+K again leaves the field, like pressing the shortcut twice.
      event.preventDefault();
      leave();
      return;
    }
    if (event.key === "Escape") {
      if (hasText) {
        // First Escape clears the text; the next one leaves the field.
        event.preventDefault();
        event.stopPropagation();
        setInput("");
        return;
      }
      leave();
      return;
    }
    if (!showResults || !results.length) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setActive(moveActive(active, results.length, event.key === "ArrowDown" ? 1 : -1));
    } else if (event.key === "Home" && event.ctrlKey) {
      event.preventDefault();
      setActive(0);
    } else if (event.key === "End" && event.ctrlKey) {
      event.preventDefault();
      setActive(results.length - 1);
    } else if (event.key === "Enter" && activeResult) {
      event.preventDefault();
      choose(activeResult);
    }
  }

  const noResults = hasText && !search.isLoading && !search.isError && results.length === 0;
  const status = !hasText
    ? ""
    : search.isLoading
      ? t("search.searching")
      : search.isError
        ? t("search.couldNotSearch")
        : noResults
          ? t("search.noResults", { query: search.query })
          : t("search.resultCount", { count: results.length });

  const renderOption = (result: SearchResult): ReactNode => {
    const key = resultKey(result);
    const selected = activeResult !== undefined && resultKey(activeResult) === key;
    return (
      <div
        key={key}
        id={optionDomId(listId, key)}
        role="option"
        aria-selected={selected}
        data-search-result={key}
        onMouseMove={() => {
          if (!selected) setActiveKey(key);
        }}
        onClick={() => choose(result)}
        className={`flex cursor-pointer flex-col gap-0.5 rounded-lg px-3 py-2 text-sm text-[var(--app-text)] ${
          selected ? "bg-[var(--app-primary-soft)] outline outline-2 -outline-offset-2 outline-[var(--app-primary)]" : ""
        }`}
      >
        <span className={`truncate font-medium ${result.is_done ? "line-through text-[var(--app-text-muted)]" : ""}`}>{result.label}</span>
        <ResultDetails result={result} />
      </div>
    );
  };

  const resultsPanel = (
    // Clicking in the results must not take focus from the field (that would close them).
    <div onMouseDown={(event) => event.preventDefault()} className="flex flex-col gap-1">
      {search.isError ? (
        <div className="flex flex-col items-center gap-2 py-4 text-center">
          <Text size="sm">{t("search.couldNotSearch")}</Text>
          <Button size="xs" variant="light" onClick={search.retry}>
            {t("common.retry")}
          </Button>
        </div>
      ) : null}
      {noResults ? (
        <Text size="sm" c="dimmed" ta="center" py="md">
          {t("search.noResults", { query: search.query })}
        </Text>
      ) : null}
      {search.isLoading && !groups.length ? (
        <Text size="sm" c="dimmed" ta="center" py="md">
          {t("search.searching")}
        </Text>
      ) : null}
      <div id={listId} role="listbox" aria-label={t("search.results")} className="max-h-[min(60vh,26rem)] overflow-y-auto">
        {groups.map((group) => {
          const headingId = `${listId}-${group.type}`;
          return (
            <div key={group.type} role="group" aria-labelledby={headingId} className="mb-1">
              <div id={headingId} className="px-3 pb-1 pt-1 text-xs font-semibold uppercase tracking-wide text-[var(--app-text-muted)]">
                {searchTypeLabel(group.type)}
              </div>
              {group.items.map(renderOption)}
              {group.has_more ? (
                <Text size="xs" c="dimmed" px="sm">
                  {t("search.moreResults")}
                </Text>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );

  const field = (
    <TextInput
      ref={inputRef}
      value={input}
      onChange={(event) => setInput(event.currentTarget.value)}
      onKeyDown={onKeyDown}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      autoFocus={autoFocus}
      data-autofocus={focusOnOpen || undefined}
      placeholder={placeholder ?? t("search.open")}
      leftSection={<SearchIcon size={16} />}
      rightSection={
        search.isLoading ? (
          <Loader size="xs" />
        ) : !hasText && !focused && shortcut.label ? (
          <kbd className="whitespace-nowrap rounded border border-[var(--app-border)] px-1.5 text-[11px] font-medium text-[var(--app-text-muted)]">
            {shortcut.label}
          </kbd>
        ) : null
      }
      rightSectionWidth={shortcut.label === "Ctrl+K" ? 64 : 44}
      rightSectionPointerEvents="none"
      role="combobox"
      aria-label={t("search.inputLabel")}
      aria-keyshortcuts={answersShortcut && shortcut.aria ? shortcut.aria : undefined}
      aria-expanded={showResults}
      aria-controls={listId}
      aria-autocomplete="list"
      aria-activedescendant={activeId}
      autoComplete="off"
      spellCheck={false}
      data-global-search
    />
  );

  const liveStatus = (
    <div className="sr-only" role="status" aria-live="polite">
      {status}
    </div>
  );

  if (inline) {
    return (
      <div className="flex flex-col gap-2">
        {field}
        {liveStatus}
        {showResults ? resultsPanel : null}
      </div>
    );
  }

  return (
    <>
      <Popover
        opened={showResults}
        position="bottom-start"
        width={360}
        offset={6}
        shadow="md"
        radius="md"
        withinPortal
        withRoles={false}
        trapFocus={false}
        returnFocus={false}
        closeOnEscape={false}
        middlewares={{ flip: true, shift: { padding: 8 } }}
      >
        <Popover.Target>{field}</Popover.Target>
        <Popover.Dropdown p={6} className="max-w-[calc(100vw-16px)]">
          {resultsPanel}
        </Popover.Dropdown>
      </Popover>
      {liveStatus}
    </>
  );
}
