'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Icons } from '@/components/atoms/icons';
import { Button } from '@/components/atoms/Button';
import { pageBreadcrumb, pageContent } from '@/lib/layout';
import { useFacultativePlacement, usePlacementLockStatus } from '@/hooks';
import { FacultativeOverview } from '@/components/molecules/reinsurance/stats/FacultativeOverview';
import { DistributionListTab } from '@/components/molecules/reinsurance/tabs/DistributionListTab';
import { PlacementClosingsTab } from '@/components/molecules/reinsurance/tabs/PlacementClosingsTab';
import { TabBar } from '@/components/molecules/shared/TabBar';
import { EditFacultativePanel } from '@/components/organisms/reinsurance/panels/EditFacultativePanel';
import { EndorsementPanel } from '@/components/organisms/reinsurance/panels/EndorsementPanel';
import { EndorsementTab } from '@/components/molecules/reinsurance/tabs/EndorsmentTab';

type FacultativeTab = 'distribution' | 'closings' | 'endorsement';

const TABS = [
  { key: 'distribution', label: 'Distribution List' },
  { key: 'closings', label: 'Placement Closings' },
  { key: 'endorsement', label: 'Endorsement' },
];

export default function FacultativeDetailPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; id: string }>;
}) {
  const { tenantSlug, id } = use(params);
  const searchParams = useSearchParams();
  const fromClosing = searchParams.get('from') === 'closing';
  const { data: placement, isLoading } = useFacultativePlacement(id);
  const { data: lockStatus } = usePlacementLockStatus(id);
  const [activeTab, setActiveTab] = useState<FacultativeTab>('distribution');
  const [editOpen, setEditOpen] = useState(false);
  const [endorsementOpen, setEndorsementOpen] = useState(false);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Breadcrumb */}
      <div className={`${pageBreadcrumb} shrink-0 flex items-center justify-between`}>
        <nav className="flex items-center gap-2 text-sm text-gray-400">
          <Link
            href={`/${tenantSlug}/operations/reinsurance/facultative${fromClosing ? '?tab=closing' : ''}`}
            className="hover:text-gray-700 transition-colors"
          >
            {fromClosing ? 'Closings' : 'Facultative'}
          </Link>
          <Icons.ChevronRight className="w-5 h-5" />
          <span className="text-gray-700 font-medium">{placement?.reference ?? '—'}</span>
        </nav>
        {placement && (
          <div className="flex items-center gap-2">
            {placement.participants.some(
              (p) => p.status === 'ACCEPTED' || p.status === 'CLOSED',
            ) && (
              <Button size="sm" variant="secondary" onClick={() => setEndorsementOpen(true)}>
                Endorse Policy
              </Button>
            )}
            <Button
              size="sm"
              onClick={() => setEditOpen(true)}
              disabled={lockStatus ? !lockStatus.editable : false}
            >
              Edit
            </Button>
          </div>
        )}
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
                {activeTab === 'closings' && <PlacementClosingsTab placement={placement} />}
                {activeTab === 'endorsement' && <EndorsementTab placement={placement} />}
              </div>
            </div>
          </div>
        )}
      </div>

      {placement && editOpen && (
        <EditFacultativePanel
          isOpen={editOpen}
          placement={placement}
          onClose={() => setEditOpen(false)}
        />
      )}
      {placement && endorsementOpen && (
        <EndorsementPanel
          isOpen={endorsementOpen}
          placement={placement}
          onClose={() => setEndorsementOpen(false)}
        />
      )}
    </div>
  );
}
