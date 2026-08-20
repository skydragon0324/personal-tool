"use client";

import { Paper, Text } from "@mantine/core";
import type { ReactNode } from "react";

import { ThemeToggle } from "@/features/board/components/theme-toggle";

export function AuthCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-[var(--app-bg)] px-4 py-10">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <Paper
        withBorder
        radius="lg"
        p="xl"
        className="w-full max-w-md bg-[var(--app-surface)]"
      >
        <Text className="font-display text-2xl text-[var(--app-text)]">{title}</Text>
        <Text size="sm" c="dimmed" mt={6} mb="lg">
          {subtitle}
        </Text>
        {children}
      </Paper>
    </div>
  );
}
