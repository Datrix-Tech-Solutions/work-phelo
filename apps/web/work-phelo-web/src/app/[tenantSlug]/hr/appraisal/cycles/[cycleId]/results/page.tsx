// MANAGER APPRAISAL PAGE //

'use client';

import { use, useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { StatusBadge } from '@/components/molecules/StatusBadge';
import {
  AppraisalCycle,
  FinalRating,
  CycleResultItem,
  CycleResultsSummary,
  DEFAULT_PERFORMANCE_BANDS,
} from '@/types/appraisal';

/* ── Helpers ── */
function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

const RATING_STYLES: Record<FinalRating, string> = {
  Outstanding: 'bg-green-100 text-green-700',
  'Very Good': 'bg-blue-100 text-blue-700',
  Good: 'bg-cyan-100 text-cyan-700',
  Satisfactory: 'bg-yellow-100 text-yellow-700',
  'Needs Improvement': 'bg-red-100 text-red-700',
};

function RatingBadge({ rating }: { rating: FinalRating }) {
  return (
    <span className={cn('px-2.5 py-1 rounded-full text-xs font-semibold', RATING_STYLES[rating])}>
      {rating}
    </span>
  );
}

/* ── Metric card ── */
function MetricCard({
  label,
  value,
  sub,
  highlight,
}: {
  label: string;
  value: string | number;
  sub?: string;
  highlight?: 'green' | 'red';
}) {
  return (
    <div className="bg-white border border-gray-100 rounded-card p-5 flex flex-col gap-2 shadow-sm">
      <span className="text-sm text-gray-500 font-medium">{label}</span>
      <span
        className={cn(
          'text-2xl font-bold',
          highlight === 'green'
            ? 'text-green-600'
            : highlight === 'red'
              ? 'text-red-500'
              : 'text-gray-900',
        )}
      >
        {value}
      </span>
      {sub && <span className="text-xs text-gray-400">{sub}</span>}
    </div>
  );
}

/* ── ChevronLeft icon ── */
function ChevronLeft() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

const ALL_RATINGS: FinalRating[] = [
  'Outstanding',
  'Very Good',
  'Good',
  'Satisfactory',
  'Needs Improvement',
];

export default function CycleResultsPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; cycleId: string }>;
}) {
  const { tenantSlug, cycleId } = use(params);
  const router = useRouter();

  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [ratingFilter, setRatingFilter] = useState('');

  /* ── Fetch cycle ── */
  const { data: cycle, isLoading: cycleLoading } = useQuery<AppraisalCycle>({
    queryKey: ['appraisal-cycle', cycleId],
    queryFn: () => api.get(`/hr/appraisals/cycles/${cycleId}`).then((r) => r.data),
  });

  /* ── Fetch results ── */
  const { data: summary, isLoading: resultsLoading } = useQuery<CycleResultsSummary>({
    queryKey: ['cycle-results', tenantSlug, cycleId],
    queryFn: () => api.get(`/hr/appraisals/cycles/${cycleId}/results`).then((r) => r.data),
    enabled: !!cycleId,
  });

  /* ── Derived stats ── */
  const results: CycleResultItem[] = summary?.results ?? [];

  const exceeded = useMemo(
    () =>
      results.filter((r) => r.finalRating === 'Outstanding' || r.finalRating === 'Very Good')
        .length,
    [results],
  );
  const needsImprovement = useMemo(
    () => results.filter((r) => r.finalRating === 'Needs Improvement').length,
    [results],
  );

  /* ── Unique departments for filter ── */
  const departments = useMemo(() => {
    const set = new Set(results.map((r) => r.department));
    return Array.from(set).sort();
  }, [results]);

  /* ── Filtered table data ── */
  const filtered = useMemo(() => {
    let data = results;
    if (search) {
      const q = search.toLowerCase();
      data = data.filter((r) => r.employeeName.toLowerCase().includes(q));
    }
    if (deptFilter) data = data.filter((r) => r.department === deptFilter);
    if (ratingFilter) data = data.filter((r) => r.finalRating === ratingFilter);
    return [...data].sort((a, b) => a.employeeName.localeCompare(b.employeeName));
  }, [results, search, deptFilter, ratingFilter]);

  /* ── Rating distribution ── */
  const distribution = useMemo(() => {
    const total = results.length || 1;
    return ALL_RATINGS.map((rating) => {
      const count = results.filter((r) => r.finalRating === rating).length;
      return { rating, count, percentage: Math.round((count / total) * 100) };
    });
  }, [results]);

  if (cycleLoading) {
    return <div className="p-8 text-sm text-gray-400">Loading…</div>;
  }

  if (!cycle) {
    return (
      <div className="p-8 flex flex-col gap-4">
        <p className="text-sm text-red-500">Cycle not found.</p>
        <Link
          href={`/${tenantSlug}/hr/appraisal`}
          className="text-sm text-[#0D2244] hover:underline"
        >
          Back to Appraisals
        </Link>
      </div>
    );
  }

  return (
    <div className="p-8 flex flex-col gap-6 min-h-full">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-gray-400 shrink-0">
        <Link
          href={`/${tenantSlug}/hr/appraisal`}
          className="flex items-center gap-1 hover:text-gray-600 transition-colors"
        >
          <ChevronLeft />
          Appraisals
        </Link>
        <span>/</span>
        <span className="text-gray-700 font-medium">{cycle.name}</span>
      </nav>

      {/* Cycle header */}
      <div className="flex items-start justify-between shrink-0">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-gray-900">{cycle.name}</h1>
            <StatusBadge status={cycle.status} />
          </div>
          <p className="text-sm text-gray-500">
            {cycle.frequency} · {formatDate(cycle.startDate)} – {formatDate(cycle.endDate)}
          </p>
        </div>
      </div>

      {resultsLoading ? (
        <div className="text-sm text-gray-400">Loading results…</div>
      ) : (
        <>
          {/* Metric cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 shrink-0">
            <MetricCard
              label="Total Reviewed"
              value={summary?.reviewedCount ?? 0}
              sub={`of ${summary?.totalEmployees ?? 0} employees`}
            />
            <MetricCard label="Completion Rate" value={`${summary?.completionRate ?? 0}%`} />
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

          {/* Rating distribution */}
          <div className="bg-white border border-gray-100 rounded-card shadow-sm shrink-0">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-900">Rating Distribution</h2>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 font-medium border-b border-gray-100">
                  <th className="px-5 py-3 text-left">Rating</th>
                  <th className="px-5 py-3 text-left">Employees</th>
                  <th className="px-5 py-3 text-left">Percentage</th>
                  <th className="px-5 py-3 text-left w-48">Distribution</th>
                </tr>
              </thead>
              <tbody>
                {distribution.map(({ rating, count, percentage }) => (
                  <tr key={rating} className="border-b border-gray-50 last:border-0">
                    <td className="px-5 py-3">
                      <RatingBadge rating={rating} />
                    </td>
                    <td className="px-5 py-3 font-medium text-gray-900">{count}</td>
                    <td className="px-5 py-3 text-gray-600">{percentage}%</td>
                    <td className="px-5 py-3">
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden w-36">
                        <div
                          className="h-full bg-[#0D2244] rounded-full transition-all"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Individual results table */}
          <div className="bg-white border border-gray-100 rounded-card shadow-sm flex flex-col flex-1 min-h-0">
            {/* Table toolbar */}
            <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3 flex-wrap shrink-0">
              <h2 className="text-sm font-semibold text-gray-900 mr-auto">Individual Results</h2>

              {/* Search */}
              <div className="relative">
                <svg
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search employee…"
                  className="h-9 pl-9 pr-4 border border-gray-200 rounded-input text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-400 w-48"
                />
              </div>

              {/* Department filter */}
              <select
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
                className="h-9 px-3 border border-gray-200 rounded-input text-sm text-gray-700 bg-white focus:outline-none focus:ring-1 focus:ring-gray-400"
              >
                <option value="">All Departments</option>
                {departments.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>

              {/* Rating filter */}
              <select
                value={ratingFilter}
                onChange={(e) => setRatingFilter(e.target.value)}
                className="h-9 px-3 border border-gray-200 rounded-input text-sm text-gray-700 bg-white focus:outline-none focus:ring-1 focus:ring-gray-400"
              >
                <option value="">All Ratings</option>
                {ALL_RATINGS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            {/* Table */}
            <div className="overflow-y-auto flex-1">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-gray-50 z-10">
                  <tr className="text-xs text-gray-500 font-medium border-b border-gray-100">
                    <th className="px-5 py-3 text-left">Employee</th>
                    <th className="px-5 py-3 text-left">Department</th>
                    <th className="px-5 py-3 text-left">Job Title</th>
                    <th className="px-5 py-3 text-left">Manager</th>
                    <th className="px-5 py-3 text-left">Rating</th>
                    <th className="px-5 py-3 text-left">Completed</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-12 text-center text-sm text-gray-400">
                        No results match your filters
                      </td>
                    </tr>
                  ) : (
                    filtered.map((row) => (
                      <tr
                        key={row.id}
                        onClick={() =>
                          router.push(
                            `/${tenantSlug}/hr/appraisal/cycles/${cycleId}/results/${row.id}`,
                          )
                        }
                        className="border-b border-gray-50 last:border-0 hover:bg-gray-50 cursor-pointer transition-colors"
                      >
                        <td className="px-5 py-3.5 font-medium text-gray-900">
                          {row.employeeName}
                        </td>
                        <td className="px-5 py-3.5 text-gray-600">{row.department}</td>
                        <td className="px-5 py-3.5 text-gray-600">{row.jobTitle}</td>
                        <td className="px-5 py-3.5 text-gray-600">{row.managerName}</td>
                        <td className="px-5 py-3.5">
                          <RatingBadge rating={row.finalRating} />
                        </td>
                        <td className="px-5 py-3.5 text-gray-600">
                          {formatDate(row.reviewCompletedAt)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
