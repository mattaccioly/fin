import type { Category, Debt, Expense, FixedCost, Income, Investment } from "@/lib/types";
import { committedInstallments } from "@/lib/debts";
import { percentChange } from "@/lib/format";

export type MonthSummary = {
  incomes: number;
  variableExpenses: number;
  fixedCosts: number;
  installments: number;
  invested: number;
  committed: number;
  outflows: number;
  balance: number;
  byCategory: { category: Category; total: number }[];
};

export function summarizeMonth(params: {
  year: number;
  month: number;
  incomes: Income[];
  expenses: Expense[];
  fixedCosts: FixedCost[];
  debts: Debt[];
  investments: Investment[];
  categories: Category[];
}): MonthSummary {
  const { year, month, incomes, expenses, fixedCosts, debts, investments, categories } = params;

  const incomeTotal = incomes.reduce((s, i) => s + Number(i.amount), 0);
  const variable = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const fixed = fixedCosts.filter((f) => f.active).reduce((s, f) => s + Number(f.amount), 0);
  const installments = committedInstallments(debts, year, month);
  const invested = investments.reduce((s, i) => s + Number(i.amount), 0);
  const committed = fixed + installments;
  const outflows = fixed + installments + variable;

  const catMap = new Map(categories.map((c) => [c.id, c]));
  const totals = new Map<string, number>();
  for (const e of expenses) {
    totals.set(e.category_id, (totals.get(e.category_id) ?? 0) + Number(e.amount));
  }

  const byCategory = [...totals.entries()]
    .map(([id, total]) => ({ category: catMap.get(id)!, total }))
    .filter((x) => x.category)
    .sort((a, b) => b.total - a.total);

  return {
    incomes: incomeTotal,
    variableExpenses: variable,
    fixedCosts: fixed,
    installments,
    invested,
    committed,
    outflows,
    balance: incomeTotal - outflows,
    byCategory,
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
