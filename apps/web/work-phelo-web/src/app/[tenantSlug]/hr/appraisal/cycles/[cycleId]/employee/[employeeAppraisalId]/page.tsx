'use client';

import { use } from 'react';
import Link from 'next/link';
import { Download, Printer } from 'lucide-react';
import { useAppraisal, useAppraisalCycles, useCycleResults } from '@/hooks';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/formatters';
import { FinalRating } from '@/types/hr';
import { RatingBadge } from '@/components/molecules/appraisal/RatingBadge';

interface KpiScoreRow {
  kpiId: string;
  title: string;
  weight: number;
  maxScore: number;
  score: number;
  comment?: string;
}

const STATUS_CONFIG: Record<string, { dot: string; text: string; label: string }> = {
  Finalized: { dot: 'bg-green-500', text: 'text-green-600', label: 'Completed' },
  ManagerSubmitted: { dot: 'bg-blue-500', text: 'text-blue-600', label: 'In Review' },
  SelfSubmitted: { dot: 'bg-amber-400', text: 'text-amber-500', label: 'Pending Manager' },
  NotStarted: { dot: 'bg-gray-400', text: 'text-gray-500', label: 'Not Started' },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_CONFIG[status] ?? STATUS_CONFIG.NotStarted;
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-sm font-medium', s.text)}>
      <span className={cn('w-2 h-2 rounded-full shrink-0', s.dot)} />
      {s.label}
    </span>
  );
}

function Avatar({ name }: { name: string }) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase();
  return (
    <div className="w-28 h-28 rounded-full bg-gray-200 flex items-center justify-center text-3xl font-bold text-gray-500 shrink-0">
      {initials}
    </div>
  );
}

function ScoreCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-gray-400">{label}</span>
      <div className="text-base font-bold text-gray-900">{value}</div>
    </div>
  );
}

function ProfileRow({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-sm text-gray-400 w-36 shrink-0">{label}</span>
      <span className="text-sm font-semibold text-gray-800">{value || '—'}</span>
    </div>
  );
}

function weighted(score: number, maxScore: number, weight: number): number {
  if (!maxScore) return 0;
  return (score / maxScore) * weight;
}

export default function EmployeeAppraisalDetailPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; cycleId: string; employeeAppraisalId: string }>;
}) {
  const { tenantSlug, cycleId, employeeAppraisalId } = use(params);

  const { data: appraisal, isLoading } = useAppraisal(employeeAppraisalId);
  const { data: cycles = [] } = useAppraisalCycles();
  const { data: summary } = useCycleResults(cycleId);

  const cycle = cycles.find((c) => c.id === cycleId);
  const resultItem = summary?.results?.find((r) => r.id === employeeAppraisalId);

  const cycleTitle = appraisal?.cycle?.title ?? cycle?.title ?? '';
  const employeeName = resultItem?.employeeName ?? '';

  const selfKpis: KpiScoreRow[] = appraisal?.selfResponse?.kpiScores ?? [];
  const managerKpis: KpiScoreRow[] = appraisal?.managerResponse?.kpiScores ?? [];
  const managerMap = new Map(managerKpis.map((k: KpiScoreRow) => [k.kpiId, k]));

  const appraisalHref = `/${tenantSlug}/hr/appraisal`;
  const cycleHref = `/${tenantSlug}/hr/appraisal/cycles/${cycleId}/results`;

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-64">
        <p className="text-sm text-gray-400">Loading…</p>
      </div>
    );
  }

  if (!appraisal) {
    return (
      <div className="p-8 flex flex-col gap-4">
        <p className="text-sm text-red-500">Appraisal not found.</p>
        <Link href={appraisalHref} className="text-sm text-brand hover:underline">
          ← Back to Appraisals
        </Link>
      </div>
    );
  }

  return (
    <div className="p-8 flex flex-col gap-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-400">
        <Link href={appraisalHref} className="hover:text-gray-600 transition-colors">
          Appraisal
        </Link>
        <span>›</span>
        <Link href={cycleHref} className="hover:text-gray-600 transition-colors">
          {cycleTitle}
        </Link>
        <span>›</span>
        <span className="text-gray-600">{employeeName}</span>
      </nav>

      {/* Page title */}
      <h1 className="text-2xl font-bold text-gray-900">Appraisals</h1>

      {/* Header card */}
      <div className="bg-white rounded-xl border border-gray-200 px-6 py-5 flex items-start justify-between gap-6">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-xl font-bold text-gray-900">{employeeName}</h2>
            <StatusBadge status={appraisal.overallStatus} />
          </div>
          <p className="text-sm text-gray-500">Cycle Progress</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
            <Download className="w-4 h-4" />
            Export CSV
          </button>
          <button className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
            <Printer className="w-4 h-4" />
            Print Appraisal Summary
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="grid grid-cols-[300px_1fr] gap-6 items-start">
        {/* Left: Employee profile card */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 flex flex-col items-center gap-5">
          <Avatar name={employeeName || 'E'} />
          <div className="text-center">
            <p className="text-base font-bold text-gray-900">{employeeName}</p>
            <p className="text-sm text-gray-500">{resultItem?.jobTitle || '—'}</p>
          </div>
          <div className="w-full border-t border-gray-100 pt-4 flex flex-col gap-3">
            <ProfileRow
              label="Email Address:"
              value={
                <span className="font-normal text-gray-600">
                  {appraisal?.employee?.email ?? '—'}
                </span>
              }
            />
            <ProfileRow label="Manager:" value={resultItem?.managerName} />
            <ProfileRow label="Cycle:" value={cycleTitle} />
            <ProfileRow label="Department:" value={resultItem?.department} />
            <ProfileRow
              label="Review Completed:"
              value={resultItem?.reviewCompletedAt ? formatDate(resultItem.reviewCompletedAt) : '—'}
            />
          </div>
        </div>

        {/* Right: Employment details + KPI table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {/* Section header */}
          <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
            <h3 className="text-sm font-semibold text-gray-700">Employment Details</h3>
          </div>

          {/* Score grid */}
          <div className="grid grid-cols-4 gap-6 px-6 py-5 border-b border-gray-100">
            <ScoreCard
              label="Self Assessment Score"
              value={resultItem?.selfScore != null ? `${Math.round(resultItem.selfScore)}%` : '—'}
            />
            <ScoreCard
              label="Manager Assessment Score"
              value={
                resultItem?.managerScore != null ? `${Math.round(resultItem.managerScore)}%` : '—'
              }
            />
            <ScoreCard
              label="Final Combined Score"
              value={
                resultItem?.overallScore != null ? `${Math.round(resultItem.overallScore)}%` : '—'
              }
            />
            <ScoreCard
              label="Performance Band"
              value={<RatingBadge rating={resultItem?.finalRating as FinalRating} />}
            />
          </div>

          {/* KPI table */}
          <div className="px-6 py-4">
            <h3 className="text-base font-semibold text-gray-900">KPI Breakdown</h3>
          </div>

          <div className="px-6 pb-6">
            {selfKpis.length > 0 ? (
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 pr-4 font-semibold text-gray-700 w-2/5">
                      KPI Title
                    </th>
                    <th className="text-left py-3 pr-4 font-semibold text-gray-700">Self Score</th>
                    <th className="text-left py-3 pr-4 font-semibold text-gray-700">
                      Self Weighted
                    </th>
                    <th className="text-left py-3 pr-4 font-semibold text-gray-700">
                      Manager Score
                    </th>
                    <th className="text-left py-3 pr-4 font-semibold text-gray-700">
                      Manager Weighted
                    </th>
                    <th className="text-left py-3 font-semibold text-gray-700">Final KPI</th>
                  </tr>
                </thead>
                <tbody>
                  {selfKpis.map((self: KpiScoreRow) => {
                    const mgr = managerMap.get(self.kpiId);
                    const selfW = weighted(self.score, self.maxScore, self.weight);
                    const mgrW = mgr ? weighted(mgr.score, mgr.maxScore, mgr.weight) : null;
                    return (
                      <tr key={self.kpiId} className="border-b border-gray-100 last:border-0">
                        <td className="py-4 pr-4 text-gray-900">{self.title}</td>
                        <td className="py-4 pr-4 text-gray-700">
                          {self.score}/{self.maxScore}
                        </td>
                        <td className="py-4 pr-4 text-gray-700">{selfW.toFixed(2)}</td>
                        <td className="py-4 pr-4 text-gray-700">
                          {mgr ? `${mgr.score}/${mgr.maxScore}` : '—'}
                        </td>
                        <td className="py-4 pr-4 text-gray-700">
                          {mgrW != null ? mgrW.toFixed(2) : '—'}
                        </td>
                        <td className="py-4 font-medium text-gray-900">
                          {mgrW != null ? (selfW + mgrW).toFixed(2) : selfW.toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <p className="py-8 text-sm text-gray-400 text-center">No KPI data available yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
