'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { Users, User, CalendarCheck, BarChart2 } from 'lucide-react';
import { Icons } from '@/components/atoms/icons';
import { MetricCard } from '@/components/molecules/shared/MetricCard';
import { CycleProgressSection } from '@/components/molecules/appraisal/CycleProgressSection';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { useAppraisalCycles, useCycleAppraisals } from '@/hooks/useAppraisals';
import { cn } from '@/lib/utils';

type AppraisalItem = {
  id: string;
  employee?: { firstName?: string; lastName?: string };
  manager?: { firstName?: string; lastName?: string } | null;
  selfStatus?: string;
  managerStatus?: string;
  status?: string;
};

type CycleStatus = 'In Progress' | 'Completed' | 'Upcoming' | 'Expired';

function deriveCycleStatus(
  startDate: string,
  endDate: string,
  completionRate: number,
): CycleStatus {
  if (completionRate >= 100) return 'Completed';
  const today = new Date().toISOString().slice(0, 10);
  if (startDate > today) return 'Upcoming';
  if (endDate < today) return 'Expired';
  return 'In Progress';
}

const STATUS_DOT: Record<CycleStatus, string> = {
  'In Progress': 'bg-blue-500',
  Completed: 'bg-green-500',
  Upcoming: 'bg-gray-400',
  Expired: 'bg-red-400',
};

const STATUS_TEXT: Record<CycleStatus, string> = {
  'In Progress': 'text-blue-600',
  Completed: 'text-green-600',
  Upcoming: 'text-gray-500',
  Expired: 'text-red-500',
};

function StatusPill({ status }: { status: CycleStatus }) {
  return (
    <span
      className={cn('inline-flex items-center gap-1.5 text-sm font-medium', STATUS_TEXT[status])}
    >
      <span className={cn('w-2 h-2 rounded-full shrink-0', STATUS_DOT[status])} />
      {status}
    </span>
  );
}

function ReviewStatus({ status }: { status?: string }) {
  const submitted = status === 'SUBMITTED';
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 text-sm font-medium',
        submitted ? 'text-green-600' : 'text-amber-500',
      )}
    >
      <span
        className={cn('w-2 h-2 rounded-full shrink-0', submitted ? 'bg-green-500' : 'bg-amber-400')}
      />
      {submitted ? 'Completed' : 'Pending'}
    </span>
  );
}

interface Props {
  tenantSlug: string;
  cycleId: string;
}

export function CycleInProgressContent({ tenantSlug, cycleId }: Props) {
  const { data: cycles = [] } = useAppraisalCycles();
  const { data: rawAppraisals, isLoading } = useCycleAppraisals(cycleId);

  const cycle = cycles.find((c) => c.id === cycleId);

  const appraisals: AppraisalItem[] = useMemo(() => {
    const list = Array.isArray(rawAppraisals) ? rawAppraisals : (rawAppraisals?.data ?? []);
    return list as AppraisalItem[];
  }, [rawAppraisals]);

  const total = appraisals.length;
  const selfCompleted = appraisals.filter((a) => a.selfStatus === 'SUBMITTED').length;
  const managerCompleted = appraisals.filter((a) => a.managerStatus === 'SUBMITTED').length;
  const fullyCompleted = appraisals.filter((a) => a.status === 'COMPLETED').length;
  const overallPct = total > 0 ? Math.round((fullyCompleted / total) * 100) : 0;

  const cycleStatus: CycleStatus = cycle
    ? deriveCycleStatus(cycle.startDate, cycle.endDate, overallPct)
    : 'Upcoming';

  type PendingRow = AppraisalItem & { id: string };
  const pendingRows = appraisals as PendingRow[];

  const columns: Column<PendingRow>[] = [
    {
      key: 'employee',
      label: 'Employee',
      width: '2fr',
      render: (r) => (
        <span className="font-medium text-gray-900">
          {r.employee ? `${r.employee.firstName ?? ''} ${r.employee.lastName ?? ''}`.trim() : '—'}
        </span>
      ),
    },
    {
      key: 'manager',
      label: 'Manager',
      width: '2fr',
      render: (r) => (
        <span className="text-gray-700">
          {r.manager ? `${r.manager.firstName ?? ''} ${r.manager.lastName ?? ''}`.trim() : '—'}
        </span>
      ),
    },
    {
      key: 'selfStatus',
      label: 'Self Status',
      width: '140px',
      render: (r) => <ReviewStatus status={r.selfStatus} />,
    },
    {
      key: 'managerStatus',
      label: 'Manager Status',
      width: '160px',
      render: (r) => <ReviewStatus status={r.managerStatus} />,
    },
  ];

  return (
    <div className="p-8 flex flex-col gap-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-gray-400">
        <Link
          href={`/${tenantSlug}/hr/appraisal`}
          className="hover:text-gray-600 transition-colors"
        >
          Appraisal
        </Link>
        <Icons.ChevronRight className="w-4 h-4" />
        <span className="text-gray-700 font-medium">{cycle?.title ?? 'Cycle'}</span>
      </nav>

      <h1 className="text-2xl font-bold text-gray-900">Appraisals</h1>

      {/* Cycle header card */}
      <div className="bg-white border border-gray-100 rounded-card px-6 py-5 shadow-sm">
        <div className="flex items-center gap-3">
          <p className="text-xl font-bold text-gray-900">{cycle?.title ?? '—'}</p>
          <StatusPill status={cycleStatus} />
        </div>
        <p className="text-sm text-gray-400 mt-1">Results</p>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard label="Employees Included" value={total} icon={Users} />
        <MetricCard label="Self Assessment" value={selfCompleted} icon={User} />
        <MetricCard label="Manager Review" value={managerCompleted} icon={CalendarCheck} />
        <MetricCard label="Overall Completion" value={`${overallPct}%`} icon={BarChart2} />
      </div>

      {/* Progress sections */}
      <CycleProgressSection
        title="Self Assessments"
        completed={selfCompleted}
        total={total}
        entityLabel="employees"
      />
      <CycleProgressSection
        title="Manager Reviews"
        completed={managerCompleted}
        total={total}
        entityLabel="Managers"
      />

      {/* Pending table */}
      <div className="flex flex-col gap-3">
        <p className="text-base font-bold text-gray-900">Pending Table</p>
        <DataTable
          columns={columns}
          data={pendingRows}
          isLoading={isLoading}
          emptyMessage="All appraisals are complete"
          currentPage={1}
          totalPages={1}
          onPageChange={() => {}}
        />
      </div>
    </div>
  );
}
