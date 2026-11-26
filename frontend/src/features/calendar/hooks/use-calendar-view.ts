import { useCallback, useState } from "react";

import type { CalendarView } from "../types";
import { isCalendarView } from "../utils/calendar-range";

export const CALENDAR_VIEW_STORAGE_KEY = "life-management:calendar-view";

export function readCalendarView(storage?: Pick<Storage, "getItem"> | null): CalendarView {
  const stored = storage?.getItem(CALENDAR_VIEW_STORAGE_KEY);
  return isCalendarView(stored) ? stored : "month";
}

/** The chosen calendar view, remembered in this browser. */
export function useCalendarView(): [CalendarView, (view: CalendarView) => void] {
  // Read on the first render (the workspace only renders in the browser), so the calendar does
  // not first load the month and then the saved view.
  const [view, setViewState] = useState<CalendarView>(() =>
    typeof window === "undefined" ? "month" : readCalendarView(window.localStorage),
  );

  const setView = useCallback((next: CalendarView) => {
    setViewState(next);
    try {
      window.localStorage.setItem(CALENDAR_VIEW_STORAGE_KEY, next);
    } catch {
      // Storage can be full or blocked; the view still changes for this visit.
    }
  }, []);

  return [view, setView];
}
