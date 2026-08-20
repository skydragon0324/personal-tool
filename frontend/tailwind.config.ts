import type { Config } from "tailwindcss";

export default {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/features/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: ["selector", '[data-mantine-color-scheme="dark"]'],
  theme: {
    extend: {
      colors: {
        ink: "var(--app-text)",
        background: "var(--app-bg)",
        surface: "var(--app-surface)",
        "surface-muted": "var(--app-surface-muted)",
        "text-muted": "var(--app-text-muted)",
        border: "var(--app-border)",
        primary: "var(--app-primary)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "ui-serif", "Georgia", "serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
