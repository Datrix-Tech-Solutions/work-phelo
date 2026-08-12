'use client';

import { useState } from 'react';
import { TabBar } from '@/components/molecules/shared/TabBar';
import { ClaimOverviewTab } from '@/components/organisms/reinsurance/claim/ClaimOverviewTab';
import { ClaimCashCallsTable } from '@/components/organisms/reinsurance/claim/ClaimCashCallsTable';
import { ClaimFinancialHistoryTable } from '@/components/organisms/reinsurance/claim/ClaimFinancialHistoryTable';
import { Facultative, PlacementClaim } from '@/types/reinsurance';

type ClaimTab = 'overview' | 'cashCalls' | 'history';

const CLAIM_TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'cashCalls', label: 'Cash Calls' },
  { key: 'history', label: 'History' },
];

interface ClaimOverviewSectionProps {
  placement: Facultative;
  claim?: PlacementClaim;
}

/** Claim detail page content — tab bar over Overview / Cash Calls / History, mirroring the
 * cedant "Premiums" page pattern (`CedantDetailPage`'s `PremiumView`). */
export function ClaimOverviewSection({ placement, claim }: ClaimOverviewSectionProps) {
  const [activeTab, setActiveTab] = useState<ClaimTab>('overview');

  return (
    <div className="flex flex-col gap-4">
      <TabBar
        tabs={CLAIM_TABS}
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab as ClaimTab)}
      />

      <div>
        {activeTab === 'overview' && <ClaimOverviewTab placement={placement} claim={claim} />}
        {claim && activeTab === 'cashCalls' && (
          <ClaimCashCallsTable placement={placement} claim={claim} />
        )}
        {claim && activeTab === 'history' && (
          <ClaimFinancialHistoryTable placement={placement} claim={claim} />
        )}
      </div>
    </div>
  );
}
