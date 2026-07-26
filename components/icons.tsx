type IconProps = { className?: string };

const base = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export function DashboardIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="3" y="3" width="7.5" height="8.5" rx="1.6" />
      <rect x="13.5" y="3" width="7.5" height="5.5" rx="1.6" />
      <rect x="3" y="14.5" width="7.5" height="6.5" rx="1.6" />
      <rect x="13.5" y="11.5" width="7.5" height="9.5" rx="1.6" />
    </svg>
  );
}

export function ExpenseIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M12 4v15" />
      <path d="M18 13.5 12 19.5 6 13.5" />
    </svg>
  );
}

export function IncomeIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M12 20V5" />
      <path d="M6 10.5 12 4.5l6 6" />
    </svg>
  );
}

export function LessonsIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M12 4 2.5 8.5 12 13l9.5-4.5L12 4Z" />
      <path d="M6.5 11v5c0 1.4 2.5 2.8 5.5 2.8s5.5-1.4 5.5-2.8v-5" />
    </svg>
  );
}

export function FixedIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M3.5 9.5a8.5 8.5 0 0 1 14.4-3.6L21 9" />
      <path d="M21 4.5V9h-4.5" />
      <path d="M20.5 14.5a8.5 8.5 0 0 1-14.4 3.6L3 15" />
      <path d="M3 19.5V15h4.5" />
    </svg>
  );
}

export function InvestmentIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M3 17.5 9 11l4 4 8-8.5" />
      <path d="M15 6.5h6v6" />
    </svg>
  );
}

export function ProjectIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="0.6" fill="currentColor" />
    </svg>
  );
}

export function BudgetIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M12 3.5a8.5 8.5 0 1 0 8.5 8.5H12V3.5Z" />
      <path d="M15 3.9A8.5 8.5 0 0 1 20.1 9H15V3.9Z" />
    </svg>
  );
}

export function PlusIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function MoreIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="5" cy="12" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function LogoutIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M14.5 7.5V5.8A1.8 1.8 0 0 0 12.7 4H5.8A1.8 1.8 0 0 0 4 5.8v12.4A1.8 1.8 0 0 0 5.8 20h6.9a1.8 1.8 0 0 0 1.8-1.8v-1.7" />
      <path d="M9.5 12h11M17.5 8.5l3.5 3.5-3.5 3.5" />
    </svg>
  );
}

export function ChevronLeftIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M14.5 5.5 8 12l6.5 6.5" />
    </svg>
  );
}

export function ChevronRightIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M9.5 5.5 16 12l-6.5 6.5" />
    </svg>
  );
}
