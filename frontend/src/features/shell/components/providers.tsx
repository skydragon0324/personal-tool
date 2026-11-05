import { MantineProvider, Modal, createTheme, useMantineColorScheme } from "@mantine/core";
import { DatesProvider } from "@mantine/dates";
import { Notifications } from "@mantine/notifications";
import { QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { normalizeStoredColorScheme } from "@/features/board/utils/color-scheme";
import { ssrSafeColorSchemeManager } from "@/features/board/utils/ssr-color-scheme-manager";
import { AuthProvider } from "@/features/auth/components/auth-provider";
import { LOCALES } from "@/i18n";
import { I18nProvider, useLanguage } from "@/i18n/provider";
import { makeQueryClient } from "@/lib/query-client";
import { screenHeight } from "@/lib/viewport";

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
  components: {
    // Mantine limits modal height with `100dvh`, which older browsers (Chrome < 108) ignore, so
    // tall modals ran off the screen. Set the same limit with a unit the browser understands.
    Modal: Modal.extend({
      styles: () => ({
        inner: { paddingTop: screenHeight(5), paddingBottom: screenHeight(5) },
        content: { maxHeight: screenHeight(90) },
      }),
    }),
  },
});

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => makeQueryClient());
  const [colorSchemeManager] = useState(() => ssrSafeColorSchemeManager());

  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <MantineProvider
          theme={theme}
          defaultColorScheme="light"
          colorSchemeManager={colorSchemeManager}
        >
          <ColorSchemeHydrator />
          <Notifications position="top-right" />
          <LocalizedDates>
            <AuthProvider>{children}</AuthProvider>
          </LocalizedDates>
        </MantineProvider>
      </I18nProvider>
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

/** Mantine date pickers in the app's language (month and weekday names). */
function LocalizedDates({ children }: { children: React.ReactNode }) {
  const { language } = useLanguage();
  return (
    <DatesProvider
      settings={{ consistentWeeks: true, firstDayOfWeek: 1, locale: LOCALES[language].dayjs }}
    >
      {children}
    </DatesProvider>
  );
}
