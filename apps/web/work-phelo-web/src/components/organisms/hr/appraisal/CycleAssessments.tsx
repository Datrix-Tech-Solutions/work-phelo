'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { BarChart2, CalendarCheck, User, Users } from 'lucide-react';
import { useLoadingRouter as useRouter } from '@/hooks/useLoadingRouter';
import { Icons } from '@/components/atoms/icons';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { MetricCard } from '@/components/molecules/shared/MetricCard';
import { CycleProgressSection } from '@/components/molecules/hr/appraisal/CycleProgressSection';
import { RatingBadge } from '@/components/molecules/hr/appraisal/RatingBadge';
import { RatingDistributionChart } from '@/components/molecules/hr/appraisal/RatingDistributionChart';
import { DataTable, type Column } from '@/components/organisms/shared/DataTable';
import { useAllEmployees } from '@/hooks/hr/useEmployees';
import { formatDate } from '@/lib/formatters';
import { pageContent } from '@/lib/layout';
import {
  RATINGS,
  STATUS_LABELS,
  STATUS_STYLES,
  goalsWithObjectives,
  managerScorePct,
  overallScore,
  ratingForScore,
  selfScorePct,
} from '@/lib/appraisalAssessments';
import { cardClass, cn } from '@/lib/utils';
import { useAppraisalGoalsStore } from '@/store/appraisalGoals.store';
import { useEmployeeObjectivesStore } from '@/store/employeeObjectives.store';
import { useAppraisalAssessmentsStore, type Assessment } from '@/store/appraisalAssessments.store';

type Tab = 'overview' | 'results';

export function StatusLabel({ status }: { status: Assessment['status'] }) {
  const s = STATUS_STYLES[status];
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-sm font-medium', s.text)}>
      <span className={cn('w-2 h-2 rounded-full shrink-0', s.dot)} />
      {STATUS_LABELS[status]}
    </span>
  );
}

const pct = (value: number | null) => (value === null ? '—' : `${value}%`);

