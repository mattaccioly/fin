import type { AmountRow } from "@/lib/fx";

export type ReserveExpenseRow = AmountRow & {
  paid_from_reserve?: boolean | null;
  id?: string;
};

/**
 * Project reserve remaining in the caller's currency units (after `sum` conversion).
 * reserved = sum of investments linked to the project
 * used     = sum of expenses with paid_from_reserve on that project
 */
export function projectReserve(params: {
  reservedTotal: number;
  usedTotal: number;
}): { reserved: number; used: number; available: number } {
  const reserved = params.reservedTotal;
  const used = params.usedTotal;
  return { reserved, used, available: reserved - used };
}

export function reserveFundedRows(rows: ReserveExpenseRow[]): AmountRow[] {
  return rows.filter((r) => r.paid_from_reserve);
}
