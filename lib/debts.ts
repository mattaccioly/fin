import type { Debt } from "@/lib/types";
import { formatShortMonthYear, parseLocalDate } from "@/lib/format";

export function remainingInstallments(debt: Debt): number {
  return Math.max(0, debt.total_installments - debt.paid_installments);
}

export function remainingAmount(debt: Debt): number {
  return remainingInstallments(debt) * Number(debt.installment_amount);
}

export function payoffDate(debt: Debt): Date | null {
  const remaining = remainingInstallments(debt);
  if (remaining <= 0) return null;
  const first = parseLocalDate(debt.first_due_date);
  return new Date(
    first.getFullYear(),
    first.getMonth() + debt.paid_installments + remaining - 1,
    first.getDate(),
  );
}

export function payoffLabel(debt: Debt): string {
  const d = payoffDate(debt);
  if (!d) return "Quitado";
  return `quita em ${formatShortMonthYear(d)}`;
}

/** True if an unpaid installment falls in the given calendar month. */
export function debtDueInMonth(debt: Debt, year: number, month: number): boolean {
  if (!debt.active) return false;
  if (debt.paid_installments >= debt.total_installments) return false;

  const first = parseLocalDate(debt.first_due_date);
  for (let i = 0; i < debt.total_installments; i++) {
    const due = new Date(first.getFullYear(), first.getMonth() + i, 1);
    if (due.getFullYear() === year && due.getMonth() + 1 === month) {
      return i >= debt.paid_installments;
    }
  }
  return false;
}

export function committedInstallments(debts: Debt[], year: number, month: number): number {
  return debts
    .filter((d) => debtDueInMonth(d, year, month))
    .reduce((sum, d) => sum + Number(d.installment_amount), 0);
}