/** HR's view of a cycle: how far it has got, and every employee's result. */
export function CycleAssessments({ tenantSlug, cycleId }: { tenantSlug: string; cycleId: string }) {
  const router = useRouter();
  const cycle = useAppraisalGoalsStore((s) => s.cycles.find((c) => c.id === cycleId));
  const goals = useAppraisalGoalsStore((s) => s.goals);
  const objectives = useEmployeeObjectivesStore((s) => s.objectives);
  const allAssessments = useAppraisalAssessmentsStore((s) => s.assessments);
  const { data: employeeData } = useAllEmployees();
  const employees = useMemo(() => employeeData?.data ?? [], [employeeData]);

  const [tab, setTab] = useState<Tab>('overview');
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [ratingFilter, setRatingFilter] = useState('');

  const all = useMemo(() => {
    if (!cycle) return [];
    return allAssessments
      .filter((a) => a.cycleId === cycleId)
      .map((a) => {
        const employee = employees.find((e) => e.id === a.employeeId);
        const manager = employees.find((e) => e.id === employee?.managerId);
        const entries = goalsWithObjectives(cycle, goals, objectives, a.employeeId, a);
        const final = overallScore(a, entries);
        return {
          id: a.id,
          assessment: a,
          employeeName: employee ? `${employee.firstName} ${employee.lastName}` : 'Employee',
          department: employee?.department?.name ?? '',
          managerName: manager ? `${manager.firstName} ${manager.lastName}` : '',
          self: selfScorePct(a, entries),
          manager: managerScorePct(a, entries),
          final,
          rating: ratingForScore(final),
        };
      })
      .sort((a, b) => a.employeeName.localeCompare(b.employeeName));
  }, [allAssessments, cycle, cycleId, employees, goals, objectives]);

  type Row = (typeof all)[0];

  const total = all.length;
  const selfDone = all.filter((r) => r.assessment.status !== 'NOT_STARTED').length;
  const managerDone = all.filter(
    (r) => r.assessment.status === 'MANAGER_SUBMITTED' || r.assessment.status === 'FINALIZED',
  ).length;
  const finalized = all.filter((r) => r.assessment.status === 'FINALIZED').length;
  const overallPct = total > 0 ? Math.round((finalized / total) * 100) : 0;
  const exceeded = all.filter((r) => r.rating === 'Outstanding' || r.rating === 'Very Good').length;
  const needsImprovement = all.filter((r) => r.rating === 'Needs Improvement').length;

  const distribution = useMemo(() => {
    const rated = all.filter((r) => r.rating).length || 1;
    return RATINGS.map((rating) => {
      const count = all.filter((r) => r.rating === rating).length;
      return { rating, count, percentage: Math.round((count / rated) * 100) };
    });
  }, [all]);

  const departments = useMemo(
    () => [...new Set(all.map((r) => r.department).filter(Boolean))].sort(),
    [all],
  );

  const filtered = all.filter(
    (r) =>
      r.employeeName.toLowerCase().includes(search.trim().toLowerCase()) &&
      (!deptFilter || r.department === deptFilter) &&
      (!ratingFilter || r.rating === ratingFilter),
  );

  if (!cycle)
    return <div className={cn(pageContent, 'text-sm text-gray-400')}>Cycle not found.</div>;

  const columns: Column<Row>[] = [
    {
      key: 'employee',
      label: 'Employee',
      width: 'minmax(150px, 1.5fr)',
      render: (r) => <span className="font-medium text-gray-900">{r.employeeName}</span>,
    },
    { key: 'department', label: 'Department', render: (r) => r.department || '—' },
    { key: 'manager', label: 'Manager', render: (r) => r.managerName || '—' },
    { key: 'status', label: 'Status', render: (r) => <StatusLabel status={r.assessment.status} /> },
    { key: 'self', label: 'Self (%)', width: '100px', render: (r) => pct(r.self) },
    { key: 'managerScore', label: 'Manager (%)', width: '120px', render: (r) => pct(r.manager) },
    {
      key: 'final',
      label: 'Final (%)',
      width: '100px',
      render: (r) => <span className="font-medium text-gray-900">{pct(r.final)}</span>,
    },
    {
      key: 'rating',
      label: 'Rating',
      width: '180px',
      render: (r) => <RatingBadge rating={r.rating} />,
    },
  ];

  return (
    <div className={cn(pageContent, 'flex flex-col gap-6')}>
      <Link
        href={`/${tenantSlug}/hr/appraisal/hr-review`}
        className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors w-fit"
      >
        <Icons.ChevronLeft />
        Back to HR Review
      </Link>
      <div>
        <h1 className="text-xl font-bold text-gray-900">{cycle.title}</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {formatDate(cycle.startDate)} – {formatDate(cycle.endDate)} · {cycle.goalIds.length}{' '}
          {cycle.goalIds.length === 1 ? 'goal' : 'goals'}
        </p>
      </div>

      <div className="flex items-center gap-1 border-b border-gray-200 shrink-0">
        {(['overview', 'results'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px',
              tab === t
                ? 'border-brand text-brand'
                : 'border-transparent text-gray-500 hover:text-gray-700',
            )}
          >
            {t === 'overview' ? 'Overview' : 'Individual Results'}
          </button>
        ))}
      </div>

      {tab === 'overview' ? (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard label="Employees Included" value={total} icon={Users} />
            <MetricCard label="Self Assessment" value={selfDone} icon={User} />
            <MetricCard label="Manager Review" value={managerDone} icon={CalendarCheck} />
            <MetricCard label="Overall Completion" value={`${overallPct}%`} icon={BarChart2} />
          </div>
          <CycleProgressSection
            title="Self Assessments"
            completed={selfDone}
            total={total}
            entityLabel="employees"
          />
          <CycleProgressSection
            title="Manager Reviews"
            completed={managerDone}
            total={total}
            entityLabel="reviews"
          />
          <div className="grid grid-cols-2 gap-4">
            <MetricCard
              label="Exceeded Expectations"
              value={exceeded}
              sub="Outstanding or Very Good"
              highlight="green"
            />
            <MetricCard
              label="Needs Improvement"
              value={needsImprovement}
              highlight={needsImprovement > 0 ? 'red' : undefined}
            />
          </div>
          <div className={cardClass('shrink-0')}>
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-900">Rating Distribution</h2>
            </div>
            <RatingDistributionChart data={distribution} />
          </div>
        </>
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
          searchPlaceholder="Search employees..."
          searchValue={search}
          onSearch={setSearch}
          extraFilters={
            <>
              <div className="w-48">
                <SearchSelect
                  size="sm"
                  placeholder="Department"
                  showAllOption
                  allLabel="All departments"
                  options={departments.map((d) => ({ value: d, label: d }))}
                  value={deptFilter}
                  onChange={setDeptFilter}
                />
              </div>
              <div className="w-48">
                <SearchSelect
                  size="sm"
                  placeholder="Rating"
                  showAllOption
                  allLabel="All ratings"
                  options={RATINGS.map((r) => ({ value: r, label: r }))}
                  value={ratingFilter}
                  onChange={setRatingFilter}
                />
              </div>
            </>
          }
          onRowClick={(r) =>
            router.push(`/${tenantSlug}/hr/appraisal/cycles/${cycleId}/employee/${r.id}`)
          }
          emptyMessage={
            cycle.status === 'UPCOMING'
              ? 'Start the cycle to create the assessments.'
              : 'No assessments match your filters'
          }
          currentPage={1}
          totalPages={1}
          onPageChange={() => undefined}
          noInternalScroll
        />
      )}
    </div>
  );
}
