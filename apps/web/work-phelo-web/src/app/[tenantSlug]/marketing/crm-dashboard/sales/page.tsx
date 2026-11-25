'use client';

import {
  CrmDashboardDetailPage,
  type CrmDetailFilters,
} from '@/components/organisms/marketing/CrmDashboardDetailPage';
import type { Column } from '@/components/organisms/shared/DataTable';
import { useMarketingDashboard, useWonDeals } from '@/hooks/marketing/useMarketingDashboard';
import { formatDay } from '@/lib/dashboardPeriod';
import { formatMoney } from '@/lib/formatMoney';
import type { MarketingDashboardWonDeal } from '@/types/marketing';

type Row = MarketingDashboardWonDeal & { id: string; currency: string };

const COLUMNS: Column<Row>[] = [
  {
    key: 'clientName',
    label: 'Client',
    width: 'minmax(180px, 1.5fr)',
    render: (r) => <span className="font-medium text-gray-900">{r.clientName}</span>,
  },
  { key: 'productName', label: 'Product', width: 'minmax(140px, 1fr)' },
  { key: 'date', label: 'Date Won', width: '140px', render: (r) => formatDay(r.date) },
  {
    key: 'value',
    label: 'Value',
    width: 'minmax(120px, 0.7fr)',
    render: (r) => `${r.currency} ${formatMoney(r.value)}`.trim(),
  },
];

function useRows({ period, year, userId, ready }: CrmDetailFilters) {
  const { data = [], isLoading, isError } = useWonDeals(period, year, userId, ready);
  // The currency comes with the dashboard summary.
  const { data: summary } = useMarketingDashboard(period, year, userId);
  const rows = data.map((deal) => ({
    ...deal,
    id: `${deal.clientId}:${deal.productId}`,
    currency: summary?.currency ?? '',
  }));
  return { rows, isLoading, isError };
}

/** The full-page view of the dashboard's "Overall Sales" card. */
export default function DashboardSalesPage() {
  return (
    <CrmDashboardDetailPage<Row>
      title="Overall Sales"
      description="Deals won"
      columns={COLUMNS}
      useRows={useRows}
      searchText={(r) => `${r.clientName} ${r.productName}`}
      searchPlaceholder="Search by client or product…"
      emptyMessage="No deals were won in this period."
      rowHref={(r, base) => `${base}/prospects/clients/${r.clientId}`}
    />
  );
}
