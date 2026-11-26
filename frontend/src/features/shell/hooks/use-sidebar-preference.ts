import { useCallback, useState } from "react";

import { readSidebarCollapsed, writeSidebarCollapsed } from "../utils/sidebar-preference";

/**
 * The saved large-screen "sidebar collapsed" preference.
 *
 * It is read while the first render's state is created rather than in an effect: the workspace
 * shell only renders in the browser (the server sends the loading screen until the session is
 * known), so there is no server HTML to mismatch, and reading it up front avoids drawing the
 * expanded sidebar for one frame and then collapsing it.
 *
 * Only an explicit toggle writes the preference; crossing a breakpoint never does.
 */
export function useSidebarPreference(): [boolean, (collapsed: boolean) => void] {
  const [sidebarCollapsed, setState] = useState(() =>
    typeof window === "undefined" ? false : readSidebarCollapsed(window.localStorage),
  );
  const setSidebarCollapsed = useCallback((collapsed: boolean) => {
    setState(collapsed);
    writeSidebarCollapsed(collapsed, window.localStorage);
  }, []);
  return [sidebarCollapsed, setSidebarCollapsed];
}
