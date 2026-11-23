import { Children, isValidElement, type ReactNode } from "react";
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
      // Capped height: a long list scrolls inside the panel instead of growing the page.
      className="group flex min-h-[16rem] max-h-[min(70vh,36rem)] flex-col overflow-hidden rounded-[1.35rem] border border-[var(--app-border)] bg-[var(--app-surface)] p-5 shadow-[0_10px_32px_rgba(31,55,50,0.055)] transition-[border-color,box-shadow,transform] duration-200 hover:border-[var(--app-primary)]/30 hover:shadow-[var(--app-shadow)]"
    >
      <header className="flex shrink-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {icon ? <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[var(--app-primary-soft)] text-[var(--app-primary)]">{icon}</span> : null}
            <h2 className="truncate font-display text-lg font-semibold text-[var(--app-text)]">{title}</h2>
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

/**
 * Panels in two columns (one on small screens), each as tall as its own content.
 *
 * Not a CSS grid: grid rows take the height of their tallest panel, so one long list stretched
 * its neighbour too. Panels alternate left and right in the order given; on small screens the
 * columns dissolve (`contents`) and `order` keeps that original order.
 */
export function DashboardGrid({
  children,
  label,
  fill = false,
}: {
  children: ReactNode;
  label?: string;
  /** Share the available height equally on desktop; long panels scroll inside themselves. */
  fill?: boolean;
}) {
  const items = Children.toArray(children);
  if (fill) {
    return (
      <div
        role={label ? "region" : undefined}
        aria-label={label}
        className="grid gap-4 md:h-full md:min-h-0 md:grid-cols-2 md:grid-rows-2"
      >
        {items.map((child, index) => (
          <div
            key={isValidElement(child) && child.key != null ? child.key : index}
            className="min-w-0 md:min-h-0 md:[&>section]:h-full md:[&>section]:max-h-none md:[&>section]:min-h-0"
          >
            {child}
          </div>
        ))}
      </div>
    );
  }
  const columns = [0, 1].map((column) =>
    items
      .map((child, index) => ({ child, index }))
      .filter(({ index }) => index % 2 === column),
  );
  return (
    <div
      role={label ? "region" : undefined}
      aria-label={label}
      className="flex flex-col gap-5 md:flex-row md:items-start"
    >
      {columns.map((column, columnIndex) => (
        <div key={columnIndex} className="contents md:flex md:min-w-0 md:flex-1 md:flex-col md:gap-5">
          {column.map(({ child, index }) => (
            <div
              key={isValidElement(child) && child.key != null ? child.key : index}
              className="flex min-w-0 flex-col"
              style={{ order: index }}
            >
              {child}
            </div>
          ))}
        </div>
      ))}
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
