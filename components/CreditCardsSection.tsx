"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { DataTable, type Column } from "@/components/DataTable";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { MonthNav } from "@/components/MonthNav";
import { useMonth } from "@/components/MonthProvider";
import { useCurrency, useRowRates } from "@/components/CurrencyProvider";
import { createClient } from "@/lib/supabase/client";
import { emitDataChanged } from "@/lib/events";
import { monthRange, addMonths, parseAmountInput, toISODate } from "@/lib/format";
import type { CreditCard, CreditCardBill, Expense } from "@/lib/types";

type CardRow = {
  card: CreditCard;
  bill: CreditCardBill | null;
  /** Sum of credit expenses inside the card's billing cycle (reconciliation hint). */
  creditSpent: number;
};

/**
 * Billing cycle for the bill of (year, month): from the day after the previous
 * closing to the closing day in that month. Without a closing day, the calendar
 * month is used as an approximation.
 */
function cycleRange(
  card: CreditCard,
  year: number,
  month: number,
): { start: string; end: string } {
  if (!card.closing_day) return monthRange(year, month);
  const clampDay = (y: number, m: number, day: number) =>
    Math.min(day, new Date(y, m, 0).getDate());
  const prev = addMonths(year, month, -1);
  const endDay = clampDay(year, month, card.closing_day);
  const prevDay = clampDay(prev.year, prev.month, card.closing_day);
  const start = toISODate(new Date(prev.year, prev.month - 1, prevDay + 1));
  const end = toISODate(new Date(year, month - 1, endDay));
  return { start, end };
}

