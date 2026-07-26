"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Amount, TotalAmount } from "@/components/Amount";
import { CurrencySelect } from "@/components/CurrencySelect";
import { useCurrency, useRowRates } from "@/components/CurrencyProvider";
import { DataTable, type Column } from "@/components/DataTable";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { createClient } from "@/lib/supabase/client";
import { toCurrencyCode, type CurrencyCode } from "@/lib/currencies";
import type { AmountRow } from "@/lib/fx";
import { formatDateBR, monthRange, parseAmountInput, toISODate } from "@/lib/format";
import type { Investment, Project } from "@/lib/types";

type InvestmentRow = Investment & {
  projects: Pick<Project, "id" | "name" | "emoji"> | null;
};

export function InvestmentsView() {
  const supabase = useMemo(() => createClient(), []);
  const [userId, setUserId] = useState<string | null>(null);
  const [items, setItems] = useState<InvestmentRow[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [monthRows, setMonthRows] = useState<AmountRow[]>([]);
  const [lifetimeRows, setLifetimeRows] = useState<AmountRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<InvestmentRow | null>(null);

  useRowRates(lifetimeRows);

  const load = useCallback(
    async (uid: string) => {
      const now = new Date();
      const { start, end } = monthRange(now.getFullYear(), now.getMonth() + 1);
      const [{ data }, { data: monthData }, { data: allData }, { data: projs }] =
        await Promise.all([
          supabase
            .from("investments")
            .select("*, projects(id, name, emoji)")
            .eq("user_id", uid)
            .order("date", { ascending: false })
            .limit(100),
          supabase
            .from("investments")
            .select("amount, currency, date")
            .eq("user_id", uid)
            .gte("date", start)
            .lte("date", end),
          supabase.from("investments").select("amount, currency, date").eq("user_id", uid),
          supabase
            .from("projects")
            .select("*")
            .eq("user_id", uid)
            .eq("status", "active")
            .order("name"),
        ]);
      setItems((data as InvestmentRow[]) ?? []);
      setMonthRows((monthData as AmountRow[]) ?? []);
      setLifetimeRows((allData as AmountRow[]) ?? []);
      setProjects((projs as Project[]) ?? []);
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

  async function handleDelete(id: string) {
    if (!userId || !confirm("Excluir aporte?")) return;
    const { error } = await supabase.from("investments").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao excluir");
      return;
    }
    toast.success("Excluído");
    await load(userId);
  }

  function openEdit(item: InvestmentRow) {
    setEditing(item);
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditing(null);
  }

  const columns: Column<InvestmentRow>[] = [
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
      key: "vehicle",
      header: "Veículo",
      sortValue: (r) => r.vehicle,
      render: (r) => <span className="whitespace-nowrap">{r.vehicle}</span>,
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
      key: "project",
      header: "Projeto",
      render: (r) =>
        r.projects ? (
          <span className="whitespace-nowrap">
            {r.projects.emoji} {r.projects.name}
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
        <Amount
          value={r.amount}
          currency={r.currency}
          date={r.date}
          className="whitespace-nowrap font-semibold tabular-nums text-sky-400"
        />
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
          className="rounded-lg px-2 py-1 text-xs text-[var(--negative)] transition hover:bg-[var(--negative-soft)]"
        >
          Excluir
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Investimentos"
        subtitle="Só o registro do aporte — sem cotação"
        action={
          <Button size="sm" onClick={() => setFormOpen(true)}>
            Novo aporte
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:max-w-md lg:gap-4">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3">
          <p className="text-xs text-[var(--fg-muted)]">Este mês</p>
          <TotalAmount
            rows={monthRows}
            className="mt-1 block text-lg font-semibold tabular-nums text-[var(--fg)]"
          />
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3">
          <p className="text-xs text-[var(--fg-muted)]">Acumulado</p>
          <TotalAmount
            rows={lifetimeRows}
            className="mt-1 block text-lg font-semibold tabular-nums text-[var(--fg)]"
          />
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-[var(--fg-muted)]">Carregando…</p>
      ) : items.length === 0 ? (
        <EmptyState title="Nenhum aporte" description="Registre o que você investiu." />
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
                date: `${items.length} aporte(s)`,
                amount: <TotalAmount rows={items} />,
              }}
            />
          </div>

          <ul className="divide-y divide-[var(--border)] rounded-2xl border border-[var(--border)] bg-[var(--surface)] lg:hidden">
            {items.map((item) => (
              <li key={item.id} className="flex items-center gap-3 px-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[var(--fg)]">{item.vehicle}</p>
                  <p className="text-xs text-[var(--fg-muted)]">
                    {formatDateBR(item.date)}
                    {item.description ? ` · ${item.description}` : ""}
                    {item.projects ? ` · ${item.projects.emoji} ${item.projects.name}` : ""}
                  </p>
                </div>
                <Amount
                  value={item.amount}
                  currency={item.currency}
                  date={item.date}
                  className="text-right tabular-nums text-sm font-semibold text-sky-400"
                />
                <button
                  type="button"
                  className="rounded-lg px-2 py-1 text-xs text-[var(--fg-muted)] hover:bg-[var(--surface-2)]"
                  onClick={() => openEdit(item)}
                >
                  Editar
                </button>
                <button
                  type="button"
                  className="rounded-lg px-2 py-1 text-xs text-[var(--negative)] hover:bg-[var(--negative-soft)]"
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
        title={editing ? "Editar aporte" : "Novo aporte"}
      >
        <InvestmentForm
          userId={userId}
          editing={editing}
          projects={projects}
          onSaved={async () => {
            closeForm();
            if (userId) await load(userId);
          }}
        />
      </Modal>
    </div>
  );
}

function InvestmentForm({
  userId,
  editing,
  projects,
  onSaved,
}: {
  userId: string | null;
  editing: InvestmentRow | null;
  projects: Project[];
  onSaved: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const { mainCurrency } = useCurrency();
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<CurrencyCode>(mainCurrency);
  const currencyTouched = useRef(false);
  const [vehicle, setVehicle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(toISODate());
  const [projectId, setProjectId] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editing || currencyTouched.current) return;
    setCurrency(mainCurrency);
  }, [mainCurrency, editing]);

  useEffect(() => {
    if (!editing) return;
    setAmount(String(editing.amount).replace(".", ","));
    setCurrency(toCurrencyCode(editing.currency, mainCurrency));
    setVehicle(editing.vehicle);
    setDescription(editing.description ?? "");
    setDate(editing.date);
    setProjectId(editing.project_id ?? "");
  }, [editing, mainCurrency]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;
    const value = parseAmountInput(amount);
    if (value === null || !vehicle.trim()) {
      toast.error("Preencha valor e veículo");
      return;
    }
    setSaving(true);
    const payload = {
      user_id: userId,
      amount: value,
      currency,
      vehicle: vehicle.trim(),
      description: description.trim() || null,
      date,
      project_id: projectId || null,
    };
    const { error } = editing
      ? await supabase.from("investments").update(payload).eq("id", editing.id)
      : await supabase.from("investments").insert(payload);
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar");
      return;
    }
    toast.success(editing ? "Aporte atualizado" : "Aporte registrado");
    onSaved();
  }

  return (
    <form onSubmit={handleSave} className="space-y-3">
      <div className="grid grid-cols-[1fr_auto] gap-3">
        <div>
          <Label htmlFor="inv-amount">Valor</Label>
          <Input
            id="inv-amount"
            inputMode="decimal"
            placeholder="0,00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
        </div>
        <div>
          <Label htmlFor="inv-currency">Moeda</Label>
          <CurrencySelect
            id="inv-currency"
            codeOnly
            value={currency}
            onChange={(next) => {
              currencyTouched.current = true;
              setCurrency(next);
            }}
            className="w-24"
          />
        </div>
      </div>
      <div>
        <Label htmlFor="inv-vehicle">Veículo</Label>
        <Input
          id="inv-vehicle"
          value={vehicle}
          onChange={(e) => setVehicle(e.target.value)}
          placeholder="Tesouro Selic, CDB…"
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="inv-date">Data</Label>
          <Input id="inv-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="inv-desc">Descrição</Label>
          <Input
            id="inv-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Opcional"
          />
        </div>
      </div>
      {projects.length > 0 && (
        <div>
          <Label htmlFor="inv-proj">Projeto (opcional)</Label>
          <Select id="inv-proj" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            <option value="">Nenhum</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.emoji} {p.name}
              </option>
            ))}
          </Select>
        </div>
      )}
      <Button type="submit" className="w-full" disabled={saving}>
        {saving ? "Salvando…" : editing ? "Atualizar aporte" : "Registrar aporte"}
      </Button>
    </form>
  );
}
