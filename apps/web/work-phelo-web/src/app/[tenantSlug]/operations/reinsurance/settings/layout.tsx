'use client';

import { useParams } from 'next/navigation';
import { cn } from '@/lib/utils';
import { pagePx, pageHeader, pageContent } from '@/lib/layout';
import { TabBar } from '@/components/molecules/shared/TabBar';

export default function ReinsuranceSettingsLayout({ children }: { children: React.ReactNode }) {
  const params = useParams<{ tenantSlug: string }>();
  const base = `/${params.tenantSlug}/operations/reinsurance/settings`;

  const tabs = [
    { key: 'risk-classes', label: 'Risk Class', href: `${base}/risk-classes` },
    { key: 'risk-types', label: 'Risk Types', href: `${base}/risk-types` },
    // { key: 'currency', label: 'Currency', href: `${base}/currency` },
    { key: 'banks', label: 'Banks', href: `${base}/banks` },
    { key: 'levytaxes', label: 'Liabilities', href: `${base}/levytaxes` },
  ];

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Sticky header + tabs */}
      <div className="shrink-0 bg-white">
        <div className={pageHeader}>
          <h1 className="text-xl font-semibold text-gray-900">System Settings</h1>
        </div>
        <TabBar tabs={tabs} className={cn(pagePx, 'bg-white')} />
      </div>

      {/* Content */}
      <main className={cn(pageContent, 'flex-1 min-h-0 overflow-y-auto bg-gray-50 flex flex-col')}>
        {children}
      </main>
    </div>
  );
}
