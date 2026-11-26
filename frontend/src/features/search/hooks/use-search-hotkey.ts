import { useEffect, useRef } from "react";

import { isEditableTarget, isSearchShortcut } from "../utils/search-hotkey";

/** Calls `onShortcut` for Ctrl/Cmd+K anywhere in the app, except while typing in a field or editor. */
export function useSearchHotkey(onShortcut: () => void): void {
  const handler = useRef(onShortcut);
  handler.current = onShortcut;

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.repeat || !isSearchShortcut(event)) return;
      if (isEditableTarget(event.target)) return;
      event.preventDefault();
      handler.current();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
