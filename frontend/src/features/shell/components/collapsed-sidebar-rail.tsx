import { ActionIcon, Menu, Popover, Tooltip } from "@mantine/core";
import Link from "next/link";
import { forwardRef, useState, type ReactNode } from "react";

import { AccountSettingsModal } from "@/features/auth/components/account-settings-modal";
import { useAuth } from "@/features/auth/components/auth-provider";
import { LanguageSwitcher } from "@/components/language-switcher";
import { SearchIcon } from "@/features/board/components/board-ui-icons";
import { ThemeToggle } from "@/features/board/components/theme-toggle";
import { NotificationBell } from "@/features/notifications/components/notification-bell";
import { useSearchFocusRequest } from "@/features/search/components/global-search-provider";
import { SearchField } from "@/features/search/components/search-field";
import { shortcutAria, shortcutLabel } from "@/features/search/utils/search-hotkey";
import { usePathname } from "@/lib/navigation";
import { t } from "@/i18n";

import { useSidebarCounts } from "../hooks/use-sidebar-counts";
import { sectionFromPath, type AppSection } from "../utils/navigation";
import { SIDEBAR_RAIL_WIDTH, compactCount } from "../utils/sidebar-preference";
import { NavIcon, type NavIconName } from "./nav-icons";
import { SidebarToggle } from "./sidebar-toggle";

interface RailDestination {
  href: string;
  icon: NavIconName;
  label: string;
  section: AppSection;
  count?: number;
}

const TOOLTIP_EVENTS = { hover: true, focus: true, touch: false };

function railItemClass(active: boolean): string {
  return `relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--app-primary)] ${
    active
      ? "bg-[var(--app-primary-soft)] text-[var(--app-primary)]"
      : "text-[var(--app-text-muted)] hover:bg-[var(--app-surface-muted)] hover:text-[var(--app-text)]"
  }`;
}

/** Hint text: the destination, with its count when there is one. */
function withCount(label: string, count?: number): string {
  return count ? t("shell.navWithCount", { label, count }) : label;
}

const RailLink = forwardRef<HTMLAnchorElement, { destination: RailDestination; active: boolean }>(function RailLink(
  { destination, active, ...props },
  ref,
) {
  const name = withCount(destination.label, destination.count);
  return (
    <Link
      {...props}
      ref={ref}
      href={destination.href}
      aria-label={name}
      aria-current={active ? "page" : undefined}
      className={railItemClass(active)}
    >
      <NavIcon name={destination.icon} />
      {destination.count ? (
        <span
          aria-hidden
          className="absolute -right-1 -top-1 min-w-[1.125rem] rounded-full border-2 border-[var(--app-surface)] bg-[var(--app-primary)] px-1 text-center text-[10px] font-semibold leading-[14px] text-white dark:text-[var(--app-bg)]"
        >
          {compactCount(destination.count)}
        </span>
      ) : null}
    </Link>
  );
});

function RailTooltip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Tooltip label={label} position="right" withArrow openDelay={150} events={TOOLTIP_EVENTS}>
      {children}
    </Tooltip>
  );
}

/**
 * The collapsed rail has no room for the search field, so its search icon opens the field in a
 * small panel beside the rail. Ctrl/Cmd+K opens the same panel.
 */
function RailSearch() {
  const [opened, setOpened] = useState(false);
  useSearchFocusRequest(() => setOpened(true));
  const label = `${t("search.open")} (${shortcutLabel()})`;
  return (
    <Popover opened={opened} onChange={setOpened} position="right-start" offset={12} width={380} shadow="md" radius="md" withinPortal closeOnEscape={false}>
      <Popover.Target>
        <Tooltip label={label} position="right" withArrow openDelay={150} events={TOOLTIP_EVENTS} disabled={opened}>
          <button
            type="button"
            aria-label={t("search.open")}
            aria-keyshortcuts={shortcutAria()}
            aria-expanded={opened}
            onClick={() => setOpened((value) => !value)}
            className={railItemClass(opened)}
          >
            <SearchIcon size={18} />
          </button>
        </Tooltip>
      </Popover.Target>
      <Popover.Dropdown p="xs" className="max-w-[calc(100vw-80px)]">
        <SearchField
          inline
          autoFocus
          answersShortcut={false}
          placeholder={t("search.placeholder")}
          onNavigate={() => setOpened(false)}
          onEscape={() => setOpened(false)}
        />
      </Popover.Dropdown>
    </Popover>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : name.trim().slice(0, 2)).toUpperCase() || "?";
}

