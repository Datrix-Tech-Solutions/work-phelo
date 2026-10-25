'use client';

import { useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useLoadingRouter as useRouter } from '@/hooks/useLoadingRouter';
import { TableButton } from '@/components/atoms/TableButton';
import { DataTable, type Column } from '@/components/organisms/shared/DataTable';
import { StatusLabel } from '@/components/organisms/hr/appraisal/CycleAssessments';
import { overallScore } from '@/lib/appraisalAssessments';
import { useEmployeeAssessments, useGoalCycles } from '@/hooks/hr/useGoalAppraisals';
import { PerformanceSummaryCard } from './PerformanceSummaryCard';

/** An employee's appraisals as HR sees them: every cycle they are in, and their scores. */
export function EmployeeAssessmentsSection({ employeeId }: { employeeId: string }) {
  const router = useRouter();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { assessments } = useEmployeeAssessments(employeeId);
  const { cycles } = useGoalCycles();

  const rows = useMemo(
    () =>
      assessments.flatMap((a) => {
        const cycle = cycles.find((c) => c.id === a.cycleId);
        if (!cycle || cycle.status === 'CANCELLED') return [];
        return [
          {
            id: a.id,
            cycleId: cycle.id,
            cycleName: cycle.title,
            status: a.status,
            score: overallScore(a, a.entries),
          },
        ];
      }),
    [assessments, cycles],
  );
  type Row = (typeof rows)[0];

  const open = (r: Row) =>
    router.push(`/${tenantSlug}/hr/appraisal/cycles/${r.cycleId}/employee/${r.id}`);

  const columns: Column<Row>[] = [
    {
      key: 'cycle',
      label: 'Cycle Name',
      render: (r) => <span className="font-medium text-gray-900">{r.cycleName}</span>,
    },
    {
      key: 'score',
      label: 'Overall Score',
      width: '150px',
      render: (r) =>
        r.score !== null ? (
          <span className="font-medium text-gray-900">{r.score}%</span>
        ) : (
          <span className="text-gray-400">—</span>
        ),
    },
    {
      key: 'status',
      label: 'Status',
      width: '160px',
      render: (r) => <StatusLabel status={r.status} />,
    },
    {
      key: 'action',
      label: '',
      width: '120px',
      render: (r) => (
        <div onClick={(e) => e.stopPropagation()}>
          <TableButton variant="blue" onClick={() => open(r)}>
            View
          </TableButton>
        </div>
      ),
    },
  ];

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
      <div className="xl:col-span-2 min-w-0">
        <DataTable
          columns={columns}
          data={rows}
          onRowClick={open}
          emptyMessage="This employee isn't in any appraisal cycle yet"
          currentPage={1}
          totalPages={1}
          onPageChange={() => undefined}
          noInternalScroll
        />
      </div>
      <div className="xl:col-span-1">
        <PerformanceSummaryCard employeeId={employeeId} />
      </div>
    </div>
  );
}
