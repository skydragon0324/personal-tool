import type { ReactNode } from "react";

interface IconProps {
  size?: number;
  className?: string;
}

function Icon({ size = 16, className, children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      {children}
    </svg>
  );
}

export const PlusIcon = (props: IconProps) => <Icon {...props}><path d="M12 5v14M5 12h14" /></Icon>;
export const SlidersIcon = (props: IconProps) => (
  <Icon {...props}><path d="M4 7h9M17 7h3M4 17h3M11 17h9" /><circle cx="15" cy="7" r="2" /><circle cx="9" cy="17" r="2" /></Icon>
);
export const PeopleIcon = (props: IconProps) => (
  <Icon {...props}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.7a3.5 3.5 0 0 1 0 6.6M18 14.5a6.5 6.5 0 0 1 3.5 5.5" /></Icon>
);
export const PersonIcon = (props: IconProps) => (
  <Icon {...props}><circle cx="12" cy="8" r="4" /><path d="M4.5 21a7.5 7.5 0 0 1 15 0" /></Icon>
);
export const GearIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-2.9-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0-1.2-2.9H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.2-2.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0 1.2 2.9h.1a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
  </Icon>
);
export const BoardViewIcon = (props: IconProps) => (
  <Icon {...props}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M9 4v16" /></Icon>
);
export const TableViewIcon = (props: IconProps) => (
  <Icon {...props}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 10h18M3 15h18M9 4v16M15 4v16" /></Icon>
);
export const TrendIcon = (props: IconProps) => <Icon {...props}><path d="m3 17 6-6 4 4 8-8M15 7h6v6" /></Icon>;
export const CalendarIcon = (props: IconProps) => (
  <Icon {...props}><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M8 3v4M16 3v4M4 10h16" /></Icon>
);
export const TagIcon = (props: IconProps) => (
  <Icon {...props}><path d="M3 12V5a2 2 0 0 1 2-2h7l9 9-9 9-9-9Z" /><circle cx="8" cy="8" r="1.2" /></Icon>
);
export const FlagIcon = (props: IconProps) => <Icon {...props}><path d="M5 21V4M5 4h13l-3 4.5 3 4.5H5" /></Icon>;
export const SearchIcon = (props: IconProps) => <Icon {...props}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.8-3.8" /></Icon>;
export const ResetIcon = (props: IconProps) => <Icon {...props}><path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5" /></Icon>;
export const ChevronLeftIcon = (props: IconProps) => <Icon {...props}><path d="m15 6-6 6 6 6" /></Icon>;
export const ChevronRightIcon = (props: IconProps) => <Icon {...props}><path d="m9 6 6 6-6 6" /></Icon>;
export const LayersIcon = (props: IconProps) => (
  <Icon {...props}><path d="m12 3 9 5-9 5-9-5 9-5ZM3 13l9 5 9-5" /></Icon>
);
export const CheckCircleIcon = (props: IconProps) => (
  <Icon {...props}><circle cx="12" cy="12" r="9" /><path d="m8 12 3 3 5-6" /></Icon>
);
export const CircleIcon = (props: IconProps) => <Icon {...props}><circle cx="12" cy="12" r="9" /></Icon>;
export const ClockIcon = (props: IconProps) => (
  <Icon {...props}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Icon>
);
export const RefreshIcon = (props: IconProps) => (
  <Icon {...props}><path d="M20 11a8 8 0 0 0-14-4.5L4 9M4 4v5h5M4 13a8 8 0 0 0 14 4.5l2-2.5M20 20v-5h-5" /></Icon>
);
export const DotsIcon = ({ size = 18, className }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
    <circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" />
  </svg>
);
export const LeafIcon = ({ size = 24, className }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
    <path d="M21 3c-9.5-.4-16.5 2.3-17.7 9.3-.4 2.4.2 4.5 1.4 6L3 20.6 4.4 22l2.4-2.4c1.5 1 3.5 1.4 5.6 1C19 19.300 21.600 12.500 21 3Zm-13 13.500c1.600-3.800 4.300-6.500 8-8.500-2.700 2.600-4.900 5.500-6.500 9.700L8 16.500Z" />
  </svg>
);

/** A small status mark: empty, partly complete, or done. */
export function ProgressMark({ done, progress }: { done: boolean; progress: number }) {
  if (done) {
    return (
      <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden className="shrink-0 text-[var(--app-primary)]">
        <circle cx="10" cy="10" r="9" fill="currentColor" />
        <path d="m6 10.300 2.700 2.700L14 7.500" fill="none" stroke="var(--app-surface)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  const radius = 8;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(1, Math.max(0, progress));
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden className="shrink-0 -rotate-90">
      <circle cx="10" cy="10" r={radius} fill="none" stroke="var(--app-text-muted)" strokeOpacity={clamped > 0 ? 0.25 : 0.7} strokeWidth="1.7" />
      {clamped > 0 ? (
        <circle
          cx="10"
          cy="10"
          r={radius}
          fill="none"
          stroke="var(--app-primary)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray={`${circumference * clamped} ${circumference}`}
        />
      ) : null}
    </svg>
  );
}
