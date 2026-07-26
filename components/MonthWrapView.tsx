"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { useCurrency, useRowRates } from "@/components/CurrencyProvider";
import { createClient } from "@/lib/supabase/client";
import { budgetStatus, summarizeMonth } from "@/lib/dashboard";
import { convertAmount, type AmountRow } from "@/lib/fx";
import { computeStreak } from "@/lib/streak";
import { addMonths, formatMonthYear, monthRange, percentChange } from "@/lib/format";
import type {
  Category,
  CreditCardBill,
  Debt,
  Expense,
  FixedCost,
  Income,
  Investment,
} from "@/lib/types";

type WrapData = {
  categories: Category[];
  expenses: Expense[];
  incomes: Income[];
  fixedCosts: FixedCost[];
  debts: Debt[];
  creditCardBills: CreditCardBill[];
  investments: Investment[];
  prevExpenses: Expense[];
  prevIncomes: Income[];
  prevFixedCosts: FixedCost[];
  prevDebts: Debt[];
  prevCreditCardBills: CreditCardBill[];
};

export function MonthWrapView() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const params = useSearchParams();
  const now = new Date();
  const defaultPrev = addMonths(now.getFullYear(), now.getMonth() + 1, -1);
  const year = Number(params.get("year") ?? defaultPrev.year);
  const month = Number(params.get("month") ?? defaultPrev.month);

  const { mainCurrency, rates, format } = useCurrency();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<WrapData | null>(null);
  const [streakKept, setStreakKept] = useState(0);

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { start, end } = monthRange(year, month);
      const prev = addMonths(year, month, -1);
      const prevRange = monthRange(prev.year, prev.month);

      const [
        { data: categories },
        { data: expenses },
        { data: incomes },
        { data: fixedCosts },
        { data: debts },
        { data: bills },
        { data: investments },
        { data: prevExpenses },
        { data: prevIncomes },
        { data: prevFixed },
        { data: prevDebts },
        { data: prevBills },
        { data: expDates },
        { data: noSpend },
      ] = await Promise.all([
        supabase.from("categories").select("*").eq("user_id", user.id),
        supabase
          .from("expenses")
          .select("*")
          .eq("user_id", user.id)
          .gte("date", start)
          .lte("date", end),
        supabase
          .from("incomes")
          .select("*")
          .eq("user_id", user.id)
          .gte("date", start)
          .lte("date", end),
        supabase.from("fixed_costs").select("*").eq("user_id", user.id),
        supabase.from("debts").select("*").eq("user_id", user.id),
        supabase
          .from("credit_card_bills")
          .select("*")
          .eq("user_id", user.id)
          .eq("year", year)
          .eq("month", month),
        supabase
          .from("investments")
          .select("*")
          .eq("user_id", user.id)
          .gte("date", start)
          .lte("date", end),
        supabase
          .from("expenses")
          .select("*")
          .eq("user_id", user.id)
          .gte("date", prevRange.start)
          .lte("date", prevRange.end),
        supabase
          .from("incomes")
          .select("*")
          .eq("user_id", user.id)
          .gte("date", prevRange.start)
          .lte("date", prevRange.end),
        supabase.from("fixed_costs").select("*").eq("user_id", user.id),
        supabase.from("debts").select("*").eq("user_id", user.id),
        supabase
          .from("credit_card_bills")
          .select("*")
          .eq("user_id", user.id)
          .eq("year", prev.year)
          .eq("month", prev.month),
        supabase.from("expenses").select("date").eq("user_id", user.id),
        supabase.from("no_spend_days").select("date").eq("user_id", user.id),
      ]);

      const dates = [
        ...(expDates ?? []).map((r) => r.date as string),
        ...(noSpend ?? []).map((r) => r.date as string),
      ];
      // Streak as of end of that month
      const endDate = new Date(year, month, 0);
      const { current: streak } = computeStreak(dates, endDate);

      setData({
        categories: (categories as Category[]) ?? [],
        expenses: (expenses as Expense[]) ?? [],
        incomes: (incomes as Income[]) ?? [],
        fixedCosts: (fixedCosts as FixedCost[]) ?? [],
        debts: (debts as Debt[]) ?? [],
        creditCardBills: (bills as CreditCardBill[]) ?? [],
        investments: (investments as Investment[]) ?? [],
        prevExpenses: (prevExpenses as Expense[]) ?? [],
        prevIncomes: (prevIncomes as Income[]) ?? [],
        prevFixedCosts: (prevFixed as FixedCost[]) ?? [],
        prevDebts: (prevDebts as Debt[]) ?? [],
        prevCreditCardBills: (prevBills as CreditCardBill[]) ?? [],
      });
      setStreakKept(streak);
      setLoading(false);
    }
    void load();
  }, [supabase, year, month]);

  const datedRows = useMemo<AmountRow[]>(
    () =>
      data
        ? [
            ...data.expenses,
            ...data.incomes,
            ...data.investments,
            ...data.prevExpenses,
            ...data.prevIncomes,
          ]
        : [],
    [data],
  );

  useRowRates(datedRows);

  const summary = useMemo(
    () =>
      data
        ? summarizeMonth({
            year,
            month,
            incomes: data.incomes,
            expenses: data.expenses,
            fixedCosts: data.fixedCosts,
            debts: data.debts,
            creditCardBills: data.creditCardBills,
            investments: data.investments,
            categories: data.categories,
            mainCurrency,
            rates,
          })
        : null,
    [data, year, month, mainCurrency, rates],
  );

  const prevOutflows = useMemo(() => {
    if (!data) return 0;
    const prev = addMonths(year, month, -1);
    return summarizeMonth({
      year: prev.year,
      month: prev.month,
      incomes: data.prevIncomes,
      expenses: data.prevExpenses,
      fixedCosts: data.prevFixedCosts,
      debts: data.prevDebts,
      creditCardBills: data.prevCreditCardBills,
      investments: [],
      categories: data.categories,
      mainCurrency,
      rates,
    }).outflows;
  }, [data, year, month, mainCurrency, rates]);

  const seals = useMemo(() => {
    if (!data) return [];
    const spentMap = new Map<string, number>();
    for (const e of data.expenses) {
      const value = convertAmount(e.amount, e.currency, mainCurrency, e.date, rates);
      if (value === null) continue;
      spentMap.set(e.category_id, (spentMap.get(e.category_id) ?? 0) + value);
    }
    return data.categories
      .filter((c) => c.monthly_budget && Number(c.monthly_budget) > 0)
      .filter((c) => budgetStatus(spentMap.get(c.id) ?? 0, Number(c.monthly_budget)) !== "red")
      .map((c) => `${c.icon} ${c.name}`);
  }, [data, mainCurrency, rates]);

  async function dismiss() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("month_closings").upsert(
        { user_id: user.id, year, month, seen_at: new Date().toISOString() },
        { onConflict: "user_id,year,month" },
      );
    }
    router.push("/");
  }

  if (loading || !data || !summary) {
    return <p className="text-sm text-[var(--fg-muted)]">Preparando resumo…</p>;
  }

  const expenseCount = data.expenses.length;

  const top = summary.byCategory[0];
  const change = percentChange(summary.outflows, prevOutflows);

  return (
    <div className="space-y-6">
      <header className="text-center pt-4">
        <p className="text-sm text-[var(--accent)] font-medium">Fechamento do mês</p>
        <h1 className="mt-1 text-2xl font-semibold text-[var(--fg)]">
          {formatMonthYear(year, month)}
        </h1>
      </header>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 text-center">
          <p className="text-xs text-[var(--fg-muted)]">Gastos registrados</p>
          <p className="mt-1 text-3xl font-semibold tabular-nums text-[var(--fg)]">{expenseCount}</p>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 text-center">
          <p className="text-xs text-[var(--fg-muted)]">Streak no fechamento</p>
          <p className="mt-1 text-3xl font-semibold tabular-nums text-[var(--accent)]">
            🔥 {streakKept}
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 space-y-2">
        <Row label="Entradas" value={format(summary.incomes)} />
        <Row label="Saídas" value={format(summary.outflows)} />
        <Row label="Investido" value={format(summary.invested)} />
        <Row
          label="Saldo"
          value={format(summary.balance)}
          accent={summary.balance >= 0 ? "good" : "bad"}
        />
        {change !== null && (
          <p className="pt-2 text-sm text-[var(--fg-muted)]">
            Saídas {change > 0 ? "↑" : change < 0 ? "↓" : "→"} {Math.abs(change).toFixed(0)}% vs mês
            anterior
          </p>
        )}
      </div>

      {top && (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 text-center">
          <p className="text-xs text-[var(--fg-muted)]">Categoria campeã</p>
          <p className="mt-2 text-xl text-[var(--fg)]">
            {top.category.icon} {top.category.name}
          </p>
          <p className="text-sm text-[var(--fg-muted)]">{format(top.total)}</p>
        </div>
      )}

      {seals.length > 0 && (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <p className="text-sm font-medium text-[var(--fg)]">Selos de orçamento</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {seals.map((s) => (
              <li
                key={s}
                className="rounded-lg bg-[var(--positive-soft)] px-2.5 py-1 text-sm text-[var(--positive)]"
              >
                ✓ {s}
              </li>
            ))}
          </ul>
        </div>
      )}

      <Button size="lg" className="w-full" onClick={dismiss}>
        Continuar
      </Button>
    </div>
  );
}

function Row({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "good" | "bad";
}) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-[var(--fg-muted)]">{label}</span>
      <span
        className={`tabular-nums font-medium ${
          accent === "good"
            ? "text-[var(--positive)]"
            : accent === "bad"
              ? "text-[var(--negative)]"
              : "text-[var(--fg)]"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
