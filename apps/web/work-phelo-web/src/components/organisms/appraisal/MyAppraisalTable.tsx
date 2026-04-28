'use client';

import { useMemo, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useMyAppraisals, useAppraisalCycles } from '@/hooks/useAppraisals';
import { Column, DataTable } from '../shared/DataTable';
import { cn } from '@/lib/utils';
import { Icons } from '@/components/atoms/icons';

type MyAppraisalStatus = 'Pending' | 'Completed' | 'Overdue';

const STATUS_CONFIG: Record<MyAppraisalStatus, { dot: string; text: string }> = {
  Pending: { dot: 'bg-amber-400', text: 'text-amber-500' },
  Completed: { dot: 'bg-green-500', text: 'text-green-600' },
  Overdue: { dot: 'bg-red-500', text: 'text-red-500' },
};

function deriveStatus(overallStatus: string, deadline: string): MyAppraisalStatus {
  if (overallStatus === 'Finalized') return 'Completed';
  if (deadline) {
    const today = new Date().toISOString().slice(0, 10);
    if (deadline.slice(0, 10) < today) return 'Overdue';
  }
  return 'Pending';
}

function formatDeadline(d: string): string {
  if (!d) return '—';
  const date = new Date(d);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const PAGE_SIZE = 10;

interface Props {
  search: string;
  onSearch: (q: string) => void;
  page: number;
  onPageChange: (page: number) => void;
}

export function MyAppraisalsTable({ search, page, onPageChange }: Props) {
  const router = useRouter();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const [statusFilter, setStatusFilter] = useState('');

  const { data: myData, isLoading } = useMyAppraisals();
  const { data: cycles = [] } = useAppraisalCycles();

  const myRows = useMemo(() => {
    const list = Array.isArray(myData) ? myData : [];
    return list.map(
      (r: {
        id: unknown;
        cycleId: unknown;
        cycleName?: unknown;
        cycleStatus?: string;
        overallStatus?: string;
        overallScore?: number | null;
      }) => {
        const cycleId = String(r.cycleId ?? '');
        const cycle = cycles.find((c) => c.id === cycleId);
        return {
          id: String(r.id),
          cycleId,
          cycleName: String(r.cycleName ?? cycle?.title ?? ''),
          cycleStatus: r.cycleStatus ?? 'UPCOMING',
          overallStatus: r.overallStatus ?? 'NotStarted',
          overallScore: r.overallScore != null ? Number(r.overallScore) : undefined,
          selfAssessmentDeadline: cycle?.selfAssessmentDeadline ?? '',
        };
      },
    );
  }, [myData, cycles]);

  const filteredRows = useMemo(() => {
    let rows = myRows;
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter((r) => r.cycleName.toLowerCase().includes(q));
    }
    if (statusFilter) {
      rows = rows.filter(
        (r) => deriveStatus(r.overallStatus, r.selfAssessmentDeadline) === statusFilter,
      );
    }
    return rows;
  }, [myRows, search, statusFilter]);

  const pageData = filteredRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));

  type MyRow = (typeof myRows)[0];

  const columns: Column<MyRow>[] = [
    {
      key: 'cycleName',
      label: 'Cycle Name',
      render: (r) => <span className="font-medium text-gray-900">{r.cycleName}</span>,
    },
    {
      key: 'selfAssessmentDeadline',
      label: 'Self-Assessment Deadline',
      render: (r) => (
        <span className="text-gray-700">{formatDeadline(r.selfAssessmentDeadline)}</span>
      ),
    },
    {
      key: 'overallScore',
      label: 'Overall Score',
      render: (r) =>
        r.overallScore != null ? (
          <span className="font-medium text-gray-900">{r.overallScore}%</span>
        ) : (
          <span className="text-gray-400">-</span>
        ),
    },
    {
      key: 'status',
      label: 'Status',
      width: '130px',
      render: (r) => {
        const status = deriveStatus(r.overallStatus, r.selfAssessmentDeadline);
        const s = STATUS_CONFIG[status];
        return (
          <span className={cn('inline-flex items-center gap-1.5 text-sm font-medium', s.text)}>
            <span className={cn('w-2 h-2 rounded-full shrink-0', s.dot)} />
            {status}
          </span>
        );
      },
    },
    {
      key: 'action',
      label: '',
      width: '160px',
      render: (r) => {
        const status = deriveStatus(r.overallStatus, r.selfAssessmentDeadline);
        if (status === 'Completed') {
          return (
            <button
              onClick={() =>
                router.push(`/${tenantSlug}/hr/appraisal/cycles/${r.cycleId}/results/${r.id}`)
              }
              className="text-sm font-medium text-gray-700 hover:text-brand transition-colors"
            >
              View Assessment
            </button>
          );
        }
        return (
          <button
            onClick={() =>
              router.push(`/${tenantSlug}/hr/appraisal/cycles/${r.cycleId}/self-assessment/${r.id}`)
            }
            className="px-4 py-1.5 rounded-full border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Start
          </button>
        );
      },
    },
  ];

  return (
    <div className="flex flex-col gap-4 flex-1 min-h-0 h-full">
      {/* Custom toolbar */}
      <div className="flex items-center gap-3 flex-wrap shrink-0">
        {/* Status filter */}
        <div className="relative">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              onPageChange(1);
            }}
            className="appearance-none pl-4 pr-8 py-2 border border-gray-200 rounded-input text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-gray-400 bg-white font-medium"
          >
            <option value="">Filter</option>
            <option value="Pending">Pending</option>
            <option value="Completed">Completed</option>
            <option value="Overdue">Overdue</option>
          </select>
          <Icons.ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none h-4 w-4" />
        </div>

        <div className="flex-1" />
      </div>

      {/* Table — pass data without triggering DataTable's own toolbar */}
      <DataTable
        columns={columns}
        data={pageData}
        isLoading={isLoading}
        emptyMessage="No appraisal cycles assigned to you yet"
        currentPage={page}
        totalPages={totalPages}
        onPageChange={onPageChange}
      />
    </div>
  );
}
