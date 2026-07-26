"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import { useNewExpense } from "@/components/AppShell";

const items = [
  { href: "/dashboard", label: "Dashboard", icon: "▤" },
  { href: "/gastos", label: "Gastos", icon: "↓" },
  { href: "/entradas", label: "Entradas", icon: "↑" },
  { href: "/fixos", label: "Fixos & Parcelas", icon: "↻" },
  { href: "/investimentos", label: "Investimentos", icon: "▲" },
  { href: "/projetos", label: "Projetos", icon: "◎" },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const openNewExpense = useNewExpense();

  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-[var(--border)] bg-[var(--surface)]/60 px-4 py-6 backdrop-blur-md lg:flex">
      <Link href="/dashboard" className="mb-6 px-2 text-lg font-semibold tracking-tight text-[var(--fg)]">
        Fin
      </Link>

      <Button className="mb-6 w-full" onClick={openNewExpense}>
        + Novo gasto
      </Button>

      <nav className="flex-1">
        <ul className="space-y-1">
          {items.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                    active
                      ? "bg-[var(--accent)]/15 text-[var(--accent)]"
                      : "text-[var(--fg-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--fg)]"
                  }`}
                >
                  <span className="w-5 text-center" aria-hidden>
                    {item.icon}
                  </span>
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="space-y-1 border-t border-[var(--border)] pt-4">
        <Link
          href="/orcamentos"
          className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
            pathname === "/orcamentos"
              ? "bg-[var(--accent)]/15 text-[var(--accent)]"
              : "text-[var(--fg-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--fg)]"
          }`}
        >
          <span className="w-5 text-center" aria-hidden>
            ◐
          </span>
          Orçamentos
        </Link>
        <button
          type="button"
          onClick={logout}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-[var(--fg-muted)] transition hover:bg-red-500/10 hover:text-red-400"
        >
          <span className="w-5 text-center" aria-hidden>
            ⏻
          </span>
          Sair
        </button>
      </div>
    </aside>
  );
}
