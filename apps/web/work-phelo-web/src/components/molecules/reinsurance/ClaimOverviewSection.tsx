'use client';

import { useState } from 'react';
import { TabBar } from '@/components/molecules/shared/TabBar';
import { ClaimOverview } from '@/components/molecules/reinsurance/stats/ClaimOverview';
import { ClaimOverviewTab } from '@/components/organisms/reinsurance/claim/ClaimOverviewTab';
import { ClaimCashCallsTable } from '@/components/organisms/reinsurance/claim/ClaimCashCallsTable';
import { ClaimFinancialHistoryTable } from '@/components/organisms/reinsurance/claim/ClaimFinancialHistoryTable';
import { Facultative, PlacementClaim } from '@/types/reinsurance';

type ClaimTab = 'details' | 'cashCalls' | 'history';

const CLAIM_TABS = [
  { key: 'details', label: 'Details' },
  { key: 'cashCalls', label: 'Recoveries' },
  { key: 'history', label: 'History' },
];

interface ClaimOverviewSectionProps {
  placement: Facultative;
  claim?: PlacementClaim;
}

/** Claim detail page content — a persistent fact-summary card (mirrors `FacultativeOverview`)
 * above a tab bar over Details / Recoveries / History, following the Facultative detail page
 * layout: overview on top, tabbed table content below. */
export function ClaimOverviewSection({ placement, claim }: ClaimOverviewSectionProps) {
  const [activeTab, setActiveTab] = useState<ClaimTab>('details');

  return (
    <div className="flex flex-col gap-4">
      <ClaimOverview placement={placement} claim={claim} />

      <div className="flex flex-col">
        <TabBar
          tabs={CLAIM_TABS}
          activeTab={activeTab}
          onTabChange={(tab) => setActiveTab(tab as ClaimTab)}
        />

        <div className="pt-5">
          {activeTab === 'details' && <ClaimOverviewTab placement={placement} claim={claim} />}
          {claim && activeTab === 'cashCalls' && (
            <ClaimCashCallsTable placement={placement} claim={claim} />
          )}
          {claim && activeTab === 'history' && (
            <ClaimFinancialHistoryTable placement={placement} claim={claim} />
          )}
        </div>
      </div>
    </div>
  );
}
