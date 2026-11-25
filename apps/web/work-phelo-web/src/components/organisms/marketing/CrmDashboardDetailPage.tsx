'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import type { Period } from '@/components/atoms/PeriodToggle';
import { DashboardPageHeader } from '@/components/molecules/shared/DashboardPageHeader';
import {
  DashboardShell,
  type DashboardFilterField,
} from '@/components/organisms/shared/DashboardShell';
import { Column, DataTable } from '@/components/organisms/shared/DataTable';
import { useMarketingDashboardReps } from '@/hooks/marketing/useMarketingDashboardReps';
import { usePermissionRule } from '@/hooks/hr/usePermission';
import { useLinkedDashboardFilters } from '@/hooks/useLinkedDashboardFilters';
import { useLoadingRouter as useRouter } from '@/hooks/useLoadingRouter';
import { dashboardRanges, formatDay } from '@/lib/dashboardPeriod';
import { useAuthStore } from '@/store/auth.store';

const PAGE_SIZE = 10;

export interface CrmDetailFilters {
  period: Period;
  year: number;
  userId?: string;
  /** False until it is known whose figures to show, so nothing loads unscoped. */
  ready: boolean;
}

interface Props<T extends { id: string }> {
  title: string;
  /** Start of the line under the title; the period's dates follow it. */
  description: string;
  columns: Column<T>[];
  /** A hook returning the rows for the chosen filters. */
  useRows: (filters: CrmDetailFilters) => { rows: T[]; isLoading: boolean; isError: boolean };
  /** Text a row is searched by. */
  searchText: (row: T) => string;
  searchPlaceholder: string;
  emptyMessage: string;
  rowHref: (row: T, base: string) => string;
}

/** The full-page view behind a CRM dashboard figure: its filters, a search and a table. */
export function CrmDashboardDetailPage<T extends { id: string }>({
  title,
  description,
  columns,
  useRows,
  searchText,
  searchPlaceholder,
  emptyMessage,
  rowHref,
}: Props<T>) {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const router = useRouter();
  const filters = useLinkedDashboardFilters(['rep']);
  // As on the CRM dashboard: without the general permission the figures are the caller's own.
  const canViewGeneral = usePermissionRule('marketing.dashboard:VIEW');
  const currentUserId = useAuthStore((s) => s.user?.id);
  const { data: reps = [] } = useMarketingDashboardReps(canViewGeneral);
  const userId = canViewGeneral ? filters.fieldValues.rep || undefined : currentUserId;
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { rows, isLoading, isError } = useRows({
    period: filters.period,
    year: filters.year,
    userId,
    ready: canViewGeneral || !!currentUserId,
  });

  const fields: DashboardFilterField[] = canViewGeneral
    ? [
        {
          key: 'rep',
          placeholder: 'Sales reps',
          options: reps.map((rep) => ({ value: rep.userId, label: rep.name })),
        },
      ]
    : [];

  const term = search.trim().toLowerCase();
  const matches = rows.filter((row) => searchText(row).toLowerCase().includes(term));
  const totalPages = Math.max(1, Math.ceil(matches.length / PAGE_SIZE));
  // A narrower filter or search can leave the page number past the end.
  const currentPage = Math.min(page, totalPages);
  const { fromDate, toDate } = dashboardRanges(filters.period, filters.year);
  const base = `/${tenantSlug}/marketing`;

  return (
    <DashboardShell filters={filters} fields={fields}>
      <DashboardPageHeader
        title={title}
        description={`${description} ${formatDay(fromDate)} – ${formatDay(toDate)}`}
        backHref={`${base}/crm-dashboard`}
      />
      <DataTable
        columns={columns}
        data={matches.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)}
        isLoading={isLoading}
        emptyMessage={isError ? 'Could not be loaded.' : emptyMessage}
        searchPlaceholder={searchPlaceholder}
        searchValue={search}
        onSearch={setSearch}
        onRowClick={(row) => router.push(rowHref(row, base))}
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setPage}
        noInternalScroll
      />
    </DashboardShell>
  );
}