export function CreditCardsSection() {
  const supabase = useMemo(() => createClient(), []);
  const { year, month, go } = useMonth();
  const { format, sum } = useCurrency();
  const [userId, setUserId] = useState<string | null>(null);
  const [cards, setCards] = useState<CreditCard[]>([]);
  const [bills, setBills] = useState<CreditCardBill[]>([]);
  const [creditExpenses, setCreditExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  const [cardFormOpen, setCardFormOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<CreditCard | null>(null);
  const [billFormOpen, setBillFormOpen] = useState(false);
  const [billTarget, setBillTarget] = useState<CardRow | null>(null);

  const load = useCallback(
    async (uid: string) => {
      // Credit expenses since the previous month cover any cycle window.
      const prev = addMonths(year, month, -1);
      const { start } = monthRange(prev.year, prev.month);
      const { end } = monthRange(year, month);
      const [{ data: cardRows }, { data: billRows }, { data: expenseRows }] =
        await Promise.all([
          supabase
            .from("credit_cards")
            .select("*")
            .eq("user_id", uid)
            .order("active", { ascending: false })
            .order("name"),
          supabase
            .from("credit_card_bills")
            .select("*")
            .eq("user_id", uid)
            .eq("year", year)
            .eq("month", month),
          supabase
            .from("expenses")
            .select("*")
            .eq("user_id", uid)
            .eq("payment_method", "credit")
            .gte("date", start)
            .lte("date", end),
        ]);
      setCards((cardRows as CreditCard[]) ?? []);
      setBills((billRows as CreditCardBill[]) ?? []);
      setCreditExpenses((expenseRows as Expense[]) ?? []);
      setLoading(false);
    },
    [supabase, year, month],
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

  useRowRates(creditExpenses);

  const rows = useMemo<CardRow[]>(
    () =>
      cards.map((card) => {
        const { start, end } = cycleRange(card, year, month);
        const inCycle = creditExpenses.filter((e) => e.date >= start && e.date <= end);
        return {
          card,
          bill: bills.find((b) => b.credit_card_id === card.id) ?? null,
          creditSpent: sum(inCycle).total,
        };
      }),
    [cards, bills, creditExpenses, year, month, sum],
  );

  const monthTotal = rows.reduce((s, r) => s + Number(r.bill?.amount ?? 0), 0);

  async function togglePaid(row: CardRow) {
    if (!userId || !row.bill) return;
    const { error } = await supabase
      .from("credit_card_bills")
      .update({ paid: !row.bill.paid })
      .eq("id", row.bill.id);
    if (error) {
      toast.error("Erro ao atualizar");
      return;
    }
    toast.success(row.bill.paid ? "Fatura reaberta" : "Fatura marcada como paga");
    await load(userId);
    emitDataChanged();
  }

  async function toggleCardActive(card: CreditCard) {
    if (!userId) return;
    const { error } = await supabase
      .from("credit_cards")
      .update({ active: !card.active })
      .eq("id", card.id);
    if (error) {
      toast.error("Erro ao atualizar");
      return;
    }
    toast.success(card.active ? "Cartão pausado" : "Cartão ativado");
    await load(userId);
  }

  async function deleteCard(card: CreditCard) {
    if (!userId || !confirm("Excluir cartão e todas as faturas dele?")) return;
    const { error } = await supabase.from("credit_cards").delete().eq("id", card.id);
    if (error) {
      toast.error("Erro ao excluir");
      return;
    }
    toast.success("Cartão excluído");
    await load(userId);
    emitDataChanged();
  }

  function openBillForm(row: CardRow) {
    setBillTarget(row);
    setBillFormOpen(true);
  }

  function cardLabel(card: CreditCard) {
    return card.last4 ? `${card.name} •••• ${card.last4}` : card.name;
  }

  function reconciliationCell(row: CardRow) {
    if (row.creditSpent === 0 && !row.bill) {
      return <span className="text-[var(--fg-muted)]">—</span>;
    }
    const diff = row.bill ? Number(row.bill.amount) - row.creditSpent : null;
    const matches = diff !== null && Math.abs(diff) < 0.005;
    return (
      <span className="whitespace-nowrap tabular-nums text-xs text-[var(--fg-muted)]">
        {format(row.creditSpent)}
        {diff !== null && !matches && (
          <span className="ml-1 text-[var(--warning)]">
            (Δ {format(Math.abs(diff))})
          </span>
        )}
        {matches && <span className="ml-1 text-[var(--positive)]">✓</span>}
      </span>
    );
  }

  const columns: Column<CardRow>[] = [
    {
      key: "name",
      header: "Cartão",
      sortValue: (r) => r.card.name,
      render: (r) => (
        <span className={`font-medium ${!r.card.active ? "opacity-50" : ""}`}>
          {cardLabel(r.card)}
        </span>
      ),
    },
    {
      key: "due_day",
      header: "Vencimento",
      sortValue: (r) => r.card.due_day,
      render: (r) => <span className="tabular-nums">Dia {r.card.due_day}</span>,
    },
    {
      key: "amount",
      header: "Fatura",
      align: "right",
      sortValue: (r) => Number(r.bill?.amount ?? 0),
      render: (r) =>
        r.bill ? (
          <span className="whitespace-nowrap font-semibold tabular-nums">
            {format(r.bill.amount)}
          </span>
        ) : (
          <span className="text-[var(--fg-muted)]">—</span>
        ),
    },
    {
      key: "credit_spent",
      header: "Crédito no app",
      align: "right",
      render: reconciliationCell,
    },
    {
      key: "status",
      header: "Status",
      render: (r) =>
        r.bill ? (
          <span
            className={`rounded-lg px-2 py-0.5 text-xs ${
              r.bill.paid
                ? "bg-[var(--positive-soft)] text-[var(--positive)]"
                : "bg-[var(--surface-2)] text-[var(--fg-muted)]"
            }`}
          >
            {r.bill.paid ? "paga" : "em aberto"}
          </span>
        ) : (
          <span className="rounded-lg bg-[var(--surface-2)] px-2 py-0.5 text-xs text-[var(--fg-muted)]">
            sem fatura
          </span>
        ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (r) => (
        <span className="flex justify-end gap-1">
          {r.bill && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                void togglePaid(r);
              }}
              className="whitespace-nowrap rounded-lg px-2 py-1 text-xs text-[var(--accent)] transition hover:bg-[var(--surface-2)]"
            >
              {r.bill.paid ? "Reabrir" : "Marcar paga"}
            </button>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setEditingCard(r.card);
              setCardFormOpen(true);
            }}
            className="rounded-lg px-2 py-1 text-xs text-[var(--fg-muted)] transition hover:bg-[var(--surface-2)]"
          >
            Cartão
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              void toggleCardActive(r.card);
            }}
            className="rounded-lg px-2 py-1 text-xs text-[var(--fg-muted)] transition hover:bg-[var(--surface-2)]"
          >
            {r.card.active ? "Pausar" : "Ativar"}
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              void deleteCard(r.card);
            }}
            className="rounded-lg px-2 py-1 text-xs text-[var(--negative)] transition hover:bg-[var(--negative-soft)]"
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
    <section className="space-y-4">
      <PageHeader
        title="Faturas de cartão"
        subtitle={`Total do mês: ${format(monthTotal)}`}
        action={
          <div className="flex items-center gap-2">
            <MonthNav year={year} month={month} onGo={go} />
            <Button
              size="sm"
              onClick={() => {
                setEditingCard(null);
                setCardFormOpen(true);
              }}
            >
              Novo cartão
            </Button>
          </div>
        }
      />

      {cards.length === 0 ? (
        <EmptyState
          title="Sem cartões cadastrados"
          description="Cadastre o cartão para lançar a fatura de cada mês."
        />
      ) : (
        <>
          <div className="hidden lg:block">
            <DataTable
              columns={columns}
              rows={rows}
              rowKey={(r) => r.card.id}
              onRowClick={openBillForm}
              footer={{
                name: `${cards.length} cartão(ões)`,
                amount: format(monthTotal),
              }}
            />
          </div>

          <ul className="space-y-3 lg:hidden">
            {rows.map((row) => (
              <li
                key={row.card.id}
                className={`rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 ${!row.card.active ? "opacity-50" : ""}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-[var(--fg)]">{cardLabel(row.card)}</p>
                    <p className="text-xs text-[var(--fg-muted)]">
                      Vence dia {row.card.due_day}
                      {row.bill ? (row.bill.paid ? " · paga" : " · em aberto") : " · sem fatura"}
                    </p>
                    <p className="mt-1 text-xs text-[var(--fg-muted)]">
                      Crédito no app: {reconciliationCell(row)}
                    </p>
                  </div>
                  <p className="tabular-nums text-sm font-semibold">
                    {row.bill ? format(row.bill.amount) : "—"}
                  </p>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" onClick={() => openBillForm(row)}>
                    {row.bill ? "Editar fatura" : "Lançar fatura"}
                  </Button>
                  {row.bill && (
                    <Button size="sm" variant="ghost" onClick={() => void togglePaid(row)}>
                      {row.bill.paid ? "Reabrir" : "Marcar paga"}
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setEditingCard(row.card);
                      setCardFormOpen(true);
                    }}
                  >
                    Editar cartão
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => void deleteCard(row.card)}>
                    Excluir
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      <Modal
        open={cardFormOpen}
        onClose={() => {
          setCardFormOpen(false);
          setEditingCard(null);
        }}
        title={editingCard ? "Editar cartão" : "Novo cartão"}
      >
        <CreditCardForm
          userId={userId}
          editing={editingCard}
          onSaved={async () => {
            setCardFormOpen(false);
            setEditingCard(null);
            if (userId) await load(userId);
          }}
        />
      </Modal>

      <Modal
        open={billFormOpen}
        onClose={() => {
          setBillFormOpen(false);
          setBillTarget(null);
        }}
        title={
          billTarget
            ? `Fatura ${cardLabel(billTarget.card)} — ${String(month).padStart(2, "0")}/${year}`
            : "Fatura"
        }
      >
        {billTarget && (
          <BillForm
            userId={userId}
            card={billTarget.card}
            bill={billTarget.bill}
            year={year}
            month={month}
            creditSpent={billTarget.creditSpent}
            onSaved={async () => {
              setBillFormOpen(false);
              setBillTarget(null);
              if (userId) await load(userId);
              emitDataChanged();
            }}
          />
        )}
      </Modal>
    </section>
  );
}

function CreditCardForm({
  userId,
  editing,
  onSaved,
}: {
  userId: string | null;
  editing: CreditCard | null;
  onSaved: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [name, setName] = useState("");
  const [dueDay, setDueDay] = useState("10");
  const [closingDay, setClosingDay] = useState("");
  const [last4, setLast4] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editing) return;
    setName(editing.name);
    setDueDay(String(editing.due_day));
    setClosingDay(editing.closing_day ? String(editing.closing_day) : "");
    setLast4(editing.last4 ?? "");
  }, [editing]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;
    const due = Number(dueDay);
    const closing = closingDay ? Number(closingDay) : null;
    const digits = last4.trim();
    if (
      due < 1 ||
      due > 31 ||
      (closing !== null && (closing < 1 || closing > 31)) ||
      (digits && !/^\d{4}$/.test(digits))
    ) {
      toast.error("Dados inválidos");
      return;
    }
    setSaving(true);
    const payload = {
      user_id: userId,
      name: name.trim(),
      due_day: due,
      closing_day: closing,
      last4: digits || null,
      active: editing?.active ?? true,
    };
    const { error } = editing
      ? await supabase.from("credit_cards").update(payload).eq("id", editing.id)
      : await supabase.from("credit_cards").insert(payload);
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar");
      return;
    }
    toast.success(editing ? "Cartão atualizado" : "Cartão adicionado");
    onSaved();
  }

  return (
    <form onSubmit={handleSave} className="space-y-3">
      <div>
        <Label htmlFor="cc-name">Nome</Label>
        <Input
          id="cc-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nubank, Itaú…"
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="cc-due">Dia do vencimento</Label>
          <Input
            id="cc-due"
            type="number"
            min={1}
            max={31}
            value={dueDay}
            onChange={(e) => setDueDay(e.target.value)}
            required
          />
        </div>
        <div>
          <Label htmlFor="cc-closing">Dia do fechamento</Label>
          <Input
            id="cc-closing"
            type="number"
            min={1}
            max={31}
            value={closingDay}
            onChange={(e) => setClosingDay(e.target.value)}
            placeholder="Opcional"
          />
        </div>
      </div>
      <div>
        <Label htmlFor="cc-last4">Últimos 4 dígitos</Label>
        <Input
          id="cc-last4"
          inputMode="numeric"
          maxLength={4}
          value={last4}
          onChange={(e) => setLast4(e.target.value)}
          placeholder="Opcional"
        />
      </div>
      <Button type="submit" className="w-full" disabled={saving}>
        {saving ? "Salvando…" : editing ? "Atualizar cartão" : "Adicionar cartão"}
      </Button>
    </form>
  );
}

function BillForm({
  userId,
  card,
  bill,
  year,
  month,
  creditSpent,
  onSaved,
}: {
  userId: string | null;
  card: CreditCard;
  bill: CreditCardBill | null;
  year: number;
  month: number;
  creditSpent: number;
  onSaved: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const { format } = useCurrency();
  const [amount, setAmount] = useState("");
  const [paid, setPaid] = useState(false);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!bill) return;
    setAmount(String(bill.amount).replace(".", ","));
    setPaid(bill.paid);
    setNotes(bill.notes ?? "");
  }, [bill]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;
    const value = parseAmountInput(amount);
    if (value === null) {
      toast.error("Valor inválido");
      return;
    }
    setSaving(true);
    const payload = {
      user_id: userId,
      credit_card_id: card.id,
      year,
      month,
      amount: value,
      paid,
      notes: notes.trim() || null,
    };
    const { error } = bill
      ? await supabase.from("credit_card_bills").update(payload).eq("id", bill.id)
      : await supabase.from("credit_card_bills").insert(payload);
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar");
      return;
    }
    toast.success(bill ? "Fatura atualizada" : "Fatura lançada");
    onSaved();
  }

  async function handleDelete() {
    if (!bill || !confirm("Remover a fatura deste mês?")) return;
    setSaving(true);
    const { error } = await supabase.from("credit_card_bills").delete().eq("id", bill.id);
    setSaving(false);
    if (error) {
      toast.error("Erro ao remover");
      return;
    }
    toast.success("Fatura removida");
    onSaved();
  }

  return (
    <form onSubmit={handleSave} className="space-y-3">
      <div>
        <Label htmlFor="bill-amount">Valor da fatura</Label>
        <Input
          id="bill-amount"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
          autoFocus
        />
        {creditSpent > 0 && (
          <p className="mt-1 text-xs text-[var(--fg-muted)]">
            Gastos no crédito registrados no app neste ciclo: {format(creditSpent)}
          </p>
        )}
      </div>
      <label className="flex items-center gap-2 text-sm text-[var(--fg)]">
        <input
          type="checkbox"
          checked={paid}
          onChange={(e) => setPaid(e.target.checked)}
          className="h-4 w-4 accent-[var(--accent)]"
        />
        Fatura paga
      </label>
      <div>
        <Label htmlFor="bill-notes">Observações</Label>
        <Input
          id="bill-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Opcional"
        />
      </div>
      <Button type="submit" className="w-full" disabled={saving}>
        {saving ? "Salvando…" : bill ? "Atualizar fatura" : "Lançar fatura"}
      </Button>
      {bill && (
        <Button
          type="button"
          variant="danger"
          className="w-full"
          disabled={saving}
          onClick={() => void handleDelete()}
        >
          Remover fatura
        </Button>
      )}
    </form>
  );
}
