'use client';

import { ClientsProspectsChart } from '@/components/molecules/marketing/ClientsProspectsChart';
import { RevenueByProductChart } from '@/components/molecules/marketing/RevenueByProductChart';
import { TopSalesPersonnelChart } from '@/components/molecules/marketing/TopSalesPersonnelChart';
import { TargetsOverviewCard } from '@/components/molecules/marketing/TargetsOverviewCard';
import { UpcomingBirthdaysCard } from '@/components/molecules/marketing/UpcomingBirthdaysCard';
import { PipelineStageCards } from '@/components/molecules/marketing/PipelineStageCards';
import { CrmQuickActions } from '@/components/organisms/marketing/CrmQuickActions';
import { MyAppointmentsCard } from '@/components/organisms/marketing/MyAppointmentsCard';
import { MyRemindersCard } from '@/components/organisms/marketing/MyRemindersCard';
import { MarketingDashboardKpis } from '@/components/organisms/marketing/MarketingDashboardKpis';
import type { DashboardViewOption } from '@/components/atoms/DashboardViewToggle';
import {
  DashboardShell,
  type DashboardFilterField,
} from '@/components/organisms/shared/DashboardShell';
import { useMarketingDashboardReps } from '@/hooks/marketing/useMarketingDashboardReps';
import { usePermissionRule } from '@/hooks/hr/usePermission';
import { useAuthStore } from '@/store/auth.store';
import { useDashboardFilters } from '@/hooks/useDashboardFilters';

const VIEWS: DashboardViewOption[] = [
  { label: 'General Dashboard', value: 'general' },
  { label: 'Personal Dashboard', value: 'personal' },
];

export default function CrmDashboardPage() {
  const filters = useDashboardFilters();
  // The general dashboard is the organisation-wide view and needs its own permission. Without
  // it the user only has their personal dashboard, so there is nothing to toggle.
  const canViewGeneral = usePermissionRule('marketing.dashboard:VIEW');
  const view = canViewGeneral ? filters.view : 'personal';
  const { data: reps = [] } = useMarketingDashboardReps(view === 'general');
  const currentUserId = useAuthStore((s) => s.user?.id);
  // The personal dashboard is the same figures scoped to the signed-in user; the general one
  // follows the rep filter. Hold off until the user is known so nothing loads unscoped.
  const userId = view === 'personal' ? currentUserId : filters.fieldValues.rep || undefined;
  const ready = view === 'general' || !!currentUserId;
  const fields: DashboardFilterField[] =
    view === 'general'
      ? [
          {
            key: 'rep',
            placeholder: 'Sales reps',
            options: reps.map((rep) => ({ value: rep.userId, label: rep.name })),
          },
        ]
      : [];

  return (
    <DashboardShell
      filters={filters}
      fields={fields}
      showViewToggle={canViewGeneral}
      viewOptions={VIEWS}
    >
      {ready && (
        <>
          <MarketingDashboardKpis period={filters.period} year={filters.year} userId={userId} />
          <PipelineStageCards period={filters.period} year={filters.year} userId={userId} />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-20 gap-3">
            <ClientsProspectsChart
              period={filters.period}
              userId={userId}
              className="md:col-span-2 lg:col-span-8"
            />
            <RevenueByProductChart
              period={filters.period}
              year={filters.year}
              userId={userId}
              className="lg:col-span-7"
            />
            <CrmQuickActions fillCell className="md:col-span-2 lg:col-span-5" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-20 gap-3">
            {view === 'general' && (
              <TopSalesPersonnelChart
                period={filters.period}
                year={filters.year}
                userId={userId}
                className="md:col-span-2 lg:col-span-7"
              />
            )}
            <TargetsOverviewCard
              period={filters.period}
              year={filters.year}
              userId={userId}
              className={
                view === 'personal' ? 'md:col-span-2 lg:col-span-5' : 'md:col-span-2 lg:col-span-7'
              }
            />
            {view === 'personal' && currentUserId && (
              <>
                <MyRemindersCard userId={currentUserId} className="h-60 lg:col-span-5" />
                <MyAppointmentsCard userId={currentUserId} className="h-60 lg:col-span-5" />
              </>
            )}
            <UpcomingBirthdaysCard
              userId={userId}
              className={view === 'personal' ? 'lg:col-span-5' : 'lg:col-span-6'}
            />
          </div>
        </>
      )}
    </DashboardShell>
  );
}
