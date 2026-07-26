"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { CloseMonthModal } from "@/components/CloseMonthModal";
import { useCurrency } from "@/components/CurrencyProvider";
import { DataTable, type Column } from "@/components/DataTable";
import { EmptyState } from "@/components/EmptyState";
import { LessonForm } from "@/components/LessonForm";
import { MonthNav } from "@/components/MonthNav";
import { useMonth } from "@/components/MonthProvider";
import { createClient } from "@/lib/supabase/client";
import { emitDataChanged, onDataChanged } from "@/lib/events";
import { defaultPaymentStatusForLessonStatus, lessonTotals } from "@/lib/lessons";
import { formatDateBR, monthRange, toISODate } from "@/lib/format";
import {
  LESSON_PAYMENT_STATUS_LABELS,
  LESSON_STATUS_LABELS,
  type Lesson,
  type LessonPaymentStatus,
  type LessonStatus,
  type Student,
} from "@/lib/types";

type LessonRow = Lesson & {
  students: Pick<
    Student,
    "id" | "name" | "financial_guardian" | "billing_mode" | "default_rate" | "active"
  > | null;
};

export function LessonsPanel({ incomeFilter }: { incomeFilter?: string | null }) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const { year, month, go } = useMonth();
  const { format } = useCurrency();
  const [userId, setUserId] = useState<string | null>(null);
  const [rows, setRows] = useState<LessonRow[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);

  const [customRange, setCustomRange] = useState(false);
  const [rangeStart, setRangeStart] = useState(monthRange(year, month).start);
  const [rangeEnd, setRangeEnd] = useState(monthRange(year, month).end);
  const [studentFilter, setStudentFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<LessonStatus | "all">("all");
  const [paymentFilter, setPaymentFilter] = useState<LessonPaymentStatus | "all">(
    "all",
  );

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<LessonRow | null>(null);
  const [repeatStudentId, setRepeatStudentId] = useState<string | undefined>();
  const [repeatAmount, setRepeatAmount] = useState<number | undefined>();

  const [payOpen, setPayOpen] = useState(false);
  const [payingLesson, setPayingLesson] = useState<LessonRow | null>(null);
  const [paymentDate, setPaymentDate] = useState(toISODate());
  const [paying, setPaying] = useState(false);

  const [closeOpen, setCloseOpen] = useState(false);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<LessonStatus>("given");
  const [bulkSaving, setBulkSaving] = useState(false);

  const period = useMemo(() => {
    if (customRange && rangeStart && rangeEnd) {
      return { start: rangeStart, end: rangeEnd };
    }
    return monthRange(year, month);
  }, [customRange, rangeStart, rangeEnd, year, month]);

  const load = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);

    let query = supabase
      .from("lessons")
      .select(
        "*, students(id, name, financial_guardian, billing_mode, default_rate, active)",
      )
      .eq("user_id", user.id)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false });

    if (incomeFilter) {
      query = query.eq("income_id", incomeFilter);
    } else {
      query = query.gte("date", period.start).lte("date", period.end);
    }

    const [{ data: lessons, error }, { data: stu }] = await Promise.all([
      query,
      supabase.from("students").select("*").eq("user_id", user.id).order("name"),
    ]);

    if (error) {
      toast.error("Erro ao carregar aulas");
      return;
    }
    setRows((lessons as LessonRow[]) ?? []);
    setStudents((stu as Student[]) ?? []);
    setLoading(false);
  }, [supabase, period, incomeFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => onDataChanged(() => void load()), [load]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (studentFilter && r.student_id !== studentFilter) return false;
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (paymentFilter !== "all" && r.payment_status !== paymentFilter) return false;
      return true;
    });
  }, [rows, studentFilter, statusFilter, paymentFilter]);

  const totals = useMemo(() => lessonTotals(filtered), [filtered]);

  useEffect(() => {
    setSelected((prev) => {
      const ids = new Set(filtered.map((r) => r.id));
      const next = new Set([...prev].filter((id) => ids.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [filtered]);

  const selectableRows = useMemo(
    () => filtered.filter((r) => r.payment_status !== "paid"),
    [filtered],
  );
  const allSelected =
    selectableRows.length > 0 && selectableRows.every((r) => selected.has(r.id));

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelected((prev) =>
      prev.size >= selectableRows.length && selectableRows.every((r) => prev.has(r.id))
        ? new Set()
        : new Set(selectableRows.map((r) => r.id)),
    );
  }

  function clearSelection() {
    setSelected(new Set());
  }

  async function applyBulkStatus() {
    const targets = filtered.filter((r) => selected.has(r.id));
    const blocked = targets.filter((r) => r.payment_status === "paid");
    const updatable = targets.filter((r) => r.payment_status !== "paid");

    if (updatable.length === 0) {
      toast.error("Aulas pagas não podem mudar de status. Desfaça o pagamento antes.");
      return;
    }

    setBulkSaving(true);
    const { error } = await supabase
      .from("lessons")
      .update({
        status: bulkStatus,
        payment_status: defaultPaymentStatusForLessonStatus(bulkStatus),
      })
      .in(
        "id",
        updatable.map((r) => r.id),
      );
    setBulkSaving(false);

    if (error) {
      toast.error("Erro ao atualizar status");
      return;
    }

    const suffix = blocked.length
      ? ` (${blocked.length} paga${blocked.length === 1 ? "" : "s"} ignorada${blocked.length === 1 ? "" : "s"})`
      : "";
    toast.success(
      `${updatable.length} aula${updatable.length === 1 ? "" : "s"} atualizada${updatable.length === 1 ? "" : "s"}${suffix}`,
    );
    clearSelection();
    emitDataChanged();
    await load();
  }

  function openNew() {
    setEditing(null);
    setRepeatStudentId(undefined);
    setRepeatAmount(undefined);
    setFormOpen(true);
  }

  function openEdit(row: LessonRow) {
    setEditing(row);
    setRepeatStudentId(undefined);
    setRepeatAmount(undefined);
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditing(null);
    setRepeatStudentId(undefined);
    setRepeatAmount(undefined);
  }

  async function markAsGiven(row: LessonRow) {
    if (row.status === "given") return;
    if (row.payment_status === "paid") {
      toast.error("Desfaça o pagamento antes de alterar o status");
      return;
    }
    const { error } = await supabase
      .from("lessons")
      .update({
        status: "given",
        payment_status: "pending",
      })
      .eq("id", row.id);
    if (error) {
      toast.error("Erro ao atualizar");
      return;
    }
    toast.success("Aula marcada como dada");
    emitDataChanged();
    await load();
  }

  async function handleDelete(row: LessonRow) {
    if (row.payment_status === "paid") {
      toast.error("Desfaça o pagamento antes de excluir");
      return;
    }
    if (!confirm("Excluir esta aula?")) return;
    const { error } = await supabase.from("lessons").delete().eq("id", row.id);
    if (error) {
      toast.error("Erro ao excluir");
      return;
    }
    toast.success("Aula excluída");
    emitDataChanged();
    await load();
  }

  function openPay(row: LessonRow) {
    if (row.payment_status !== "pending") return;
    if (row.students?.billing_mode === "monthly") {
      toast.error("Use “Fechar mês do aluno” para cobrança mensal");
      return;
    }
    setPayingLesson(row);
    setPaymentDate(toISODate());
    setPayOpen(true);
  }

  async function confirmPay() {
    if (!payingLesson) return;
    setPaying(true);
    const { error } = await supabase.rpc("mark_lesson_paid", {
      p_lesson_id: payingLesson.id,
      p_payment_date: paymentDate,
    });
    setPaying(false);
    if (error) {
      toast.error(error.message || "Erro ao marcar como paga");
      return;
    }
    toast.success("Pagamento registrado e entrada gerada");
    setPayOpen(false);
    setPayingLesson(null);
    emitDataChanged();
    await load();
  }

  async function undoPay(row: LessonRow) {
    if (row.payment_status !== "paid") return;
    if (
      !confirm(
        "Desfazer pagamento? A entrada vinculada em Entradas será removida.",
      )
    ) {
      return;
    }
    const { error } = await supabase.rpc("undo_lesson_payment", {
      p_lesson_id: row.id,
    });
    if (error) {
      toast.error(error.message || "Erro ao desfazer pagamento");
      return;
    }
    toast.success("Pagamento desfeito");
    emitDataChanged();
    await load();
  }

  async function repeatLastForStudent(studentId: string) {
    const { data, error } = await supabase
      .from("lessons")
      .select("student_id, amount")
      .eq("student_id", studentId)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      toast.error("Nenhuma aula anterior deste aluno");
      return;
    }

    setEditing(null);
    setRepeatStudentId(data.student_id);
    setRepeatAmount(Number(data.amount));
    setFormOpen(true);
  }

  const columns: Column<LessonRow>[] = [
    {
      key: "select",
      header: (
        <input
          type="checkbox"
          aria-label="Selecionar todas"
          checked={allSelected}
          onChange={toggleSelectAll}
          disabled={selectableRows.length === 0}
          className="accent-[var(--accent)]"
        />
      ),
      render: (r) =>
        r.payment_status === "paid" ? (
          <span className="text-[var(--fg-muted)]">—</span>
        ) : (
          <input
            type="checkbox"
            aria-label="Selecionar aula"
            checked={selected.has(r.id)}
            onChange={() => toggleSelect(r.id)}
            onClick={(e) => e.stopPropagation()}
            className="accent-[var(--accent)]"
          />
        ),
    },
    {
      key: "date",
      header: "Data",
      sortValue: (r) => r.date,
      render: (r) => (
        <span className="whitespace-nowrap tabular-nums text-[var(--fg-muted)]">
          {formatDateBR(r.date)}
        </span>
      ),
    },
    {
      key: "student",
      header: "Aluno",
      sortValue: (r) => r.students?.name ?? "",
      render: (r) => r.students?.name ?? "—",
    },
    {
      key: "guardian",
      header: "Responsável financeiro",
      sortValue: (r) => r.students?.financial_guardian ?? "",
      render: (r) => (
        <span className="text-[var(--fg-muted)]">
          {r.students?.financial_guardian || "—"}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status da aula",
      render: (r) => LESSON_STATUS_LABELS[r.status],
    },
    {
      key: "amount",
      header: "Valor",
      align: "right",
      sortValue: (r) => Number(r.amount),
      render: (r) => (
        <span className="whitespace-nowrap font-semibold tabular-nums">
          {format(r.amount)}
        </span>
      ),
    },
    {
      key: "payment",
      header: "Status de pagamento",
      render: (r) => (
        <span
          className={
            r.payment_status === "paid"
              ? "text-[var(--positive)]"
              : r.payment_status === "pending"
                ? "text-[var(--warning)]"
                : "text-[var(--fg-muted)]"
          }
        >
          {LESSON_PAYMENT_STATUS_LABELS[r.payment_status]}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (r) => (
        <div className="flex flex-wrap justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          {r.status === "scheduled" && (
            <button
              type="button"
              onClick={() => void markAsGiven(r)}
              className="rounded-lg px-2 py-1 text-xs text-[var(--accent)] hover:bg-[var(--accent-soft)]"
            >
              Dada
            </button>
          )}
          {r.payment_status === "pending" && r.students?.billing_mode === "per_class" && (
            <button
              type="button"
              onClick={() => openPay(r)}
              className="rounded-lg px-2 py-1 text-xs text-[var(--positive)] hover:bg-[var(--positive-soft)]"
            >
              Paga
            </button>
          )}
          {r.payment_status === "paid" && (
            <button
              type="button"
              onClick={() => void undoPay(r)}
              className="rounded-lg px-2 py-1 text-xs text-[var(--fg-muted)] hover:bg-[var(--surface-2)]"
            >
              Desfazer
            </button>
          )}
          <button
            type="button"
            onClick={() => void handleDelete(r)}
            className="rounded-lg px-2 py-1 text-xs text-[var(--negative)] hover:bg-[var(--negative-soft)]"
          >
            Excluir
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button variant="secondary" size="sm" onClick={() => setCloseOpen(true)}>
          Fechar mês do aluno
        </Button>
        <Button size="sm" onClick={openNew}>
          Nova aula
        </Button>
      </div>

      {incomeFilter ? (
        <div className="rounded-xl border border-[var(--accent)]/40 bg-[var(--accent)]/10 px-3 py-2 text-sm text-[var(--fg)]">
          Mostrando aulas da entrada selecionada.{" "}
          <button
            type="button"
            className="text-[var(--accent)] underline"
            onClick={() => router.replace("/aulas")}
          >
            Limpar filtro
          </button>
        </div>
      ) : null}

      <div className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 lg:p-4">
        {!incomeFilter && (
          <div className="flex flex-wrap items-center gap-2">
            {!customRange ? (
              <MonthNav year={year} month={month} onGo={go} />
            ) : (
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  value={rangeStart}
                  onChange={(e) => setRangeStart(e.target.value)}
                  className="w-auto py-1.5 text-sm"
                />
                <span className="text-xs text-[var(--fg-muted)]">até</span>
                <Input
                  type="date"
                  value={rangeEnd}
                  onChange={(e) => setRangeEnd(e.target.value)}
                  className="w-auto py-1.5 text-sm"
                />
              </div>
            )}
            <Button variant="ghost" size="sm" onClick={() => setCustomRange((v) => !v)}>
              {customRange ? "Usar mês" : "Intervalo personalizado"}
            </Button>
          </div>
        )}

        <div className="grid gap-2 sm:grid-cols-3">
          <Select
            value={studentFilter}
            onChange={(e) => setStudentFilter(e.target.value)}
            className="py-2 text-sm"
          >
            <option value="">Todos os alunos</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as LessonStatus | "all")}
            className="py-2 text-sm"
          >
            <option value="all">Todos os status</option>
            {(Object.keys(LESSON_STATUS_LABELS) as LessonStatus[]).map((s) => (
              <option key={s} value={s}>
                {LESSON_STATUS_LABELS[s]}
              </option>
            ))}
          </Select>
          <Select
            value={paymentFilter}
            onChange={(e) =>
              setPaymentFilter(e.target.value as LessonPaymentStatus | "all")
            }
            className="py-2 text-sm"
          >
            <option value="all">Todos os pagamentos</option>
            {(Object.keys(LESSON_PAYMENT_STATUS_LABELS) as LessonPaymentStatus[]).map(
              (s) => (
                <option key={s} value={s}>
                  {LESSON_PAYMENT_STATUS_LABELS[s]}
                </option>
              ),
            )}
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 text-center text-xs sm:text-sm">
        <div>
          <p className="text-[var(--fg-muted)]">Dado</p>
          <p className="font-semibold tabular-nums text-[var(--fg)]">
            {format(totals.given)}
          </p>
        </div>
        <div>
          <p className="text-[var(--fg-muted)]">A receber</p>
          <p className="font-semibold tabular-nums text-[var(--warning)]">
            {format(totals.receivable)}
          </p>
        </div>
        <div>
          <p className="text-[var(--fg-muted)]">Recebido</p>
          <p className="font-semibold tabular-nums text-[var(--positive)]">
            {format(totals.received)}
          </p>
        </div>
      </div>

      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--accent)]/40 bg-[var(--accent)]/10 px-3 py-2">
          <span className="text-sm font-medium text-[var(--fg)]">
            {selected.size} selecionada{selected.size === 1 ? "" : "s"}
          </span>
          <span className="text-sm text-[var(--fg-muted)]">alterar status para</span>
          <Select
            value={bulkStatus}
            onChange={(e) => setBulkStatus(e.target.value as LessonStatus)}
            className="w-auto py-1.5 text-sm"
          >
            {(Object.keys(LESSON_STATUS_LABELS) as LessonStatus[]).map((s) => (
              <option key={s} value={s}>
                {LESSON_STATUS_LABELS[s]}
              </option>
            ))}
          </Select>
          <Button size="sm" disabled={bulkSaving} onClick={() => void applyBulkStatus()}>
            {bulkSaving ? "Aplicando…" : "Aplicar"}
          </Button>
          <Button variant="ghost" size="sm" onClick={clearSelection}>
            Limpar seleção
          </Button>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-[var(--fg-muted)]">Carregando aulas…</p>
      ) : filtered.length === 0 ? (
        <EmptyState
          title="Nenhuma aula encontrada"
          description="Cadastre um aluno e registre a primeira aula."
        />
      ) : (
        <>
          <div className="hidden lg:block">
            <DataTable
              columns={columns}
              rows={filtered}
              rowKey={(r) => r.id}
              onRowClick={openEdit}
              initialSort={{ key: "date", dir: "desc" }}
              footer={{
                date: `${filtered.length} aula(s)`,
                amount: format(totals.receivable),
                payment: "a receber",
              }}
            />
          </div>

          {selectableRows.length > 0 && (
            <label className="flex cursor-pointer items-center gap-2 px-1 text-xs text-[var(--fg-muted)] lg:hidden">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleSelectAll}
                className="accent-[var(--accent)]"
              />
              Selecionar todas
            </label>
          )}

          <ul className="divide-y divide-[var(--border)] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] lg:hidden">
            {filtered.map((row) => (
              <li key={row.id} className="space-y-2 px-3 py-3">
                <div className="flex items-start gap-3">
                  {row.payment_status !== "paid" && (
                    <input
                      type="checkbox"
                      aria-label="Selecionar aula"
                      checked={selected.has(row.id)}
                      onChange={() => toggleSelect(row.id)}
                      className="mt-1 accent-[var(--accent)]"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[var(--fg)]">
                      {row.students?.name ?? "Aluno"}
                    </p>
                    <p className="text-xs text-[var(--fg-muted)]">
                      {formatDateBR(row.date)} · {LESSON_STATUS_LABELS[row.status]} ·{" "}
                      <span
                        className={
                          row.payment_status === "paid"
                            ? "text-[var(--positive)]"
                            : row.payment_status === "pending"
                              ? "text-[var(--warning)]"
                              : ""
                        }
                      >
                        {LESSON_PAYMENT_STATUS_LABELS[row.payment_status]}
                      </span>
                    </p>
                    {row.students?.financial_guardian ? (
                      <p className="text-xs text-[var(--fg-muted)]">
                        Resp.: {row.students.financial_guardian}
                      </p>
                    ) : null}
                  </div>
                  <p className="tabular-nums text-sm font-semibold text-[var(--fg)]">
                    {format(row.amount)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1">
                  {row.status === "scheduled" && (
                    <button
                      type="button"
                      onClick={() => void markAsGiven(row)}
                      className="rounded-lg px-2 py-1 text-xs text-[var(--accent)] hover:bg-[var(--accent-soft)]"
                    >
                      Marcar como dada
                    </button>
                  )}
                  {row.payment_status === "pending" &&
                    row.students?.billing_mode === "per_class" && (
                      <button
                        type="button"
                        onClick={() => openPay(row)}
                        className="rounded-lg px-2 py-1 text-xs text-[var(--positive)] hover:bg-[var(--positive-soft)]"
                      >
                        Marcar como paga
                      </button>
                    )}
                  {row.payment_status === "paid" && (
                    <button
                      type="button"
                      onClick={() => void undoPay(row)}
                      className="rounded-lg px-2 py-1 text-xs text-[var(--fg-muted)] hover:bg-[var(--surface-2)]"
                    >
                      Desfazer pagamento
                    </button>
                  )}
                  {row.students && (
                    <button
                      type="button"
                      onClick={() => void repeatLastForStudent(row.student_id)}
                      className="rounded-lg px-2 py-1 text-xs text-[var(--fg-muted)] hover:bg-[var(--surface-2)]"
                    >
                      Repetir última
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => openEdit(row)}
                    className="rounded-lg px-2 py-1 text-xs text-[var(--fg-muted)] hover:bg-[var(--surface-2)]"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDelete(row)}
                    className="rounded-lg px-2 py-1 text-xs text-[var(--negative)] hover:bg-[var(--negative-soft)]"
                  >
                    Excluir
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {students.some((s) => s.active) && (
        <div className="hidden lg:flex flex-wrap gap-2">
          <span className="text-xs text-[var(--fg-muted)] self-center">
            Repetir última aula:
          </span>
          {students
            .filter((s) => s.active)
            .map((s) => (
              <Button
                key={s.id}
                variant="ghost"
                size="sm"
                onClick={() => void repeatLastForStudent(s.id)}
              >
                {s.name}
              </Button>
            ))}
        </div>
      )}

      <Modal
        open={formOpen}
        onClose={closeForm}
        title={editing ? "Editar aula" : "Nova aula"}
      >
        <LessonForm
          userId={userId}
          students={students}
          editing={editing}
          initialStudentId={repeatStudentId}
          initialAmount={repeatAmount}
          onSaved={async () => {
            closeForm();
            await load();
          }}
        />
      </Modal>

      <Modal
        open={payOpen}
        onClose={() => {
          setPayOpen(false);
          setPayingLesson(null);
        }}
        title="Marcar como paga"
      >
        <div className="space-y-3">
          {payingLesson && (
            <p className="text-sm text-[var(--fg-muted)]">
              {payingLesson.students?.name} · {format(payingLesson.amount)}
            </p>
          )}
          <div>
            <Label htmlFor="pay-date">Data do pagamento</Label>
            <Input
              id="pay-date"
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
            />
          </div>
          <Button className="w-full" disabled={paying} onClick={() => void confirmPay()}>
            {paying ? "Confirmando…" : "Confirmar recebimento"}
          </Button>
        </div>
      </Modal>

      <CloseMonthModal
        open={closeOpen}
        onClose={() => setCloseOpen(false)}
        students={students}
        year={year}
        month={month}
        onDone={() => void load()}
      />
    </div>
  );
}
