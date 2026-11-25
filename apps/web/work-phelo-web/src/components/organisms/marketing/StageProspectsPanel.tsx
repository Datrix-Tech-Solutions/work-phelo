'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import type { Period } from '@/components/atoms/PeriodToggle';
import { Skeleton } from '@/components/atoms/Skeleton';
import { DashboardDrilldownPanel } from '@/components/organisms/shared/DashboardDrilldownPanel';
import { useStageProspects } from '@/hooks/marketing/useMarketingDashboard';
import { useMarketingAccess } from '@/hooks/marketing/useMarketingAccess';
import { dashboardRanges, formatDay } from '@/lib/dashboardPeriod';
import { formatMoney } from '@/lib/formatMoney';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  stage: { stageId: string; name: string } | null;
  currency: string | null | undefined;
  period: Period;
  year: number;
  userId?: string;
}

/** The open prospects in one pipeline stage, created in the dashboard's period. */
export function StageProspectsPanel({
  isOpen,
  onClose,
  stage,
  currency,
  period,
  year,
  userId,
}: Props) {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { canSeeTab } = useMarketingAccess();
  const {
    data = [],
    isLoading,
    isError,
  } = useStageProspects(stage?.stageId ?? '', period, year, userId, isOpen);
  const { fromDate, toDate } = dashboardRanges(period, year);
  const base = `/${tenantSlug}/marketing/prospects/all`;
  const canOpenProspects = canSeeTab('prospects', 'all');

  return (
    <DashboardDrilldownPanel
      isOpen={isOpen}
      onClose={onClose}
      title={stage?.name ?? 'Pipeline stage'}
      description={`Prospects created ${formatDay(fromDate)} – ${formatDay(toDate)}`}
      expandHref={stage && canOpenProspects ? `${base}?stage=${stage.stageId}` : undefined}
    >
      {isLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))}
        </div>
      ) : isError ? (
        <p className="text-sm text-gray-400 text-center py-10">Prospects could not be loaded.</p>
      ) : data.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-10">
          No prospects from this period are in this stage.
        </p>
      ) : (
        <ul className="flex flex-col gap-1">
          {data.map((prospect) => (
            <li key={prospect.prospectId}>
              <Link
                href={`${base}/${prospect.prospectId}`}
                className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-gray-100/70"
              >
                <div className="flex min-w-0 flex-1 flex-col leading-tight">
                  <span className="truncate text-sm font-semibold text-gray-900">
                    {prospect.companyName}
                  </span>
                  <span className="truncate text-xs text-gray-400">
                    {prospect.assignedUserName}
                  </span>
                </div>
                <span className="shrink-0 text-xs font-medium text-gray-700">
                  {`${currency ?? ''} ${formatMoney(prospect.expected)}`.trim()}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </DashboardDrilldownPanel>
  );
}
