'use client';

import Link from 'next/link';
import { usePathname, useParams } from 'next/navigation';
import { cn } from '@/lib/utils';

const TABS = [
  { label: 'Employment & Resignation', slug: 'employment' },
  { label: 'Cycle Recipients', slug: 'recipients' },
  { label: 'Company Agreements', slug: 'agreements' },
  { label: 'Finances', slug: 'finances' },
];

export default function CompanyPoliciesLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const params = useParams<{ tenantSlug: string }>();
  const base = `/${params.tenantSlug}/hr/hrmanagement/companyPolicies`;

  return (
    <div className="flex flex-col gap-6">
      <div className="shrink-0">
        <h2 className="text-base font-semibold text-gray-900">Company Policies</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Configure default HR policies for your organisation
        </p>
      </div>

      <div className="flex items-end gap-1 border-b border-gray-200 shrink-0">
        {TABS.map((tab) => {
          const href = `${base}/${tab.slug}`;
          const isActive = pathname === href || pathname.startsWith(href + '/');
          return (
            <Link
              key={tab.slug}
              href={href}
              className={cn(
                'relative px-6 py-3 text-sm transition-colors whitespace-nowrap',
                isActive
                  ? 'text-brand font-semibold after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-brand after:rounded-t-full'
                  : 'text-gray-500 hover:text-gray-800',
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      <div>{children}</div>
    </div>
  );
}
