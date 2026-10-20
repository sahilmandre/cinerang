export default function Loading() {
  return (
    <div className="mt-2 animate-pulse">
      {/* Skeleton is decorative; the status text below is what screen
          readers announce (aria-hidden on the wrapper used to hide it). */}
      <div aria-hidden>
        {/* Mirrors the real Hero: full-bleed on mobile, inset + rounded from
            sm up, same height clamp — otherwise the page jumps on load. */}
        <div className="shimmer -mx-4 h-[68vh] min-h-[460px] max-h-[620px] bg-white/5 sm:mx-0 sm:h-[64vh] sm:min-h-[500px] sm:rounded-[28px]" />
        {[0, 1].map((r) => (
          <div key={r} className="mt-10">
            <div className="mb-3.5 h-5 w-44 rounded bg-white/10" />
            {/* Same strip geometry as components/Row.tsx (`-mx-4` + `px-4`), and
                enough cards to overflow it, so the strip is clipped at the
                container edge exactly like the loaded row instead of stopping
                short and leaving a hole. */}
            <div className="no-scrollbar -mx-4 flex gap-3.5 overflow-hidden px-4 pb-2.5 md:gap-4">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="w-[136px] shrink-0 sm:w-[148px] md:w-[160px]">
                  <div className="aspect-[2/3] rounded-2xl bg-white/5" />
                  <div className="mt-2 h-3 rounded bg-white/5" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <span role="status" className="sr-only">
        Loading titles…
      </span>
    </div>
  );
}
