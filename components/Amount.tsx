"use client";

import { useCurrency } from "@/components/CurrencyProvider";
import { toCurrencyCode } from "@/lib/currencies";
import type { AmountRow } from "@/lib/fx";

/**
 * Shows the amount as it was recorded, with the main-currency equivalent
 * (converted at the rate of `date`) underneath when they differ.
 */
export function Amount({
  value,
  currency,
  date,
  className = "",
}: {
  value: number | string;
  currency?: string | null;
  date: string;
  className?: string;
}) {
  const { mainCurrency, convert, noQuote, format } = useCurrency();
  const code = toCurrencyCode(currency ?? mainCurrency);

  if (code === mainCurrency) {
    return <span className={className}>{format(value, code)}</span>;
  }

  const converted = convert(value, code, date);
  const hint =
    converted !== null
      ? `≈ ${format(converted)}`
      : noQuote(code, date)
        ? "sem cotação"
        : "≈ …";

  return (
    <span className={`inline-block ${className}`}>
      {format(value, code)}
      <span className="block text-[11px] font-normal text-[var(--fg-muted)]">{hint}</span>
    </span>
  );
}

/** Sum of rows in the main currency; trails with an ellipsis while rates load. */
export function TotalAmount({
  rows,
  className = "",
}: {
  rows: AmountRow[];
  className?: string;
}) {
  const { sum, format } = useCurrency();
  const { total, missing } = sum(rows);
  return (
    <span className={className}>
      {format(total)}
      {missing > 0 ? " …" : ""}
    </span>
  );
}
