import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { useWorkspaceChrome } from "@/features/shell/components/workspace-chrome";

import { useSearchHotkey } from "../hooks/use-search-hotkey";

interface GlobalSearchValue {
  /** Goes up each time Ctrl/Cmd+K asks for the search field. */
  focusRequest: number;
  /** Whether a request is waiting for a search field to take it. */
  hasPendingFocus: () => boolean;
  /** Takes the waiting request, if any, so only one search field answers it. */
  takeFocusRequest: () => boolean;
  /** Moves focus to the search field (opening the small-screen navigation first). */
  requestFocus: () => void;
  /** Gives focus back to where it was before Ctrl/Cmd+K moved it to the search field. */
  restoreFocus: () => void;
}

const GlobalSearchContext = createContext<GlobalSearchValue | null>(null);

export function useGlobalSearchContext(): GlobalSearchValue | null {
  return useContext(GlobalSearchContext);
}

/**
 * Runs `onRequest` when Ctrl/Cmd+K asks for the search field, including a request made just before
 * this component mounted (the small-screen navigation mounts its field only once it opens).
 */
export function useSearchFocusRequest(onRequest: () => void, enabled = true): void {
  const search = useGlobalSearchContext();
  const callback = useRef(onRequest);
  callback.current = onRequest;
  const request = search?.focusRequest ?? 0;
  useEffect(() => {
    if (enabled && search?.takeFocusRequest()) callback.current();
  }, [enabled, request, search]);
}

/**
 * Ctrl/Cmd+K anywhere in the workspace puts the cursor in the sidebar's search field. There is no
 * separate search window: the field in the sidebar (or the collapsed rail) shows the results.
 */
export function GlobalSearchProvider({ children }: { children: ReactNode }) {
  const chrome = useWorkspaceChrome();
  const [focusRequest, setFocusRequest] = useState(0);
  const pending = useRef(false);
  const returnTo = useRef<HTMLElement | null>(null);
  const chromeRef = useRef(chrome);
  chromeRef.current = chrome;

  const requestFocus = useCallback(() => {
    const active = document.activeElement;
    returnTo.current = active instanceof HTMLElement && active !== document.body ? active : null;
    const current = chromeRef.current;
    if (current && !current.isDesktop && !current.mobileSidebarOpened) current.openSidebar();
    pending.current = true;
    setFocusRequest((value) => value + 1);
  }, []);

  const restoreFocus = useCallback(() => {
    const target = returnTo.current;
    returnTo.current = null;
    if (target?.isConnected) target.focus();
    else if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  }, []);

  useSearchHotkey(requestFocus);

  // A request nobody could take (no search field on screen) must not fire later by surprise.
  useEffect(() => {
    if (!pending.current) return;
    const timer = window.setTimeout(() => {
      pending.current = false;
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [focusRequest]);

  const value = useMemo<GlobalSearchValue>(
    () => ({
      focusRequest,
      hasPendingFocus: () => pending.current,
      takeFocusRequest: () => {
        if (!pending.current) return false;
        pending.current = false;
        return true;
      },
      requestFocus,
      restoreFocus,
    }),
    [focusRequest, requestFocus, restoreFocus],
  );

  return <GlobalSearchContext.Provider value={value}>{children}</GlobalSearchContext.Provider>;
}
