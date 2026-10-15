export default function Loading() {
  return (
    <div className="mt-4 animate-pulse md:mt-5" aria-hidden>
      <div className="shimmer h-[260px] rounded-2xl bg-white/5 sm:h-[300px] md:h-[400px]" />
      {[0, 1].map((r) => (
        <div key={r} className="mt-8">
          <div className="mb-3 h-5 w-40 rounded bg-white/10" />
          <div className="flex gap-3 overflow-hidden">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="w-[136px] shrink-0 sm:w-[148px] md:w-[160px]">
                <div className="aspect-[2/3] rounded-xl bg-white/5" />
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
