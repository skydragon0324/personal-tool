import { MobileSidebarButton } from "@/features/shell/components/workspace-chrome";

export function PageHeader({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <header className="sticky top-0 z-20 shrink-0 border-b border-[var(--app-border)] bg-[var(--app-surface)]/88 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1480px] flex-wrap items-center justify-between gap-3 px-4 py-3.5 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <MobileSidebarButton />
          <div className="min-w-0">
            <h1 className="truncate font-display text-[1.75rem] font-semibold leading-tight tracking-[-0.02em] text-[var(--app-text)] sm:text-[2rem]">{title}</h1>
            {description ? (
              <p className="mt-1 text-sm text-[var(--app-text-muted)]">{description}</p>
            ) : null}
          </div>
        </div>
        {children ? <div className="flex flex-wrap items-center gap-2">{children}</div> : null}
      </div>
    </header>
  );
}
