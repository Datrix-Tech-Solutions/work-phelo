'use client';

import { use, useMemo, useState } from 'react';
import Link from 'next/link';
import { Icons } from '@/components/atoms/icons';
import { Button } from '@/components/atoms/Button';
import { pageBreadcrumb, pageContent } from '@/lib/layout';
import { useCedants, useFacultatives, useCurrencies } from '@/hooks';
import { EditCedantPanel } from '@/components/organisms/reinsurance/panels/EditCedantPanel';
import { EditFacultativePanel } from '@/components/organisms/reinsurance/panels/EditFacultativePanel';
import { EndorsementPanel } from '@/components/organisms/reinsurance/panels/EndorsementPanel';
import { CedantOverview } from '@/components/molecules/reinsurance/CedantOverview';
import { CedantContactsTab } from '@/components/molecules/reinsurance/CedantContactsTab';
import { CedantPlacementsTab } from '@/components/molecules/reinsurance/CedantPlacementsTab';
import { CedantRevenueTab } from '@/components/molecules/reinsurance/CedantRevenueTab';
import { TabBar } from '@/components/molecules/shared/TabBar';
import { Facultative } from '@/types/reinsurance';

type CedantTab = 'contacts' | 'placements' | 'revenue';

const TABS = [
  { key: 'contacts', label: 'Contacts' },
  { key: 'placements', label: 'Placements' },
  { key: 'revenue', label: 'Revenue' },
];

export default function CedantDetailPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; cedantId: string }>;
}) {
  const { tenantSlug, cedantId } = use(params);

  const { data: cedants = [], isLoading: cedantsLoading } = useCedants();
  const { data: placements = [], isLoading: placementsLoading } = useFacultatives();
  const { data: currencies = [] } = useCurrencies();

  const cedant = cedants.find((c) => c.id === cedantId) ?? null;

  const [editOpen, setEditOpen] = useState(false);
  const [editPlacement, setEditPlacement] = useState<Facultative | null>(null);
  const [endorsementPlacement, setEndorsementPlacement] = useState<Facultative | null>(null);
  const [activeTab, setActiveTab] = useState<CedantTab>('contacts');

  const settingsBase = `/${tenantSlug}/operations/reinsurance/settings/cedants`;

  const cedantPlacements = useMemo(
    () => placements.filter((p) => p.cedant.id === cedantId),
    [placements, cedantId],
  );

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className={`${pageBreadcrumb} shrink-0 flex items-center justify-between`}>
        <nav className="flex items-center gap-2 text-sm text-gray-400">
          <Link href={settingsBase} className="hover:text-gray-700 transition-colors">
            Cedants
          </Link>
          <Icons.ChevronRight className="w-5 h-5" />
          <span className="text-gray-700 font-medium">{cedant?.name ?? '—'}</span>
        </nav>
        {cedant && (
          <Button size="sm" onClick={() => setEditOpen(true)}>
            Edit
          </Button>
        )}
      </div>

      <div className={`${pageContent} flex-1 overflow-y-auto`}>
        {cedantsLoading ? (
          <div className="flex items-center justify-center h-40 text-sm text-gray-400">
            Loading…
          </div>
        ) : !cedant ? (
          <div className="flex items-center justify-center h-40 text-sm text-gray-400">
            Cedant not found.
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            <CedantOverview cedant={cedant} />

            <div className="flex flex-col">
              <TabBar
                tabs={TABS}
                activeTab={activeTab}
                onTabChange={(t) => setActiveTab(t as CedantTab)}
              />

              <div className="pt-5">
                {activeTab === 'contacts' && <CedantContactsTab contacts={cedant.contacts} />}

                {activeTab === 'placements' && (
                  <CedantPlacementsTab
                    placements={cedantPlacements}
                    isLoading={placementsLoading}
                    tenantSlug={tenantSlug}
                    onEditPlacement={setEditPlacement}
                    onEndorsement={setEndorsementPlacement}
                  />
                )}

                {activeTab === 'revenue' && (
                  <CedantRevenueTab placements={cedantPlacements} currencies={currencies} />
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <EditCedantPanel cedant={editOpen ? cedant : null} onClose={() => setEditOpen(false)} />

      {editPlacement && (
        <EditFacultativePanel
          isOpen={!!editPlacement}
          placement={editPlacement}
          onClose={() => setEditPlacement(null)}
        />
      )}

      {endorsementPlacement && (
        <EndorsementPanel
          isOpen={!!endorsementPlacement}
          placement={endorsementPlacement}
          onClose={() => setEndorsementPlacement(null)}
        />
      )}
    </div>
  );
}