/** Account settings and logout, behind the user's initials. */
function RailAccountMenu() {
  const { user, logout } = useAuth();
  const [accountOpen, setAccountOpen] = useState(false);
  if (!user) return null;
  const label = t("account.open", { name: user.display_name });
  return (
    <>
      <Menu shadow="md" position="right-end" withinPortal>
        <Menu.Target>
          <ActionIcon variant="light" radius="xl" size="lg" aria-label={label} title={label}>
            <span className="text-xs font-semibold">{initials(user.display_name)}</span>
          </ActionIcon>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Label>
            {user.display_name} · {user.login_id}
          </Menu.Label>
          <Menu.Item onClick={() => setAccountOpen(true)}>{t("account.title")}</Menu.Item>
          <Menu.Item onClick={() => void logout()}>{t("shell.logout")}</Menu.Item>
        </Menu.Dropdown>
      </Menu>
      <AccountSettingsModal opened={accountOpen} onClose={() => setAccountOpen(false)} />
    </>
  );
}

/**
 * The large-screen sidebar collapsed to icons. Every destination keeps its name (as the link's
 * accessible name and as a tooltip on hover or focus); the board and folder tree is left out.
 */
export function CollapsedSidebarRail() {
  const pathname = usePathname();
  const section = sectionFromPath(pathname);
  const counts = useSidebarCounts();

  const destinations: RailDestination[] = [
    { href: "/today", icon: "home", label: t("shell.home"), section: "today" },
    { href: "/inbox", icon: "inbox", label: t("shell.inbox"), section: "inbox", count: counts.inbox },
    { href: "/my-tasks", icon: "myTasks", label: t("shell.myTasks"), section: "myTasks", count: counts.myTasks },
    { href: "/calendar", icon: "calendar", label: t("shell.calendar"), section: "calendar" },
    { href: "/reports", icon: "reports", label: t("shell.reports"), section: "reports" },
    { href: "/boards", icon: "boards", label: t("shell.boards"), section: "boards" },
    { href: "/plans", icon: "plans", label: t("shell.plans"), section: "plans" },
    { href: "/notepad", icon: "notepad", label: t("shell.notepad"), section: "notepad" },
    { href: "/schedule", icon: "schedule", label: t("shell.schedule"), section: "schedule" },
  ];

  return (
    <div
      data-sidebar-rail
      style={{ width: SIDEBAR_RAIL_WIDTH }}
      className="flex h-full flex-col items-center border-r border-[var(--app-border)] bg-[var(--app-surface)]"
    >
      <div className="flex w-full flex-col items-center gap-1 border-b border-[var(--app-border)] py-3">
        <SidebarToggle />
        <NotificationBell />
      </div>
      <nav
        aria-label={t("shell.navigation")}
        className="flex min-h-0 w-full flex-1 flex-col items-center gap-1 overflow-y-auto overflow-x-hidden py-3"
      >
        <RailSearch />
        {destinations.map((destination) => (
          <RailTooltip key={destination.href} label={withCount(destination.label, destination.count)}>
            <RailLink destination={destination} active={destination.section === section} />
          </RailTooltip>
        ))}
      </nav>
      <div className="flex w-full flex-col items-center gap-1 border-t border-[var(--app-border)] bg-[var(--app-surface-muted)]/45 py-3">
        <LanguageSwitcher />
        <ThemeToggle />
        <RailAccountMenu />
      </div>
    </div>
  );
}
