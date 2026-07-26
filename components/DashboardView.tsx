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
import { EmptyState } from "@/components/EmptyState";
import { LessonsReceivableWidget } from "@/components/LessonsReceivableWidget";
import { MonthNav } from "@/components/MonthNav";
import { useMonth } from "@/components/MonthProvider";
import { createClient } from "@/lib/supabase/client";
import { budgetStatus, momDelta, summarizeMonth } from "@/lib/dashboard";
import { onDataChanged } from "@/lib/events";
import {
  addMonths,
  formatCurrency,
  formatDateBR,
  monthRange,
} from "@/lib/format";
import {
  PAYMENT_METHOD_LABELS,
  type Category,
  type Debt,
  type Expense,
  type FixedCost,
  type Income,
  type Investment,
  type Project,
} from "@/lib/types";

type ProjectCard = Project & { spent: number; invested: number };

export function DashboardView() {
  const supabase = useMemo(() => createClient(), []);
  const { year, month, go } = useMonth();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<ReturnType<typeof summarizeMonth> | null>(null);
  const [prevOutflows, setPrevOutflows] = useState(0);
  const [prevIncomes, setPrevIncomes] = useState(0);
  const [monthExpenses, setMonthExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [projects, setProjects] = useState<ProjectCard[]>([]);

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
      { data: investments },
      { data: prevExpenses },
      { data: prevIncomesData },
      { data: prevFixed },
      { data: prevDebts },
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
        .from("projects")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "active")
        .order("created_at", { ascending: false }),
    ]);

    const catList = (cats as Category[]) ?? [];
    const expList = (expenses as Expense[]) ?? [];
    const current = summarizeMonth({
      year,
      month,
      incomes: (incomes as Income[]) ?? [],
      expenses: expList,
      fixedCosts: (fixedCosts as FixedCost[]) ?? [],
      debts: (debts as Debt[]) ?? [],
      investments: (investments as Investment[]) ?? [],
      categories: catList,
    });
    const previous = summarizeMonth({
      year: prev.year,
      month: prev.month,
      incomes: (prevIncomesData as Income[]) ?? [],
      expenses: (prevExpenses as Expense[]) ?? [],
      fixedCosts: (prevFixed as FixedCost[]) ?? [],
      debts: (prevDebts as Debt[]) ?? [],
      investments: [],
      categories: catList,
    });

    const projList = (activeProjects as Project[]) ?? [];
    const projCards: ProjectCard[] = await Promise.all(
      projList.map(async (p) => {
        const [{ data: exps }, { data: invs }] = await Promise.all([
          supabase.from("expenses").select("amount").eq("project_id", p.id),
          supabase.from("investments").select("amount").eq("project_id", p.id),
        ]);
        return {
          ...p,
          spent: (exps ?? []).reduce((s, e) => s + Number(e.amount), 0),
          invested: (invs ?? []).reduce((s, e) => s + Number(e.amount), 0),
        };
      }),
    );

    setCategories(catList);
    setMonthExpenses(expList);
    setSummary(current);
    setPrevOutflows(previous.outflows);
    setPrevIncomes(previous.incomes);
    setProjects(projCards);
    setLoading(false);
  }, [supabase, year, month]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  useEffect(() => onDataChanged(() => void load()), [load]);

  if (loading || !summary) {
    return <p className="text-sm text-[var(--fg-muted)]">Carregando dashboard…</p>;
  }

  const outflowDelta = momDelta(summary.outflows, prevOutflows);
  const incomeDelta = momDelta(summary.incomes, prevIncomes);
  const chartData = summary.byCategory.map((c) => ({
    name: c.category.name,
    value: c.total,
    color: c.category.color,
  }));

  const catMap = new Map(categories.map((c) => [c.id, c]));
  const recentExpenses = [...monthExpenses]
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
            summary.teachingIncomes > 0
              ? `Aulas ${formatCurrency(summary.teachingIncomes)}`
              : undefined
          }
        />
        <StatCard label="Saídas" value={summary.outflows} delta={outflowDelta} positiveGood={false} />
        <StatCard label="Investido" value={summary.invested} />
        <StatCard
          label="Saldo do mês"
          value={summary.balance}
          highlight={summary.balance >= 0 ? "good" : "bad"}
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
                      formatter={(v: number) => formatCurrency(v)}
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
                    <span className="tabular-nums text-[var(--fg-muted)]">{formatCurrency(total)}</span>
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
                {formatCurrency(summary.committed)}
              </p>
              <p className="mt-1 text-xs text-[var(--fg-muted)]">
                Fixos {formatCurrency(summary.fixedCosts)} + Parcelas{" "}
                {formatCurrency(summary.installments)}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <h2 className="text-sm font-medium text-[var(--fg-muted)]">Projetos ativos</h2>
            {projects.length === 0 ? (
              <EmptyState
                title="Nenhum projeto ativo"
                description="Crie um projeto e vincule gastos e aportes."
              />
            ) : (
              <ul className="space-y-2">
                {projects.map((p) => {
                  const target = p.target_amount ? Number(p.target_amount) : null;
                  const pct = target ? Math.min(100, (p.invested / target) * 100) : null;
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
                            {formatCurrency(p.invested)}
                            {target ? ` / ${formatCurrency(target)}` : ""}
                          </span>
                        </div>
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
                  <p className="tabular-nums text-sm font-semibold text-[var(--fg)]">
                    {formatCurrency(exp.amount)}
                  </p>
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
        {formatCurrency(value)}
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
  const [rows, setRows] = useState<
    { category: Category; spent: number; budget: number; status: "green" | "yellow" | "red" }[]
  >([]);

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { start, end } = monthRange(year, month);
      const [{ data: cats }, { data: expenses }] = await Promise.all([
        supabase
          .from("categories")
          .select("*")
          .eq("user_id", user.id)
          .not("monthly_budget", "is", null),
        supabase
          .from("expenses")
          .select("category_id, amount")
          .eq("user_id", user.id)
          .gte("date", start)
          .lte("date", end),
      ]);
      const spentMap = new Map<string, number>();
      for (const e of expenses ?? []) {
        spentMap.set(
          e.category_id,
          (spentMap.get(e.category_id) ?? 0) + Number(e.amount),
        );
      }
      setRows(
        ((cats as Category[]) ?? [])
          .filter((c) => c.monthly_budget && Number(c.monthly_budget) > 0)
          .map((c) => {
            const budget = Number(c.monthly_budget);
            const spent = spentMap.get(c.id) ?? 0;
            return { category: c, spent, budget, status: budgetStatus(spent, budget) };
          }),
      );
    }
    void load();
  }, [supabase, year, month]);

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
                {formatCurrency(spent)} / {formatCurrency(budget)}
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
