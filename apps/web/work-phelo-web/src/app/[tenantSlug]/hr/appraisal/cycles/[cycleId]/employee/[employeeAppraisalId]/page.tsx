'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { useAppraisal, useAppraisalCycles, useCycleResults } from '@/hooks';
import { cn } from '@/lib/utils';
import { FinalRating } from '@/types/hr';
import { RatingBadge } from '@/components/molecules/appraisal/RatingBadge';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';

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

function ScoreCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-gray-400">{label}</span>
      <div className="text-base font-bold text-gray-900">{value}</div>
    </div>
  );
}

export default function EmployeeAppraisalDetailPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; cycleId: string; employeeAppraisalId: string }>;
}) {
  const { tenantSlug, cycleId, employeeAppraisalId } = use(params);

  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

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
  const cycleHref = `/${tenantSlug}/hr/appraisal/cycles/${cycleId}?tab=results`;

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
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-xl font-bold text-gray-900">{employeeName}</h2>
            <StatusBadge status={appraisal.overallStatus} />
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-500">
            <span>{cycleTitle}</span>
            {resultItem?.department && (
              <>
                <span className="text-gray-300">·</span>
                <span>{resultItem.department}</span>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <Button variant="outline" onClick={() => setRejectOpen(true)}>
            Reject
          </Button>
          <Button variant="primary">Approve</Button>
        </div>
      </div>

      {/* Main content */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {/* Section header */}
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-gray-700">Assessment Results</h3>
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
                  <th className="text-left py-3 pr-4 font-semibold text-gray-700">KPI</th>
                  <th className="text-left py-3 pr-4 font-semibold text-gray-700">Employee</th>
                  <th className="text-left py-3 pr-4 font-semibold text-gray-700">Manager</th>
                  <th className="text-left py-3 pr-4 font-semibold text-gray-700">Weight</th>
                  <th className="text-left py-3 pr-4 font-semibold text-gray-700">
                    Employee Comment
                  </th>
                  <th className="text-left py-3 font-semibold text-gray-700">Manager Comment</th>
                </tr>
              </thead>
              <tbody>
                {selfKpis.map((self: KpiScoreRow) => {
                  const mgr = managerMap.get(self.kpiId);
                  return (
                    <tr key={self.kpiId} className="border-b border-gray-100 last:border-0">
                      <td className="py-4 pr-4 text-gray-900">{self.title}</td>
                      <td className="py-4 pr-4 text-gray-700">
                        {self.score}/{self.maxScore}
                      </td>
                      <td className="py-4 pr-4 text-gray-700">
                        {mgr ? `${mgr.score}/${mgr.maxScore}` : '—'}
                      </td>
                      <td className="py-4 pr-4 text-gray-700">{self.weight}%</td>
                      <td className="py-4 pr-4 text-gray-500">{self.comment ?? '—'}</td>
                      <td className="py-4 text-gray-500">{mgr?.comment ?? '—'}</td>
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

      {/* Overall score + comment cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 px-6 py-5 flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">Overall Self-Assessment Score</span>
            <span className="text-base font-bold text-gray-900">
              {appraisal.selfResponse?.score != null
                ? `${Math.round(appraisal.selfResponse.score)}%`
                : '—'}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-sm font-semibold text-gray-900">Overall Comment</p>
            <p className="text-sm text-gray-500">{appraisal.selfResponse?.comment ?? '—'}</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 px-6 py-5 flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">Overall Manager Assessment Score</span>
            <span className="text-base font-bold text-gray-900">
              {appraisal.managerResponse?.score != null
                ? `${Math.round(appraisal.managerResponse.score)}%`
                : '—'}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-sm font-semibold text-gray-900">Overall Manager Comment</p>
            <p className="text-sm text-gray-500">{appraisal.managerResponse?.comment ?? '—'}</p>
          </div>
        </div>
      </div>

      <Modal
        isOpen={rejectOpen}
        onClose={() => {
          setRejectOpen(false);
          setRejectReason('');
        }}
        title="Reject Assessment"
        description="You are about to reject the assessment submitted. This action will reactivate the appraisal form for the respective employees."
        footer={
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setRejectOpen(false);
                setRejectReason('');
              }}
            >
              Cancel
            </Button>
            <Button variant="danger" disabled={!rejectReason.trim()}>
              Confirm Rejection
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-700">Rejection Note</label>
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Enter reason…"
            rows={4}
            className="w-full rounded-input border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-400 resize-none"
          />
        </div>
      </Modal>
    </div>
  );
}
