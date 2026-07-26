"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  DashboardIcon,
  ExpenseIcon,
  MoreIcon,
  PlusIcon,
} from "@/components/icons";

const items = [
  { href: "/", label: "Registrar", Icon: PlusIcon },
  { href: "/dashboard", label: "Dashboard", Icon: DashboardIcon },
  { href: "/gastos", label: "Gastos", Icon: ExpenseIcon },
  { href: "/more", label: "Mais", Icon: MoreIcon },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border)] bg-[var(--surface)]/90 backdrop-blur-md lg:hidden">
      <ul className="mx-auto flex max-w-lg items-stretch justify-around px-2 pt-1">
        {items.map(({ href, label, Icon }) => {
          const active =
            href === "/"
              ? pathname === "/"
              : pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center gap-1 rounded-xl px-2 py-2 text-[11px] font-medium transition-colors ${
                  active
                    ? "text-[var(--accent)]"
                    : "text-[var(--fg-muted)] hover:text-[var(--fg)]"
                }`}
              >
                <Icon className="h-5 w-5" />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
