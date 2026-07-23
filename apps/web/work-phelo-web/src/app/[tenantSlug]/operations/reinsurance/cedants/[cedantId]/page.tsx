'use client';

import { use, useMemo, useState } from 'react';
import Link from 'next/link';
import { Icons } from '@/components/atoms/icons';
import { Button } from '@/components/atoms/Button';
import { pageBreadcrumb, pageContent } from '@/lib/layout';
import {
  useCedants,
  useFacultatives,
  useCurrencies,
  useFacultativePlacement,
  usePlacementPayments,
} from '@/hooks';
import { EditCedantPanel } from '@/components/organisms/reinsurance/panels/EditCedantPanel';
import { EditFacultativePanel } from '@/components/organisms/reinsurance/panels/EditFacultativePanel';
import { EndorsementPanel } from '@/components/organisms/reinsurance/panels/EndorsementPanel';
import { CedantOverview } from '@/components/molecules/reinsurance/stats/CedantOverview';
import { CedantContactsTab } from '@/components/molecules/reinsurance/tabs/CedantContactsTab';
import { CedantPlacementsTab } from '@/components/molecules/reinsurance/tabs/CedantPlacementsTab';
import { CedantRevenueTab } from '@/components/molecules/reinsurance/tabs/CedantRevenueTab';
import { TabBar } from '@/components/molecules/shared/TabBar';
import { FacultativeOverview } from '@/components/molecules/reinsurance/stats/FacultativeOverview';
import { DistributionListTab } from '@/components/molecules/reinsurance/tabs/DistributionListTab';
import { PlacementClosingsTab } from '@/components/molecules/reinsurance/tabs/PlacementClosingsTab';
import { EndorsementTab } from '@/components/molecules/reinsurance/tabs/EndorsmentTab';
import { BusinessPaymentSection } from '@/components/molecules/reinsurance/BusinessPaymentSection';
import { PaymentHistoryTab } from '@/components/molecules/reinsurance/tabs/PaymentHistoryTab';
import AddPaymentForm from '@/components/organisms/reinsurance/AddPaymentForm';
import { Facultative } from '@/types/reinsurance';
import { displayPolicyNumber } from '@/lib/reinsurance/policyNumber';

type CedantTab = 'placements' | 'revenue' | 'contacts';
type FacultativeTab = 'distribution' | 'closings' | 'endorsement';
type PaymentTab = 'overview' | 'history';

type ActivePlacementView =
  | { mode: 'view'; placement: Facultative }
  | { mode: 'premium'; placement: Facultative }
  | null;

const TABS = [
  { key: 'placements', label: 'Placements' },
  { key: 'revenue', label: 'Revenue' },
  { key: 'contacts', label: 'Contacts' },
];

const FACULTATIVE_TABS = [
  { key: 'distribution', label: 'Distribution List' },
  { key: 'closings', label: 'Placement Closings' },
  { key: 'endorsement', label: 'Endorsement' },
];

const PAYMENT_TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'history', label: 'Payment History' },
];

function PlacementView({ placementId }: { placementId: string }) {
  const { data: placement, isLoading } = useFacultativePlacement(placementId);
  const [activeTab, setActiveTab] = useState<FacultativeTab>('distribution');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40 text-sm text-gray-400">Loading…</div>
    );
  }

  if (!placement) {
    return (
      <div className="flex items-center justify-center h-40 text-sm text-gray-400">
        Placement not found.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <FacultativeOverview placement={placement} />
      <div className="flex flex-col">
        <TabBar
          tabs={FACULTATIVE_TABS}
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
  );
}

function PremiumView({ placementId }: { placementId: string }) {
  const { data: placement } = useFacultativePlacement(placementId);
  const { data: payments = [] } = usePlacementPayments(placementId);
  const [activeTab, setActiveTab] = useState<PaymentTab>('overview');

  const paidAmount = useMemo(
    () =>
      payments
        .filter((p) => p.status === 'RECORDED')
        .reduce((sum, p) => sum + parseFloat(p.amount), 0),
    [payments],
  );

  if (!placement) {
    return (
      <div className="flex items-center justify-center h-40 text-sm text-gray-400">Loading…</div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <TabBar
        tabs={PAYMENT_TABS}
        activeTab={activeTab}
        onTabChange={(t) => setActiveTab(t as PaymentTab)}
      />
      <div>
        {activeTab === 'overview' && (
          <BusinessPaymentSection placement={placement} paidAmount={paidAmount} />
        )}
        {activeTab === 'history' && (
          <PaymentHistoryTab placementId={placementId} placement={placement} />
        )}
      </div>
    </div>
  );
}

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
  const [activeTab, setActiveTab] = useState<CedantTab>('placements');
  const [activePlacementView, setActivePlacementView] = useState<ActivePlacementView>(null);

  const settingsBase = `/${tenantSlug}/operations/reinsurance/cedants`;

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
          {activePlacementView ? (
            <>
              <button
                onClick={() => setActivePlacementView(null)}
                className="hover:text-gray-700 transition-colors"
              >
                {cedant?.name ?? '—'}
              </button>
              <Icons.ChevronRight className="w-5 h-5" />
              <span className="text-gray-700 font-medium">
                {displayPolicyNumber(activePlacementView.placement.policyNumber)}
              </span>
            </>
          ) : (
            <span className="text-gray-700 font-medium">{cedant?.name ?? '—'}</span>
          )}
        </nav>

        {activePlacementView?.mode === 'premium' ? (
          <AddPaymentForm placementId={activePlacementView.placement.id} />
        ) : activePlacementView?.mode === 'view' ? (
          <div className="flex items-center gap-2">
            {activePlacementView.placement.participants.some(
              (p) => p.status === 'ACCEPTED' || p.status === 'CLOSED',
            ) && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setEndorsementPlacement(activePlacementView.placement)}
              >
                Endorse Policy
              </Button>
            )}
            <Button size="sm" onClick={() => setEditPlacement(activePlacementView.placement)}>
              Edit
            </Button>
          </div>
        ) : (
          cedant && (
            <Button size="sm" onClick={() => setEditOpen(true)}>
              Edit
            </Button>
          )
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
        ) : activePlacementView?.mode === 'view' ? (
          <PlacementView placementId={activePlacementView.placement.id} />
        ) : activePlacementView?.mode === 'premium' ? (
          <PremiumView placementId={activePlacementView.placement.id} />
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
                {activeTab === 'contacts' && <CedantContactsTab counterparty={cedant} />}

                {activeTab === 'placements' && (
                  <CedantPlacementsTab
                    placements={cedantPlacements}
                    isLoading={placementsLoading}
                    onEditPlacement={setEditPlacement}
                    onEndorsement={setEndorsementPlacement}
                    onView={(p) => setActivePlacementView({ mode: 'view', placement: p })}
                    onPremiums={(p) => setActivePlacementView({ mode: 'premium', placement: p })}
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
