'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const TABS = [
  { href: '/admin', label: 'Overview' },
  { href: '/admin/users', label: 'Users' },
];

export default function AdminNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Admin" className="mt-4 flex gap-1 border-b border-white/[0.08] px-1">
      {TABS.map((tab) => {
        const active =
          tab.href === '/admin' ? pathname === '/admin' : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              '-mb-px border-b-2 px-3 py-2 text-sm font-semibold transition-colors duration-150',
              active
                ? 'border-accent text-white'
                : 'border-transparent text-white/60 hover:text-white'
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
