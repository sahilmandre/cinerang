import type { Metadata } from 'next';
import './globals.css';
import Navbar from '@/components/Navbar';

export const metadata: Metadata = {
  title: 'Cinejoy Clone — Watch Movies & TV',
  description: 'TMDB-powered streaming UI with multi-server player, like cinejoy.pk',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-base antialiased">
        <Navbar />
        <main className="mx-auto max-w-7xl px-4 pb-20">{children}</main>
        <footer className="border-t border-white/10 py-6 text-center text-xs text-white/40">
          Educational clone for UI purposes. Metadata by TMDB. Video is embedded from
          third-party servers you configure — ensure you have rights to play it in your region.
        </footer>
      </body>
    </html>
  );
}
