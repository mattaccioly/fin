import { DesktopRedirect } from "@/components/DesktopRedirect";
import { QuickExpense } from "@/components/QuickExpense";

export default function HomePage() {
  return (
    <>
      <DesktopRedirect />
      <div className="lg:hidden">
        <QuickExpense />
      </div>
      <p className="hidden text-sm text-[var(--fg-muted)] lg:block">
        Abrindo o dashboard…
      </p>
    </>
  );
}
