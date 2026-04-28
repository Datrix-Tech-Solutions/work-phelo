'use client';

import { use } from 'react';
import Link from 'next/link';
import { useAppraisal, useAppraisalCycles } from '@/hooks';
import { cn } from '@/lib/utils';

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

function scoreToPercent(score: number | null | undefined): string {
  if (score == null) return '—';
  return `${Math.round(score)}%`;
}

function weightedScore(score: number, maxScore: number, weight: number): string {
  if (!maxScore) return '—';
  return ((score / maxScore) * weight).toFixed(1);
}

function KpiTable({ rows, label }: { rows: KpiScoreRow[]; label: string }) {
  return (
    <table className="w-full text-sm border-collapse">
      <thead>
        <tr className="border-b border-gray-200">
          <th className="text-left py-3 pr-4 font-semibold text-gray-700 w-1/3">{label}</th>
          <th className="text-left py-3 pr-4 font-semibold text-gray-700">Max Score</th>
          <th className="text-left py-3 pr-4 font-semibold text-gray-700">Your Score</th>
          <th className="text-left py-3 pr-4 font-semibold text-gray-700">Weighted Score</th>
          <th className="text-left py-3 font-semibold text-gray-700">Comment</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.kpiId} className="border-b border-gray-100">
            <td className="py-4 pr-4 text-gray-900">{row.title}</td>
            <td className="py-4 pr-4 text-gray-700">{row.maxScore}</td>
            <td className="py-4 pr-4 text-gray-700">{row.score}</td>
            <td className="py-4 pr-4 text-gray-700">
              {weightedScore(row.score, row.maxScore, row.weight)}
            </td>
            <td className="py-4 text-gray-500">{row.comment ?? '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function EmployeeAppraisalResultPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; cycleId: string; employeeAppraisalId: string }>;
}) {
  const { tenantSlug, cycleId, employeeAppraisalId } = use(params);

  const { data: appraisal, isLoading } = useAppraisal(employeeAppraisalId);
  const { data: cycles = [] } = useAppraisalCycles();
  const cycle = cycles.find((c) => c.id === cycleId);

  const backHref = `/${tenantSlug}/hr/appraisal`;

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-64">
        <p className="text-sm text-gray-400">Loading...</p>
      </div>
    );
  }

  if (!appraisal) {
    return (
      <div className="p-8">
        <p className="text-sm text-red-500">Appraisal not found.</p>
        <Link href={backHref} className="text-brand hover:underline mt-4 inline-block text-sm">
          ← Back
        </Link>
      </div>
    );
  }

  const cycleTitle = appraisal.cycle?.title ?? cycle?.title ?? '';
  const selfKpis: KpiScoreRow[] = appraisal.selfResponse?.kpiScores ?? [];
  const managerKpis: KpiScoreRow[] = appraisal.managerResponse?.kpiScores ?? [];

  return (
    <div className="p-8 flex flex-col gap-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-400">
        <Link href={backHref} className="hover:text-gray-600 transition-colors">
          Appraisal
        </Link>
        <span>›</span>
        <span className="text-gray-600">{cycleTitle}</span>
      </nav>

      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 px-6 py-5 flex items-start justify-between gap-6">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-bold text-gray-900">{cycleTitle}</h1>
            <StatusBadge status={appraisal.overallStatus} />
          </div>
          <p className="text-sm text-gray-500">Results</p>
        </div>
        <div className="flex flex-col items-end shrink-0">
          {appraisal.finalizedAppraisal ? (
            <>
              <span className="text-xs text-gray-400">Overall Assessment Score</span>
              <span className="text-2xl font-bold text-gray-900">
                {scoreToPercent(appraisal.finalizedAppraisal.overallScore)}
              </span>
            </>
          ) : (
            <>
              <span className="text-xs text-gray-400">Overall Self-Assessment Score</span>
              <span className="text-2xl font-bold text-gray-900">
                {scoreToPercent(appraisal.selfResponse?.score)}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Self-Assessment Results */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Self-Assessment Results</h2>
        </div>

        <div className="px-6">
          {selfKpis.length > 0 ? (
            <KpiTable rows={selfKpis} label="KPI" />
          ) : (
            <p className="py-8 text-sm text-gray-400 text-center">
              No self-assessment submitted yet.
            </p>
          )}
        </div>

        {appraisal.selfResponse && (
          <div className="px-6 py-4 border-t border-gray-100 flex flex-col gap-1">
            <p className="text-sm text-gray-700">
              <span className="text-gray-400">Overall Self-Assessment Score </span>
              <strong>{scoreToPercent(appraisal.selfResponse.score)}</strong>
            </p>
            {appraisal.selfResponse.comment && (
              <div>
                <p className="text-sm font-semibold text-gray-700">Overall Comment</p>
                <p className="text-sm text-gray-500">{appraisal.selfResponse.comment}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Manager Review */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Manager Review</h2>
        </div>

        <div className="px-6">
          {managerKpis.length > 0 ? (
            <KpiTable rows={managerKpis} label="KPI" />
          ) : (
            <p className="py-8 text-sm text-gray-400 text-center">
              Manager review not submitted yet.
            </p>
          )}
        </div>

        {appraisal.managerResponse && (
          <div className="px-6 py-4 border-t border-gray-100 flex flex-col gap-1">
            <p className="text-sm text-gray-700">
              <span className="text-gray-400">Overall Manager Assessment Score </span>
              <strong>{scoreToPercent(appraisal.managerResponse.score)}</strong>
            </p>
            {appraisal.managerResponse.comment && (
              <div>
                <p className="text-sm font-semibold text-gray-700">Overall Manager Comment</p>
                <p className="text-sm text-gray-500">{appraisal.managerResponse.comment}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
