/**
 * Shared page header for listing pages — aurora bar, display-font title,
 * optional count chip / extra content. `tone="danger"` switches to the
 * red treatment used by 18+ sections.
 */
export default function PageHeader({
  title,
  count,
  tone = 'accent',
  children,
}: {
  title: string;
  count?: string | number;
  tone?: 'accent' | 'danger';
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 px-1">
      <span
        aria-hidden
        className={`h-6 w-1 rounded-full ${
          tone === 'danger'
            ? 'bg-gradient-to-b from-red-500 to-red-800'
            : 'bg-gradient-to-b from-accent to-accent-2'
        }`}
      />
      <h1 className="font-display text-2xl font-bold tracking-tight sm:text-[1.7rem]">{title}</h1>
      {count != null ? (
        <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-xs tabular-nums text-white/40">
          {count}
        </span>
      ) : null}
      {children}
    </div>
  );
}
