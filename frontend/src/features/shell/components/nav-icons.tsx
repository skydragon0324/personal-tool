export type NavIconName =
  | "home"
  | "myTasks"
  | "calendar"
  | "inbox"
  | "reports"
  | "today"
  | "boards"
  | "plans"
  | "notepad"
  | "schedule";

const PATHS: Record<NavIconName, JSX.Element> = {
  home: <path d="m3 11 9-8 9 8M5.500 9.500V20a1 1 0 0 0 1 1H10v-6h4v6h3.500a1 1 0 0 0 1-1V9.500" />,
  myTasks: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path d="m8.500 12 2.500 2.500 4.500-5" />
    </>
  ),
  calendar: (
    <>
      <rect x="4" y="5" width="16" height="15" rx="2" />
      <path d="M8 3v4M16 3v4M4 10h16" />
    </>
  ),
  inbox: (
    <>
      <path d="M5.500 5h13L21 13v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-5l2.500-8Z" />
      <path d="M3 13h5l1.500 3h5L16 13h5" />
    </>
  ),
  reports: <path d="M5 20v-6M12 20V5M19 20v-9" />,
  today: (
    <>
      <rect x="4" y="5" width="16" height="15" rx="2" />
      <path d="M8 3v4M16 3v4M4 10h16" />
    </>
  ),
  boards: (
    <>
      <rect x="3" y="5" width="7" height="14" rx="1.500" />
      <rect x="14" y="5" width="7" height="9" rx="1.500" />
    </>
  ),
  plans: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M8 9l1.500 1.500L12 8M8 15l1.500 1.500L12 14M14.500 9.500H16M14.500 15.500H16" />
    </>
  ),
  notepad: <path d="M8 4h8a2 2 0 0 1 2 2v14l-6-3-6 3V6a2 2 0 0 1 2-2Z" />,
  schedule: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4l2.500 1.500" />
    </>
  ),
};

export function NavIcon({ name, className }: { name: NavIconName; className?: string }) {
  return (
    <svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      {PATHS[name]}
    </svg>
  );
}
