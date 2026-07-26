"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Amount } from "@/components/Amount";
import { useRowRates } from "@/components/CurrencyProvider";
import { EmptyState } from "@/components/EmptyState";
import { ExpenseForm } from "@/components/ExpenseForm";
import { createClient } from "@/lib/supabase/client";
import { onDataChanged } from "@/lib/events";
import { formatDateBR, startOfWeek, toISODate } from "@/lib/format";
import { computeStreak } from "@/lib/streak";
import {
  PAYMENT_METHOD_LABELS,
  type Category,
  type Expense,
} from "@/lib/types";

type ExpenseRow = Expense & {
  categories: Pick<Category, "id" | "name" | "icon" | "color"> | null;
};

export function QuickExpense() {
  const supabase = useMemo(() => createClient(), []);
  const [userId, setUserId] = useState<string | null>(null);
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [editing, setEditing] = useState<ExpenseRow | null>(null);
  const [streak, setStreak] = useState({ current: 0, best: 0 });
  const [loading, setLoading] = useState(true);

  useRowRates(expenses);

  const loadStreak = useCallback(
    async (uid: string) => {
      const [{ data: expDates }, { data: noSpend }] = await Promise.all([
        supabase.from("expenses").select("date").eq("user_id", uid),
        supabase.from("no_spend_days").select("date").eq("user_id", uid),
      ]);
      const dates = [
        ...(expDates ?? []).map((r) => r.date as string),
        ...(noSpend ?? []).map((r) => r.date as string),
      ];
      setStreak(computeStreak(dates));
    },
    [supabase],
  );

  const loadExpenses = useCallback(
    async (uid: string) => {
      const weekStart = toISODate(startOfWeek());
      const { data, error } = await supabase
        .from("expenses")
        .select("*, categories(id, name, icon, color)")
        .eq("user_id", uid)
        .gte("date", weekStart)
        .order("date", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) {
        toast.error("Erro ao carregar gastos");
        return;
      }
      setExpenses((data as ExpenseRow[]) ?? []);
    },
    [supabase],
  );

  useEffect(() => {
    async function init() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      await Promise.all([loadExpenses(user.id), loadStreak(user.id)]);
      setLoading(false);
    }
    void init();
  }, [supabase, loadExpenses, loadStreak]);

  useEffect(() => {
    if (!userId) return;
    return onDataChanged(() => {
      void loadExpenses(userId);
      void loadStreak(userId);
    });
  }, [userId, loadExpenses, loadStreak]);

  async function handleDelete(id: string) {
    if (!userId) return;
    if (!confirm("Excluir este gasto?")) return;
    const { error } = await supabase.from("expenses").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao excluir");
      return;
    }
    toast.success("Excluído");
    await Promise.all([loadExpenses(userId), loadStreak(userId)]);
  }

  async function markNoSpend() {
    if (!userId) return;
    const today = toISODate();
    const { error } = await supabase.from("no_spend_days").upsert(
      { user_id: userId, date: today },
      { onConflict: "user_id,date" },
    );
    if (error) {
      toast.error("Erro ao marcar dia");
      return;
    }
    toast.success("Dia sem gastos marcado — streak preservado");
    await loadStreak(userId);
  }

  function startEdit(exp: ExpenseRow) {
    setEditing(exp);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const todayIso = toISODate();
  const todayExpenses = expenses.filter((e) => e.date === todayIso);
  const weekExpenses = expenses;

  if (loading) {
    return <p className="text-[var(--fg-muted)] text-sm">Carregando…</p>;
  }

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-[var(--fg)]">
            {editing ? "Editar gasto" : "Registrar"}
          </h1>
          <p className="text-sm text-[var(--fg-muted)]">Em menos de 10 segundos</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-semibold tabular-nums text-[var(--accent)]">
            🔥 {streak.current}
          </p>
          <p className="text-xs text-[var(--fg-muted)]">melhor: {streak.best}</p>
        </div>
      </header>

      <ExpenseForm
        editing={editing}
        autoFocusAmount
        onSaved={() => setEditing(null)}
        onCancelEdit={() => setEditing(null)}
      />

      <div className="flex justify-center">
        <Button type="button" variant="ghost" size="sm" onClick={markNoSpend}>
          Dia sem gastos
        </Button>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-[var(--fg-muted)]">
          Hoje ({todayExpenses.length})
        </h2>
        {todayExpenses.length === 0 ? (
          <EmptyState
            title="Nenhum gasto hoje"
            description="Registre o primeiro — ou marque o dia sem gastos para manter o streak."
          />
        ) : (
          <ExpenseList items={todayExpenses} onEdit={startEdit} onDelete={handleDelete} />
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-[var(--fg-muted)]">Esta semana</h2>
        {weekExpenses.length === 0 ? (
          <EmptyState
            title="Semana vazia"
            description="Seus gastos da semana aparecerão aqui."
          />
        ) : (
          <ExpenseList items={weekExpenses} onEdit={startEdit} onDelete={handleDelete} />
        )}
      </section>
    </div>
  );
}

function ExpenseList({
  items,
  onEdit,
  onDelete,
}: {
  items: ExpenseRow[];
  onEdit: (e: ExpenseRow) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <ul className="divide-y divide-[var(--border)] rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
      {items.map((exp) => (
        <li key={exp.id} className="flex items-center gap-3 px-3 py-3">
          <span className="text-xl">{exp.categories?.icon ?? "📦"}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-[var(--fg)]">
              {exp.description || exp.categories?.name || "Gasto"}
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
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => onEdit(exp)}
              className="rounded-lg px-2 py-1 text-xs text-[var(--fg-muted)] hover:bg-[var(--surface-2)]"
            >
              Editar
            </button>
            <button
              type="button"
              onClick={() => onDelete(exp.id)}
              className="rounded-lg px-2 py-1 text-xs text-[var(--negative)] hover:bg-[var(--negative-soft)]"
            >
              Excluir
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
