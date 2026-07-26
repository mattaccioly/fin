export function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)]/50 px-4 py-8 text-center">
      <p className="text-[var(--fg)] font-medium">{title}</p>
      <p className="mt-1 text-sm text-[var(--fg-muted)]">{description}</p>
    </div>
  );
}
