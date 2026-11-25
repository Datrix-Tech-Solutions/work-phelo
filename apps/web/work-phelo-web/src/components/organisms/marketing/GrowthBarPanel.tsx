'use client';

import { useParams } from 'next/navigation';
import { DrilldownList, type DrilldownRow } from '@/components/molecules/shared/DrilldownList';
import { DashboardDrilldownPanel } from '@/components/organisms/shared/DashboardDrilldownPanel';
import { useGrowthRecords } from '@/hooks/marketing/useMarketingDashboard';
import { useMarketingAccess } from '@/hooks/marketing/useMarketingAccess';
import { formatDay } from '@/lib/dashboardPeriod';
import type { SeriesBucket } from '@/lib/periodSeries';
import type {
  MarketingDashboardNewClient,
  MarketingDashboardPeriodProspect,
} from '@/types/marketing';

export interface GrowthBar {
  kind: 'prospects' | 'clients';
  bucket: SeriesBucket;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  bar: GrowthBar | null;
  userId?: string;
}

/** The records behind the bar picked on the Prospects vs Clients chart. */
export function GrowthBarPanel({ isOpen, onClose, bar, userId }: Props) {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { canSeeTab } = useMarketingAccess();
  const showsClients = bar?.kind === 'clients';
  const range = bar?.bucket ?? null;
  const prospects = useGrowthRecords<MarketingDashboardPeriodProspect>(
    'period-prospects',
    range,
    userId,
    isOpen && !showsClients,
  );
  const clients = useGrowthRecords<MarketingDashboardNewClient>(
    'new-clients',
    range,
    userId,
    isOpen && showsClients,
  );
  const base = `/${tenantSlug}/marketing/prospects`;
  const tab = showsClients ? 'clients' : 'all';
  const query = showsClients ? clients : prospects;

  const rows: DrilldownRow[] = showsClients
    ? (clients.data ?? []).map((c) => ({
        id: c.clientId,
        title: c.companyName,
        detail: c.assignedUserName,
        trailing: formatDay(c.createdDate),
        href: `${base}/clients/${c.clientId}`,
      }))
    : (prospects.data ?? []).map((p) => ({
        id: p.prospectId,
        title: p.companyName,
        detail: [p.assignedUserName, p.clientId ? 'Converted' : p.stageName].join(' · '),
        trailing: formatDay(p.createdDate),
        // A converted prospect continues as a client, so that is the record to open.
        href: p.clientId ? `${base}/clients/${p.clientId}` : `${base}/all/${p.prospectId}`,
      }));

  return (
    <DashboardDrilldownPanel
      isOpen={isOpen}
      onClose={onClose}
      title={showsClients ? 'New Clients' : 'New Prospects'}
      description={bar?.bucket.detail}
      expandHref={canSeeTab('prospects', tab) ? `${base}/${tab}` : undefined}
    >
      <DrilldownList
        rows={rows}
        isLoading={query.isLoading}
        isError={query.isError}
        emptyText={`No new ${showsClients ? 'clients' : 'prospects'} in this range.`}
      />
    </DashboardDrilldownPanel>
  );
}
