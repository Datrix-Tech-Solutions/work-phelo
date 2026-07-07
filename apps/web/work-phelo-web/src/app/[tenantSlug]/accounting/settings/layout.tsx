'use client';

import { useParams } from 'next/navigation';
import { cn } from '@/lib/utils';
import { pagePx, pageHeader, pageContent } from '@/lib/layout';
import { TabBar } from '@/components/molecules/shared/TabBar';

export default function AccountingSettingsLayout({ children }: { children: React.ReactNode }) {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const base = `/${tenantSlug}/accounting/settings`;

  const tabs = [
    { key: 'vendors', label: 'Vendors', href: `${base}/vendors` },
    { key: 'customers', label: 'Customers', href: `${base}/customers` },
    { key: 'account-type', label: 'Account Type', href: `${base}/account-type` },
    { key: 'accounts', label: 'Accounts', href: `${base}/accounts` },
    { key: 'currency', label: 'Currency', href: `${base}/currency` },
    { key: 'fiscal-year', label: 'Fiscal Year', href: `${base}/fiscal-year` },
    { key: 'budget-forecast', label: 'Budget & Forecast', href: `${base}/budget-forecast` },
  ];

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="shrink-0 bg-white">
        <div className={pageHeader}>
          <h1 className="text-xl font-semibold text-gray-900">Settings</h1>
        </div>
        <TabBar tabs={tabs} className={cn(pagePx, 'bg-white')} />
      </div>

      <main className={cn(pageContent, 'flex-1 min-h-0 overflow-y-auto bg-gray-50 flex flex-col')}>
        {children}
      </main>
    </div>
  );
}
