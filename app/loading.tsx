export default function Loading() {
  return (
    <div className="mt-6 animate-pulse">
      <div className="h-[320px] rounded-2xl bg-white/5 md:h-[380px]" />
      {[0, 1].map((r) => (
        <div key={r} className="mt-8">
          <div className="mb-3 h-5 w-40 rounded bg-white/10" />
          <div className="flex gap-3 overflow-hidden">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="w-[140px] shrink-0 md:w-[160px]">
                <div className="aspect-[2/3] rounded-xl bg-white/5" />
                <div className="mt-2 h-3 rounded bg-white/5" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
