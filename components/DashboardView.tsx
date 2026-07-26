"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { Amount } from "@/components/Amount";
import { useCurrency, useRowRates } from "@/components/CurrencyProvider";
import { EmptyState } from "@/components/EmptyState";
import { LessonsReceivableWidget } from "@/components/LessonsReceivableWidget";
import { MonthNav } from "@/components/MonthNav";
import { useMonth } from "@/components/MonthProvider";
import { createClient } from "@/lib/supabase/client";
import { budgetStatus, momDelta, summarizeMonth } from "@/lib/dashboard";
import { convertAmount, type AmountRow } from "@/lib/fx";
import { onDataChanged } from "@/lib/events";
import { addMonths, formatDateBR, monthRange } from "@/lib/format";
import { projectReserve, reserveFundedRows, type ReserveExpenseRow } from "@/lib/reserves";
import {
  PAYMENT_METHOD_LABELS,
  type Category,
  type CreditCardBill,
  type Debt,
  type Expense,
  type FixedCost,
  type Income,
  type Investment,
  type Project,
} from "@/lib/types";

type ProjectCard = Project & {
  expenseRows: ReserveExpenseRow[];
  investmentRows: AmountRow[];
};

type MonthData = {
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
  projects: ProjectCard[];
};

export function DashboardView() {
  const supabase = useMemo(() => createClient(), []);
  const { year, month, go } = useMonth();
  const { mainCurrency, rates, sum, format } = useCurrency();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<MonthData | null>(null);

  const load = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { start, end } = monthRange(year, month);
    const prev = addMonths(year, month, -1);
    const prevRange = monthRange(prev.year, prev.month);

    const [
      { data: cats },
      { data: expenses },
      { data: incomes },
      { data: fixedCosts },
      { data: debts },
      { data: bills },
      { data: investments },
      { data: prevExpenses },
      { data: prevIncomesData },
      { data: prevFixed },
      { data: prevDebts },
      { data: prevBills },
      { data: activeProjects },
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
      supabase
        .from("projects")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "active")
        .order("created_at", { ascending: false }),
    ]);

    const projList = (activeProjects as Project[]) ?? [];
    const projCards: ProjectCard[] = await Promise.all(
      projList.map(async (p) => {
        const [{ data: exps }, { data: invs }] = await Promise.all([
          supabase
            .from("expenses")
            .select("amount, currency, date, paid_from_reserve")
            .eq("project_id", p.id),
          supabase.from("investments").select("amount, currency, date").eq("project_id", p.id),
        ]);
        return {
          ...p,
          expenseRows: (exps as ReserveExpenseRow[]) ?? [],
          investmentRows: (invs as AmountRow[]) ?? [],
        };
      }),
    );

    setData({
      categories: (cats as Category[]) ?? [],
      expenses: (expenses as Expense[]) ?? [],
      incomes: (incomes as Income[]) ?? [],
      fixedCosts: (fixedCosts as FixedCost[]) ?? [],
      debts: (debts as Debt[]) ?? [],
      creditCardBills: (bills as CreditCardBill[]) ?? [],
      investments: (investments as Investment[]) ?? [],
      prevExpenses: (prevExpenses as Expense[]) ?? [],
      prevIncomes: (prevIncomesData as Income[]) ?? [],
      prevFixedCosts: (prevFixed as FixedCost[]) ?? [],
      prevDebts: (prevDebts as Debt[]) ?? [],
      prevCreditCardBills: (prevBills as CreditCardBill[]) ?? [],
      projects: projCards,
    });
    setLoading(false);
  }, [supabase, year, month]);

  const datedRows = useMemo<AmountRow[]>(() => {
    if (!data) return [];
    return [
      ...data.expenses,
      ...data.incomes,
      ...data.investments,
      ...data.prevExpenses,
      ...data.prevIncomes,
      ...data.projects.flatMap((p) => [...p.expenseRows, ...p.investmentRows]),
    ];
  }, [data]);

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

  const previous = useMemo(() => {
    if (!data) return null;
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
    });
  }, [data, year, month, mainCurrency, rates]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  useEffect(() => onDataChanged(() => void load()), [load]);

  if (loading || !data || !summary || !previous) {
    return <p className="text-sm text-[var(--fg-muted)]">Carregando dashboard…</p>;
  }

  const outflowDelta = momDelta(summary.outflows, previous.outflows);
  const incomeDelta = momDelta(summary.incomes, previous.incomes);
  const chartData = summary.byCategory.map((c) => ({
    name: c.category.name,
    value: c.total,
    color: c.category.color,
  }));

  const catMap = new Map(data.categories.map((c) => [c.id, c]));
  const recentExpenses = [...data.expenses]
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.created_at < b.created_at ? 1 : -1))
    .slice(0, 8);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-[var(--fg-muted)]">Visão do mês</p>
          <h1 className="text-xl font-semibold tracking-tight text-[var(--fg)] lg:text-2xl">
            Dashboard
          </h1>
        </div>
        <MonthNav year={year} month={month} onGo={go} />
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <StatCard
          label="Entradas"
          value={summary.incomes}
          delta={incomeDelta}
          positiveGood
          subtitle={
            summary.teachingIncomes > 0 ? `Aulas ${format(summary.teachingIncomes)}` : undefined
          }
        />
        <StatCard label="Saídas" value={summary.outflows} delta={outflowDelta} positiveGood={false} />
        <StatCard label="Investido" value={summary.invested} />
        <StatCard
          label="Saldo do mês"
          value={summary.balance}
          highlight={summary.balance >= 0 ? "good" : "bad"}
          subtitle="após reservas"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <section className="space-y-3 lg:col-span-2 xl:col-span-1">
          <LessonsReceivableWidget />
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-medium text-[var(--fg-muted)]">Gastos por categoria</h2>
          {chartData.length === 0 ? (
            <EmptyState
              title="Sem gastos variáveis"
              description="Registre gastos para ver o gráfico."
            />
          ) : (
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={48}
                      outerRadius={72}
                      paddingAngle={2}
                    >
                      {chartData.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v: number) => format(v)}
                      contentStyle={{
                        background: "var(--surface-2)",
                        border: "1px solid var(--border)",
                        borderRadius: 12,
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="mt-2 space-y-1.5">
                {summary.byCategory.map(({ category, total }) => (
                  <li key={category.id} className="flex items-center justify-between text-sm">
                    <span className="text-[var(--fg)]">
                      {category.icon} {category.name}
                    </span>
                    <span className="tabular-nums text-[var(--fg-muted)]">{format(total)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-medium text-[var(--fg-muted)]">Orçamentos</h2>
          <BudgetBars year={year} month={month} />
        </section>

        <section className="space-y-4 lg:col-span-2 xl:col-span-1">
          <div className="space-y-3">
            <h2 className="text-sm font-medium text-[var(--fg-muted)]">Comprometido do mês</h2>
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
              <p className="text-2xl font-semibold tabular-nums text-[var(--fg)]">
                {format(summary.committed)}
              </p>
              <p className="mt-1 text-xs text-[var(--fg-muted)]">
                Fixos {format(summary.fixedCosts)} + Parcelas {format(summary.installments)} +
                Faturas {format(summary.creditBills)}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <h2 className="text-sm font-medium text-[var(--fg-muted)]">Projetos ativos</h2>
            {data.projects.length === 0 ? (
              <EmptyState
                title="Nenhum projeto ativo"
                description="Crie um projeto e vincule gastos e aportes."
              />
            ) : (
              <ul className="space-y-2">
                {data.projects.map((p) => {
                  const target = p.target_amount ? Number(p.target_amount) : null;
                  const reserved = sum(p.investmentRows).total;
                  const used = sum(reserveFundedRows(p.expenseRows)).total;
                  const { available } = projectReserve({ reservedTotal: reserved, usedTotal: used });
                  const pct = target ? Math.min(100, (reserved / target) * 100) : null;
                  return (
                    <li key={p.id}>
                      <Link
                        href={`/projetos/${p.id}`}
                        className="block rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 transition hover:border-[var(--accent)]"
                      >
                        <div className="flex items-center justify-between gap-2 text-sm">
                          <span className="font-medium text-[var(--fg)]">
                            {p.emoji} {p.name}
                          </span>
                          <span className="tabular-nums text-xs text-[var(--fg-muted)]">
                            {format(reserved)}
                            {target ? ` / ${format(target)}` : ""}
                          </span>
                        </div>
                        {reserved > 0 && (
                          <p className="mt-1 text-xs text-[var(--fg-muted)]">
                            Disponível na reserva {format(available)}
                          </p>
                        )}
                        {pct !== null && (
                          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--surface-2)]">
                            <div
                              className="h-full bg-[var(--accent)]"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-[var(--fg-muted)]">Últimos gastos</h2>
          <Link href="/gastos" className="text-xs text-[var(--accent)] hover:underline">
            Ver todos →
          </Link>
        </div>
        {recentExpenses.length === 0 ? (
          <EmptyState title="Sem gastos no mês" description="Os últimos registros aparecem aqui." />
        ) : (
          <ul className="divide-y divide-[var(--border)] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
            {recentExpenses.map((exp) => {
              const cat = catMap.get(exp.category_id);
              return (
                <li key={exp.id} className="flex items-center gap-3 px-3 py-2.5">
                  <span className="text-lg">{cat?.icon ?? "📦"}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-[var(--fg)]">
                      {exp.description || cat?.name || "Gasto"}
                    </p>
                    <p className="text-xs text-[var(--fg-muted)]">
                      {formatDateBR(exp.date)} · {PAYMENT_METHOD_LABELS[exp.payment_method]}
                    </p>
                  </div>
                  <Amount
                    value={exp.amount}
                    currency={exp.currency}
                    date={exp.date}
                    className="text-right tabular-nums text-sm font-semibold text-[var(--fg)]"
                  />
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  delta,
  positiveGood,
  highlight,
  subtitle,
}: {
  label: string;
  value: number;
  delta?: { pct: number | null; up: boolean | null };
  positiveGood?: boolean;
  highlight?: "good" | "bad";
  subtitle?: string;
}) {
  const { format } = useCurrency();

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 lg:p-4">
      <p className="text-xs text-[var(--fg-muted)]">{label}</p>
      <p
        className={`mt-1 text-lg font-semibold tabular-nums lg:text-xl ${
          highlight === "good"
            ? "text-[var(--positive)]"
            : highlight === "bad"
              ? "text-[var(--negative)]"
              : "text-[var(--fg)]"
        }`}
      >
        {format(value)}
      </p>
      {subtitle ? (
        <p className="mt-0.5 text-xs text-[var(--fg-muted)]">{subtitle}</p>
      ) : null}
      {delta && delta.pct !== null && (
        <p
          className={`mt-0.5 text-xs ${
            delta.up === null
              ? "text-[var(--fg-muted)]"
              : (delta.up && positiveGood) || (!delta.up && !positiveGood)
                ? "text-[var(--positive)]"
                : "text-[var(--negative)]"
          }`}
        >
          {delta.up === null ? "→" : delta.up ? "↑" : "↓"}{" "}
          {Math.abs(delta.pct).toFixed(0)}% vs mês anterior
        </p>
      )}
    </div>
  );
}

function BudgetBars({ year, month }: { year: number; month: number }) {
  const supabase = useMemo(() => createClient(), []);
  const { mainCurrency, rates, format } = useCurrency();
  const [categories, setCategories] = useState<Category[]>([]);
  const [expenses, setExpenses] = useState<
    (AmountRow & { category_id: string; paid_from_reserve?: boolean })[]
  >([]);

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { start, end } = monthRange(year, month);
      const [{ data: cats }, { data: exps }] = await Promise.all([
        supabase
          .from("categories")
          .select("*")
          .eq("user_id", user.id)
          .not("monthly_budget", "is", null),
        supabase
          .from("expenses")
          .select("category_id, amount, currency, date, paid_from_reserve")
          .eq("user_id", user.id)
          .gte("date", start)
          .lte("date", end),
      ]);
      setCategories((cats as Category[]) ?? []);
      setExpenses(
        (exps as (AmountRow & { category_id: string; paid_from_reserve?: boolean })[]) ?? [],
      );
    }
    void load();
  }, [supabase, year, month]);

  useRowRates(expenses);

  const rows = useMemo(() => {
    const spentMap = new Map<string, number>();
    for (const e of expenses) {
      if (e.paid_from_reserve) continue;
      const value = convertAmount(e.amount, e.currency ?? mainCurrency, mainCurrency, e.date, rates);
      if (value === null) continue;
      spentMap.set(e.category_id, (spentMap.get(e.category_id) ?? 0) + value);
    }
    return categories
      .filter((c) => c.monthly_budget && Number(c.monthly_budget) > 0)
      .map((c) => {
        const budget = Number(c.monthly_budget);
        const spent = spentMap.get(c.id) ?? 0;
        return { category: c, spent, budget, status: budgetStatus(spent, budget) };
      });
  }, [categories, expenses, mainCurrency, rates]);

  if (rows.length === 0) {
    return (
      <EmptyState
        title="Sem metas de categoria"
        description="Defina metas na tela de Orçamentos."
      />
    );
  }

  const colors = {
    green: "bg-[var(--positive)]",
    yellow: "bg-[var(--warning)]",
    red: "bg-[var(--negative)]",
  };

  return (
    <ul className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
      {rows.map(({ category, spent, budget, status }) => {
        const pct = Math.min(100, (spent / budget) * 100);
        return (
          <li key={category.id}>
            <div className="mb-1 flex justify-between text-sm">
              <span>
                {category.icon} {category.name}
              </span>
              <span className="tabular-nums text-[var(--fg-muted)]">
                {format(spent)} / {format(budget)}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-2)]">
              <div className={`h-full ${colors[status]}`} style={{ width: `${pct}%` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
