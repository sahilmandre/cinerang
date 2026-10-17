export default function Loading() {
  return (
    <div className="mt-2 animate-pulse" aria-hidden>
      <div className="shimmer h-72 rounded-none bg-white/5 sm:h-80 sm:rounded-[28px]" />
      {[0, 1].map((r) => (
        <div key={r} className="mt-10">
          <div className="mb-3.5 h-5 w-44 rounded bg-white/10" />
          <div className="flex gap-3.5 overflow-hidden">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="w-[136px] shrink-0 sm:w-[148px] md:w-[160px]">
                <div className="aspect-[2/3] rounded-2xl bg-white/5" />
                <div className="mt-2 h-3 rounded bg-white/5" />
              </div>
            ))}
          </div>
        </div>
      ))}
      <span className="sr-only">Loading titles…</span>
    </div>
  );
}
