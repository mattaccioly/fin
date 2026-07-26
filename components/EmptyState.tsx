export function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-[var(--border)] px-4 py-10 text-center">
      <p className="text-sm font-medium text-[var(--fg)]">{title}</p>
      <p className="mx-auto mt-1 max-w-xs text-sm text-[var(--fg-muted)]">
        {description}
      </p>
    </div>
  );
}
