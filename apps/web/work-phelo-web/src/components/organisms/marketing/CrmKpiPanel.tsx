'use client';

import { useParams } from 'next/navigation';
import type { Period } from '@/components/atoms/PeriodToggle';
import { Badge } from '@/components/atoms/Badge';
import { DrilldownList, type DrilldownRow } from '@/components/molecules/shared/DrilldownList';
import { DashboardDrilldownPanel } from '@/components/organisms/shared/DashboardDrilldownPanel';
import {
  useClientRevenue,
  usePeriodProspects,
  useWonDeals,
} from '@/hooks/marketing/useMarketingDashboard';
import { useMarketingAccess } from '@/hooks/marketing/useMarketingAccess';
import { usePermissionRule } from '@/hooks/hr/usePermission';
import { dashboardRanges, formatDay } from '@/lib/dashboardPeriod';
import { formatMoney } from '@/lib/formatMoney';

export type CrmKpi = 'sales' | 'revenue' | 'conversion' | 'prospects';

const TITLES: Record<CrmKpi, string> = {
  sales: 'Overall Sales',
  revenue: 'Achieved Revenue',
  conversion: 'Conversion Rate',
  prospects: 'New Prospects',
};

const DESCRIPTIONS: Record<CrmKpi, string> = {
  sales: 'Deals won',
  revenue: 'Revenue by client',
  conversion: 'Prospects created, and who converted,',
  prospects: 'Prospects created',
};

interface Props {
  isOpen: boolean;
  onClose: () => void;
  kpi: CrmKpi;
  currency: string | null | undefined;
  period: Period;
  year: number;
  userId?: string;
}

/** What is behind one of the CRM headline figures. */
export function CrmKpiPanel({ isOpen, onClose, kpi, currency, period, year, userId }: Props) {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { canSeeTab } = useMarketingAccess();
  const canViewReports = usePermissionRule('marketing.dashboard:VIEW');
  const { fromDate, toDate } = dashboardRanges(period, year);
  const base = `/${tenantSlug}/marketing`;
  const money = (value: string) => `${currency ?? ''} ${formatMoney(value)}`.trim();

  // Only the open figure's list is asked for.
  const showsProspects = kpi === 'conversion' || kpi === 'prospects';
  const sales = useWonDeals(period, year, userId, isOpen && kpi === 'sales');
  const revenue = useClientRevenue(period, year, userId, isOpen && kpi === 'revenue');
  const prospects = usePeriodProspects(period, year, userId, isOpen && showsProspects);

  const filterQuery = new URLSearchParams({
    period,
    year: String(year),
    ...(userId ? { rep: userId } : {}),
  }).toString();
  const expandHrefs: Record<CrmKpi, string | undefined> = {
    sales: `${base}/crm-dashboard/sales?${filterQuery}`,
    revenue: canViewReports ? `${base}/reports/sales-performance` : undefined,
    conversion: `${base}/crm-dashboard/conversion?${filterQuery}`,
    prospects: canSeeTab('prospects', 'all') ? `${base}/prospects/all` : undefined,
  };

  const prospectRows: DrilldownRow[] = (prospects.data ?? []).map((p) => ({
    id: p.prospectId,
    title: p.companyName,
    detail: [p.assignedUserName, formatDay(p.createdDate)].join(' · '),
    // A converted prospect continues as a client, so that is the record to open.
    href: p.clientId
      ? `${base}/prospects/clients/${p.clientId}`
      : `${base}/prospects/all/${p.prospectId}`,
    trailing:
      kpi === 'conversion' ? (
        <Badge
          variant={p.clientId ? 'success' : 'neutral'}
          label={p.clientId ? 'Converted' : 'Open'}
        />
      ) : p.clientId ? (
        'Client'
      ) : (
        p.stageName
      ),
  }));

  const lists = {
    sales: {
      query: sales,
      emptyText: 'No deals were won in this period.',
      rows: (sales.data ?? []).map((deal) => ({
        id: `${deal.clientId}:${deal.productId}`,
        title: deal.clientName,
        detail: `${deal.productName} · ${formatDay(deal.date)}`,
        trailing: money(deal.value),
        href: `${base}/prospects/clients/${deal.clientId}`,
      })),
    },
    revenue: {
      query: revenue,
      emptyText: 'No revenue in this period.',
      rows: (revenue.data ?? []).map((client) => ({
        id: client.clientId,
        title: client.clientName,
        trailing: money(client.amount),
        href: `${base}/prospects/clients/${client.clientId}`,
      })),
    },
    conversion: {
      query: prospects,
      emptyText: 'No prospects were created in this period.',
      rows: prospectRows,
    },
    prospects: {
      query: prospects,
      emptyText: 'No prospects were created in this period.',
      rows: prospectRows,
    },
  };
  const { query, rows, emptyText } = lists[kpi];

  return (
    <DashboardDrilldownPanel
      isOpen={isOpen}
      onClose={onClose}
      title={TITLES[kpi]}
      description={`${DESCRIPTIONS[kpi]} ${formatDay(fromDate)} – ${formatDay(toDate)}`}
      expandHref={expandHrefs[kpi]}
    >
      <DrilldownList
        rows={rows}
        isLoading={query.isLoading}
        isError={query.isError}
        emptyText={emptyText}
      />
    </DashboardDrilldownPanel>
  );
}
