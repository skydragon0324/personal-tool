"use client";

import { MobileSidebarButton } from "@/features/shell/components/workspace-chrome";

export function PageHeader({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-[var(--app-border)] bg-[var(--app-surface)]/90 backdrop-blur">
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <MobileSidebarButton />
          <h1 className="truncate font-display text-2xl text-[var(--app-text)] sm:text-3xl">{title}</h1>
        </div>
        {children ? <div className="flex flex-wrap items-center gap-2">{children}</div> : null}
      </div>
    </header>
  );
}
