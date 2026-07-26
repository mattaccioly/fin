"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CurrencySelect } from "@/components/CurrencySelect";
import { useCurrency } from "@/components/CurrencyProvider";
import type { CurrencyCode } from "@/lib/currencies";

export function MainCurrencySetting() {
  const { mainCurrency, setMainCurrency, ready } = useCurrency();
  const [saving, setSaving] = useState(false);

  async function handleChange(next: CurrencyCode) {
    if (next === mainCurrency) return;
    setSaving(true);
    try {
      await setMainCurrency(next);
      toast.success(`Moeda principal: ${next}`);
    } catch {
      toast.error("Não foi possível salvar a moeda");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <CurrencySelect
        id="main-currency"
        value={mainCurrency}
        onChange={(c) => void handleChange(c)}
        disabled={!ready || saving}
      />
      <p className="text-xs text-[var(--fg-muted)]">
        Totais e gráficos são exibidos nessa moeda. Lançamentos em outra moeda são convertidos
        pela cotação do dia do gasto, da entrada ou do aporte.
      </p>
    </div>
  );
}
