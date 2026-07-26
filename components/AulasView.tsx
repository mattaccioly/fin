"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { StudentsPanel } from "@/components/StudentsPanel";
import { LessonsPanel } from "@/components/LessonsPanel";

type Tab = "aulas" | "alunos";

export function AulasView() {
  const searchParams = useSearchParams();
  const incomeFilter = searchParams.get("income");
  const [tab, setTab] = useState<Tab>("aulas");

  useEffect(() => {
    if (incomeFilter) setTab("aulas");
  }, [incomeFilter]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Aulas"
        subtitle="Alunos, aulas dadas e pagamentos"
      />

      <div className="flex gap-1 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1">
        {(
          [
            { id: "aulas" as const, label: "Aulas" },
            { id: "alunos" as const, label: "Alunos" },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
              tab === t.id
                ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                : "text-[var(--fg-muted)] hover:text-[var(--fg)]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "aulas" ? (
        <LessonsPanel incomeFilter={incomeFilter} />
      ) : (
        <StudentsPanel />
      )}
    </div>
  );
}
