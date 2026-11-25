'use client';

import { Badge } from '@/components/atoms/Badge';
import {
  CrmDashboardDetailPage,
  type CrmDetailFilters,
} from '@/components/organisms/marketing/CrmDashboardDetailPage';
import type { Column } from '@/components/organisms/shared/DataTable';
import { usePeriodProspects } from '@/hooks/marketing/useMarketingDashboard';
import { formatDay } from '@/lib/dashboardPeriod';
import type { MarketingDashboardPeriodProspect } from '@/types/marketing';

type Row = MarketingDashboardPeriodProspect & { id: string };

const COLUMNS: Column<Row>[] = [
  {
    key: 'companyName',
    label: 'Prospect',
    width: 'minmax(180px, 1.5fr)',
    render: (r) => <span className="font-medium text-gray-900">{r.companyName}</span>,
  },
  { key: 'assignedUserName', label: 'Sales Rep', width: 'minmax(140px, 1fr)' },
  { key: 'stageName', label: 'Stage', width: 'minmax(120px, 0.8fr)' },
  { key: 'createdDate', label: 'Created', width: '140px', render: (r) => formatDay(r.createdDate) },
  {
    key: 'clientId',
    label: 'Outcome',
    width: '120px',
    render: (r) => (
      <Badge
        variant={r.clientId ? 'success' : 'neutral'}
        label={r.clientId ? 'Converted' : 'Open'}
      />
    ),
  },
];

function useRows({ period, year, userId, ready }: CrmDetailFilters) {
  const { data = [], isLoading, isError } = usePeriodProspects(period, year, userId, ready);
  return { rows: data.map((p) => ({ ...p, id: p.prospectId })), isLoading, isError };
}

/** The full-page view of the dashboard's "Conversion Rate" card. */
export default function DashboardConversionPage() {
  return (
    <CrmDashboardDetailPage<Row>
      title="Conversion Rate"
      description="Prospects created, and who converted,"
      columns={COLUMNS}
      useRows={useRows}
      searchText={(r) => `${r.companyName} ${r.assignedUserName}`}
      searchPlaceholder="Search by prospect or rep…"
      emptyMessage="No prospects were created in this period."
      rowHref={(r, base) =>
        r.clientId
          ? `${base}/prospects/clients/${r.clientId}`
          : `${base}/prospects/all/${r.prospectId}`
      }
    />
  );
}
