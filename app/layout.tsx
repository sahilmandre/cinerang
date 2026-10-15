import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Navbar from '@/components/Navbar';

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'CineRang — Watch Movies, TV & Anime',
  description: 'Discover trending movies, TV shows and anime with a multi-server player.',
};

export const viewport = {
  themeColor: '#0a0f0a',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen bg-base font-sans text-ink antialiased">
        <a
          href="#content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-accent focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-black"
        >
          Skip to content
        </a>
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(60rem_30rem_at_50%_-10rem,rgba(149,255,80,0.07),transparent)]"
        />
        <Navbar />
        <main id="content" className="mx-auto w-full max-w-7xl px-4 pb-20">
          {children}
        </main>
        <footer className="border-t border-white/[0.07] py-8">
          <div className="mx-auto max-w-7xl px-4 text-center">
            <p className="text-sm font-semibold">
              cine<span className="text-accent">rang</span>
            </p>
            <p className="mx-auto mt-1 max-w-xl text-xs leading-relaxed text-white/40">
              Discovery UI for education. Metadata by TMDB. Video is embedded from
              third-party servers you configure — ensure you have rights to play it
              in your region.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
