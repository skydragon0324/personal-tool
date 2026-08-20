"use client";

import { STATUS_COLORS, statusHeaderClass } from "./status-colors";

export const BOARD_ICONS = [
  "home",
  "briefcase",
  "users",
  "heart",
  "star",
  "flag",
  "bookmark",
  "calendar",
] as const;

export type BoardIconName = (typeof BOARD_ICONS)[number];

export const BOARD_COLORS = STATUS_COLORS;

export function boardColorClass(color: string): string {
  return statusHeaderClass(color);
}

export function BoardGlyph({ name, size = 16 }: { name?: string | null; size?: number }) {
  const icon = BOARD_ICONS.includes(name as BoardIconName) ? name : "home";
  const props = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    "aria-hidden": true as const,
  };
  switch (icon) {
    case "briefcase":
      return (
        <svg {...props}>
          <path d="M8 7V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v1M4 9h16v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9Z" stroke="currentColor" strokeWidth="1.8" />
        </svg>
      );
    case "users":
      return (
        <svg {...props}>
          <circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="1.8" />
          <path d="M3.5 19a5.5 5.5 0 0 1 11 0M16 8a3 3 0 1 1 0 6 3 3 0 0 1 0-6ZM16.5 19a4.5 4.5 0 0 1 4 2.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case "heart":
      return (
        <svg {...props}>
          <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2 4 4 0 0 1 7 2c0 5.6-7 10-7 10Z" stroke="currentColor" strokeWidth="1.8" />
        </svg>
      );
    case "star":
      return (
        <svg {...props}>
          <path d="m12 3 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.8 6.8 19.1l1-5.8L3.5 9.2l5.9-.9L12 3Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        </svg>
      );
    case "flag":
      return (
        <svg {...props}>
          <path d="M6 21V4m0 0h10l-2 4 2 4H6" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        </svg>
      );
    case "bookmark":
      return (
        <svg {...props}>
          <path d="M7 4h10v16l-5-3-5 3V4Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        </svg>
      );
    case "calendar":
      return (
        <svg {...props}>
          <rect x="4" y="5" width="16" height="15" rx="2" stroke="currentColor" strokeWidth="1.8" />
          <path d="M8 3v4M16 3v4M4 10h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    default:
      return (
        <svg {...props}>
          <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        </svg>
      );
  }
}
