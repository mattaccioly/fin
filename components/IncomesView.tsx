"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { DataTable, type Column } from "@/components/DataTable";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, formatDateBR, parseAmountInput, toISODate } from "@/lib/format";
import { INCOME_SOURCE_LABELS, type Income, type IncomeSource } from "@/lib/types";

export function IncomesView() {
  const supabase = useMemo(() => createClient(), []);
  const [userId, setUserId] = useState<string | null>(null);
  const [items, setItems] = useState<Income[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Income | null>(null);
  const [repeating, setRepeating] = useState(false);

  const load = useCallback(
    async (uid: string) => {
      const { data, error } = await supabase
        .from("incomes")
        .select("*")
        .eq("user_id", uid)
        .order("date", { ascending: false });
      if (error) toast.error("Erro ao carregar entradas");
      else setItems((data as Income[]) ?? []);
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

  async function repeatLastMonth() {
    if (!userId) return;
    setRepeating(true);
    const now = new Date();
    const prevMonth = now.getMonth() === 0 ? 12 : now.getMonth();
    const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
    const start = `${prevYear}-${String(prevMonth).padStart(2, "0")}-01`;
    const lastDay = new Date(prevYear, prevMonth, 0).getDate();
    const end = `${prevYear}-${String(prevMonth).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

    const { data, error } = await supabase
      .from("incomes")
      .select("*")
      .eq("user_id", userId)
      .eq("is_recurring", true)
      .gte("date", start)
      .lte("date", end);

    if (error || !data?.length) {
      setRepeating(false);
      toast.error("Nenhuma entrada recorrente no mês passado");
      return;
    }

    const today = toISODate();
    const rows = data.map((i) => ({
      user_id: userId,
      amount: i.amount,
      source: i.source,
      description: i.description,
      is_recurring: true,
      date: today,
    }));

    const { error: insertError } = await supabase.from("incomes").insert(rows);
    setRepeating(false);
    if (insertError) {
      toast.error("Erro ao repetir");
      return;
    }
    toast.success(`${rows.length} entrada(s) repetida(s)`);
    await load(userId);
  }

  async function handleDelete(id: string) {
    if (!userId || !confirm("Excluir entrada?")) return;
    const { error } = await supabase.from("incomes").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao excluir");
      return;
    }
    toast.success("Excluído");
    await load(userId);
  }

  function openEdit(item: Income) {
    setEditing(item);
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditing(null);
  }

  const total = items.reduce((s, i) => s + Number(i.amount), 0);

  const columns: Column<Income>[] = [
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
      key: "source",
      header: "Fonte",
      sortValue: (r) => INCOME_SOURCE_LABELS[r.source],
      render: (r) => INCOME_SOURCE_LABELS[r.source],
    },
    {
      key: "description",
      header: "Descrição",
      render: (r) => (
        <span className="block max-w-64 truncate">
          {r.description || <span className="text-[var(--fg-muted)]">—</span>}
        </span>
      ),
    },
    {
      key: "recurring",
      header: "Recorrente",
      render: (r) =>
        r.is_recurring ? (
          <span className="rounded-lg bg-[var(--surface-2)] px-2 py-0.5 text-xs text-[var(--fg-muted)]">
            recorrente
          </span>
        ) : (
          <span className="text-[var(--fg-muted)]">—</span>
        ),
    },
    {
      key: "amount",
      header: "Valor",
      align: "right",
      sortValue: (r) => Number(r.amount),
      render: (r) => (
        <span className="whitespace-nowrap font-semibold tabular-nums text-emerald-400">
          {formatCurrency(r.amount)}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (r) => (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            void handleDelete(r.id);
          }}
          className="rounded-lg px-2 py-1 text-xs text-red-400 transition hover:bg-red-500/10"
        >
          Excluir
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Entradas"
        subtitle="Salário, bolsa, freelance…"
        action={
          <>
            <Button variant="secondary" size="sm" onClick={repeatLastMonth} disabled={repeating}>
              {repeating ? "Repetindo…" : "Repetir do mês passado"}
            </Button>
            <Button size="sm" onClick={() => setFormOpen(true)}>
              Nova entrada
            </Button>
          </>
        }
      />

      {loading ? (
        <p className="text-sm text-[var(--fg-muted)]">Carregando…</p>
      ) : items.length === 0 ? (
        <EmptyState title="Nenhuma entrada" description="Lance seu salário ou bolsa para começar." />
      ) : (
        <>
          <div className="hidden lg:block">
            <DataTable
              columns={columns}
              rows={items}
              rowKey={(r) => r.id}
              onRowClick={openEdit}
              initialSort={{ key: "date", dir: "desc" }}
              footer={{
                date: `${items.length} entrada(s)`,
                amount: formatCurrency(total),
              }}
            />
          </div>

          <ul className="divide-y divide-[var(--border)] rounded-2xl border border-[var(--border)] bg-[var(--surface)] lg:hidden">
            {items.map((item) => (
              <li key={item.id} className="flex items-center gap-3 px-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[var(--fg)]">
                    {INCOME_SOURCE_LABELS[item.source]}
                    {item.is_recurring ? " · recorrente" : ""}
                  </p>
                  <p className="text-xs text-[var(--fg-muted)]">
                    {formatDateBR(item.date)}
                    {item.description ? ` · ${item.description}` : ""}
                  </p>
                </div>
                <p className="tabular-nums text-sm font-semibold text-emerald-400">
                  {formatCurrency(item.amount)}
                </p>
                <button
                  type="button"
                  className="rounded-lg px-2 py-1 text-xs text-[var(--fg-muted)] hover:bg-[var(--surface-2)]"
                  onClick={() => openEdit(item)}
                >
                  Editar
                </button>
                <button
                  type="button"
                  className="rounded-lg px-2 py-1 text-xs text-red-400 hover:bg-red-500/10"
                  onClick={() => void handleDelete(item.id)}
                >
                  Excluir
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      <Modal
        open={formOpen}
        onClose={closeForm}
        title={editing ? "Editar entrada" : "Nova entrada"}
      >
        <IncomeForm
          userId={userId}
          editing={editing}
          onSaved={async () => {
            closeForm();
            if (userId) await load(userId);
          }}
        />
      </Modal>
    </div>
  );
}

function IncomeForm({
  userId,
  editing,
  onSaved,
}: {
  userId: string | null;
  editing: Income | null;
  onSaved: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [amount, setAmount] = useState("");
  const [source, setSource] = useState<IncomeSource>("salary");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(toISODate());
  const [isRecurring, setIsRecurring] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editing) return;
    setAmount(String(editing.amount).replace(".", ","));
    setSource(editing.source);
    setDescription(editing.description ?? "");
    setDate(editing.date);
    setIsRecurring(editing.is_recurring);
  }, [editing]);

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
      amount: value,
      source,
      description: description.trim() || null,
      date,
      is_recurring: isRecurring,
    };
    const { error } = editing
      ? await supabase.from("incomes").update(payload).eq("id", editing.id)
      : await supabase.from("incomes").insert(payload);
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar");
      return;
    }
    toast.success(editing ? "Entrada atualizada" : "Entrada registrada");
    onSaved();
  }

  return (
    <form onSubmit={handleSave} className="space-y-3">
      <div>
        <Label htmlFor="inc-amount">Valor</Label>
        <Input
          id="inc-amount"
          inputMode="decimal"
          placeholder="0,00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
        />
      </div>
      <div>
        <Label htmlFor="inc-source">Fonte</Label>
        <Select
          id="inc-source"
          value={source}
          onChange={(e) => setSource(e.target.value as IncomeSource)}
        >
          {(Object.keys(INCOME_SOURCE_LABELS) as IncomeSource[]).map((s) => (
            <option key={s} value={s}>
              {INCOME_SOURCE_LABELS[s]}
            </option>
          ))}
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="inc-date">Data</Label>
          <Input id="inc-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="inc-desc">Descrição</Label>
          <Input
            id="inc-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Opcional"
          />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm text-[var(--fg-muted)]">
        <input
          type="checkbox"
          checked={isRecurring}
          onChange={(e) => setIsRecurring(e.target.checked)}
          className="accent-[var(--accent)]"
        />
        Recorrente
      </label>
      <Button type="submit" className="w-full" disabled={saving}>
        {saving ? "Salvando…" : editing ? "Atualizar entrada" : "Registrar entrada"}
      </Button>
    </form>
  );
}
