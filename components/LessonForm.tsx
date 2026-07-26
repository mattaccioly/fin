"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select } from "@/components/ui/Input";
import { createClient } from "@/lib/supabase/client";
import { emitDataChanged } from "@/lib/events";
import { defaultPaymentStatusForLessonStatus } from "@/lib/lessons";
import { parseAmountInput, toISODate } from "@/lib/format";
import {
  LESSON_STATUS_LABELS,
  type Lesson,
  type LessonStatus,
  type Student,
} from "@/lib/types";

type LessonRow = Lesson & {
  students: Pick<
    Student,
    "id" | "name" | "financial_guardian" | "billing_mode" | "default_rate" | "active"
  > | null;
};

export function LessonForm({
  userId,
  students,
  editing,
  initialStudentId,
  initialAmount,
  onSaved,
}: {
  userId: string | null;
  students: Student[];
  editing: LessonRow | null;
  initialStudentId?: string;
  initialAmount?: number;
  onSaved: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const activeStudents = students.filter((s) => s.active || s.id === editing?.student_id);

  const [date, setDate] = useState(toISODate());
  const [studentId, setStudentId] = useState("");
  const [status, setStatus] = useState<LessonStatus>("given");
  const [amount, setAmount] = useState("");
  const [billAnyway, setBillAnyway] = useState(false);
  const [saving, setSaving] = useState(false);

  const isCancelledOrRescheduled =
    status === "cancelled_by_student" ||
    status === "cancelled_by_me" ||
    status === "rescheduled";

  useEffect(() => {
    if (editing) {
      setDate(editing.date);
      setStudentId(editing.student_id);
      setStatus(editing.status);
      setAmount(String(editing.amount).replace(".", ","));
      setBillAnyway(
        editing.payment_status === "pending" && isCancelledStatus(editing.status),
      );
      return;
    }
    setDate(toISODate());
    setStatus("given");
    setBillAnyway(false);
    if (initialStudentId) {
      setStudentId(initialStudentId);
      const stu = students.find((s) => s.id === initialStudentId);
      const rate = initialAmount ?? stu?.default_rate;
      setAmount(rate != null ? String(rate).replace(".", ",") : "");
      return;
    }
    const first = students.find((s) => s.active) ?? students[0];
    setStudentId(first?.id ?? "");
    setAmount(first ? String(first.default_rate).replace(".", ",") : "");
  }, [editing, initialStudentId, initialAmount, students]);

  function onStudentChange(id: string) {
    setStudentId(id);
    if (editing) return;
    const stu = students.find((s) => s.id === id);
    if (stu) setAmount(String(stu.default_rate).replace(".", ","));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;
    if (!studentId) {
      toast.error("Selecione um aluno");
      return;
    }
    const value = parseAmountInput(amount);
    if (value === null) {
      toast.error("Valor inválido");
      return;
    }

    if (editing?.payment_status === "paid") {
      toast.error("Desfaça o pagamento antes de editar esta aula");
      return;
    }

    let paymentStatus = defaultPaymentStatusForLessonStatus(status);
    if (isCancelledOrRescheduled && billAnyway) {
      paymentStatus = "pending";
    }

    setSaving(true);
    const payload = {
      user_id: userId,
      date,
      student_id: studentId,
      status,
      amount: value,
      payment_status: paymentStatus,
    };

    const { error } = editing
      ? await supabase.from("lessons").update(payload).eq("id", editing.id)
      : await supabase.from("lessons").insert(payload);

    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar aula");
      return;
    }
    toast.success(editing ? "Aula atualizada" : "Aula registrada");
    emitDataChanged();
    onSaved();
  }

  return (
    <form onSubmit={handleSave} className="space-y-3">
      <div>
        <Label htmlFor="les-date">Data</Label>
        <Input
          id="les-date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
        />
      </div>
      <div>
        <Label htmlFor="les-student">Aluno</Label>
        <Select
          id="les-student"
          value={studentId}
          onChange={(e) => onStudentChange(e.target.value)}
          required
        >
          {activeStudents.length === 0 ? (
            <option value="">Cadastre um aluno primeiro</option>
          ) : (
            activeStudents.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))
          )}
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="les-status">Status</Label>
          <Select
            id="les-status"
            value={status}
            onChange={(e) => setStatus(e.target.value as LessonStatus)}
          >
            {(Object.keys(LESSON_STATUS_LABELS) as LessonStatus[]).map((s) => (
              <option key={s} value={s}>
                {LESSON_STATUS_LABELS[s]}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="les-amount">Valor</Label>
          <Input
            id="les-amount"
            inputMode="decimal"
            placeholder="0,00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
        </div>
      </div>
      {isCancelledOrRescheduled && (
        <label className="flex items-center gap-2 text-sm text-[var(--fg-muted)]">
          <input
            type="checkbox"
            checked={billAnyway}
            onChange={(e) => setBillAnyway(e.target.checked)}
            className="accent-[var(--accent)]"
          />
          Cobrar mesmo assim
        </label>
      )}
      <Button type="submit" className="w-full" disabled={saving || !studentId}>
        {saving ? "Salvando…" : editing ? "Atualizar aula" : "Registrar aula"}
      </Button>
    </form>
  );
}

function isCancelledStatus(status: LessonStatus): boolean {
  return (
    status === "cancelled_by_student" ||
    status === "cancelled_by_me" ||
    status === "rescheduled"
  );
}
