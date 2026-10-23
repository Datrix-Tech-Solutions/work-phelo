import { useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useLoadingRouter as useRouter } from '@/hooks/useLoadingRouter';
import { formatDate } from '@/lib/formatters';
import { TableButton } from '@/components/atoms/TableButton';
import { Column, DataTable } from '../../shared/DataTable';
import { useAllEmployees, useMyProfile } from '@/hooks/hr/useEmployees';
import { useAppraisalGoalsStore } from '@/store/appraisalGoals.store';
import { useAppraisalAssessmentsStore } from '@/store/appraisalAssessments.store';
import { useIsManager } from '@/hooks/hr/useIsManager';
import { StatusLabel } from './CycleAssessments';

const PAGE_SIZE = 10;

interface Props {
  search: string;
  onSearch: (q: string) => void;
  page: number;
  onPageChange: (page: number) => void;
}

/** The assessments of the people who report to the signed-in manager, once they have rated themselves. */
export function TeamReviewTable({ search, onSearch, page, onPageChange }: Props) {
  const router = useRouter();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { data: me } = useMyProfile();
  const { reviewsAll } = useIsManager();
  const { data: employeeData, isLoading } = useAllEmployees();
  const cycles = useAppraisalGoalsStore((s) => s.cycles);
  const assessments = useAppraisalAssessmentsStore((s) => s.assessments);

  const rows = useMemo(() => {
    const team = (employeeData?.data ?? []).filter(
      (e) => reviewsAll || (e.managerId && e.managerId === me?.id),
    );
    return assessments.flatMap((a) => {
      const employee = team.find((e) => e.id === a.employeeId);
      const cycle = cycles.find((c) => c.id === a.cycleId);
      if (!employee || !cycle || cycle.status === 'CANCELLED' || a.status === 'NOT_STARTED') {
        return [];
      }
      const employeeName = `${employee.firstName} ${employee.lastName}`;
      if (
        search &&
        !`${employeeName} ${cycle.title}`.toLowerCase().includes(search.toLowerCase())
      ) {
        return [];
      }
      return [
        {
          id: a.id,
          cycleId: cycle.id,
          employeeName,
          cycleName: cycle.title,
          managerReviewDeadline: cycle.managerReviewDeadline,
          status: a.status,
        },
      ];
    });
  }, [assessments, cycles, employeeData, me?.id, reviewsAll, search]);

  type Row = (typeof rows)[0];
  const open = (r: Row) =>
    router.push(
      `/${tenantSlug}/hr/appraisal/cycles/${r.cycleId}/${
        r.status === 'SELF_SUBMITTED' ? 'manager-review' : 'results'
      }/${r.id}`,
    );

  const columns: Column<Row>[] = [
    {
      key: 'employeeName',
      label: 'Employee',
      render: (r) => <span className="font-medium text-gray-900">{r.employeeName}</span>,
    },
    { key: 'cycleName', label: 'Cycle', render: (r) => r.cycleName },
    {
      key: 'deadline',
      label: 'Review deadline',
      render: (r) => (r.managerReviewDeadline ? formatDate(r.managerReviewDeadline) : '—'),
    },
    { key: 'status', label: 'Status', render: (r) => <StatusLabel status={r.status} /> },
    {
      key: 'action',
      label: '',
      width: '160px',
      render: (r) => (
        <div onClick={(e) => e.stopPropagation()}>
          <TableButton
            variant={r.status === 'SELF_SUBMITTED' ? 'green' : 'blue'}
            onClick={() => open(r)}
          >
            {r.status === 'SELF_SUBMITTED' ? 'Review' : 'View'}
          </TableButton>
        </div>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)}
      isLoading={isLoading}
      searchPlaceholder="Search team..."
      searchValue={search}
      onSearch={onSearch}
      onRowClick={open}
      currentPage={page}
      totalPages={Math.max(1, Math.ceil(rows.length / PAGE_SIZE))}
      onPageChange={onPageChange}
      emptyMessage="No team assessments to review yet"
      noInternalScroll
    />
  );
}
