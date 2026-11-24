'use client';

import { use, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ActivityAndActionsCard } from '@/components/molecules/hr/ActivityAndActionsCard';
import { DepartmentDistributionChart } from '@/components/molecules/hr/DepartmentDistributionChart';
import { OutTodayCard } from '@/components/molecules/hr/OutTodayCard';
import { PayrollStatusCard } from '@/components/molecules/hr/PayrollStatusCard';
import { ProjectsSummaryCard } from '@/components/molecules/hr/ProjectsSummaryCard';
import { RecruitmentPipelineCard } from '@/components/molecules/hr/RecruitmentPipelineCard';
import { UpcomingEventsCard } from '@/components/molecules/hr/UpcomingEventsCard';
import { DashboardShell } from '@/components/organisms/shared/DashboardShell';
import { HrDashboardKpis } from '@/components/organisms/hr/HrDashboardKpis';
import { usePermission } from '@/hooks/hr/usePermission';
import { useDashboardFilters } from '@/hooks/useDashboardFilters';
import { Permission } from '@/lib/permissionMap';
import { useAuthStore } from '@/store/auth.store';

export default function HrDashboardPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = use(params);
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const canViewHrDashboard = usePermission(Permission.VIEW_HR_DASHBOARD);
  const canViewPayroll = usePermission(Permission.READ_PAYROLL);
  // The card summarises every project, so it needs the see-all permission as well as the feature.
  const canViewProjects =
    usePermission(Permission.READ_PROJECTS) && Boolean(user?.featureConfig?.hr?.projects);
  const filters = useDashboardFilters();

  // Without the permission this page is not theirs: send them to their own home.
  useEffect(() => {
    if (user !== null && !canViewHrDashboard) router.replace(`/${tenantSlug}/hr/home`);
  }, [user, canViewHrDashboard, tenantSlug, router]);

  if (!canViewHrDashboard) return null;

  return (
    <DashboardShell filters={filters} showViewToggle>
      <HrDashboardKpis period={filters.period} year={filters.year} showProjects={canViewProjects} />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-20 gap-3">
        <DepartmentDistributionChart className="md:col-span-2 lg:col-span-6" />
        <RecruitmentPipelineCard className="md:col-span-2 lg:col-span-7" />
        <UpcomingEventsCard className="md:col-span-2 lg:col-span-7" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-20 gap-3">
        <ActivityAndActionsCard
          className={
            canViewProjects ? 'md:col-span-2 lg:col-span-6' : 'md:col-span-2 lg:col-span-12'
          }
        />
        {canViewProjects && <ProjectsSummaryCard className="md:col-span-2 lg:col-span-6" />}
        <OutTodayCard className="md:col-span-2 lg:col-span-4" />
        {canViewPayroll && <PayrollStatusCard className="md:col-span-2 lg:col-span-4" />}
      </div>
    </DashboardShell>
  );
}
