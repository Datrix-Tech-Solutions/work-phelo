'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Users, CheckCheck, Trophy, TriangleAlert } from 'lucide-react';
import { SearchIcon } from 'lucide-react';
import { api } from '@/lib/api';
import { Icons } from '@/components/atoms/icons';
import { MetricCard } from '@/components/molecules/shared/MetricCard';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { useAppraisalCycles } from '@/hooks/useAppraisals';
import { cn } from '@/lib/utils';
import { FinalRating, CycleResultItem, CycleResultsSummary } from '@/types/hr';

const BAND_STYLES: Record<FinalRating, { dot: string; text: string }> = {
  Outstanding: { dot: 'bg-green-500', text: 'text-green-600' },
  'Very Good': { dot: 'bg-blue-400', text: 'text-blue-600' },
  Good: { dot: 'bg-gray-400', text: 'text-gray-600' },
  Satisfactory: { dot: 'bg-amber-400', text: 'text-amber-600' },
  'Needs Improvement': { dot: 'bg-red-500', text: 'text-red-600' },
};

const ALL_RATINGS: FinalRating[] = [
  'Outstanding',
  'Very Good',
  'Good',
  'Satisfactory',
  'Needs Improvement',
];

function BandBadge({ rating }: { rating?: FinalRating }) {
  if (!rating) return <span className="text-gray-400">—</span>;
  const s = BAND_STYLES[rating];
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-sm font-medium', s.text)}>
      <span className={cn('w-2 h-2 rounded-full shrink-0', s.dot)} />
      {rating}
    </span>
  );
}

function formatCompletedDate(d?: string): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
}

interface Props {
  tenantSlug: string;
  cycleId: string;
}

export function CycleCompletedContent({ tenantSlug, cycleId }: Props) {
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [bandFilter, setBandFilter] = useState('');

  const { data: cycles = [] } = useAppraisalCycles();
  const cycle = cycles.find((c) => c.id === cycleId);

  const { data: summary, isLoading } = useQuery<CycleResultsSummary>({
    queryKey: ['cycle-results', cycleId],
    queryFn: () => api.get(`/hr/appraisals/cycles/${cycleId}/results`).then((r) => r.data),
    enabled: !!cycleId,
  });

  const results: CycleResultItem[] = useMemo(() => summary?.results ?? [], [summary]);

  const outstanding = useMemo(
    () => results.filter((r) => r.finalRating === 'Outstanding').length,
    [results],
  );
  const needsImprovement = useMemo(
    () => results.filter((r) => r.finalRating === 'Needs Improvement').length,
    [results],
  );

  const departments = useMemo(() => {
    const set = new Set(results.map((r) => r.department).filter(Boolean));
    return Array.from(set).sort();
  }, [results]);

  const filtered = useMemo(() => {
    let data = results;
    if (search) {
      const q = search.toLowerCase();
      data = data.filter((r) => r.employeeName.toLowerCase().includes(q));
    }
    if (deptFilter) data = data.filter((r) => r.department === deptFilter);
    if (bandFilter) data = data.filter((r) => r.finalRating === bandFilter);
    return data;
  }, [results, search, deptFilter, bandFilter]);

  const columns: Column<CycleResultItem>[] = [
    {
      key: 'employeeName',
      label: 'Employee',
      width: '1.5fr',
      render: (r) => <span className="font-medium text-gray-900">{r.employeeName}</span>,
    },
    {
      key: 'department',
      label: 'Department',
      render: (r) => <span className="text-gray-700">{r.department || '—'}</span>,
    },
    {
      key: 'jobTitle',
      label: 'Job Titles',
      render: (r) => <span className="text-gray-700">{r.jobTitle || '—'}</span>,
    },
    {
      key: 'managerName',
      label: 'Manager',
      render: (r) => <span className="text-gray-700">{r.managerName || '—'}</span>,
    },
    {
      key: 'selfScore',
      label: 'Self (%)',
      width: '100px',
      render: (r) => (
        <span className="text-gray-700">{r.selfScore != null ? `${r.selfScore}%` : '—'}</span>
      ),
    },
    {
      key: 'managerScore',
      label: 'Manager (%)',
      width: '120px',
      render: (r) => (
        <span className="text-gray-700">{r.managerScore != null ? `${r.managerScore}%` : '—'}</span>
      ),
    },
    {
      key: 'overallScore',
      label: 'Final (%)',
      width: '100px',
      render: (r) => (
        <span className="font-medium text-gray-900">
          {r.overallScore != null ? `${r.overallScore}%` : '—'}
        </span>
      ),
    },
    {
      key: 'finalRating',
      label: 'Band',
      width: '180px',
      render: (r) => <BandBadge rating={r.finalRating} />,
    },
    {
      key: 'reviewCompletedAt',
      label: 'Completed',
      width: '120px',
      render: (r) => (
        <span className="text-gray-700">{formatCompletedDate(r.reviewCompletedAt)}</span>
      ),
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

      {/* Cycle header card */}
      <div className="bg-white border border-gray-100 rounded-card px-6 py-5 shadow-sm flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <p className="text-xl font-bold text-gray-900">{cycle?.title ?? '—'}</p>
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-green-600">
              <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
              Completed
            </span>
          </div>
          <p className="text-sm text-gray-400 mt-1">Cycle Progress</p>
        </div>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Total Employees Reviewed"
          value={summary?.reviewedCount ?? 0}
          icon={Users}
        />
        <MetricCard
          label="Completion Rate"
          value={`${summary?.completionRate ?? 0}%`}
          icon={CheckCheck}
        />
        <MetricCard label="Outstanding" value={outstanding} icon={Trophy} />
        <MetricCard label="Needs Improvement" value={needsImprovement} icon={TriangleAlert} />
      </div>

      {/* Individual Performance */}
      <div className="bg-white border border-gray-100 rounded-card shadow-sm flex flex-col gap-4 p-5">
        <p className="text-base font-bold text-gray-900">Individual Performance</p>

        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-48 max-w-sm">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="search employee name, job title..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-input text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-400"
            />
          </div>

          <div className="relative">
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="appearance-none pl-4 pr-8 py-2 border border-gray-200 rounded-input text-sm font-medium text-gray-700 bg-white focus:outline-none focus:ring-1 focus:ring-gray-400"
            >
              <option value="">All Departments</option>
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            <Icons.ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none h-4 w-4" />
          </div>

          <div className="relative">
            <select
              value={bandFilter}
              onChange={(e) => setBandFilter(e.target.value)}
              className="appearance-none pl-4 pr-8 py-2 border border-gray-200 rounded-input text-sm font-medium text-gray-700 bg-white focus:outline-none focus:ring-1 focus:ring-gray-400"
            >
              <option value="">All Performance Band</option>
              {ALL_RATINGS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <Icons.ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none h-4 w-4" />
          </div>
        </div>

        <DataTable
          columns={columns}
          data={filtered}
          isLoading={isLoading}
          emptyMessage="No results found"
          currentPage={1}
          totalPages={1}
          onPageChange={() => {}}
        />
      </div>
    </div>
  );
}
