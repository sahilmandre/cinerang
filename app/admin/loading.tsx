/** Skeleton while an admin page's queries run — same geometry as the content. */
export default function AdminLoading() {
  return (
    <div aria-busy="true" aria-label="Loading" className="pb-6">
      <div className="mt-10 h-5 w-24 rounded bg-white/[0.06]" />
      <div className="shimmer mt-3 grid h-[88px] rounded-2xl border border-white/[0.08] bg-white/[0.03]" />
      <div className="mt-10 h-5 w-32 rounded bg-white/[0.06]" />
      <div className="shimmer mt-3 h-72 rounded-2xl border border-white/[0.08] bg-white/[0.03]" />
    </div>
  );
}
