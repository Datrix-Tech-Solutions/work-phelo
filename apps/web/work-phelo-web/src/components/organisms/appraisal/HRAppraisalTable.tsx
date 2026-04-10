// components/HRAppraisalsTable.tsx
import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/atoms/Button';
import { formatDate } from '@/lib/formatters';
import { Column, DataTable } from '../shared/DataTable';
import { StatusBadge } from '@/components/molecules/shared/StatusBadge';
import { api } from '@/lib/api';

interface Props {
  search: string;
  onSearch: (q: string) => void;
  page: number;
  onPageChange: (page: number) => void;
}

export function HRAppraisalsTable({ search, onSearch, page, onPageChange }: Props) {
  const router = useRouter();

  const { data: hrData, isLoading } = useQuery({
    queryKey: ['appraisal-cycles-summary', search, page],
    queryFn: () =>
      api
        .get('/hr/appraisals/cycles', {
          params: { page, search: search || undefined, includeSummary: true },
        })
        .then((r) => r.data),
  });

  type HRCycleRow = {
    id: string;
    title: string;
    startDate: string;
    endDate: string;
    totalEmployees?: number;
    completionRate?: number;
    status?: string;
    isActive?: boolean;
  };

  const hrCycles = useMemo<HRCycleRow[]>(() => {
    const list = Array.isArray(hrData) ? hrData : (hrData?.data ?? hrData?.cycles ?? []);
    return list as HRCycleRow[];
  }, [hrData]);

  const totalPages = hrData?.totalPages ?? 1;

  const columns: Column<HRCycleRow>[] = [
    {
      key: 'title',
      label: 'Cycle Name',
      render: (r) => <span className="font-medium text-gray-900">{r.title}</span>,
    },
    {
      key: 'period',
      label: 'Period',
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
                className="h-full bg-[#0D2244] rounded-full transition-all"
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
      render: (r) => <StatusBadge status={r.isActive ? 'ACTIVE' : 'INACTIVE'} />,
    },
    {
      key: 'viewResults',
      label: '',
      render: (r) =>
        !r.isActive && r.completionRate === 100 ? (
          <Button size="sm" onClick={() => router.push(`/hr/appraisal/cycles/${r.id}/results`)}>
            View Results
          </Button>
        ) : null,
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
      onPageChange={onPageChange}
      emptyMessage="No appraisal cycles created yet"
    />
  );
}
