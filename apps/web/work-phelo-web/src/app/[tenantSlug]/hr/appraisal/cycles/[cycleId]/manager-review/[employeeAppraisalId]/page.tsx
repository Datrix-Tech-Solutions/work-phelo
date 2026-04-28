'use client';

import { use } from 'react';
import Link from 'next/link';
import { useAppraisal, useCycleKpis, useAppraisalCycles } from '@/hooks';
import { ManagerReviewForm } from '@/components/organisms/appraisal/ManagerReviewForm';
import { cn } from '@/lib/utils';

function scoreToPercent(score: number | null | undefined): string {
  if (score == null) return '—';
  return `${Math.round((score / 5) * 100)}%`;
}

export default function ManagerReviewPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; cycleId: string; employeeAppraisalId: string }>;
}) {
  const { tenantSlug, cycleId, employeeAppraisalId } = use(params);

  const { data: appraisal, isLoading: loadingAppraisal } = useAppraisal(employeeAppraisalId);
  const { data: kpis = [], isLoading: loadingKpis } = useCycleKpis(cycleId);
  const { data: cycles = [] } = useAppraisalCycles();

  const cycle = cycles.find((c) => c.id === cycleId);
  const backHref = `/${tenantSlug}/hr/appraisal`;
  const isLoading = loadingAppraisal || loadingKpis;

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

  if (appraisal.overallStatus === 'ManagerSubmitted' || appraisal.overallStatus === 'Finalized') {
    return (
      <div className="p-8 flex flex-col gap-4">
        <p className="text-sm text-gray-500">Manager review has already been submitted.</p>
        <Link href={backHref} className="text-brand hover:underline text-sm">
          ← Back to Appraisals
        </Link>
      </div>
    );
  }

  const selfScoreMap = Object.fromEntries(
    (appraisal.selfResponse?.kpiScores ?? []).map((s: { kpiId: string; score: number }) => [
      s.kpiId,
      s.score,
    ]),
  );

  const kpiRows = (
    kpis as { id: string; title: string; description?: string; maxScore: number }[]
  ).map((k) => ({
    kpiId: k.id,
    title: k.title,
    description: k.description,
    maxScore: k.maxScore,
    selfScore: selfScoreMap[k.id] ?? 0,
  }));

  const emp = appraisal.employee;
  const employeeName: string =
    appraisal.employeeName ??
    (emp ? `${emp.firstName ?? ''} ${emp.lastName ?? ''}`.trim() : '') ??
    '';
  const jobTitle: string = appraisal.jobTitle ?? emp?.jobTitle ?? '';
  const cycleTitle: string = appraisal.cycle?.title ?? cycle?.title ?? '';
  const isPending = appraisal.overallStatus === 'SelfSubmitted';

  return (
    <div className="p-8 flex flex-col gap-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-400">
        <Link href={backHref} className="hover:text-gray-600 transition-colors">
          Appraisal
        </Link>
        <span>›</span>
        <span className="text-gray-600">
          {employeeName} – {cycleTitle}
        </span>
      </nav>

      {/* Header card */}
      <div className="bg-white rounded-xl border border-gray-200 px-6 py-5 flex items-start justify-between gap-6">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-bold text-gray-900">
              {employeeName} – {cycleTitle}
            </h1>
            <span
              className={cn(
                'inline-flex items-center gap-1.5 text-sm font-medium',
                isPending ? 'text-amber-500' : 'text-green-600',
              )}
            >
              <span
                className={cn('w-2 h-2 rounded-full', isPending ? 'bg-amber-400' : 'bg-green-500')}
              />
              {isPending ? 'Pending' : 'Submitted'}
            </span>
          </div>
          {jobTitle && <p className="text-sm text-gray-500">{jobTitle}</p>}
        </div>

        <div className="flex flex-col items-end shrink-0">
          <span className="text-xs text-gray-400">Assessment score</span>
          <span className="text-2xl font-bold text-gray-900">
            {scoreToPercent(appraisal.selfResponse?.score)}
          </span>
        </div>
      </div>

      {/* Instruction */}
      <p className="text-sm text-gray-600">
        Complete the KPIs below to evaluate your mentee&apos;s performance for this review cycle.
      </p>

      {/* KPI form */}
      {kpiRows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 p-8 text-center">
          <p className="text-sm text-gray-400">No KPIs have been configured for this cycle yet.</p>
        </div>
      ) : (
        <ManagerReviewForm appraisalId={employeeAppraisalId} kpis={kpiRows} backHref={backHref} />
      )}
    </div>
  );
}
