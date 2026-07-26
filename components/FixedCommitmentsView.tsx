"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { DataTable, type Column } from "@/components/DataTable";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { createClient } from "@/lib/supabase/client";
import { payoffLabel, remainingAmount, remainingInstallments } from "@/lib/debts";
import { formatCurrency, parseAmountInput, toISODate } from "@/lib/format";
import type { Debt, FixedCost } from "@/lib/types";

export function FixedCommitmentsView() {
  const supabase = useMemo(() => createClient(), []);
  const [userId, setUserId] = useState<string | null>(null);
  const [fixedCosts, setFixedCosts] = useState<FixedCost[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [loading, setLoading] = useState(true);

  const [fixedFormOpen, setFixedFormOpen] = useState(false);
  const [editingFixed, setEditingFixed] = useState<FixedCost | null>(null);
  const [debtFormOpen, setDebtFormOpen] = useState(false);
  const [editingDebt, setEditingDebt] = useState<Debt | null>(null);

  const load = useCallback(
    async (uid: string) => {
      const [{ data: fixed }, { data: debtRows }] = await Promise.all([
        supabase.from("fixed_costs").select("*").eq("user_id", uid).order("name"),
        supabase
          .from("debts")
          .select("*")
          .eq("user_id", uid)
          .order("active", { ascending: false })
          .order("name"),
      ]);
      setFixedCosts((fixed as FixedCost[]) ?? []);
      setDebts((debtRows as Debt[]) ?? []);
      setLoading(false);
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
      await load(user.id);
    }
    void init();
  }, [supabase, load]);

  const totalActive = fixedCosts
    .filter((i) => i.active)
    .reduce((s, i) => s + Number(i.amount), 0);
  const monthlyInstallments = debts
    .filter((d) => d.active)
    .reduce((s, d) => s + Number(d.installment_amount), 0);

  // ----- Custos fixos -----

  async function toggleActive(item: FixedCost) {
    if (!userId) return;
    const { error } = await supabase
      .from("fixed_costs")
      .update({ active: !item.active })
      .eq("id", item.id);
    if (error) {
      toast.error("Erro ao atualizar");
      return;
    }
    toast.success(item.active ? "Custo pausado" : "Custo ativado");
    await load(userId);
  }

  async function deleteFixed(id: string) {
    if (!userId || !confirm("Excluir custo fixo?")) return;
    const { error } = await supabase.from("fixed_costs").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao excluir");
      return;
    }
    toast.success("Excluído");
    await load(userId);
  }

  // ----- Parcelamentos -----

  async function markPaid(debt: Debt) {
    if (!userId) return;
    if (debt.paid_installments >= debt.total_installments) return;
    const next = debt.paid_installments + 1;
    const { error } = await supabase
      .from("debts")
      .update({
        paid_installments: next,
        active: next < debt.total_installments,
      })
      .eq("id", debt.id);
    if (error) {
      toast.error("Erro ao marcar parcela");
      return;
    }
    toast.success("Parcela marcada");
    await load(userId);
  }

  async function deleteDebt(id: string) {
    if (!userId || !confirm("Excluir parcelamento?")) return;
    const { error } = await supabase.from("debts").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao excluir");
      return;
    }
    toast.success("Excluído");
    await load(userId);
  }

  const fixedColumns: Column<FixedCost>[] = [
    {
      key: "name",
      header: "Nome",
      sortValue: (r) => r.name,
      render: (r) => (
        <span className={`font-medium ${!r.active ? "opacity-50" : ""}`}>{r.name}</span>
      ),
    },
    {
      key: "category",
      header: "Categoria",
      render: (r) =>
        r.category ? r.category : <span className="text-[var(--fg-muted)]">—</span>,
    },
    {
      key: "due_day",
      header: "Vencimento",
      sortValue: (r) => r.due_day,
      render: (r) => <span className="tabular-nums">Dia {r.due_day}</span>,
    },
    {
      key: "status",
      header: "Status",
      render: (r) => (
        <span
          className={`rounded-lg px-2 py-0.5 text-xs ${
            r.active
              ? "bg-emerald-500/15 text-emerald-400"
              : "bg-[var(--surface-2)] text-[var(--fg-muted)]"
          }`}
        >
          {r.active ? "ativo" : "pausado"}
        </span>
      ),
    },
    {
      key: "amount",
      header: "Valor",
      align: "right",
      sortValue: (r) => Number(r.amount),
      render: (r) => (
        <span className="whitespace-nowrap font-semibold tabular-nums">
          {formatCurrency(r.amount)}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (r) => (
        <span className="flex justify-end gap-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              void toggleActive(r);
            }}
            className="rounded-lg px-2 py-1 text-xs text-[var(--fg-muted)] transition hover:bg-[var(--surface-2)]"
          >
            {r.active ? "Pausar" : "Ativar"}
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              void deleteFixed(r.id);
            }}
            className="rounded-lg px-2 py-1 text-xs text-red-400 transition hover:bg-red-500/10"
          >
            Excluir
          </button>
        </span>
      ),
    },
  ];

  const debtColumns: Column<Debt>[] = [
    {
      key: "name",
      header: "Nome",
      sortValue: (r) => r.name,
      render: (r) => (
        <span className={`font-medium ${!r.active ? "opacity-50" : ""}`}>{r.name}</span>
      ),
    },
    {
      key: "progress",
      header: "Progresso",
      sortValue: (r) => r.paid_installments / r.total_installments,
      render: (r) => {
        const pct = (r.paid_installments / r.total_installments) * 100;
        return (
          <span className="flex min-w-40 items-center gap-2">
            <span className="whitespace-nowrap tabular-nums text-xs text-[var(--fg-muted)]">
              {r.paid_installments}/{r.total_installments}
            </span>
            <span className="h-1.5 w-24 overflow-hidden rounded-full bg-[var(--surface-2)]">
              <span
                className="block h-full bg-[var(--accent)]"
                style={{ width: `${pct}%` }}
              />
            </span>
          </span>
        );
      },
    },
    {
      key: "installment",
      header: "Parcela",
      align: "right",
      sortValue: (r) => Number(r.installment_amount),
      render: (r) => (
        <span className="whitespace-nowrap tabular-nums">
          {formatCurrency(r.installment_amount)}/mês
        </span>
      ),
    },
    {
      key: "remaining",
      header: "Restante",
      align: "right",
      sortValue: (r) => remainingAmount(r),
      render: (r) => (
        <span className="whitespace-nowrap tabular-nums text-[var(--fg-muted)]">
          {formatCurrency(remainingAmount(r))} ({remainingInstallments(r)}×)
        </span>
      ),
    },
    {
      key: "payoff",
      header: "Quitação",
      render: (r) => <span className="whitespace-nowrap">{payoffLabel(r)}</span>,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (r) => (
        <span className="flex justify-end gap-1">
          {r.active && r.paid_installments < r.total_installments && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                void markPaid(r);
              }}
              className="whitespace-nowrap rounded-lg px-2 py-1 text-xs text-[var(--accent)] transition hover:bg-[var(--surface-2)]"
            >
              Parcela paga
            </button>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              void deleteDebt(r.id);
            }}
            className="rounded-lg px-2 py-1 text-xs text-red-400 transition hover:bg-red-500/10"
          >
            Excluir
          </button>
        </span>
      ),
    },
  ];

  if (loading) {
    return <p className="text-sm text-[var(--fg-muted)]">Carregando…</p>;
  }

  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <PageHeader
          title="Custos fixos"
          subtitle={`Total ativo: ${formatCurrency(totalActive)}`}
          action={
            <Button
              size="sm"
              onClick={() => {
                setEditingFixed(null);
                setFixedFormOpen(true);
              }}
            >
              Novo custo fixo
            </Button>
          }
        />

        {fixedCosts.length === 0 ? (
          <EmptyState title="Sem custos fixos" description="Aluguel, internet, academia…" />
        ) : (
          <>
            <div className="hidden lg:block">
              <DataTable
                columns={fixedColumns}
                rows={fixedCosts}
                rowKey={(r) => r.id}
                onRowClick={(r) => {
                  setEditingFixed(r);
                  setFixedFormOpen(true);
                }}
                footer={{
                  name: `${fixedCosts.length} custo(s)`,
                  amount: formatCurrency(totalActive),
                }}
              />
            </div>

            <ul className="divide-y divide-[var(--border)] rounded-2xl border border-[var(--border)] bg-[var(--surface)] lg:hidden">
              {fixedCosts.map((item) => (
                <li
                  key={item.id}
                  className={`flex items-center gap-3 px-3 py-3 ${!item.active ? "opacity-50" : ""}`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[var(--fg)]">{item.name}</p>
                    <p className="text-xs text-[var(--fg-muted)]">
                      Dia {item.due_day}
                      {item.category ? ` · ${item.category}` : ""}
                    </p>
                  </div>
                  <p className="tabular-nums text-sm font-semibold">{formatCurrency(item.amount)}</p>
                  <button
                    type="button"
                    className="rounded-lg px-2 py-1 text-xs text-[var(--fg-muted)] hover:bg-[var(--surface-2)]"
                    onClick={() => void toggleActive(item)}
                  >
                    {item.active ? "Pausar" : "Ativar"}
                  </button>
                  <button
                    type="button"
                    className="rounded-lg px-2 py-1 text-xs text-[var(--fg-muted)] hover:bg-[var(--surface-2)]"
                    onClick={() => {
                      setEditingFixed(item);
                      setFixedFormOpen(true);
                    }}
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    className="rounded-lg px-2 py-1 text-xs text-red-400 hover:bg-red-500/10"
                    onClick={() => void deleteFixed(item.id)}
                  >
                    Excluir
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section className="space-y-4">
        <PageHeader
          title="Parcelamentos"
          subtitle={`Comprometido mensal: ${formatCurrency(monthlyInstallments)}`}
          action={
            <Button
              size="sm"
              onClick={() => {
                setEditingDebt(null);
                setDebtFormOpen(true);
              }}
            >
              Novo parcelamento
            </Button>
          }
        />

        {debts.length === 0 ? (
          <EmptyState
            title="Sem parcelamentos"
            description="Cadastre um financiamento ou compra parcelada."
          />
        ) : (
          <>
            <div className="hidden lg:block">
              <DataTable
                columns={debtColumns}
                rows={debts}
                rowKey={(r) => r.id}
                onRowClick={(r) => {
                  setEditingDebt(r);
                  setDebtFormOpen(true);
                }}
                footer={{
                  name: `${debts.length} parcelamento(s)`,
                  installment: formatCurrency(monthlyInstallments),
                }}
              />
            </div>

            <ul className="space-y-3 lg:hidden">
              {debts.map((debt) => {
                const paid = debt.paid_installments;
                const total = debt.total_installments;
                const pct = (paid / total) * 100;
                return (
                  <li
                    key={debt.id}
                    className={`rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 ${!debt.active ? "opacity-50" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-[var(--fg)]">{debt.name}</p>
                        <p className="text-xs text-[var(--fg-muted)]">
                          {paid}/{total} parcelas — {payoffLabel(debt)}
                        </p>
                        <p className="mt-1 text-xs text-[var(--fg-muted)]">
                          Restante: {formatCurrency(remainingAmount(debt))} (
                          {remainingInstallments(debt)}× {formatCurrency(debt.installment_amount)})
                        </p>
                      </div>
                      <p className="tabular-nums text-sm font-semibold">
                        {formatCurrency(debt.installment_amount)}/mês
                      </p>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--surface-2)]">
                      <div className="h-full bg-[var(--accent)]" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {debt.active && paid < total && (
                        <Button size="sm" variant="secondary" onClick={() => void markPaid(debt)}>
                          Marcar parcela paga
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditingDebt(debt);
                          setDebtFormOpen(true);
                        }}
                      >
                        Editar
                      </Button>
                      <Button size="sm" variant="danger" onClick={() => void deleteDebt(debt.id)}>
                        Excluir
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </section>

      <Modal
        open={fixedFormOpen}
        onClose={() => {
          setFixedFormOpen(false);
          setEditingFixed(null);
        }}
        title={editingFixed ? "Editar custo fixo" : "Novo custo fixo"}
      >
        <FixedCostForm
          userId={userId}
          editing={editingFixed}
          onSaved={async () => {
            setFixedFormOpen(false);
            setEditingFixed(null);
            if (userId) await load(userId);
          }}
        />
      </Modal>

      <Modal
        open={debtFormOpen}
        onClose={() => {
          setDebtFormOpen(false);
          setEditingDebt(null);
        }}
        title={editingDebt ? "Editar parcelamento" : "Novo parcelamento"}
      >
        <DebtForm
          userId={userId}
          editing={editingDebt}
          onSaved={async () => {
            setDebtFormOpen(false);
            setEditingDebt(null);
            if (userId) await load(userId);
          }}
        />
      </Modal>
    </div>
  );
}

function FixedCostForm({
  userId,
  editing,
  onSaved,
}: {
  userId: string | null;
  editing: FixedCost | null;
  onSaved: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDay, setDueDay] = useState("10");
  const [category, setCategory] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editing) return;
    setName(editing.name);
    setAmount(String(editing.amount).replace(".", ","));
    setDueDay(String(editing.due_day));
    setCategory(editing.category);
  }, [editing]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;
    const value = parseAmountInput(amount);
    const day = Number(dueDay);
    if (value === null || day < 1 || day > 31) {
      toast.error("Dados inválidos");
      return;
    }
    setSaving(true);
    const payload = {
      user_id: userId,
      name: name.trim(),
      amount: value,
      due_day: day,
      category: category.trim(),
      active: editing?.active ?? true,
    };
    const { error } = editing
      ? await supabase.from("fixed_costs").update(payload).eq("id", editing.id)
      : await supabase.from("fixed_costs").insert(payload);
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar");
      return;
    }
    toast.success(editing ? "Custo atualizado" : "Custo adicionado");
    onSaved();
  }

  return (
    <form onSubmit={handleSave} className="space-y-3">
      <div>
        <Label htmlFor="fc-name">Nome</Label>
        <Input id="fc-name" value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="fc-amount">Valor</Label>
          <Input
            id="fc-amount"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
        </div>
        <div>
          <Label htmlFor="fc-day">Dia do vencimento</Label>
          <Input
            id="fc-day"
            type="number"
            min={1}
            max={31}
            value={dueDay}
            onChange={(e) => setDueDay(e.target.value)}
            required
          />
        </div>
      </div>
      <div>
        <Label htmlFor="fc-cat">Categoria (livre)</Label>
        <Input
          id="fc-cat"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="Moradia, internet…"
        />
      </div>
      <Button type="submit" className="w-full" disabled={saving}>
        {saving ? "Salvando…" : editing ? "Atualizar custo" : "Adicionar custo"}
      </Button>
    </form>
  );
}

function DebtForm({
  userId,
  editing,
  onSaved,
}: {
  userId: string | null;
  editing: Debt | null;
  onSaved: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [name, setName] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [installmentAmount, setInstallmentAmount] = useState("");
  const [totalInstallments, setTotalInstallments] = useState("");
  const [paidInstallments, setPaidInstallments] = useState("0");
  const [firstDueDate, setFirstDueDate] = useState(toISODate());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editing) return;
    setName(editing.name);
    setTotalAmount(String(editing.total_amount).replace(".", ","));
    setInstallmentAmount(String(editing.installment_amount).replace(".", ","));
    setTotalInstallments(String(editing.total_installments));
    setPaidInstallments(String(editing.paid_installments));
    setFirstDueDate(editing.first_due_date);
  }, [editing]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;
    const total = parseAmountInput(totalAmount);
    const installment = parseAmountInput(installmentAmount);
    const n = Number(totalInstallments);
    const paid = Number(paidInstallments);
    if (total === null || installment === null || n < 1 || paid < 0 || paid > n) {
      toast.error("Dados inválidos");
      return;
    }
    setSaving(true);
    const payload = {
      user_id: userId,
      name: name.trim(),
      total_amount: total,
      installment_amount: installment,
      total_installments: n,
      paid_installments: paid,
      first_due_date: firstDueDate,
      active: editing?.active ?? true,
    };
    const { error } = editing
      ? await supabase.from("debts").update(payload).eq("id", editing.id)
      : await supabase.from("debts").insert(payload);
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar");
      return;
    }
    toast.success(editing ? "Parcelamento atualizado" : "Parcelamento adicionado");
    onSaved();
  }

  return (
    <form onSubmit={handleSave} className="space-y-3">
      <div>
        <Label htmlFor="d-name">Nome</Label>
        <Input id="d-name" value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="d-total">Valor total</Label>
          <Input
            id="d-total"
            inputMode="decimal"
            value={totalAmount}
            onChange={(e) => setTotalAmount(e.target.value)}
            required
          />
        </div>
        <div>
          <Label htmlFor="d-inst">Valor da parcela</Label>
          <Input
            id="d-inst"
            inputMode="decimal"
            value={installmentAmount}
            onChange={(e) => setInstallmentAmount(e.target.value)}
            required
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="d-n">Nº de parcelas</Label>
          <Input
            id="d-n"
            type="number"
            min={1}
            value={totalInstallments}
            onChange={(e) => setTotalInstallments(e.target.value)}
            required
          />
        </div>
        <div>
          <Label htmlFor="d-paid">Já pagas</Label>
          <Input
            id="d-paid"
            type="number"
            min={0}
            value={paidInstallments}
            onChange={(e) => setPaidInstallments(e.target.value)}
          />
        </div>
      </div>
      <div>
        <Label htmlFor="d-first">1ª parcela</Label>
        <Input
          id="d-first"
          type="date"
          value={firstDueDate}
          onChange={(e) => setFirstDueDate(e.target.value)}
          required
        />
      </div>
      <Button type="submit" className="w-full" disabled={saving}>
        {saving ? "Salvando…" : editing ? "Atualizar parcelamento" : "Adicionar parcelamento"}
      </Button>
    </form>
  );
}
