import { useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useLoadingRouter as useRouter } from '@/hooks/useLoadingRouter';
import { formatDate } from '@/lib/formatters';
import { Column, DataTable } from '../../shared/DataTable';
import { cn } from '@/lib/utils';
import { useAppraisalGoalsStore, type LocalCycle } from '@/store/appraisalGoals.store';
import { useAppraisalAssessmentsStore } from '@/store/appraisalAssessments.store';

interface Props {
  search: string;
  onSearch: (q: string) => void;
  page: number;
  onPageChange: (page: number) => void;
}

type CycleStatus = 'In Progress' | 'Completed' | 'Upcoming' | 'Expired' | 'Cancelled';

const CYCLE_STATUS_STYLES: Record<CycleStatus, { dot: string; text: string }> = {
  'In Progress': { dot: 'bg-blue-500', text: 'text-blue-600' },
  Completed: { dot: 'bg-green-500', text: 'text-green-600' },
  Upcoming: { dot: 'bg-gray-400', text: 'text-gray-500' },
  Expired: { dot: 'bg-red-400', text: 'text-red-500' },
  Cancelled: { dot: 'bg-red-300', text: 'text-red-400' },
};

const PAGE_SIZE = 10;

export function HRAppraisalsTable({ search, onSearch, page, onPageChange }: Props) {
  const router = useRouter();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const cycles = useAppraisalGoalsStore((s) => s.cycles);
  const assessments = useAppraisalAssessmentsStore((s) => s.assessments);

  const rows = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return cycles
      .filter((c) => c.title.toLowerCase().includes(search.trim().toLowerCase()))
      .map((c) => {
        const own = assessments.filter((a) => a.cycleId === c.id);
        const done = own.reduce(
          (sum, a) =>
            sum +
            (a.status === 'FINALIZED'
              ? 2
              : a.status === 'MANAGER_SUBMITTED'
                ? 2
                : a.status === 'SELF_SUBMITTED'
                  ? 1
                  : 0),
          0,
        );
        const rate = own.length > 0 ? Math.round((done / (own.length * 2)) * 100) : 0;
        let status: CycleStatus;
        if (c.status === 'CANCELLED') status = 'Cancelled';
        else if (c.status === 'UPCOMING') status = c.endDate < today ? 'Expired' : 'Upcoming';
        else if (own.length > 0 && own.every((a) => a.status === 'FINALIZED')) status = 'Completed';
        else status = c.endDate < today ? 'Expired' : 'In Progress';
        return { id: c.id, cycle: c, employees: own.length, rate, status };
      });
  }, [cycles, assessments, search]);

  type Row = (typeof rows)[0];
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const pageData = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const columns: Column<Row>[] = [
    {
      key: 'title',
      label: 'Cycle Name',
      width: 'minmax(200px, 1fr)',
      render: (r) => <span className="font-medium text-gray-900">{r.cycle.title}</span>,
    },
    {
      key: 'date range',
      label: 'Date range',
      width: '200px',
      render: (r: Row) => {
        const c: LocalCycle = r.cycle;
        return (
          <span className="text-xs text-gray-600">
            {formatDate(c.startDate)} – {formatDate(c.endDate)}
          </span>
        );
      },
    },
    {
      key: 'employees',
      label: 'Employees',
      width: '100px',
      render: (r) => <span className="font-medium text-gray-700">{r.employees || '—'}</span>,
    },
    {
      key: 'completionRate',
      label: 'Completion',
      width: '200px',
      render: (r) => (
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden max-w-24">
            <div
              className="h-full bg-brand rounded-full transition-all"
              style={{ width: `${r.rate}%` }}
            />
          </div>
          <span className="text-xs text-gray-600 shrink-0 w-9 text-right">{r.rate}%</span>
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      width: '150px',
      render: (r) => {
        const s = CYCLE_STATUS_STYLES[r.status];
        return (
          <span className={cn('inline-flex items-center gap-1.5 text-sm font-medium', s.text)}>
            <span className={cn('w-2 h-2 rounded-full shrink-0', s.dot)} />
            {r.status}
          </span>
        );
      },
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={pageData}
      searchPlaceholder="Search cycles..."
      searchValue={search}
      onSearch={onSearch}
      currentPage={page}
      totalPages={totalPages}
      onRowClick={(r) => router.push(`/${tenantSlug}/hr/appraisal/cycles/${r.cycle.id}`)}
      onPageChange={onPageChange}
      emptyMessage="No appraisal cycles created yet"
      noInternalScroll
    />
  );
}
