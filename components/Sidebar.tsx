"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { createClient } from "@/lib/supabase/client";
import { useNewExpense } from "@/components/AppShell";
import {
  BudgetIcon,
  DashboardIcon,
  ExpenseIcon,
  FixedIcon,
  IncomeIcon,
  InvestmentIcon,
  LessonsIcon,
  LogoutIcon,
  PlusIcon,
  ProjectIcon,
} from "@/components/icons";

const items = [
  { href: "/dashboard", label: "Dashboard", Icon: DashboardIcon },
  { href: "/gastos", label: "Gastos", Icon: ExpenseIcon },
  { href: "/entradas", label: "Entradas", Icon: IncomeIcon },
  { href: "/aulas", label: "Aulas", Icon: LessonsIcon },
  { href: "/fixos", label: "Fixos & Parcelas", Icon: FixedIcon },
  { href: "/investimentos", label: "Investimentos", Icon: InvestmentIcon },
  { href: "/projetos", label: "Projetos", Icon: ProjectIcon },
];

const linkBase =
  "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors";

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
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-[var(--border)] bg-[var(--surface)] px-3 py-5 lg:flex">
      <Link
        href="/dashboard"
        className="mb-6 px-2 text-base font-semibold tracking-tight text-[var(--fg)]"
      >
        Fin
      </Link>

      <Button className="mb-6 w-full" onClick={openNewExpense}>
        <PlusIcon className="h-4 w-4" />
        Novo gasto
      </Button>

      <nav className="flex-1">
        <ul className="space-y-0.5">
          {items.map(({ href, label, Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`${linkBase} ${
                    active
                      ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                      : "text-[var(--fg-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--fg)]"
                  }`}
                >
                  <Icon className="h-[18px] w-[18px] shrink-0" />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="space-y-3 border-t border-[var(--border)] pt-4">
        <Link
          href="/orcamentos"
          aria-current={pathname === "/orcamentos" ? "page" : undefined}
          className={`${linkBase} ${
            pathname === "/orcamentos"
              ? "bg-[var(--accent-soft)] text-[var(--accent)]"
              : "text-[var(--fg-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--fg)]"
          }`}
        >
          <BudgetIcon className="h-[18px] w-[18px] shrink-0" />
          Orçamentos
        </Link>

        <ThemeToggle />

        <button
          type="button"
          onClick={logout}
          className={`${linkBase} w-full text-[var(--fg-muted)] hover:bg-[var(--negative-soft)] hover:text-[var(--negative)]`}
        >
          <LogoutIcon className="h-[18px] w-[18px] shrink-0" />
          Sair
        </button>
      </div>
    </aside>
  );
}
