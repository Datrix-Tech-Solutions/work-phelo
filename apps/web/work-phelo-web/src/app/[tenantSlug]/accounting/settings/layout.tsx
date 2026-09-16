'use client';

import { useParams } from 'next/navigation';
import { cn } from '@/lib/utils';
import { pagePx, pageHeader, pageContent } from '@/lib/layout';
import { TabBar, TabGroup } from '@/components/molecules/shared/TabBar';
import { AppBackground } from '@/components/atoms/AppBackground';

export default function AccountingSettingsLayout({ children }: { children: React.ReactNode }) {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const base = `/${tenantSlug}/accounting/settings`;

  const groups: TabGroup[] = [
    {
      tabs: [
        { key: 'transaction-types', label: 'Transaction Types', href: `${base}/transaction-types` },
        { key: 'source-types', label: 'Source Types', href: `${base}/source-types` },
        { key: 'rules', label: 'Rules', href: `${base}/rules` },
      ],
    },
    {
      tabs: [
        // { key: 'configuration', label: 'Configuration', href: `${base}/configuration` },
        // { key: 'account-type', label: 'Account Type', href: `${base}/account-type` },
        // { key: 'classifications', label: 'Classifications', href: `${base}/classifications` },
        // { key: 'cost-centres', label: 'Cost Centres', href: `${base}/cost-centres` },
        { key: 'tax-types', label: 'Tax Types', href: `${base}/tax-types` },
        { key: 'currency', label: 'Currency', href: `${base}/currency` },
        // { key: 'posting-rules', label: 'Posting Rules', href: `${base}/posting-rules` },
      ],
    },
    
  ];

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="shrink-0">
        <div className={pageHeader}>
          <h1 className="text-xl font-semibold text-gray-900">Settings</h1>
        </div>
        <TabBar groups={groups} className={pagePx} />
      </div>

      <AppBackground
        as="main"
        className={cn(pageContent, 'flex-1 min-h-0 overflow-y-auto flex flex-col')}
      >
        {children}
      </AppBackground>
    </div>
  );
}
