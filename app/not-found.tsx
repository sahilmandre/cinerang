import Link from 'next/link';
import { Ghost } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="mx-auto mt-8 max-w-md rounded-2xl border border-white/[0.07] bg-card/60 p-8 text-center sm:mt-10">
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-white/5 text-white/40">
        <Ghost size={22} aria-hidden />
      </span>
      <h1 className="mt-3 text-xl font-bold tracking-tight">Page not found</h1>
      <p className="mt-1 text-sm text-white/50">
        This title, category or page doesn&apos;t exist (anymore).
      </p>
      <Link
        href="/"
        className="mt-5 inline-block rounded-xl bg-accent px-6 py-2.5 text-sm font-bold text-black shadow-lg shadow-accent/30 transition hover:shadow-glow"
      >
        Back to home
      </Link>
    </div>
  );
}
