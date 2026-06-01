'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { Icons } from '@/components/atoms/icons';
import { pageBreadcrumb, pageContent } from '@/lib/layout';
import { useFacultativePlacement } from '@/hooks';
import { FacultativeOverview } from '@/components/molecules/reinsurance/FacultativeOverview';
import { DistributionListTab } from '@/components/molecules/reinsurance/DistributionListTab';
import { TabBar } from '@/components/molecules/shared/TabBar';

type FacultativeTab = 'distribution' | 'closings';

const TABS = [
  { key: 'distribution', label: 'Distribution List' },
  { key: 'closings', label: 'Placement Closings' },
];

export default function FacultativeDetailPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; id: string }>;
}) {
  const { tenantSlug, id } = use(params);
  const { data: placement, isLoading } = useFacultativePlacement(id);
  const [activeTab, setActiveTab] = useState<FacultativeTab>('distribution');

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Breadcrumb */}
      <div className={`${pageBreadcrumb} shrink-0`}>
        <nav className="flex items-center gap-2 text-sm text-gray-400">
          <Link
            href={`/${tenantSlug}/operations/reinsurance/facultative`}
            className="hover:text-gray-700 transition-colors"
          >
            Facultative
          </Link>
          <Icons.ChevronRight className="w-5 h-5" />
          <span className="text-gray-700 font-medium">{placement?.policyNumber ?? '—'}</span>
        </nav>
      </div>

      {/* Content */}
      <div className={`${pageContent} flex-1 overflow-y-auto`}>
        {isLoading ? (
          <div className="flex items-center justify-center h-40 text-sm text-gray-400">
            Loading…
          </div>
        ) : !placement ? (
          <div className="flex items-center justify-center h-40 text-sm text-gray-400">
            Placement not found.
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {/* Overview */}
            <FacultativeOverview placement={placement} />

            {/* Tabs */}
            <div className="flex flex-col">
              <TabBar
                tabs={TABS}
                activeTab={activeTab}
                onTabChange={(t) => setActiveTab(t as FacultativeTab)}
              />

              <div className="pt-5">
                {activeTab === 'distribution' && <DistributionListTab placement={placement} />}
                {activeTab === 'closings' && (
                  <div className="flex items-center justify-center h-40 text-sm text-gray-400">
                    No placement closings yet.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
