"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import { budgetStatus, summarizeMonth } from "@/lib/dashboard";
import { computeStreak } from "@/lib/streak";
import {
  addMonths,
  formatCurrency,
  formatMonthYear,
  monthRange,
  percentChange,
} from "@/lib/format";
import type { Category, Debt, Expense, FixedCost, Income, Investment } from "@/lib/types";

export function MonthWrapView() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const params = useSearchParams();
  const now = new Date();
  const defaultPrev = addMonths(now.getFullYear(), now.getMonth() + 1, -1);
  const year = Number(params.get("year") ?? defaultPrev.year);
  const month = Number(params.get("month") ?? defaultPrev.month);

  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<ReturnType<typeof summarizeMonth> | null>(null);
  const [prevOutflows, setPrevOutflows] = useState(0);
  const [seals, setSeals] = useState<string[]>([]);
  const [streakKept, setStreakKept] = useState(0);
  const [expenseCount, setExpenseCount] = useState(0);

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
        { data: investments },
        { data: prevExpenses },
        { data: prevIncomes },
        { data: prevFixed },
        { data: prevDebts },
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
        supabase.from("expenses").select("date").eq("user_id", user.id),
        supabase.from("no_spend_days").select("date").eq("user_id", user.id),
      ]);

      const cats = (categories as Category[]) ?? [];
      const exps = (expenses as Expense[]) ?? [];
      const current = summarizeMonth({
        year,
        month,
        incomes: (incomes as Income[]) ?? [],
        expenses: exps,
        fixedCosts: (fixedCosts as FixedCost[]) ?? [],
        debts: (debts as Debt[]) ?? [],
        investments: (investments as Investment[]) ?? [],
        categories: cats,
      });
      const previous = summarizeMonth({
        year: prev.year,
        month: prev.month,
        incomes: (prevIncomes as Income[]) ?? [],
        expenses: (prevExpenses as Expense[]) ?? [],
        fixedCosts: (prevFixed as FixedCost[]) ?? [],
        debts: (prevDebts as Debt[]) ?? [],
        investments: [],
        categories: cats,
      });

      const spentMap = new Map<string, number>();
      for (const e of exps) {
        spentMap.set(e.category_id, (spentMap.get(e.category_id) ?? 0) + Number(e.amount));
      }
      const earnedSeals = cats
        .filter((c) => c.monthly_budget && Number(c.monthly_budget) > 0)
        .filter((c) => {
          const spent = spentMap.get(c.id) ?? 0;
          return budgetStatus(spent, Number(c.monthly_budget)) !== "red";
        })
        .map((c) => `${c.icon} ${c.name}`);

      const dates = [
        ...(expDates ?? []).map((r) => r.date as string),
        ...(noSpend ?? []).map((r) => r.date as string),
      ];
      // Streak as of end of that month
      const endDate = new Date(year, month, 0);
      const { current: streak } = computeStreak(dates, endDate);

      setSummary(current);
      setPrevOutflows(previous.outflows);
      setSeals(earnedSeals);
      setStreakKept(streak);
      setExpenseCount(exps.length);
      setLoading(false);
    }
    void load();
  }, [supabase, year, month]);

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

  if (loading || !summary) {
    return <p className="text-sm text-[var(--fg-muted)]">Preparando resumo…</p>;
  }

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
        <Row label="Entradas" value={formatCurrency(summary.incomes)} />
        <Row label="Saídas" value={formatCurrency(summary.outflows)} />
        <Row label="Investido" value={formatCurrency(summary.invested)} />
        <Row
          label="Saldo"
          value={formatCurrency(summary.balance)}
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
          <p className="text-sm text-[var(--fg-muted)]">{formatCurrency(top.total)}</p>
        </div>
      )}

      {seals.length > 0 && (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <p className="text-sm font-medium text-[var(--fg)]">Selos de orçamento</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {seals.map((s) => (
              <li
                key={s}
                className="rounded-lg bg-emerald-500/15 px-2.5 py-1 text-sm text-emerald-300"
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
            ? "text-emerald-400"
            : accent === "bad"
              ? "text-red-400"
              : "text-[var(--fg)]"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
