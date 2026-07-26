"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select } from "@/components/ui/Input";
import { ensureCategories } from "@/lib/categories";
import { emitDataChanged } from "@/lib/events";
import { createClient } from "@/lib/supabase/client";
import { parseAmountInput, toISODate } from "@/lib/format";
import {
  PAYMENT_METHOD_LABELS,
  type Category,
  type Expense,
  type PaymentMethod,
  type Project,
} from "@/lib/types";

export type EditableExpense = Pick<
  Expense,
  "id" | "amount" | "category_id" | "payment_method" | "description" | "date" | "project_id"
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
  const [userId, setUserId] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("pix");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(toISODate());
  const [linkProject, setLinkProject] = useState(false);
  const [projectId, setProjectId] = useState("");
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
    if (!editing) return;
    setAmount(String(editing.amount).replace(".", ","));
    setCategoryId(editing.category_id);
    setPaymentMethod(editing.payment_method);
    setDescription(editing.description ?? "");
    setDate(editing.date);
    setLinkProject(!!editing.project_id);
    setProjectId(editing.project_id ?? "");
  }, [editing]);

  function resetAfterSave() {
    setAmount("");
    setDescription("");
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

    setSaving(true);
    const payload = {
      user_id: userId,
      amount: value,
      category_id: categoryId,
      payment_method: paymentMethod,
      description: description.trim() || null,
      date,
      project_id: linkProject && projectId ? projectId : null,
    };

    const { error } = editing
      ? await supabase.from("expenses").update(payload).eq("id", editing.id)
      : await supabase.from("expenses").insert(payload);

    setSaving(false);
    if (error) {
      toast.error("Não foi possível salvar");
      return;
    }

    toast.success(editing ? "Gasto atualizado" : "Gasto registrado!");
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 600);
    resetAfterSave();
    emitDataChanged();
    onSaved?.();
  }

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
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-2xl text-[var(--fg-muted)]">
            R$
          </span>
          <input
            id="amount"
            inputMode="decimal"
            autoComplete="off"
            placeholder="0,00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] py-4 pl-14 pr-3 text-4xl font-semibold tabular-nums text-[var(--fg)] outline-none transition placeholder:text-[var(--fg-muted)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--ring)]"
            autoFocus={autoFocusAmount}
          />
        </div>
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
              onChange={(e) => setLinkProject(e.target.checked)}
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
