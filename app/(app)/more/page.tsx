"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { MainCurrencySetting } from "@/components/MainCurrencySetting";
import { PageHeader } from "@/components/PageHeader";
import { ThemeToggle } from "@/components/ThemeToggle";

const links = [
  { href: "/entradas", label: "Entradas", desc: "Salário, bolsa, freelance" },
  { href: "/aulas", label: "Aulas", desc: "Alunos, aulas e pagamentos" },
  { href: "/fixos", label: "Fixos & Parcelas", desc: "Contas mensais e parcelamentos" },
  { href: "/investimentos", label: "Investimentos", desc: "Registro de aportes" },
  { href: "/projetos", label: "Projetos", desc: "Metas com gastos e reservas" },
  { href: "/orcamentos", label: "Orçamentos", desc: "Metas por categoria" },
];

export default function MorePage() {
  const router = useRouter();

  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Mais" subtitle="Estrutura financeira e conta" />

      <ul className="divide-y divide-[var(--border)] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
        {links.map((l) => (
          <li key={l.href}>
            <Link
              href={l.href}
              className="flex items-center justify-between gap-3 px-4 py-3.5 transition-colors hover:bg-[var(--surface-2)]"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-[var(--fg)]">{l.label}</p>
                <p className="text-xs text-[var(--fg-muted)]">{l.desc}</p>
              </div>
              <span className="text-[var(--fg-muted)]" aria-hidden>
                →
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-[var(--fg-muted)]">Moeda principal</h2>
        <MainCurrencySetting />
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-[var(--fg-muted)]">Aparência</h2>
        <ThemeToggle showLabels />
      </section>

      <Button variant="danger" className="w-full" onClick={logout}>
        Sair
      </Button>
    </div>
  );
}
