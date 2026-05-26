'use client';

import Link from 'next/link';
import { usePathname, useParams } from 'next/navigation';
import { cn } from '@/lib/utils';
import { pagePx, pageHeader, pageContent } from '@/lib/layout';

interface TabItem {
  label: string;
  href: string;
}

function SettingsTabs({ tabs }: { tabs: TabItem[] }) {
  const pathname = usePathname();

  return (
    <div
      className={cn(
        pagePx,
        'flex items-end gap-1 border-b border-gray-200 bg-white overflow-x-auto [&::-webkit-scrollbar]:hidden [scrollbar-width:none]',
      )}
    >
      {tabs.map((tab) => {
        const isActive = pathname === tab.href || pathname.startsWith(tab.href + '/');
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              'relative px-4 py-3 text-sm transition-colors whitespace-nowrap',
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
  );
}

export default function ReinsuranceSettingsLayout({ children }: { children: React.ReactNode }) {
  const params = useParams<{ tenantSlug: string }>();
  const base = `/${params.tenantSlug}/operations/reinsurance/settings`;

  const tabs: TabItem[] = [
    { label: 'Cedants', href: `${base}/cedants` },
    { label: 'Reinsurers', href: `${base}/reinsurers` },
    { label: 'Brokers', href: `${base}/brokers` },
    { label: 'Risk Types', href: `${base}/risk-types` },
    { label: 'Risk Classes', href: `${base}/risk-classes` },
    { label: 'Currency', href: `${base}/currency` },
  ];

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Sticky header + tabs */}
      <div className="shrink-0 bg-white">
        <div className={pageHeader}>
          <h1 className="text-xl font-semibold text-gray-900">System Settings</h1>
        </div>
        <SettingsTabs tabs={tabs} />
      </div>

      {/* Content */}
      <main className={cn(pageContent, 'flex-1 min-h-0 overflow-y-auto bg-gray-50 flex flex-col')}>
        {children}
      </main>
    </div>
  );
}
