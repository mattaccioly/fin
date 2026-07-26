"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { DataTable, type Column } from "@/components/DataTable";
import { EmptyState } from "@/components/EmptyState";
import { ExpenseForm } from "@/components/ExpenseForm";
import { PageHeader } from "@/components/PageHeader";
import { useMonth } from "@/components/MonthProvider";
import { createClient } from "@/lib/supabase/client";
import { onDataChanged } from "@/lib/events";
import {
  formatCurrency,
  formatDateBR,
  formatMonthYear,
  monthRange,
} from "@/lib/format";
import {
  PAYMENT_METHOD_LABELS,
  type Category,
  type Expense,
  type PaymentMethod,
  type Project,
} from "@/lib/types";

type ExpenseRow = Expense & {
  categories: Pick<Category, "id" | "name" | "icon" | "color"> | null;
  projects: Pick<Project, "id" | "name" | "emoji"> | null;
};

export function ExpensesView() {
  const supabase = useMemo(() => createClient(), []);
  const { year, month, go } = useMonth();
  const [rows, setRows] = useState<ExpenseRow[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  const [customRange, setCustomRange] = useState(false);
  const [rangeStart, setRangeStart] = useState(monthRange(year, month).start);
  const [rangeEnd, setRangeEnd] = useState(monthRange(year, month).end);

  const [catFilter, setCatFilter] = useState<string[]>([]);
  const [methodFilter, setMethodFilter] = useState<PaymentMethod | "all">("all");
  const [projectFilter, setProjectFilter] = useState("");
  const [search, setSearch] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ExpenseRow | null>(null);

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

    const [{ data: expenses, error }, { data: cats }, { data: projs }] =
      await Promise.all([
        supabase
          .from("expenses")
          .select("*, categories(id, name, icon, color), projects(id, name, emoji)")
          .eq("user_id", user.id)
          .gte("date", period.start)
          .lte("date", period.end)
          .order("date", { ascending: false })
          .order("created_at", { ascending: false }),
        supabase.from("categories").select("*").eq("user_id", user.id).order("name"),
        supabase.from("projects").select("*").eq("user_id", user.id).order("name"),
      ]);

    if (error) {
      toast.error("Erro ao carregar gastos");
      return;
    }
    setRows((expenses as ExpenseRow[]) ?? []);
    setCategories((cats as Category[]) ?? []);
    setProjects((projs as Project[]) ?? []);
    setLoading(false);
  }, [supabase, period]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => onDataChanged(() => void load()), [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (catFilter.length > 0 && !catFilter.includes(r.category_id)) return false;
      if (methodFilter !== "all" && r.payment_method !== methodFilter) return false;
      if (projectFilter === "none" && r.project_id) return false;
      if (projectFilter && projectFilter !== "none" && r.project_id !== projectFilter)
        return false;
      if (q && !(r.description ?? "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, catFilter, methodFilter, projectFilter, search]);

  const total = filtered.reduce((s, r) => s + Number(r.amount), 0);

  function toggleCategory(id: string) {
    setCatFilter((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    );
  }

  async function handleDelete(id: string) {
    if (!confirm("Excluir este gasto?")) return;
    const { error } = await supabase.from("expenses").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao excluir");
      return;
    }
    toast.success("Excluído");
    await load();
  }

  function openEdit(row: ExpenseRow) {
    setEditing(row);
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditing(null);
  }

  const columns: Column<ExpenseRow>[] = [
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
      key: "category",
      header: "Categoria",
      sortValue: (r) => r.categories?.name ?? "",
      render: (r) => (
        <span className="whitespace-nowrap">
          {r.categories?.icon} {r.categories?.name ?? "—"}
        </span>
      ),
    },
    {
      key: "description",
      header: "Descrição",
      render: (r) => (
        <span className="block max-w-64 truncate text-[var(--fg)]">
          {r.description || <span className="text-[var(--fg-muted)]">—</span>}
        </span>
      ),
    },
    {
      key: "method",
      header: "Método",
      render: (r) => (
        <span className="text-[var(--fg-muted)]">
          {PAYMENT_METHOD_LABELS[r.payment_method]}
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
        title="Gastos"
        subtitle="Todos os gastos variáveis do período"
        action={
          <Button size="sm" onClick={() => setFormOpen(true)}>
            + Novo gasto
          </Button>
        }
      />

      <div className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 lg:p-4">
        <div className="flex flex-wrap items-center gap-2">
          {!customRange ? (
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" onClick={() => go(-1)} aria-label="Mês anterior">
                ←
              </Button>
              <span className="min-w-36 text-center text-sm font-medium text-[var(--fg)]">
                {formatMonthYear(year, month)}
              </span>
              <Button variant="ghost" size="sm" onClick={() => go(1)} aria-label="Próximo mês">
                →
              </Button>
            </div>
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
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCustomRange((v) => !v)}
          >
            {customRange ? "Usar mês" : "Intervalo personalizado"}
          </Button>
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          <Input
            placeholder="Buscar na descrição…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="py-2 text-sm"
          />
          <Select
            value={methodFilter}
            onChange={(e) => setMethodFilter(e.target.value as PaymentMethod | "all")}
            className="py-2 text-sm"
          >
            <option value="all">Todos os métodos</option>
            {(Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).map((m) => (
              <option key={m} value={m}>
                {PAYMENT_METHOD_LABELS[m]}
              </option>
            ))}
          </Select>
          <Select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="py-2 text-sm"
          >
            <option value="">Todos os projetos</option>
            <option value="none">Sem projeto</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.emoji} {p.name}
              </option>
            ))}
          </Select>
        </div>

        {categories.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {categories.map((c) => {
              const active = catFilter.includes(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => toggleCategory(c.id)}
                  className={`rounded-xl border px-2.5 py-1 text-xs transition ${
                    active
                      ? "border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--fg)]"
                      : "border-[var(--border)] bg-[var(--bg)] text-[var(--fg-muted)] hover:border-[var(--fg-muted)]"
                  }`}
                >
                  {c.icon} {c.name}
                </button>
              );
            })}
            {catFilter.length > 0 && (
              <button
                type="button"
                onClick={() => setCatFilter([])}
                className="rounded-xl px-2.5 py-1 text-xs text-[var(--accent)] hover:underline"
              >
                Limpar
              </button>
            )}
          </div>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-[var(--fg-muted)]">Carregando gastos…</p>
      ) : filtered.length === 0 ? (
        <EmptyState
          title="Nenhum gasto encontrado"
          description="Ajuste os filtros ou registre um novo gasto."
        />
      ) : (
        <>
          {/* Desktop: tabela densa */}
          <div className="hidden lg:block">
            <DataTable
              columns={columns}
              rows={filtered}
              rowKey={(r) => r.id}
              onRowClick={openEdit}
              initialSort={{ key: "date", dir: "desc" }}
              footer={{
                date: `${filtered.length} lançamento(s)`,
                amount: formatCurrency(total),
              }}
            />
          </div>

          {/* Mobile: lista de cards */}
          <div className="space-y-3 lg:hidden">
            <ul className="divide-y divide-[var(--border)] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
              {filtered.map((exp) => (
                <li key={exp.id} className="flex items-center gap-3 px-3 py-3">
                  <span className="text-xl">{exp.categories?.icon ?? "📦"}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[var(--fg)]">
                      {exp.description || exp.categories?.name || "Gasto"}
                    </p>
                    <p className="text-xs text-[var(--fg-muted)]">
                      {formatDateBR(exp.date)} · {PAYMENT_METHOD_LABELS[exp.payment_method]}
                      {exp.projects ? ` · ${exp.projects.emoji} ${exp.projects.name}` : ""}
                    </p>
                  </div>
                  <p className="tabular-nums text-sm font-semibold text-[var(--fg)]">
                    {formatCurrency(exp.amount)}
                  </p>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => openEdit(exp)}
                      className="rounded-lg px-2 py-1 text-xs text-[var(--fg-muted)] hover:bg-[var(--surface-2)]"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDelete(exp.id)}
                      className="rounded-lg px-2 py-1 text-xs text-red-400 hover:bg-red-500/10"
                    >
                      Excluir
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            <p className="text-right text-sm text-[var(--fg-muted)]">
              Total filtrado:{" "}
              <span className="font-semibold text-[var(--fg)]">{formatCurrency(total)}</span>
            </p>
          </div>
        </>
      )}

      <Modal
        open={formOpen}
        onClose={closeForm}
        title={editing ? "Editar gasto" : "Novo gasto"}
      >
        <ExpenseForm
          frameless
          editing={editing}
          onSaved={closeForm}
          onCancelEdit={closeForm}
        />
      </Modal>
    </div>
  );
}
