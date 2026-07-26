"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useCurrency } from "@/components/CurrencyProvider";
import { EmptyState } from "@/components/EmptyState";
import { createClient } from "@/lib/supabase/client";
import { onDataChanged } from "@/lib/events";
import { groupReceivableByGuardian } from "@/lib/lessons";
import type { Lesson, Student } from "@/lib/types";

type PendingLesson = Lesson & {
  students: Pick<
    Student,
    "id" | "name" | "financial_guardian" | "billing_mode"
  > | null;
};

export function LessonsReceivableWidget() {
  const supabase = useMemo(() => createClient(), []);
  const { format } = useCurrency();
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<ReturnType<typeof groupReceivableByGuardian>>([]);

  const load = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("lessons")
      .select(
        "id, date, amount, status, payment_status, student_id, students(id, name, financial_guardian, billing_mode)",
      )
      .eq("user_id", user.id)
      .eq("payment_status", "pending");

    if (error) {
      setLoading(false);
      return;
    }

    const rows = ((data as unknown as PendingLesson[]) ?? []).map((row) => ({
      ...row,
      students: Array.isArray(row.students)
        ? (row.students[0] ?? null)
        : row.students,
    }));
    setGroups(groupReceivableByGuardian(rows));
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => onDataChanged(() => void load()), [load]);

  const total = groups.reduce((s, g) => s + g.total, 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-medium text-[var(--fg-muted)]">A receber de aulas</h2>
        <Link href="/aulas" className="text-xs text-[var(--accent)] hover:underline">
          Ver aulas
        </Link>
      </div>

      {loading ? (
        <p className="text-sm text-[var(--fg-muted)]">Carregando…</p>
      ) : groups.length === 0 ? (
        <EmptyState
          title="Nada a receber"
          description="Quando houver aulas pendentes, elas aparecem aqui."
        />
      ) : (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <p className="text-2xl font-semibold tabular-nums text-[var(--warning)]">
            {format(total)}
          </p>
          <p className="mt-1 text-xs text-[var(--fg-muted)]">Total pendente</p>

          <ul className="mt-4 space-y-2">
            {groups.map((g) => (
              <li
                key={g.key}
                className={`rounded-xl border px-3 py-2 text-sm ${
                  g.awaitingClosedMonth
                    ? "border-[var(--warning)]/40 bg-[var(--warning-soft)]"
                    : "border-[var(--border)] bg-[var(--bg)]"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-[var(--fg)]">
                      {g.label} — {format(g.total)}
                    </p>
                    <p className="text-xs text-[var(--fg-muted)]">
                      {g.count} aula{g.count === 1 ? "" : "s"}
                    </p>
                    {g.awaitingClosedMonth ? (
                      <p className="mt-1 text-xs font-medium text-[var(--warning)]">
                        Mês fechado, aguardando pagamento
                      </p>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
