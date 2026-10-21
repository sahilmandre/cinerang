/** Server-rendered building blocks shared by the admin pages. */
import { cn } from '@/lib/utils';

export function Section({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('mt-10', className)}>
      <div className="mb-3 flex flex-wrap items-end gap-x-4 gap-y-1 px-1">
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-lg font-semibold tracking-tight">{title}</h2>
          {description ? <p className="mt-0.5 text-sm text-white/60">{description}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

/** A row of headline numbers in one hairline-divided strip. */
export function StatStrip({
  stats,
  className,
}: {
  stats: { label: string; value: string | number; hint?: string }[];
  className?: string;
}) {
  return (
    <dl
      className={cn(
        'grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.08] sm:grid-cols-4',
        // Odd count on the 2-column phone layout: the last stat takes the
        // whole row instead of leaving an empty hairline cell.
        '[&>div:last-child:nth-child(odd)]:col-span-2 sm:[&>div:last-child:nth-child(odd)]:col-span-1',
        className
      )}
    >
      {stats.map((s) => (
        <div key={s.label} className="bg-[#0d130e] px-4 py-3.5">
          <dt className="text-xs font-medium text-white/60">{s.label}</dt>
          <dd className="mt-1 text-2xl font-semibold text-ink">
            {typeof s.value === 'number' ? compact(s.value) : s.value}
          </dd>
          {s.hint ? <p className="mt-0.5 text-[11px] text-white/50">{s.hint}</p> : null}
        </div>
      ))}
    </dl>
  );
}

/** 1,284 · 12.9K · 4.2M */
export function compact(n: number): string {
  return new Intl.NumberFormat('en', {
    notation: n >= 10_000 ? 'compact' : 'standard',
    maximumFractionDigits: 1,
  }).format(n);
}

const STATUS = {
  owner: 'border-accent-2/40 bg-accent-2/10 text-accent-2',
  admin: 'border-accent/40 bg-accent/10 text-accent',
  blocked: 'border-red-400/40 bg-red-500/10 text-red-300',
  neutral: 'border-white/15 bg-white/[0.04] text-white/70',
} as const;

export function Badge({ tone, children }: { tone: keyof typeof STATUS; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border px-1.5 py-0.5 text-[11px] font-semibold leading-none',
        STATUS[tone]
      )}
    >
      {children}
    </span>
  );
}

export function UserBadges({
  owner,
  role,
  banned,
}: {
  owner: boolean;
  role?: string | null;
  banned?: boolean | null;
}) {
  return (
    <span className="inline-flex flex-wrap gap-1">
      {owner ? <Badge tone="owner">Owner</Badge> : role === 'admin' ? <Badge tone="admin">Admin</Badge> : null}
      {banned ? <Badge tone="blocked">Blocked</Badge> : null}
    </span>
  );
}

export function Avatar({ name, image, size = 32 }: { name: string; image?: string | null; size?: number }) {
  if (image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={image}
        alt=""
        width={size}
        height={size}
        referrerPolicy="no-referrer"
        loading="lazy"
        className="shrink-0 rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      aria-hidden
      className="grid shrink-0 place-items-center rounded-full bg-white/10 font-semibold text-white/80"
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      {(name.trim()[0] ?? '?').toUpperCase()}
    </span>
  );
}

const RELATIVE = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

/** "5 minutes ago" — reads the same in every time zone. */
export function timeAgo(date: Date | string | number | null | undefined): string {
  if (date == null) return '—';
  const ms = new Date(date).getTime();
  if (!Number.isFinite(ms)) return '—';
  const s = Math.round((ms - Date.now()) / 1000);
  const abs = Math.abs(s);
  if (abs < 45) return 'just now';
  if (abs < 3600) return RELATIVE.format(Math.round(s / 60), 'minute');
  if (abs < 86_400) return RELATIVE.format(Math.round(s / 3600), 'hour');
  if (abs < 30 * 86_400) return RELATIVE.format(Math.round(s / 86_400), 'day');
  return new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function When({ date }: { date: Date | string | number | null | undefined }) {
  if (date == null) return <span className="text-white/50">—</span>;
  const iso = new Date(date).toISOString();
  return (
    <time dateTime={iso} title={iso.replace('T', ' ').slice(0, 16) + ' UTC'} className="whitespace-nowrap">
      {timeAgo(date)}
    </time>
  );
}

/** Share of a whole on a faint track of the same hue. */
export function Meter({ value, label }: { value: number; label: string }) {
  const pct = Math.max(0, Math.min(100, value * 100));
  return (
    <span
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      aria-label={label}
      className="block h-1.5 w-full overflow-hidden rounded-full bg-accent/15"
    >
      <span className="block h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
    </span>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-2xl border border-dashed border-white/15 px-4 py-8 text-center text-sm leading-relaxed text-white/60">
      {children}
    </p>
  );
}

/**
 * Dense table shell: wide tables scroll sideways on narrow screens instead
 * of squashing; `fit` tables (few columns) shrink to the screen instead.
 */
export function TableShell({
  children,
  label,
  fit = false,
}: {
  children: React.ReactNode;
  label: string;
  fit?: boolean;
}) {
  return (
    <div
      role="region"
      aria-label={label}
      tabIndex={0}
      className="overflow-x-auto rounded-2xl border border-white/[0.08] bg-[#0d130e]"
    >
      <table
        className={cn(
          'w-full border-collapse text-left text-sm',
          fit ? 'table-fixed' : 'min-w-[640px]'
        )}
      >
        {children}
      </table>
    </div>
  );
}

export const th = 'px-4 py-2.5 text-xs font-semibold text-white/60';
export const td = 'border-t border-white/[0.06] px-4 py-2.5 align-middle';
