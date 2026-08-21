export function NavIcon({
  name,
  className,
}: {
  name: "today" | "boards" | "notepad" | "schedule";
  className?: string;
}) {
  const props = {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
    "aria-hidden": true as const,
    className,
  };
  switch (name) {
    case "today":
      return (
        <svg {...props}>
          <rect x="4" y="5" width="16" height="15" rx="2" stroke="currentColor" strokeWidth="1.8" />
          <path d="M8 3v4M16 3v4M4 10h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case "boards":
      return (
        <svg {...props}>
          <rect x="3" y="5" width="7" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
          <rect x="14" y="5" width="7" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
        </svg>
      );
    case "notepad":
      return (
        <svg {...props}>
          <path
            d="M8 4h8a2 2 0 0 1 2 2v14l-6-3-6 3V6a2 2 0 0 1 2-2Z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
        </svg>
      );
    default:
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.8" />
          <path d="M12 8v4l2.5 1.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
  }
}
