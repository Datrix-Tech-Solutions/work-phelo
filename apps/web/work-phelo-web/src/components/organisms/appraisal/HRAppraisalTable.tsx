import { useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { formatDate } from '@/lib/formatters';
import { Column, DataTable } from '../shared/DataTable';
import { useAppraisalCycles } from '@/hooks/useAppraisals';
import { cn } from '@/lib/utils';

interface Props {
  search: string;
  onSearch: (q: string) => void;
  page: number;
  onPageChange: (page: number) => void;
}

type CycleStatus = 'In Progress' | 'Completed' | 'Upcoming' | 'Expired';

const CYCLE_STATUS_STYLES: Record<CycleStatus, { dot: string; text: string }> = {
  'In Progress': { dot: 'bg-blue-500', text: 'text-blue-600' },
  Completed: { dot: 'bg-green-500', text: 'text-green-600' },
  Upcoming: { dot: 'bg-gray-400', text: 'text-gray-500' },
  Expired: { dot: 'bg-red-400', text: 'text-red-500' },
};

function deriveCycleStatus(
  startDate: string,
  endDate: string,
  completionRate?: number,
): CycleStatus {
  if ((completionRate ?? 0) >= 100) return 'Completed';
  const today = new Date().toISOString().slice(0, 10);
  if (startDate > today) return 'Upcoming';
  if (endDate < today) return 'Expired';
  return 'In Progress';
}

export function HRAppraisalsTable({ search, onSearch, page, onPageChange }: Props) {
  const router = useRouter();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();

  const { data: hrData, isLoading } = useAppraisalCycles({ page, search: search || undefined });

  type HRCycleRow = {
    id: string;
    title: string;
    frequency: string;
    startDate: string;
    endDate: string;
    totalEmployees?: number;
    completionRate?: number;
    status?: string;
    isActive?: boolean;
  };

  const hrCycles = useMemo<HRCycleRow[]>(() => (hrData ?? []) as HRCycleRow[], [hrData]);

  const totalPages = 1;

  const columns: Column<HRCycleRow>[] = [
    {
      key: 'title',
      label: 'Cycle Name',
      render: (r) => <span className="font-medium text-gray-900">{r.title}</span>,
    },
    {
      key: 'frequency',
      label: 'Frequency',
      render: (r) => <span className="font-medium text-gray-900">{r.frequency ?? '—'}</span>,
    },
    {
      key: 'date range',
      label: 'Date range',
      render: (r) => (
        <span className="text-xs text-gray-600">
          {formatDate(r.startDate)} – {formatDate(r.endDate)}
        </span>
      ),
    },
    {
      key: 'totalEmployees',
      label: 'Employees',
      render: (r) => <span className="font-medium text-gray-700">{r.totalEmployees ?? '—'}</span>,
    },
    {
      key: 'completionRate',
      label: 'Completion',
      render: (r) => {
        const rate = r.completionRate ?? 0;
        return (
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden max-w-24">
              <div
                className="h-full bg-brand rounded-full transition-all"
                style={{ width: `${rate}%` }}
              />
            </div>
            <span className="text-xs text-gray-600 shrink-0 w-9 text-right">{rate}%</span>
          </div>
        );
      },
    },
    {
      key: 'status',
      label: 'Status',
      render: (r) => {
        const status = deriveCycleStatus(r.startDate, r.endDate, r.completionRate);
        const s = CYCLE_STATUS_STYLES[status];
        return (
          <span className={cn('inline-flex items-center gap-1.5 text-sm font-medium', s.text)}>
            <span className={cn('w-2 h-2 rounded-full shrink-0', s.dot)} />
            {status}
          </span>
        );
      },
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={hrCycles}
      isLoading={isLoading}
      searchPlaceholder="Search cycles..."
      onSearch={onSearch}
      currentPage={page}
      totalPages={totalPages}
      onRowClick={(row) => router.push(`/${tenantSlug}/hr/appraisal/cycles/${row.id}`)}
      onPageChange={onPageChange}
      emptyMessage="No appraisal cycles created yet"
    />
  );
}
