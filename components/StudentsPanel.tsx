"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select, Textarea } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { DataTable, type Column } from "@/components/DataTable";
import { EmptyState } from "@/components/EmptyState";
import { useCurrency } from "@/components/CurrencyProvider";
import { createClient } from "@/lib/supabase/client";
import { parseAmountInput } from "@/lib/format";
import {
  BILLING_MODE_LABELS,
  type BillingMode,
  type Student,
} from "@/lib/types";

export function StudentsPanel() {
  const supabase = useMemo(() => createClient(), []);
  const { format } = useCurrency();
  const [userId, setUserId] = useState<string | null>(null);
  const [items, setItems] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInactive, setShowInactive] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Student | null>(null);

  const load = useCallback(
    async (uid: string) => {
      const { data, error } = await supabase
        .from("students")
        .select("*")
        .eq("user_id", uid)
        .order("name");
      if (error) toast.error("Erro ao carregar alunos");
      else setItems((data as Student[]) ?? []);
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

  const visible = useMemo(
    () => (showInactive ? items : items.filter((s) => s.active)),
    [items, showInactive],
  );

  async function handleDelete(id: string) {
    if (!userId || !confirm("Excluir este aluno?")) return;
    const { error } = await supabase.from("students").delete().eq("id", id);
    if (error) {
      toast.error("Não foi possível excluir. Inative o aluno se houver aulas vinculadas.");
      return;
    }
    toast.success("Aluno excluído");
    await load(userId);
  }

  function openEdit(student: Student) {
    setEditing(student);
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditing(null);
  }

  const columns: Column<Student>[] = [
    {
      key: "name",
      header: "Nome",
      sortValue: (r) => r.name,
      render: (r) => <span className="font-medium">{r.name}</span>,
    },
    {
      key: "guardian",
      header: "Responsável",
      sortValue: (r) => r.financial_guardian,
      render: (r) => (
        <span className="text-[var(--fg-muted)]">{r.financial_guardian || "—"}</span>
      ),
    },
    {
      key: "mode",
      header: "Modo",
      render: (r) => BILLING_MODE_LABELS[r.billing_mode],
    },
    {
      key: "rate",
      header: "Valor padrão",
      align: "right",
      sortValue: (r) => Number(r.default_rate),
      render: (r) => (
        <span className="tabular-nums">{format(r.default_rate)}</span>
      ),
    },
    {
      key: "active",
      header: "Ativo",
      render: (r) =>
        r.active ? (
          <span className="text-[var(--positive)]">Sim</span>
        ) : (
          <span className="text-[var(--fg-muted)]">Não</span>
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
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-sm text-[var(--fg-muted)]">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
            className="accent-[var(--accent)]"
          />
          Mostrar inativos
        </label>
        <Button
          size="sm"
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          Novo aluno
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-[var(--fg-muted)]">Carregando…</p>
      ) : visible.length === 0 ? (
        <EmptyState
          title="Nenhum aluno"
          description="Cadastre um aluno para começar a registrar aulas."
        />
      ) : (
        <>
          <div className="hidden lg:block">
            <DataTable
              columns={columns}
              rows={visible}
              rowKey={(r) => r.id}
              onRowClick={openEdit}
              initialSort={{ key: "name", dir: "asc" }}
            />
          </div>

          <ul className="divide-y divide-[var(--border)] rounded-2xl border border-[var(--border)] bg-[var(--surface)] lg:hidden">
            {visible.map((s) => (
              <li key={s.id} className="flex items-center gap-3 px-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[var(--fg)]">
                    {s.name}
                    {!s.active ? (
                      <span className="ml-2 text-xs text-[var(--fg-muted)]">inativo</span>
                    ) : null}
                  </p>
                  <p className="text-xs text-[var(--fg-muted)]">
                    {BILLING_MODE_LABELS[s.billing_mode]} · {format(s.default_rate)}
                    {s.financial_guardian ? ` · ${s.financial_guardian}` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  className="rounded-lg px-2 py-1 text-xs text-[var(--fg-muted)] hover:bg-[var(--surface-2)]"
                  onClick={() => openEdit(s)}
                >
                  Editar
                </button>
                <button
                  type="button"
                  className="rounded-lg px-2 py-1 text-xs text-[var(--negative)] hover:bg-[var(--negative-soft)]"
                  onClick={() => void handleDelete(s.id)}
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
        title={editing ? "Editar aluno" : "Novo aluno"}
      >
        <StudentForm
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

function StudentForm({
  userId,
  editing,
  onSaved,
}: {
  userId: string | null;
  editing: Student | null;
  onSaved: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [name, setName] = useState("");
  const [guardian, setGuardian] = useState("");
  const [billingMode, setBillingMode] = useState<BillingMode>("per_class");
  const [rate, setRate] = useState("");
  const [active, setActive] = useState(true);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editing) {
      setName("");
      setGuardian("");
      setBillingMode("per_class");
      setRate("");
      setActive(true);
      setNotes("");
      return;
    }
    setName(editing.name);
    setGuardian(editing.financial_guardian);
    setBillingMode(editing.billing_mode);
    setRate(String(editing.default_rate).replace(".", ","));
    setActive(editing.active);
    setNotes(editing.notes ?? "");
  }, [editing]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;
    const value = parseAmountInput(rate);
    if (value === null) {
      toast.error("Valor padrão inválido");
      return;
    }
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error("Informe o nome");
      return;
    }

    setSaving(true);
    const payload = {
      user_id: userId,
      name: trimmedName,
      financial_guardian: guardian.trim() || trimmedName,
      billing_mode: billingMode,
      default_rate: value,
      active,
      notes: notes.trim() || null,
    };

    const { error } = editing
      ? await supabase.from("students").update(payload).eq("id", editing.id)
      : await supabase.from("students").insert(payload);

    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar aluno");
      return;
    }
    toast.success(editing ? "Aluno atualizado" : "Aluno cadastrado");
    onSaved();
  }

  return (
    <form onSubmit={handleSave} className="space-y-3">
      <div>
        <Label htmlFor="stu-name">Nome</Label>
        <Input
          id="stu-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>
      <div>
        <Label htmlFor="stu-guardian">Responsável financeiro</Label>
        <Input
          id="stu-guardian"
          value={guardian}
          onChange={(e) => setGuardian(e.target.value)}
          placeholder="Deixe vazio para usar o nome do aluno"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="stu-mode">Cobrança</Label>
          <Select
            id="stu-mode"
            value={billingMode}
            onChange={(e) => setBillingMode(e.target.value as BillingMode)}
          >
            {(Object.keys(BILLING_MODE_LABELS) as BillingMode[]).map((m) => (
              <option key={m} value={m}>
                {BILLING_MODE_LABELS[m]}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="stu-rate">Valor padrão</Label>
          <Input
            id="stu-rate"
            inputMode="decimal"
            placeholder="0,00"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            required
          />
        </div>
      </div>
      <div>
        <Label htmlFor="stu-notes">Notas</Label>
        <Textarea
          id="stu-notes"
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Opcional"
        />
      </div>
      <label className="flex items-center gap-2 text-sm text-[var(--fg-muted)]">
        <input
          type="checkbox"
          checked={active}
          onChange={(e) => setActive(e.target.checked)}
          className="accent-[var(--accent)]"
        />
        Ativo
      </label>
      <Button type="submit" className="w-full" disabled={saving}>
        {saving ? "Salvando…" : editing ? "Atualizar aluno" : "Cadastrar aluno"}
      </Button>
    </form>
  );
}
