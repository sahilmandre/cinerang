import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import { Inter, Outfit } from 'next/font/google';
import './globals.css';
import Navbar from '@/components/Navbar';
import SyncProvider from '@/components/SyncProvider';
import { Analytics } from '@vercel/analytics/next';

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-inter',
});

const outfit = Outfit({
  subsets: ['latin'],
  weight: ['500', '600', '700', '800'],
  display: 'swap',
  variable: '--font-outfit',
});

export const metadata: Metadata = {
  title: 'CineRang — Watch Movies, TV & Anime',
  description: 'Discover trending movies, TV shows and anime with a multi-server player.',
};

export const viewport: Viewport = {
  themeColor: '#0a0e0a',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${outfit.variable}`}>
      <body className="min-h-screen bg-base font-sans text-ink antialiased">
        <a
          href="#content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[70] focus:rounded-lg focus:bg-aurora focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-black"
        >
          Skip to content
        </a>
        {/* Ambient aurora glows — fixed, GPU-composited, zero layout cost */}
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(52rem_26rem_at_18%_-8rem,rgba(149,255,80,0.08),transparent),radial-gradient(44rem_24rem_at_88%_-6rem,rgba(45,212,191,0.06),transparent)]"
        />
        <Navbar />
        <main id="content" className="mx-auto w-full max-w-7xl px-4 pb-28 lg:pb-20">
          {children}
        </main>
        <footer className="border-t border-white/[0.06] py-10">
          <div className="mx-auto max-w-7xl px-4 text-center">
            <p className="font-display text-lg font-bold tracking-tight">
              cine<span className="text-aurora">rang</span>
            </p>
            <p className="mx-auto mt-2 max-w-xl text-xs leading-relaxed text-white/35">
              Discovery UI for education. Metadata by TMDB. Video is embedded from
              third-party servers you configure — ensure you have rights to play it
              in your region.
            </p>
            <Link
              href="/privacy"
              className="mt-3 inline-block text-xs font-semibold text-white/45 transition hover:text-accent"
            >
              Privacy Policy
            </Link>
          </div>
        </footer>
        <SyncProvider />
        <Analytics />
      </body>
    </html>
  );
}
