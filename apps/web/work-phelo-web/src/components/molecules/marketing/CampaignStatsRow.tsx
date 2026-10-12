'use client';

import { CalendarClock, CheckCircle2, Mail, MessageSquare } from 'lucide-react';
import { KpiCard } from '@/components/molecules/reinsurance/stats/KpiCard';
import { useCampaigns } from '@/hooks/marketing/useCampaigns';
import { useSmsWalletBalance } from '@/hooks/marketing/useSmsMarketing';
import { usePermissionRule } from '@/hooks/hr/usePermission';

const count = (value: number | undefined) => (value === undefined ? '—' : value.toLocaleString());

/** Credits left for SMS and email, and how many campaigns are lined up or done. */
export function CampaignStatsRow() {
  // The wallet is only readable with its own permission, so the cards stay out of reach without it.
  const canViewWallet = usePermissionRule('marketing.sms-wallet:VIEW');
  const wallet = useSmsWalletBalance(canViewWallet);

  // Only the totals are needed, so each asks for a single row.
  const upcoming = useCampaigns({ status: 'SCHEDULED', limit: 1 });
  const completed = useCampaigns({ status: 'COMPLETED', limit: 1 });
  const partial = useCampaigns({ status: 'PARTIALLY_COMPLETED', limit: 1 });

  const completedTotal =
    completed.data && partial.data
      ? completed.data.meta.total + partial.data.meta.total
      : undefined;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {canViewWallet && (
        <>
          <KpiCard
            label="SMS Credits Remaining"
            value={count(wallet.data?.availableCredits)}
            icon={MessageSquare}
            iconColor="#2a78d6"
            sub={
              wallet.data
                ? [{ label: 'Reserved', value: wallet.data.reservedCredits.toLocaleString() }]
                : undefined
            }
            isLoading={wallet.isLoading}
          />
          {/* Email delivery isn't set up yet, so there are no email credits to report. */}
          <KpiCard
            label="Email Credits Remaining"
            value="—"
            icon={Mail}
            iconColor="#eb6834"
            sub={[{ label: 'Status', value: 'Not available yet' }]}
          />
        </>
      )}
      <KpiCard
        label="Upcoming Campaigns"
        value={count(upcoming.data?.meta.total)}
        icon={CalendarClock}
        iconColor="#8b5cf6"
        isLoading={upcoming.isLoading}
      />
      <KpiCard
        label="Completed Campaigns"
        value={count(completedTotal)}
        icon={CheckCircle2}
        iconColor="#1baf7a"
        sub={
          partial.data && partial.data.meta.total > 0
            ? [{ label: 'Partly sent', value: partial.data.meta.total.toLocaleString() }]
            : undefined
        }
        isLoading={completed.isLoading || partial.isLoading}
      />
    </div>
  );
}
