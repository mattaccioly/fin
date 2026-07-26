"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "@/components/icons";
import { formatMonthYear } from "@/lib/format";

const arrowClass =
  "flex h-8 w-8 items-center justify-center rounded-lg text-[var(--fg-muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--fg)]";

export function MonthNav({
  year,
  month,
  onGo,
  heading = false,
}: {
  year: number;
  month: number;
  onGo: (delta: number) => void;
  /** Renders the month as the page title (h1) instead of a plain label. */
  heading?: boolean;
}) {
  const label = formatMonthYear(year, month);

  return (
    <div className="inline-flex items-center gap-1 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1">
      <button
        type="button"
        onClick={() => onGo(-1)}
        aria-label="Mês anterior"
        className={arrowClass}
      >
        <ChevronLeftIcon className="h-4 w-4" />
      </button>

      {heading ? (
        <h1 className="min-w-40 text-center text-base font-semibold tracking-tight text-[var(--fg)]">
          {label}
        </h1>
      ) : (
        <span className="min-w-40 text-center text-sm font-medium text-[var(--fg)]">
          {label}
        </span>
      )}

      <button
        type="button"
        onClick={() => onGo(1)}
        aria-label="Próximo mês"
        className={arrowClass}
      >
        <ChevronRightIcon className="h-4 w-4" />
      </button>
    </div>
  );
}
