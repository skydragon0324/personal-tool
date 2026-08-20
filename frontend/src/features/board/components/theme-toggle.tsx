"use client";

import { ActionIcon, useMantineColorScheme } from "@mantine/core";
import { useEffect, useState } from "react";

import { normalizeStoredColorScheme } from "../utils/color-scheme";

function SunIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 3v2M12 19v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M3 12h2M19 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M18 13.5A7.5 7.5 0 1 1 10.5 6 6 6 0 0 0 18 13.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ThemeToggle() {
  const { setColorScheme, colorScheme } = useMantineColorScheme();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    normalizeStoredColorScheme(window.localStorage);
    if (colorScheme === "auto") {
      setColorScheme("light");
    }
    setReady(true);
  }, [colorScheme, setColorScheme]);

  const resolved = ready && colorScheme === "dark" ? "dark" : "light";
  const label = resolved === "light" ? "Switch to dark mode" : "Switch to light mode";

  return (
    <ActionIcon
      variant="subtle"
      color="gray"
      size="lg"
      aria-label={label}
      title={label}
      onClick={() => setColorScheme(resolved === "dark" ? "light" : "dark")}
    >
      {resolved === "light" ? <MoonIcon /> : <SunIcon />}
    </ActionIcon>
  );
}
