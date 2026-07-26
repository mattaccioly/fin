"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { Amount } from "@/components/Amount";
import { useCurrency, useRowRates } from "@/components/CurrencyProvider";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { createClient } from "@/lib/supabase/client";
import type { AmountRow } from "@/lib/fx";
import { formatDateBR, parseAmountInput } from "@/lib/format";
import { projectReserve, reserveFundedRows, type ReserveExpenseRow } from "@/lib/reserves";
import type { Project, ProjectStatus } from "@/lib/types";

type ProjectCard = Project & {
  expenseRows: ReserveExpenseRow[];
  investmentRows: AmountRow[];
};

export function ProjectsList() {
  const supabase = useMemo(() => createClient(), []);
  const { mainCurrency, sum, format } = useCurrency();
  const [userId, setUserId] = useState<string | null>(null);
  const [items, setItems] = useState<ProjectCard[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("✈️");
  const [targetAmount, setTargetAmount] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [editing, setEditing] = useState<Project | null>(null);

  async function load(uid: string) {
    const { data: projects } = await supabase
      .from("projects")
      .select("*")
      .eq("user_id", uid)
      .neq("status", "archived")
      .order("created_at", { ascending: false });

    const list = (projects as Project[]) ?? [];
    const cards: ProjectCard[] = await Promise.all(
      list.map(async (p) => {
        const [{ data: exps }, { data: invs }] = await Promise.all([
          supabase
            .from("expenses")
            .select("amount, currency, date, paid_from_reserve")
            .eq("project_id", p.id),
          supabase.from("investments").select("amount, currency, date").eq("project_id", p.id),
        ]);
        return {
          ...p,
          expenseRows: (exps as ReserveExpenseRow[]) ?? [],
          investmentRows: (invs as AmountRow[]) ?? [],
        };
      }),
    );
    setItems(cards);
  }

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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load uses stable supabase
  }, [supabase]);

  const projectRows = useMemo(
    () => items.flatMap((p) => [...p.expenseRows, ...p.investmentRows]),
    [items],
  );

  useRowRates(projectRows);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!userId || !name.trim()) return;
    const target = targetAmount ? parseAmountInput(targetAmount) : null;
    if (targetAmount && target === null) {
      toast.error("Meta inválida");
      return;
    }
    const payload = {
      user_id: userId,
      name: name.trim(),
      emoji: emoji || "🎯",
      target_amount: target,
      target_date: targetDate || null,
      status: (editing?.status ?? "active") as ProjectStatus,
    };
    const { error } = editing
      ? await supabase.from("projects").update(payload).eq("id", editing.id)
      : await supabase.from("projects").insert(payload);
    if (error) {
      toast.error("Erro ao salvar");
      return;
    }
    toast.success("Projeto salvo");
    setShowForm(false);
    setEditing(null);
    setName("");
    setEmoji("✈️");
    setTargetAmount("");
    setTargetDate("");
    await load(userId);
  }

  async function setStatus(id: string, status: ProjectStatus) {
    if (!userId) return;
    if (status === "archived" && !confirm("Arquivar este projeto?")) return;
    const { error } = await supabase.from("projects").update({ status }).eq("id", id);
    if (error) {
      toast.error("Erro ao atualizar projeto");
      return;
    }
    toast.success(status === "completed" ? "Projeto concluído" : "Projeto arquivado");
    await load(userId);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Projetos"
        subtitle="Metas com gastos e reservas"
        action={
          <Button
            size="sm"
            onClick={() => {
              setShowForm(true);
              setEditing(null);
            }}
          >
            Novo projeto
          </Button>
        }
      />

      {showForm && (
        <form
          onSubmit={handleSave}
          className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4"
        >
          <div className="grid grid-cols-[72px_1fr] gap-3">
            <div>
              <Label htmlFor="p-emoji">Emoji</Label>
              <Input id="p-emoji" value={emoji} onChange={(e) => setEmoji(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="p-name">Nome</Label>
              <Input id="p-name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="p-target">Meta ({mainCurrency})</Label>
              <Input
                id="p-target"
                inputMode="decimal"
                value={targetAmount}
                onChange={(e) => setTargetAmount(e.target.value)}
                placeholder="Opcional"
              />
            </div>
            <div>
              <Label htmlFor="p-date">Prazo</Label>
              <Input
                id="p-date"
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="submit" className="flex-1">
              Salvar
            </Button>
            <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>
              Cancelar
            </Button>
          </div>
        </form>
      )}

      {items.length === 0 ? (
        <EmptyState
          title="Nenhum projeto"
          description="Ex.: Viagem Europa, Morar sozinho — vincule gastos e aportes."
        />
      ) : (
        <ul className="space-y-3 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0 xl:grid-cols-3">
          {items.map((p) => {
            const spent = sum(p.expenseRows).total;
            const reserved = sum(p.investmentRows).total;
            const used = sum(reserveFundedRows(p.expenseRows)).total;
            const { available } = projectReserve({ reservedTotal: reserved, usedTotal: used });
            const progressBase = p.target_amount ? Number(p.target_amount) : null;
            const pct = progressBase ? Math.min(100, (reserved / progressBase) * 100) : null;
            return (
              <li key={p.id}>
                <Link
                  href={`/projetos/${p.id}`}
                  className="block rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 transition hover:border-[var(--accent)]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-lg font-medium text-[var(--fg)]">
                        {p.emoji} {p.name}
                      </p>
                      <p className="mt-1 text-xs text-[var(--fg-muted)]">
                        Gasto {format(spent)} · Reservado {format(reserved)}
                        {reserved > 0 ? ` · Disponível ${format(available)}` : ""}
                        {p.target_date ? ` · até ${formatDateBR(p.target_date)}` : ""}
                      </p>
                    </div>
                    <span className="rounded-lg bg-[var(--surface-2)] px-2 py-0.5 text-xs text-[var(--fg-muted)]">
                      {p.status === "active" ? "ativo" : p.status === "completed" ? "concluído" : "arquivo"}
                    </span>
                  </div>
                  {progressBase && (
                    <div className="mt-3">
                      <div className="mb-1 flex justify-between text-xs text-[var(--fg-muted)]">
                        <span>Meta {format(progressBase)}</span>
                        <span>{pct?.toFixed(0)}%</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-2)]">
                        <div className="h-full bg-[var(--accent)]" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )}
                </Link>
                <div className="mt-1 flex gap-2 px-1">
                  <button
                    type="button"
                    className="text-xs text-[var(--fg-muted)]"
                    onClick={() => {
                      setEditing(p);
                      setShowForm(true);
                      setName(p.name);
                      setEmoji(p.emoji);
                      setTargetAmount(p.target_amount ? String(p.target_amount).replace(".", ",") : "");
                      setTargetDate(p.target_date ?? "");
                    }}
                  >
                    Editar
                  </button>
                  {p.status === "active" && (
                    <button
                      type="button"
                      className="text-xs text-[var(--positive)]"
                      onClick={() => setStatus(p.id, "completed")}
                    >
                      Concluir
                    </button>
                  )}
                  <button
                    type="button"
                    className="text-xs text-[var(--fg-muted)]"
                    onClick={() => setStatus(p.id, "archived")}
                  >
                    Arquivar
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function ProjectDetail({ projectId }: { projectId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const { format, sum } = useCurrency();
  const [project, setProject] = useState<Project | null>(null);
  const [timeline, setTimeline] = useState<
    {
      id: string;
      kind: "expense" | "investment";
      date: string;
      amount: number;
      currency: string;
      label: string;
      paidFromReserve?: boolean;
    }[]
  >([]);
  const [investmentRows, setInvestmentRows] = useState<AmountRow[]>([]);
  const [reserveExpenseRows, setReserveExpenseRows] = useState<AmountRow[]>([]);

  useRowRates([...timeline, ...investmentRows, ...reserveExpenseRows]);

  useEffect(() => {
    async function load() {
      const { data: p } = await supabase.from("projects").select("*").eq("id", projectId).single();
      if (!p) return;
      setProject(p as Project);

      const [{ data: exps }, { data: invs }] = await Promise.all([
        supabase
          .from("expenses")
          .select("id, date, amount, currency, description, paid_from_reserve, categories(name, icon)")
          .eq("project_id", projectId)
          .order("date", { ascending: false }),
        supabase
          .from("investments")
          .select("id, date, amount, currency, vehicle, description")
          .eq("project_id", projectId)
          .order("date", { ascending: false }),
      ]);

      type ExpRow = {
        id: string;
        date: string;
        amount: number;
        currency: string;
        description: string | null;
        paid_from_reserve: boolean;
        categories: { name: string; icon: string } | { name: string; icon: string }[] | null;
      };

      const expRows = (exps ?? []) as unknown as ExpRow[];
      const invRows = (invs ?? []) as unknown as Array<{
        id: string;
        date: string;
        amount: number;
        currency: string;
        vehicle: string;
        description: string | null;
      }>;

      setInvestmentRows(
        invRows.map((i) => ({ amount: Number(i.amount), currency: i.currency, date: i.date })),
      );
      setReserveExpenseRows(
        expRows
          .filter((e) => e.paid_from_reserve)
          .map((e) => ({ amount: Number(e.amount), currency: e.currency, date: e.date })),
      );

      const rows = [
        ...expRows.map((e) => {
          const cat = Array.isArray(e.categories) ? e.categories[0] : e.categories;
          return {
            id: e.id,
            kind: "expense" as const,
            date: e.date,
            amount: Number(e.amount),
            currency: e.currency,
            label: e.description || `${cat?.icon ?? ""} ${cat?.name ?? "Gasto"}`,
            paidFromReserve: !!e.paid_from_reserve,
          };
        }),
        ...invRows.map((i) => ({
          id: i.id,
          kind: "investment" as const,
          date: i.date,
          amount: Number(i.amount),
          currency: i.currency,
          label: i.description || i.vehicle,
        })),
      ].sort((a, b) => (a.date < b.date ? 1 : -1));

      setTimeline(rows);
    }
    void load();
  }, [supabase, projectId]);

  if (!project) {
    return <p className="text-sm text-[var(--fg-muted)]">Carregando…</p>;
  }

  const reserved = sum(investmentRows).total;
  const used = sum(reserveExpenseRows).total;
  const { available } = projectReserve({ reservedTotal: reserved, usedTotal: used });

  return (
    <div className="space-y-6">
      <div>
        <Link href="/projetos" className="text-sm text-[var(--fg-muted)] hover:text-[var(--fg)]">
          ← Projetos
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-[var(--fg)]">
          {project.emoji} {project.name}
        </h1>
        {project.target_amount && (
          <p className="text-sm text-[var(--fg-muted)]">
            Meta {format(project.target_amount)}
            {project.target_date ? ` · ${formatDateBR(project.target_date)}` : ""}
          </p>
        )}
        {reserved > 0 && (
          <p className="mt-1 text-sm text-[var(--fg-muted)]">
            Reservado {format(reserved)} · Usado da reserva {format(used)} · Disponível{" "}
            {format(available)}
          </p>
        )}
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-[var(--fg-muted)]">Timeline</h2>
        {timeline.length === 0 ? (
          <EmptyState
            title="Nenhuma transação"
            description="Vincule gastos ou aportes a este projeto ao registrá-los."
          />
        ) : (
          <ul className="divide-y divide-[var(--border)] rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
            {timeline.map((t) => (
              <li key={`${t.kind}-${t.id}`} className="flex items-center gap-3 px-3 py-3">
                <span className="text-xs uppercase text-[var(--fg-muted)] w-16">
                  {t.kind === "expense" ? "Gasto" : "Aporte"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-[var(--fg)]">{t.label}</p>
                  <p className="text-xs text-[var(--fg-muted)]">
                    {formatDateBR(t.date)}
                    {t.paidFromReserve ? " · da reserva" : ""}
                  </p>
                </div>
                <Amount
                  value={t.amount}
                  currency={t.currency}
                  date={t.date}
                  className={`text-right tabular-nums text-sm font-semibold ${
                    t.kind === "investment" ? "text-sky-400" : "text-[var(--fg)]"
                  }`}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
