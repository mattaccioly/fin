"use client";

import { Select } from "@/components/ui/Input";
import {
  CURRENCY_LABELS,
  SUPPORTED_CURRENCIES,
  type CurrencyCode,
} from "@/lib/currencies";

export function CurrencySelect({
  id,
  value,
  onChange,
  className = "",
  disabled = false,
  codeOnly = false,
}: {
  id?: string;
  value: CurrencyCode;
  onChange: (currency: CurrencyCode) => void;
  className?: string;
  disabled?: boolean;
  codeOnly?: boolean;
}) {
  return (
    <Select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value as CurrencyCode)}
      className={className}
      disabled={disabled}
    >
      {SUPPORTED_CURRENCIES.map((code) => (
        <option key={code} value={code}>
          {codeOnly ? code : `${code} · ${CURRENCY_LABELS[code]}`}
        </option>
      ))}
    </Select>
  );
}
