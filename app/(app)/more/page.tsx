"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/PageHeader";

const links = [
  { href: "/entradas", label: "Entradas", desc: "Salário, bolsa, freelance" },
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

      <ul className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] divide-y divide-[var(--border)]">
        {links.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="flex items-center justify-between px-4 py-3.5 hover:bg-[var(--surface-2)]">
              <div>
                <p className="text-sm font-medium text-[var(--fg)]">{l.label}</p>
                <p className="text-xs text-[var(--fg-muted)]">{l.desc}</p>
              </div>
              <span className="text-[var(--fg-muted)]">→</span>
            </Link>
          </li>
        ))}
      </ul>

      <Button variant="danger" className="w-full" onClick={logout}>
        Sair
      </Button>
    </div>
  );
}
