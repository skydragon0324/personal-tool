import type { Metadata } from "next";
import { ColorSchemeScript, mantineHtmlProps } from "@mantine/core";
import { Fraunces, Manrope } from "next/font/google";

import { NORMALIZE_COLOR_SCHEME_SCRIPT } from "@/features/board/utils/color-scheme";
import { LifeManagementShell } from "@/features/shell/components/life-management-shell";
import { Providers } from "./providers";
import "./globals.css";

const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
});

const sans = Manrope({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Life Management",
  description: "A personal workspace for managing tasks, statuses, and daily life.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" {...mantineHtmlProps}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: NORMALIZE_COLOR_SCHEME_SCRIPT }} />
        <ColorSchemeScript defaultColorScheme="light" />
      </head>
      <body className={`${display.variable} ${sans.variable} antialiased`}>
        <Providers>
          <LifeManagementShell>{children}</LifeManagementShell>
        </Providers>
      </body>
    </html>
  );
}
