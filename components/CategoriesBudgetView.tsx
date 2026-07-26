"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { useCurrency } from "@/components/CurrencyProvider";
import { ensureCategories } from "@/lib/categories";
import { createClient } from "@/lib/supabase/client";
import { parseAmountInput } from "@/lib/format";
import type { Category } from "@/lib/types";

export function CategoriesBudgetView() {
  const supabase = useMemo(() => createClient(), []);
  const { mainCurrency, format } = useCurrency();
  const [categories, setCategories] = useState<Category[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    async function init() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const cats = await ensureCategories(user.id);
      setCategories(cats);
      const d: Record<string, string> = {};
      for (const c of cats) {
        d[c.id] = c.monthly_budget != null ? String(c.monthly_budget).replace(".", ",") : "";
      }
      setDrafts(d);
    }
    void init();
  }, [supabase]);

  async function save(id: string) {
    const raw = drafts[id]?.trim();
    const budget = raw ? parseAmountInput(raw) : null;
    if (raw && budget === null) {
      toast.error("Valor inválido");
      return;
    }
    const { error } = await supabase
      .from("categories")
      .update({ monthly_budget: budget })
      .eq("id", id);
    if (error) {
      toast.error("Erro ao salvar");
      return;
    }
    toast.success("Orçamento atualizado");
    setCategories((prev) =>
      prev.map((c) => (c.id === id ? { ...c, monthly_budget: budget } : c)),
    );
  }

  if (categories.length === 0) {
    return <EmptyState title="Sem categorias" description="Elas são criadas no primeiro acesso." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Orçamentos"
        subtitle={`Meta mensal por categoria em ${mainCurrency} (opcional)`}
      />
      <ul className="space-y-3 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0 xl:grid-cols-3">
        {categories.map((c) => (
          <li
            key={c.id}
            className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3"
          >
            <p className="mb-2 text-sm font-medium text-[var(--fg)]">
              {c.icon} {c.name}
              {c.monthly_budget != null && (
                <span className="ml-2 text-xs text-[var(--fg-muted)]">
                  atual: {format(c.monthly_budget)}
                </span>
              )}
            </p>
            <div className="flex gap-2">
              <Input
                inputMode="decimal"
                placeholder="Sem meta"
                value={drafts[c.id] ?? ""}
                onChange={(e) => setDrafts((d) => ({ ...d, [c.id]: e.target.value }))}
              />
              <Button type="button" variant="secondary" onClick={() => save(c.id)}>
                Salvar
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
