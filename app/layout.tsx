import type { Metadata } from 'next';
import './globals.css';
import Navbar from '@/components/Navbar';

export const metadata: Metadata = {
  title: 'CineRang — Watch Movies, TV & Anime',
  description: 'Discover trending movies, TV shows and anime with a multi-server player.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-base antialiased">
        <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(60rem_30rem_at_50%_-10rem,rgba(149,255,80,0.07),transparent)]" />
        <Navbar />
        <main className="mx-auto max-w-7xl px-4 pb-20">{children}</main>
        <footer className="border-t border-white/[0.07] py-8 text-center">
          <p className="text-sm font-semibold">
            cine<span className="text-accent">rang</span>
          </p>
          <p className="mx-auto mt-1 max-w-xl text-xs leading-relaxed text-white/40">
            Discovery UI for education. Metadata by TMDB. Video is embedded from
            third-party servers you configure — ensure you have rights to play it
            in your region.
          </p>
        </footer>
      </body>
    </html>
  );
}
