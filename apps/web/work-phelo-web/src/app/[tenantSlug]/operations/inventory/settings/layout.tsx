'use client';

import { useParams } from 'next/navigation';
import { cn } from '@/lib/utils';
import { pagePx, pageHeader, pageContent } from '@/lib/layout';
import { TabBar } from '@/components/molecules/shared/TabBar';

export default function InventorySettingsLayout({ children }: { children: React.ReactNode }) {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const base = `/${tenantSlug}/operations/inventory/settings`;

  const tabs = [
    { key: 'categories', label: 'Categories', href: `${base}/categories` },
    { key: 'units-of-measure', label: 'Units of Measure', href: `${base}/units-of-measure` },
    { key: 'warehouses', label: 'Warehouses', href: `${base}/warehouses` },
  ];

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="shrink-0">
        <div className={pageHeader}>
          <h1 className="text-xl font-semibold text-gray-900">Settings</h1>
        </div>
        <TabBar tabs={tabs} className={pagePx} />
      </div>

      <main className={cn(pageContent, 'flex-1 min-h-0 overflow-y-auto flex flex-col')}>
        {children}
      </main>
    </div>
  );
}
