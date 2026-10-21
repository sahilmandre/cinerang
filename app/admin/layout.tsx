import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/admin';
import PageHeader from '@/components/PageHeader';
import AdminNav from '@/components/admin/AdminNav';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Admin — CineRang',
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Not an admin (or signed out): a plain 404 — the panel isn't advertised.
  // Every page checks again: on in-app navigation Next renders the page
  // without re-running this layout.
  await requireAdmin();
  return (
    <div className="mt-8">
      <PageHeader title="Admin" />
      <AdminNav />
      {children}
    </div>
  );
}
