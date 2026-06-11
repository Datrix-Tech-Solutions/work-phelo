'use client';

import { useState } from 'react';
import { FacultativeTable } from '@/components/organisms/reinsurance/tables/FacultativeTable';
import { TabBar } from '@/components/molecules/shared/TabBar';

type FacultativePageTab = 'placements' | 'closing';

const TABS = [
  { key: 'placements', label: 'Offers' },
  { key: 'closing', label: 'Closings' },
];

export default function FacultativePage() {
  const [activeTab, setActiveTab] = useState<FacultativePageTab>('placements');

  return (
    <div className="flex flex-col gap-6 p-6 overflow-y-auto flex-1">
      <div className="shrink-0">
        <h2 className="text-base font-semibold text-gray-900">Facultative</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Manage individual risk placements and facultative certificates
        </p>
      </div>
      <TabBar
        tabs={TABS}
        activeTab={activeTab}
        onTabChange={(t) => setActiveTab(t as FacultativePageTab)}
      />
      <FacultativeTable key={activeTab} tab={activeTab} />
    </div>
  );
}
