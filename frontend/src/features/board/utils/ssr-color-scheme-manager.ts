"use client";

import {
  localStorageColorSchemeManager,
  type MantineColorSchemeManager,
} from "@mantine/core";

/** Initial `get()` must match SSR (`defaultColorScheme`) and ignore localStorage. */
export function ssrSafeColorSchemeManager(): MantineColorSchemeManager {
  const inner = localStorageColorSchemeManager();
  return {
    get: (defaultValue) => defaultValue,
    set: inner.set,
    subscribe: inner.subscribe,
    unsubscribe: inner.unsubscribe,
    clear: inner.clear,
  };
}
