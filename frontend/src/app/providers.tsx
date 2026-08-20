"use client";

import { MantineProvider, createTheme, useMantineColorScheme } from "@mantine/core";
import { DatesProvider } from "@mantine/dates";
import { Notifications } from "@mantine/notifications";
import { QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { normalizeStoredColorScheme } from "@/features/board/utils/color-scheme";
import { ssrSafeColorSchemeManager } from "@/features/board/utils/ssr-color-scheme-manager";
import { makeQueryClient } from "@/lib/query-client";

import "@mantine/core/styles.css";
import "@mantine/dates/styles.css";
import "@mantine/notifications/styles.css";
import "@mantine/tiptap/styles.css";

const theme = createTheme({
  primaryColor: "teal",
  fontFamily: "var(--font-sans), ui-sans-serif, system-ui, sans-serif",
  headings: {
    fontFamily: "var(--font-display), ui-serif, Georgia, serif",
  },
  defaultRadius: "md",
  colors: {
    teal: [
      "#F0FDFA",
      "#CCFBF1",
      "#99F6E4",
      "#5EEAD4",
      "#2DD4BF",
      "#14B8A6",
      "#0F766E",
      "#0F766E",
      "#115E59",
      "#134E4A",
    ],
  },
});

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => makeQueryClient());
  const [colorSchemeManager] = useState(() => ssrSafeColorSchemeManager());

  return (
    <QueryClientProvider client={queryClient}>
      <MantineProvider
        theme={theme}
        defaultColorScheme="light"
        colorSchemeManager={colorSchemeManager}
      >
        <ColorSchemeHydrator />
        <Notifications position="top-right" />
        <DatesProvider settings={{ consistentWeeks: true, firstDayOfWeek: 1, locale: "en" }}>
          {children}
        </DatesProvider>
      </MantineProvider>
    </QueryClientProvider>
  );
}

function ColorSchemeHydrator() {
  const { setColorScheme } = useMantineColorScheme();
  useEffect(() => {
    normalizeStoredColorScheme(window.localStorage);
    const stored = window.localStorage.getItem("mantine-color-scheme-value");
    if (stored === "dark" || stored === "light") {
      setColorScheme(stored);
    }
  }, [setColorScheme]);
  return null;
}
