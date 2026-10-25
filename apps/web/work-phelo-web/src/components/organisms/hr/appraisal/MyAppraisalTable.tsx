'use client';

import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { useLoadingRouter as useRouter } from '@/hooks/useLoadingRouter';
import { useMyProfile } from '@/hooks/hr/useEmployees';
import { STATUS_LABELS, goalsWithObjectives, overallScore } from '@/lib/appraisalAssessments';
import { useAppraisalGoalsStore } from '@/store/appraisalGoals.store';
import { useEmployeeObjectivesStore } from '@/store/employeeObjectives.store';
import {
  useAppraisalAssessmentsStore,
  type AssessmentStatus,
} from '@/store/appraisalAssessments.store';
import { StatusLabel } from './CycleAssessments';
import { Column, DataTable } from '../../shared/DataTable';
import { TableButton } from '@/components/atoms/TableButton';
import { Button } from '@/components/atoms/Button';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { cardClass } from '@/lib/utils';

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
  onManage?: () => void;
}

export function MyAppraisalsTable({ search, page, onPageChange, onManage }: Props) {
  const router = useRouter();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const [statusFilter, setStatusFilter] = useState('');

  const { data: me, isLoading } = useMyProfile();
  const cycles = useAppraisalGoalsStore((s) => s.cycles);
  const goals = useAppraisalGoalsStore((s) => s.goals);
  const objectives = useEmployeeObjectivesStore((s) => s.objectives);
  const assessments = useAppraisalAssessmentsStore((s) => s.assessments);

  const myRows = useMemo(
    () =>
      assessments
        .filter((a) => a.employeeId === me?.id)
        .flatMap((a) => {
          const cycle = cycles.find((c) => c.id === a.cycleId);
          if (!cycle || cycle.status === 'CANCELLED') return [];
          return [
            {
              id: a.id,
              cycleId: cycle.id,
              cycleName: cycle.title,
              status: a.status,
              overallScore: overallScore(
                a,
                goalsWithObjectives(cycle, goals, objectives, a.employeeId, a),
              ),
              selfAssessmentDeadline: cycle.selfAssessmentDeadline,
            },
          ];
        }),
    [assessments, cycles, goals, objectives, me?.id],
  );

  const filteredRows = useMemo(() => {
    let rows = myRows;
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter((r) => r.cycleName.toLowerCase().includes(q));
    }
    if (statusFilter) rows = rows.filter((r) => r.status === statusFilter);
    return rows;
  }, [myRows, search, statusFilter]);

  const pageData = filteredRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));

  type MyRow = (typeof myRows)[0];
  const open = (r: MyRow) =>
    router.push(
      `/${tenantSlug}/hr/appraisal/cycles/${r.cycleId}/${
        r.status === 'NOT_STARTED' ? 'self-assessment' : 'results'
      }/${r.id}`,
    );

  const columns: Column<MyRow>[] = [
    {
      key: 'cycleName',
      label: 'Cycle Name',
      width: 'minmax(150px, 1.5fr)',
      render: (r) => <span className="font-medium text-gray-900">{r.cycleName}</span>,
    },
    {
      key: 'selfAssessmentDeadline',
      label: 'Self-Assessment Deadline',
      width: '200px',
      render: (r) => (
        <span className="text-gray-700">{formatDeadline(r.selfAssessmentDeadline)}</span>
      ),
    },
    {
      key: 'overallScore',
      label: 'Overall Score',
      width: '150px',
      render: (r) =>
        r.overallScore != null ? (
          <span className="font-medium text-gray-900">{r.overallScore}%</span>
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
      width: '160px',
      render: (r) => (
        <div onClick={(e) => e.stopPropagation()}>
          <TableButton
            variant={r.status === 'NOT_STARTED' ? 'green' : 'blue'}
            onClick={() => open(r)}
          >
            {r.status === 'NOT_STARTED' ? 'Start' : 'View Assessment'}
          </TableButton>
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* Custom toolbar — mirrors DataTable's own toolbar card, since it's rendered outside DataTable here */}
      <div className={cardClass('px-4 py-2 shrink-0')}>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Status filter */}
          <div className="w-48">
            <SearchSelect
              size="sm"
              placeholder="Status"
              showAllOption
              allLabel="All"
              options={(Object.keys(STATUS_LABELS) as AssessmentStatus[]).map((status) => ({
                value: status,
                label: STATUS_LABELS[status],
              }))}
              value={statusFilter}
              onChange={(value) => {
                setStatusFilter(value);
                onPageChange(1);
              }}
            />
          </div>

          <div className="flex-1" />

          {onManage && (
            <Button variant="outline" onClick={onManage}>
              Manage
            </Button>
          )}
        </div>
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
        onRowClick={open}
        noInternalScroll
      />
    </div>
  );
}
