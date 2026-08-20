"use client";

import { useCallback, useEffect, useState } from "react";

import { todayISO } from "@/lib/dates";
import {
  defaultBoardPreferences,
  readBoardPreferences,
  writeBoardPreferences,
  type BoardPreferences,
} from "../utils/board-preferences";

export function useBoardPreferences(boardId: string) {
  const [prefs, setPrefs] = useState<BoardPreferences>(defaultBoardPreferences);

  useEffect(() => {
    setPrefs(readBoardPreferences(boardId, window.localStorage, todayISO()));
  }, [boardId]);

  const updatePrefs = useCallback(
    (patch: Partial<BoardPreferences>) => {
      setPrefs((current) => {
        const next = { ...current, ...patch };
        writeBoardPreferences(boardId, next, window.localStorage);
        return next;
      });
    },
    [boardId],
  );

  return { prefs, updatePrefs };
}
