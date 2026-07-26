import { Suspense } from "react";
import { AulasView } from "@/components/AulasView";

export default function AulasPage() {
  return (
    <Suspense fallback={<p className="text-sm text-[var(--fg-muted)]">Carregando…</p>}>
      <AulasView />
    </Suspense>
  );
}
