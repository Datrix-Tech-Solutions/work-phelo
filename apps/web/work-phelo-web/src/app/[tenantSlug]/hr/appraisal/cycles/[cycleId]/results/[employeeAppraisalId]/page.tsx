// APPRAISAL PAGE //

'use client';

import { use } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { StatusBadge } from '@/components/molecules/StatusBadge';
import {
  EmployeeAppraisal,
  AppraisalCycle,
  AppraisalKpi,
  AppraisalSection,
  FinalRating,
  KpiScore,
  SectionResponse,
  SectionType,
} from '@/types/appraisal';

/* ── Helpers ── */

const RATING_STYLES: Record<FinalRating, string> = {
  Outstanding: 'bg-green-100 text-green-700 border-green-200',
  'Very Good': 'bg-blue-100 text-blue-700 border-blue-200',
  Good: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  Satisfactory: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  'Needs Improvement': 'bg-red-100 text-red-700 border-red-200',
};

function ScorePip({ score, max }: { score: number; max: number }) {
  const pct = max > 0 ? (score / max) * 100 : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden max-w-20">
        <div className="h-full bg-[#0D2244] rounded-full" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-sm font-semibold text-gray-800 w-14 text-right">
        {score} / {max}
      </span>
    </div>
  );
}

function SectionAnswer({ type, response }: { type: SectionType; response?: SectionResponse }) {
  if (!response) return <span className="text-gray-400 text-sm italic">No response</span>;

  if (type === 'YesNo') {
    return (
      <span
        className={cn(
          'px-2.5 py-1 rounded-full text-xs font-semibold',
          response.yesNo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600',
        )}
      >
        {response.yesNo ? 'Yes' : 'No'}
      </span>
    );
  }
  if (type === 'RatingScale') {
    return <span className="text-sm font-semibold text-gray-900">{response.rating ?? '—'}</span>;
  }
  return (
    <p className="text-sm text-gray-700 leading-relaxed">
      {response.comment || <span className="text-gray-400 italic">No comment</span>}
    </p>
  );
}

/* ── Column wrapper ── */
function ResponseColumn({
  title,
  status,
  children,
  accent,
}: {
  title: string;
  status?: string;
  children: React.ReactNode;
  accent?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-5 flex-1 min-w-0', accent)}>
      <div className="flex items-center gap-3">
        <h2 className="text-base font-semibold text-gray-900">{title}</h2>
        {status && <StatusBadge status={status} />}
      </div>
      {children}
    </div>
  );
}

/* ── Section card ── */
function SectionCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border border-gray-200 rounded-card p-4 flex flex-col gap-2 bg-white">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{label}</p>
      {children}
    </div>
  );
}

export default function EmployeeAppraisalDetailPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; cycleId: string; employeeAppraisalId: string }>;
}) {
  const { tenantSlug, cycleId, employeeAppraisalId } = use(params);

  /* ── Fetch appraisal ── */
  const { data: appraisal, isLoading: appraisalLoading } = useQuery<EmployeeAppraisal>({
    queryKey: ['employee-appraisal', employeeAppraisalId],
    queryFn: () =>
      api
        .get(`/${tenantSlug}/appraisal/employee-appraisals/${employeeAppraisalId}`)
        .then((r) => r.data),
  });

  /* ── Fetch cycle (for templateId) ── */
  const { data: cycle } = useQuery<AppraisalCycle>({
    queryKey: ['appraisal-cycle', cycleId],
    queryFn: () => api.get(`/${tenantSlug}/appraisal/cycles/${cycleId}`).then((r) => r.data),
  });

  /* ── Fetch KPIs ── */
  const { data: kpis = [] } = useQuery<AppraisalKpi[]>({
    queryKey: ['cycle-kpis', cycleId],
    queryFn: () => api.get(`/${tenantSlug}/appraisal/cycles/${cycleId}/kpis`).then((r) => r.data),
  });

  const sections: AppraisalSection[] = [];

  /* ── Score lookup helpers ── */
  function getKpiScore(scores: KpiScore[] | undefined, kpiId: string): KpiScore | undefined {
    return scores?.find((s) => s.kpiId === kpiId);
  }

  function getSectionResponse(
    responses: SectionResponse[] | undefined,
    sectionId: string,
  ): SectionResponse | undefined {
    return responses?.find((s) => s.sectionId === sectionId);
  }

  if (appraisalLoading) {
    return <div className="p-8 text-sm text-gray-400">Loading…</div>;
  }

  if (!appraisal) {
    return (
      <div className="p-8 flex flex-col gap-4">
        <p className="text-sm text-red-500">Appraisal not found.</p>
        <Link
          href={`/${tenantSlug}/hr/appraisal/cycles/${cycleId}/results`}
          className="text-sm text-[#0D2244] hover:underline"
        >
          Back to Results
        </Link>
      </div>
    );
  }

  const self = appraisal.selfResponse;
  const manager = appraisal.managerResponse;
  const finalized = appraisal.finalizedAppraisal;

  return (
    <div className="p-8 flex flex-col gap-6 min-h-full">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-gray-400 shrink-0">
        <Link
          href={`/${tenantSlug}/hr/appraisal`}
          className="hover:text-gray-600 transition-colors"
        >
          Appraisals
        </Link>
        <span>/</span>
        <Link
          href={`/${tenantSlug}/hr/appraisal/cycles/${cycleId}/results`}
          className="flex items-center gap-1 hover:text-gray-600 transition-colors"
        >
          {cycle?.title ?? 'Cycle Results'}
        </Link>
        <span>/</span>
        <span className="text-gray-700 font-medium">Employee Detail</span>
      </nav>

      {/* Status header */}
      <div className="flex items-center gap-3 shrink-0">
        <h1 className="text-xl font-bold text-gray-900">Appraisal Detail</h1>
        <StatusBadge status={appraisal.overallStatus} />
      </div>

      {/* Side-by-side responses */}
      <div className="flex flex-col lg:flex-row gap-6 flex-1">
        {/* ── Self Assessment (left) ── */}
        <ResponseColumn title="Self Assessment" status={self?.status}>
          {/* KPIs */}
          {kpis.length > 0 && (
            <div className="flex flex-col gap-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">KPIs</p>
              {kpis.map((kpi) => {
                const scored = getKpiScore(self?.kpiScores, kpi.id);
                return (
                  <SectionCard key={kpi.id} label={kpi.title}>
                    {scored ? (
                      <div className="flex flex-col gap-1.5">
                        <ScorePip score={scored.score} max={kpi.maxScore} />
                        {scored.comment && (
                          <p className="text-xs text-gray-500 mt-1">{scored.comment}</p>
                        )}
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400 italic">Not scored</span>
                    )}
                  </SectionCard>
                );
              })}
            </div>
          )}

          {/* Sections */}
          {sections.length > 0 && (
            <div className="flex flex-col gap-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Questionnaire
              </p>
              {sections.map((section) => (
                <SectionCard key={section.id} label={section.name}>
                  <SectionAnswer
                    type={section.type}
                    response={getSectionResponse(self?.sectionResponses, section.id)}
                  />
                </SectionCard>
              ))}
            </div>
          )}

          {!self && (
            <div className="flex-1 flex items-center justify-center py-12 border-2 border-dashed border-gray-200 rounded-card">
              <p className="text-sm text-gray-400">Self assessment not submitted yet</p>
            </div>
          )}
        </ResponseColumn>

        {/* Divider */}
        <div className="hidden lg:block w-px bg-gray-200 shrink-0" />
        <div className="block lg:hidden h-px bg-gray-200 w-full shrink-0" />

        {/* ── Manager Review (right) ── */}
        <ResponseColumn title="Manager Review" status={manager?.status}>
          {/* KPIs */}
          {kpis.length > 0 && (
            <div className="flex flex-col gap-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">KPIs</p>
              {kpis.map((kpi) => {
                const scored = getKpiScore(manager?.kpiScores, kpi.id);
                return (
                  <SectionCard key={kpi.id} label={kpi.title}>
                    {scored ? (
                      <div className="flex flex-col gap-1.5">
                        <ScorePip score={scored.score} max={kpi.maxScore} />
                        {scored.comment && (
                          <p className="text-xs text-gray-500 mt-1">{scored.comment}</p>
                        )}
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400 italic">Not scored</span>
                    )}
                  </SectionCard>
                );
              })}
            </div>
          )}

          {/* Sections */}
          {sections.length > 0 && (
            <div className="flex flex-col gap-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Questionnaire
              </p>
              {sections.map((section) => (
                <SectionCard key={section.id} label={section.name}>
                  <SectionAnswer
                    type={section.type}
                    response={getSectionResponse(manager?.sectionResponses, section.id)}
                  />
                </SectionCard>
              ))}
            </div>
          )}

          {/* Final rating + HR comments */}
          {finalized && (
            <div
              className={cn(
                'mt-2 border rounded-card p-5 flex flex-col gap-4',
                RATING_STYLES[finalized.finalRating],
              )}
            >
              <div className="flex flex-col gap-1">
                <p className="text-xs font-semibold uppercase tracking-wide opacity-70">
                  Overall Performance Rating
                </p>
                <p className="text-lg font-bold">{finalized.finalRating}</p>
                <p className="text-sm opacity-80">Score: {finalized.overallScore}%</p>
              </div>
              {finalized.hrComments && (
                <div className="flex flex-col gap-1 border-t border-current border-opacity-20 pt-4">
                  <p className="text-xs font-semibold uppercase tracking-wide opacity-70">
                    HR Comments
                  </p>
                  <p className="text-sm leading-relaxed">{finalized.hrComments}</p>
                </div>
              )}
            </div>
          )}

          {!manager && (
            <div className="flex-1 flex items-center justify-center py-12 border-2 border-dashed border-gray-200 rounded-card">
              <p className="text-sm text-gray-400">Manager review not submitted yet</p>
            </div>
          )}
        </ResponseColumn>
      </div>
    </div>
  );
}
