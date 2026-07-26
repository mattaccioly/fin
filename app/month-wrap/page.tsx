import { Suspense } from "react";
import { MonthWrapView } from "@/components/MonthWrapView";

export default function MonthWrapPage() {
  return (
    <main className="mx-auto min-h-dvh max-w-lg px-4 py-6">
      <Suspense fallback={<p className="text-sm text-[var(--fg-muted)]">Carregando…</p>}>
        <MonthWrapView />
      </Suspense>
    </main>
  );
}
