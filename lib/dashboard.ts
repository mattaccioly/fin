import type {
  Category,
  CreditCardBill,
  Debt,
  Expense,
  FixedCost,
  Income,
  Investment,
} from "@/lib/types";
import type { CurrencyCode } from "@/lib/currencies";
import { committedInstallments } from "@/lib/debts";
import { convertAmount, sumConverted, type RateMap } from "@/lib/fx";
import { percentChange } from "@/lib/format";

export type MonthSummary = {
  incomes: number;
  teachingIncomes: number;
  variableExpenses: number;
  fixedCosts: number;
  installments: number;
  creditBills: number;
  invested: number;
  committed: number;
  outflows: number;
  balance: number;
  byCategory: { category: Category; total: number }[];
  /** Entries left out of the totals because their rate is still missing. */
  missingRates: number;
};

/**
 * Every total is expressed in `mainCurrency`. Dated entries are converted with the
 * rate of their own date; fixed costs, installments and card bills are already in
 * the main currency.
 *
 * Credit expenses count for category tracking only — the manual card bill is the
 * real cash outflow, so credit-method expenses are excluded from `outflows` to
 * avoid double counting.
 */
export function summarizeMonth(params: {
  year: number;
  month: number;
  incomes: Income[];
  expenses: Expense[];
  fixedCosts: FixedCost[];
  debts: Debt[];
  creditCardBills: CreditCardBill[];
  investments: Investment[];
  categories: Category[];
  mainCurrency: CurrencyCode;
  rates: RateMap;
}): MonthSummary {
  const {
    year,
    month,
    incomes,
    expenses,
    fixedCosts,
    debts,
    creditCardBills,
    investments,
    categories,
    mainCurrency,
    rates,
  } = params;

  const incomeTotal = sumConverted(incomes, mainCurrency, rates);
  const teaching = sumConverted(
    incomes.filter((i) => i.source === "teaching"),
    mainCurrency,
    rates,
  );
  const variable = sumConverted(expenses, mainCurrency, rates);
  const cashVariable = sumConverted(
    expenses.filter((e) => e.payment_method !== "credit"),
    mainCurrency,
    rates,
  );
  const investedTotal = sumConverted(investments, mainCurrency, rates);
  const fixed = fixedCosts.filter((f) => f.active).reduce((s, f) => s + Number(f.amount), 0);
  const installments = committedInstallments(debts, year, month);
  const creditBills = creditCardBills
    .filter((b) => b.year === year && b.month === month)
    .reduce((s, b) => s + Number(b.amount), 0);
  const committed = fixed + installments + creditBills;
  const outflows = committed + cashVariable.total;

  const catMap = new Map(categories.map((c) => [c.id, c]));
  const totals = new Map<string, number>();
  for (const e of expenses) {
    const value = convertAmount(e.amount, e.currency, mainCurrency, e.date, rates);
    if (value === null) continue;
    totals.set(e.category_id, (totals.get(e.category_id) ?? 0) + value);
  }

  const byCategory = [...totals.entries()]
    .map(([id, total]) => ({ category: catMap.get(id)!, total }))
    .filter((x) => x.category)
    .sort((a, b) => b.total - a.total);

  return {
    incomes: incomeTotal.total,
    teachingIncomes: teaching.total,
    variableExpenses: variable.total,
    fixedCosts: fixed,
    installments,
    creditBills,
    invested: investedTotal.total,
    committed,
    outflows,
    balance: incomeTotal.total - outflows,
    byCategory,
    missingRates: incomeTotal.missing + variable.missing + investedTotal.missing,
  };
}

export function momDelta(current: number, previous: number): {
  pct: number | null;
  up: boolean | null;
} {
  const pct = percentChange(current, previous);
  if (pct === null) return { pct: null, up: null };
  if (pct === 0) return { pct: 0, up: null };
  return { pct, up: pct > 0 };
}

export function budgetStatus(spent: number, budget: number): "green" | "yellow" | "red" {
  const ratio = spent / budget;
  if (ratio < 0.8) return "green";
  if (ratio < 1) return "yellow";
  return "red";
}
