'use client';

import { useState } from 'react';
import { TabBar } from '@/components/molecules/shared/TabBar';
import { PartiesPage } from '@/components/organisms/inventory/PartiesPage';
import { pageContent, pageHeader, pagePx } from '@/lib/layout';

const TABS = [
  { key: 'SUPPLIER', label: 'Suppliers' },
  { key: 'CUSTOMER', label: 'Customers' },
] as const;

export default function InventorySuppliersCustomersPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]['key']>('SUPPLIER');

  return (
    <>
      <div className="shrink-0">
        <div className={pageHeader}>
          <h1 className="text-xl font-semibold text-gray-900">Suppliers &amp; Customers</h1>
        </div>
        <TabBar
          tabs={[...TABS]}
          activeTab={tab}
          onTabChange={(key) => setTab(key as (typeof TABS)[number]['key'])}
          className={pagePx}
        />
      </div>

      <div className={`${pageContent} flex flex-col`}>
        <PartiesPage key={tab} kind={tab} />
      </div>
    </>
  );
}
