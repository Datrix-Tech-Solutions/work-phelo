'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Avatar } from '@/components/atoms/Avatar';
import { DashboardPageHeader } from '@/components/molecules/shared/DashboardPageHeader';
import { DashboardShell } from '@/components/organisms/shared/DashboardShell';
import { Column, DataTable } from '@/components/organisms/shared/DataTable';
import { useOnLeave } from '@/hooks/hr/useDashboard';
import { usePermission } from '@/hooks/hr/usePermission';
import { useLinkedDashboardFilters } from '@/hooks/useLinkedDashboardFilters';
import { dashboardRanges, formatDay } from '@/lib/dashboardPeriod';
import { Permission } from '@/lib/permissionMap';
import { useAuthStore } from '@/store/auth.store';
import type { OnLeaveEntry } from '@/types/hr';

const PAGE_SIZE = 10;

const columns: Column<OnLeaveEntry>[] = [
  {
    key: 'employeeName',
    label: 'Employee',
    width: 'minmax(200px, 1.5fr)',
    render: (r) => (
      <div className="flex items-center gap-3">
        <Avatar name={r.employeeName} avatarUrl={r.avatarUrl} size="sm" />
        <span className="font-medium text-gray-900">{r.employeeName}</span>
      </div>
    ),
  },
  {
    key: 'department',
    label: 'Department',
    width: 'minmax(140px, 1fr)',
    render: (r) => <span>{r.department ?? '—'}</span>,
  },
  { key: 'leaveType', label: 'Leave Type', width: 'minmax(140px, 1fr)' },
  {
    key: 'startDate',
    label: 'Start Date',
    width: '130px',
    render: (r) => <span>{formatDay(r.startDate)}</span>,
  },
  {
    key: 'endDate',
    label: 'End Date',
    width: '130px',
    render: (r) => <span>{formatDay(r.endDate)}</span>,
  },
  { key: 'totalDays', label: 'Days', width: '80px' },
];

/** The full-page view of the dashboard's "On Leave" card. */
export default function DashboardOnLeavePage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = use(params);
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const canViewHrDashboard = usePermission(Permission.VIEW_HR_DASHBOARD);
  // Opens on the period the dashboard was showing.
  const filters = useLinkedDashboardFilters();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const {
    data = [],
    isLoading,
    isError,
  } = useOnLeave(filters.period, filters.year, {
    enabled: canViewHrDashboard,
  });

  useEffect(() => {
    if (user !== null && !canViewHrDashboard) router.replace(`/${tenantSlug}/hr/home`);
  }, [user, canViewHrDashboard, tenantSlug, router]);

  if (!canViewHrDashboard) return null;

  const term = search.trim().toLowerCase();
  const rows = data.filter((r) => r.employeeName.toLowerCase().includes(term));
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  // A narrower period or search can leave the page number past the end.
  const currentPage = Math.min(page, totalPages);
  const { fromDate, toDate } = dashboardRanges(filters.period, filters.year);

  return (
    <DashboardShell filters={filters}>
      <DashboardPageHeader
        title="On Leave"
        description={`Approved leave, ${formatDay(fromDate)} – ${formatDay(toDate)}`}
        backHref={`/${tenantSlug}/hr/dashboard`}
      />
      <DataTable
        columns={columns}
        data={rows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)}
        isLoading={isLoading}
        emptyMessage={isError ? 'Leave could not be loaded.' : 'No one is on leave in this period.'}
        searchPlaceholder="Search by employee name…"
        searchValue={search}
        onSearch={setSearch}
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setPage}
        noInternalScroll
      />
    </DashboardShell>
  );
}
