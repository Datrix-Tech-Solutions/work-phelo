'use client';

import { use, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Icons } from '@/components/atoms/icons';
import { Button } from '@/components/atoms/Button';
import { pageBreadcrumb, pageContent } from '@/lib/layout';
import { useReinsurers, useFacultatives, useCurrencies } from '@/hooks';
import { EditReinsurancePanel } from '@/components/organisms/reinsurance/panels/EditReinsurancePanel';
import { ReinsurerOverview } from '@/components/molecules/reinsurance/ReinsurerOverview';
import { CedantContactsTab } from '@/components/molecules/reinsurance/CedantContactsTab';
import { ReinsurerPlacementsTab } from '@/components/molecules/reinsurance/ReinsurerPlacementsTab';
import { ReinsurerRevenueTab } from '@/components/molecules/reinsurance/ReinsurerRevenueTab';
import { TabBar } from '@/components/molecules/shared/TabBar';
import { type ReinsurerParticipation } from '@/components/molecules/reinsurance/tables/ReinsurerPoliciesTable';

type ReinsurerTab = 'contacts' | 'placements' | 'revenue';

const TABS = [
  { key: 'contacts', label: 'Contacts' },
  { key: 'placements', label: 'Placements' },
  { key: 'revenue', label: 'Revenue' },
];

export default function ReinsurerDetailPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; reinsurerId: string }>;
}) {
  const { tenantSlug, reinsurerId } = use(params);
  const router = useRouter();

  const { data: reinsurers = [], isLoading: reinsurersLoading } = useReinsurers();
  const { data: placements = [], isLoading: placementsLoading } = useFacultatives();
  const { data: currencies = [] } = useCurrencies();

  const reinsurer = reinsurers.find((r) => r.id === reinsurerId) ?? null;

  const [editOpen, setEditOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<ReinsurerTab>('contacts');

  const settingsBase = `/${tenantSlug}/operations/reinsurance/settings/reinsurers`;

  const participations = useMemo<ReinsurerParticipation[]>(() => {
    return placements.flatMap((p) => {
      const participant = p.participants.find((pt) => pt.counterpartyId === reinsurerId);
      if (!participant) return [];
      return [
        {
          id: p.id,
          reference: p.reference,
          title: p.title,
          cedant: p.cedant.name,
          role: participant.role,
          sharePercent: participant.sharePercent,
          participantStatus: participant.status,
          placementStatus: p.status,
          offerType: 'Facultative',
          inceptionDate: p.inceptionDate,
          expiryDate: p.expiryDate,
        },
      ];
    });
  }, [placements, reinsurerId]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className={`${pageBreadcrumb} shrink-0 flex items-center justify-between`}>
        <nav className="flex items-center gap-2 text-sm text-gray-400">
          <Link href={settingsBase} className="hover:text-gray-700 transition-colors">
            Reinsurers
          </Link>
          <Icons.ChevronRight className="w-5 h-5" />
          <span className="text-gray-700 font-medium">{reinsurer?.name ?? '—'}</span>
        </nav>
        {reinsurer && (
          <Button size="sm" onClick={() => setEditOpen(true)}>
            Edit
          </Button>
        )}
      </div>

      <div className={`${pageContent} flex-1 overflow-y-auto`}>
        {reinsurersLoading ? (
          <div className="flex items-center justify-center h-40 text-sm text-gray-400">
            Loading…
          </div>
        ) : !reinsurer ? (
          <div className="flex items-center justify-center h-40 text-sm text-gray-400">
            Reinsurer not found.
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            <ReinsurerOverview reinsurer={reinsurer} />

            <div className="flex flex-col">
              <TabBar
                tabs={TABS}
                activeTab={activeTab}
                onTabChange={(t) => setActiveTab(t as ReinsurerTab)}
              />

              <div className="pt-5">
                {activeTab === 'contacts' && <CedantContactsTab contacts={reinsurer.contacts} />}

                {activeTab === 'placements' && (
                  <ReinsurerPlacementsTab
                    participations={participations}
                    isLoading={placementsLoading}
                    onView={(id) =>
                      router.push(`/${tenantSlug}/operations/reinsurance/facultative/${id}`)
                    }
                  />
                )}

                {activeTab === 'revenue' && (
                  <ReinsurerRevenueTab
                    placements={placements}
                    reinsurerId={reinsurerId}
                    reinsurerDefaultBrokerageFee={reinsurer.brokerageFee}
                    currencies={currencies}
                  />
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <EditReinsurancePanel
        reinsurer={editOpen ? reinsurer : null}
        onClose={() => setEditOpen(false)}
      />
    </div>
  );
}
