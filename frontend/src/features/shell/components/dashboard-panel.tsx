"use client";

import type { ReactNode } from "react";
import Link from "next/link";

export function DashboardPanel({
  title,
  description,
  icon,
  count,
  actionHref,
  actionLabel,
  children,
  empty,
  bodyClassName = "",
}: {
  title: string;
  description: string;
  icon?: ReactNode;
  count?: number;
  actionHref?: string;
  actionLabel?: string;
  children?: ReactNode;
  empty?: ReactNode;
  bodyClassName?: string;
}) {
  return (
    <section
      aria-label={title}
      className="flex h-full min-h-[16rem] max-h-[min(48vh,24rem)] flex-col rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] md:max-h-none"
    >
      <header className="flex shrink-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {icon ? <span className="text-[var(--app-primary)]">{icon}</span> : null}
            <h2 className="truncate font-display text-lg text-[var(--app-text)]">{title}</h2>
            {typeof count === "number" ? (
              <span className="rounded-full bg-[var(--app-surface-muted)] px-2 py-0.5 text-xs font-semibold text-[var(--app-text-muted)]">
                {count}
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-[var(--app-text-muted)]">{description}</p>
        </div>
        {actionHref && actionLabel ? (
          <Link
            href={actionHref}
            className="shrink-0 text-sm font-medium text-[var(--app-primary)] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--app-primary)]"
          >
            {actionLabel}
          </Link>
        ) : null}
      </header>
      <div className={`mt-3 min-h-0 flex-1 overflow-y-auto overscroll-contain ${bodyClassName}`}>
        {empty ?? children}
      </div>
    </section>
  );
}

export function DashboardGrid({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <div
      role={label ? "region" : undefined}
      aria-label={label}
      className="grid grid-cols-1 gap-4 md:grid-cols-2 md:grid-rows-2 md:min-h-[36rem] lg:min-h-[40rem]"
    >
      {children}
    </div>
  );
}

export function PanelEmpty({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-[7rem] items-center justify-center px-2 py-6 text-center text-sm text-[var(--app-text-muted)]">
      {children}
    </div>
  );
}
