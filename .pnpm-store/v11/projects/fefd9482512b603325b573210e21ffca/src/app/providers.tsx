"use client";

import { MantineProvider } from "@mantine/core";
import { DatesProvider } from "@mantine/dates";
import { QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

import { makeQueryClient } from "@/lib/query-client";

import "@mantine/core/styles.css";
import "@mantine/dates/styles.css";
import "@mantine/tiptap/styles.css";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => makeQueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <MantineProvider
        theme={{
          primaryColor: "teal",
          fontFamily: "var(--font-sans), ui-sans-serif, system-ui, sans-serif",
          headings: {
            fontFamily: "var(--font-display), ui-serif, Georgia, serif",
          },
          defaultRadius: "md",
        }}
      >
        <DatesProvider settings={{ consistentWeeks: true, firstDayOfWeek: 1 }}>
          {children}
        </DatesProvider>
      </MantineProvider>
    </QueryClientProvider>
  );
}
