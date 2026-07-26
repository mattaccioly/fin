"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select } from "@/components/ui/Input";
import { CurrencySelect } from "@/components/CurrencySelect";
import { useCurrency, useRowRates } from "@/components/CurrencyProvider";
import { ensureCategories } from "@/lib/categories";
import { CURRENCY_SYMBOLS, toCurrencyCode, type CurrencyCode } from "@/lib/currencies";
import { emitDataChanged } from "@/lib/events";
import type { AmountRow } from "@/lib/fx";
import { createClient } from "@/lib/supabase/client";
import { formatDateBR, parseAmountInput, toISODate } from "@/lib/format";
import { projectReserve } from "@/lib/reserves";
import {
  PAYMENT_METHOD_LABELS,
  type Category,
  type Expense,
  type PaymentMethod,
  type Project,
} from "@/lib/types";

export type EditableExpense = Pick<
  Expense,
  | "id"
  | "amount"
  | "currency"
  | "category_id"
  | "payment_method"
  | "description"
  | "date"
  | "project_id"
  | "paid_from_reserve"
>;

export function ExpenseForm({
  editing = null,
  onSaved,
  onCancelEdit,
  autoFocusAmount = false,
  frameless = false,
}: {
  editing?: EditableExpense | null;
  onSaved?: () => void;
  onCancelEdit?: () => void;
  autoFocusAmount?: boolean;
  frameless?: boolean;
}) {
  const supabase = useMemo(() => createClient(), []);
  const { mainCurrency, sum, format, convert } = useCurrency();
  const [userId, setUserId] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<CurrencyCode>(mainCurrency);
  const currencyTouched = useRef(false);
  const [categoryId, setCategoryId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("pix");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(toISODate());
  const [linkProject, setLinkProject] = useState(false);
  const [projectId, setProjectId] = useState("");
  const [paidFromReserve, setPaidFromReserve] = useState(false);
  const [investmentRows, setInvestmentRows] = useState<AmountRow[]>([]);
  const [reserveExpenseRows, setReserveExpenseRows] = useState<(AmountRow & { id?: string })[]>(
    [],
  );
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    async function init() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      try {
        const cats = await ensureCategories(user.id);
        setCategories(cats);
        setCategoryId((prev) => prev || (cats[0]?.id ?? ""));

        const { data: projs } = await supabase
          .from("projects")
          .select("*")
          .eq("user_id", user.id)
          .eq("status", "active")
          .order("name");
        setProjects((projs as Project[]) ?? []);
      } catch {
        toast.error("Erro ao inicializar categorias");
      }
    }
    void init();
  }, [supabase]);

  useEffect(() => {
    if (editing || currencyTouched.current) return;
    setCurrency(mainCurrency);
  }, [mainCurrency, editing]);

  useEffect(() => {
    if (!editing) return;
    setAmount(String(editing.amount).replace(".", ","));
    setCurrency(toCurrencyCode(editing.currency, mainCurrency));
    setCategoryId(editing.category_id);
    setPaymentMethod(editing.payment_method);
    setDescription(editing.description ?? "");
    setDate(editing.date);
    setLinkProject(!!editing.project_id);
    setProjectId(editing.project_id ?? "");
    setPaidFromReserve(!!editing.paid_from_reserve);
  }, [editing, mainCurrency]);

  useEffect(() => {
    if (!linkProject || !projectId) {
      setInvestmentRows([]);
      setReserveExpenseRows([]);
      if (!linkProject) setPaidFromReserve(false);
      return;
    }

    let cancelled = false;
    async function loadReserve() {
      const [{ data: invs }, { data: exps }] = await Promise.all([
        supabase.from("investments").select("amount, currency, date").eq("project_id", projectId),
        supabase
          .from("expenses")
          .select("id, amount, currency, date, paid_from_reserve")
          .eq("project_id", projectId)
          .eq("paid_from_reserve", true),
      ]);
      if (cancelled) return;
      setInvestmentRows((invs as AmountRow[]) ?? []);
      setReserveExpenseRows(
        ((exps as (AmountRow & { id: string; paid_from_reserve: boolean })[]) ?? []).filter(
          (e) => !editing || e.id !== editing.id,
        ),
      );
    }
    void loadReserve();
    return () => {
      cancelled = true;
    };
  }, [supabase, linkProject, projectId, editing]);

  const reserveRows = useMemo(
    () => [...investmentRows, ...reserveExpenseRows],
    [investmentRows, reserveExpenseRows],
  );
  useRowRates(reserveRows);

  const reserve = useMemo(() => {
    const reservedTotal = sum(investmentRows).total;
    const usedTotal = sum(reserveExpenseRows).total;
    return projectReserve({ reservedTotal, usedTotal });
  }, [investmentRows, reserveExpenseRows, sum]);

  const hasReserve = reserve.reserved > 0;
  const parsedAmount = parseAmountInput(amount);
  const expenseInMain =
    parsedAmount === null
      ? null
      : currency === mainCurrency
        ? parsedAmount
        : convert(parsedAmount, currency, date);

  const exceedsReserve =
    paidFromReserve &&
    expenseInMain !== null &&
    expenseInMain > reserve.available;

  function resetAfterSave() {
    setAmount("");
    setDescription("");
    setPaidFromReserve(false);
    // keep category + payment for the next entry
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!userId || !categoryId) return;
    const value = parseAmountInput(amount);
    if (value === null) {
      toast.error("Informe um valor válido");
      return;
    }

    const linkedProjectId = linkProject && projectId ? projectId : null;
    if (paidFromReserve && !linkedProjectId) {
      toast.error("Selecione um projeto para usar a reserva");
      return;
    }

    setSaving(true);
    const payload = {
      user_id: userId,
      amount: value,
      currency,
      category_id: categoryId,
      payment_method: paymentMethod,
      description: description.trim() || null,
      date,
      project_id: linkedProjectId,
      paid_from_reserve: !!linkedProjectId && paidFromReserve,
    };

    const { error } = editing
      ? await supabase.from("expenses").update(payload).eq("id", editing.id)
      : await supabase.from("expenses").insert(payload);

    setSaving(false);
    if (error) {
      const hint =
        error.message?.includes("paid_from_reserve") || error.code === "PGRST204"
          ? "Coluna de reserva ainda não existe no banco — rode a migration 20260727100000."
          : error.message;
      toast.error(hint ? `Não foi possível salvar: ${hint}` : "Não foi possível salvar");
      return;
    }

    toast.success(editing ? "Gasto atualizado" : "Gasto registrado!");
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 600);
    resetAfterSave();
    emitDataChanged();
    onSaved?.();
  }

  const symbol = CURRENCY_SYMBOLS[currency];

  return (
    <form
      onSubmit={handleSave}
      className={`space-y-4 transition ${
        frameless
          ? ""
          : "rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4"
      } ${savedFlash ? "ring-2 ring-[var(--accent)] scale-[1.01]" : ""}`}
    >
      <div>
        <Label htmlFor="amount">Valor</Label>
        <div className="grid grid-cols-[minmax(0,1fr)_4.5rem] items-stretch gap-2">
          <div className="relative min-w-0">
            <span
              className={`pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-2xl text-[var(--fg-muted)] ${
                symbol.length > 2 ? "text-xl" : ""
              }`}
            >
              {symbol}
            </span>
            <input
              id="amount"
              inputMode="decimal"
              autoComplete="off"
              placeholder="0,00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className={`w-full min-w-0 rounded-xl border border-[var(--border)] bg-[var(--bg)] py-4 pr-3 text-4xl font-semibold tabular-nums text-[var(--fg)] outline-none transition placeholder:text-[var(--fg-muted)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--ring)] ${
                symbol.length > 2 ? "pl-16" : "pl-12"
              }`}
              autoFocus={autoFocusAmount}
            />
          </div>
          <CurrencySelect
            codeOnly
            value={currency}
            onChange={(next) => {
              currencyTouched.current = true;
              setCurrency(next);
            }}
            className="h-full w-full shrink-0 px-1.5 text-center text-sm font-medium"
          />
        </div>
        {currency !== mainCurrency && (
          <p className="mt-1.5 text-xs text-[var(--fg-muted)]">
            Convertido para {mainCurrency} pela cotação de {formatDateBR(date)}.
          </p>
        )}
      </div>

      <div>
        <Label>Categoria</Label>
        <div className="grid grid-cols-4 gap-2">
          {categories.map((cat) => {
            const active = cat.id === categoryId;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategoryId(cat.id)}
                className={`flex flex-col items-center gap-1 rounded-xl border px-1 py-2.5 text-center transition ${
                  active
                    ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                    : "border-[var(--border)] bg-[var(--bg)] hover:border-[var(--border-strong)]"
                }`}
              >
                <span className="text-xl leading-none">{cat.icon}</span>
                <span className="text-[10px] leading-tight text-[var(--fg-muted)] line-clamp-2">
                  {cat.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <Label>Pagamento</Label>
        <div className="grid grid-cols-4 gap-2">
          {(Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setPaymentMethod(m)}
              className={`rounded-xl border px-2 py-2 text-xs font-medium transition ${
                paymentMethod === m
                  ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--fg)]"
                  : "border-[var(--border)] bg-[var(--bg)] text-[var(--fg-muted)]"
              }`}
            >
              {PAYMENT_METHOD_LABELS[m]}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="date">Data</Label>
          <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="desc">Descrição</Label>
          <Input
            id="desc"
            placeholder="Opcional"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
      </div>

      {projects.length > 0 && (
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm text-[var(--fg-muted)]">
            <input
              type="checkbox"
              checked={linkProject}
              onChange={(e) => {
                setLinkProject(e.target.checked);
                if (!e.target.checked) {
                  setProjectId("");
                  setPaidFromReserve(false);
                }
              }}
              className="accent-[var(--accent)]"
            />
            Vincular a um projeto
          </label>
          {linkProject && (
            <Select value={projectId} onChange={(e) => setProjectId(e.target.value)} required>
              <option value="">Selecione…</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.emoji} {p.name}
                </option>
              ))}
            </Select>
          )}
          {linkProject && projectId && hasReserve && (
            <div className="space-y-1.5 rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3">
              <label className="flex items-center gap-2 text-sm text-[var(--fg)]">
                <input
                  type="checkbox"
                  checked={paidFromReserve}
                  onChange={(e) => setPaidFromReserve(e.target.checked)}
                  className="accent-[var(--accent)]"
                />
                Pagar com valor reservado
              </label>
              <p className="text-xs text-[var(--fg-muted)]">
                Disponível na reserva: {format(reserve.available)}
                {reserve.used > 0 ? ` · já usado ${format(reserve.used)}` : ""}
              </p>
              {paidFromReserve && (
                <p className="text-xs text-[var(--fg-muted)]">
                  Não conta no saldo do mês nem nas categorias — só reduz a reserva do projeto.
                </p>
              )}
              {exceedsReserve && (
                <p className="text-xs text-[var(--warning)]">
                  Valor acima da reserva disponível ({format(reserve.available)}). Você pode
                  continuar, mas a reserva ficará negativa.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      <div className="flex gap-2">
        <Button type="submit" size="lg" className="flex-1" disabled={saving}>
          {saving ? "Salvando…" : editing ? "Atualizar gasto" : "Registrar gasto"}
        </Button>
        {editing && onCancelEdit && (
          <Button
            type="button"
            variant="secondary"
            size="lg"
            onClick={() => {
              setAmount("");
              setDescription("");
              setPaidFromReserve(false);
              onCancelEdit();
            }}
          >
            Cancelar
          </Button>
        )}
      </div>
    </form>
  );
}
