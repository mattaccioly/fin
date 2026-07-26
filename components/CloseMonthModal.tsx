"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { createClient } from "@/lib/supabase/client";
import { emitDataChanged } from "@/lib/events";
import {
  formatCurrency,
  formatDateBR,
  formatMonthYear,
  monthRange,
  toISODate,
} from "@/lib/format";
import type { Lesson, Student } from "@/lib/types";

type LessonRow = Lesson & {
  students: Pick<Student, "id" | "name" | "billing_mode"> | null;
};

export function CloseMonthModal({
  open,
  onClose,
  students,
  year,
  month,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  students: Student[];
  year: number;
  month: number;
  onDone: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const monthlyStudents = useMemo(
    () => students.filter((s) => s.billing_mode === "monthly" && s.active),
    [students],
  );

  const [studentId, setStudentId] = useState("");
  const [paymentDate, setPaymentDate] = useState(toISODate());
  const [lessons, setLessons] = useState<LessonRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPaymentDate(toISODate());
    setStudentId((prev) =>
      prev && monthlyStudents.some((s) => s.id === prev)
        ? prev
        : (monthlyStudents[0]?.id ?? ""),
    );
  }, [open, monthlyStudents]);

  useEffect(() => {
    if (!open || !studentId) {
      setLessons([]);
      setSelected(new Set());
      return;
    }

    async function load() {
      setLoading(true);
      const { start, end } = monthRange(year, month);
      const { data, error } = await supabase
        .from("lessons")
        .select("*, students(id, name, billing_mode)")
        .eq("student_id", studentId)
        .eq("payment_status", "pending")
        .in("status", [
          "given",
          "cancelled_by_student",
          "cancelled_by_me",
          "rescheduled",
        ])
        .gte("date", start)
        .lte("date", end)
        .order("date", { ascending: true });

      setLoading(false);
      if (error) {
        toast.error("Erro ao carregar aulas do mês");
        return;
      }
      const rows = (data as LessonRow[]) ?? [];
      setLessons(rows);
      setSelected(new Set(rows.map((r) => r.id)));
    }

    void load();
  }, [open, studentId, year, month, supabase]);

  const total = useMemo(
    () =>
      lessons
        .filter((l) => selected.has(l.id))
        .reduce((s, l) => s + Number(l.amount), 0),
    [lessons, selected],
  );

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleConfirm() {
    if (!studentId || selected.size === 0) {
      toast.error("Selecione ao menos uma aula");
      return;
    }
    setSaving(true);
    const { error } = await supabase.rpc("close_student_month", {
      p_student_id: studentId,
      p_lesson_ids: [...selected],
      p_payment_date: paymentDate,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message || "Erro ao fechar mês");
      return;
    }
    toast.success("Mês fechado e entrada gerada");
    emitDataChanged();
    onDone();
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="Fechar mês do aluno">
      <div className="space-y-3">
        <p className="text-sm text-[var(--fg-muted)]">
          {formatMonthYear(year, month)} — selecione as aulas a incluir no pagamento.
        </p>

        {monthlyStudents.length === 0 ? (
          <p className="text-sm text-[var(--fg-muted)]">
            Nenhum aluno com cobrança mensal ativo.
          </p>
        ) : (
          <>
            <div>
              <Label htmlFor="close-student">Aluno</Label>
              <Select
                id="close-student"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
              >
                {monthlyStudents.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <Label htmlFor="close-date">Data do pagamento</Label>
              <Input
                id="close-date"
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
              />
            </div>

            {loading ? (
              <p className="text-sm text-[var(--fg-muted)]">Carregando aulas…</p>
            ) : lessons.length === 0 ? (
              <p className="text-sm text-[var(--fg-muted)]">
                Nenhuma aula dada pendente neste mês.
              </p>
            ) : (
              <ul className="max-h-56 space-y-1 overflow-y-auto rounded-xl border border-[var(--border)] p-2">
                {lessons.map((l) => (
                  <li key={l.id}>
                    <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-[var(--surface-2)]">
                      <input
                        type="checkbox"
                        checked={selected.has(l.id)}
                        onChange={() => toggle(l.id)}
                        className="accent-[var(--accent)]"
                      />
                      <span className="flex-1 text-sm text-[var(--fg)]">
                        {formatDateBR(l.date)}
                      </span>
                      <span className="tabular-nums text-sm text-[var(--fg-muted)]">
                        {formatCurrency(l.amount)}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            )}

            <p className="text-right text-sm text-[var(--fg)]">
              Total:{" "}
              <span className="font-semibold tabular-nums">{formatCurrency(total)}</span>
              <span className="text-[var(--fg-muted)]">
                {" "}
                ({selected.size} aula{selected.size === 1 ? "" : "s"})
              </span>
            </p>

            <Button
              className="w-full"
              disabled={saving || selected.size === 0}
              onClick={() => void handleConfirm()}
            >
              {saving ? "Confirmando…" : "Confirmar recebimento"}
            </Button>
          </>
        )}
      </div>
    </Modal>
  );
}
