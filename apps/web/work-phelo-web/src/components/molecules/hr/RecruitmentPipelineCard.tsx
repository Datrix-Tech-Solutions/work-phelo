'use client';

import { useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Icons } from '@/components/atoms/icons';
import { Button } from '@/components/atoms/Button';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { GaugeOverviewCard } from '@/components/molecules/shared/GaugeOverviewCard';
import { usePermission } from '@/hooks/hr/usePermission';
import { useCandidates, useJobOpenings, useRecruitmentStages } from '@/hooks/hr/useRecruitment';
import { Permission } from '@/lib/permissionMap';

interface RecruitmentPipelineCardProps {
  className?: string;
}

const stageIdByName = (stages: { id: string; name: string }[], name: string) =>
  stages.find((s) => s.name.trim().toLowerCase() === name)?.id;

/** Candidates through the hiring pipeline, counted from the recruitment candidates list. */
export function RecruitmentPipelineCard({ className }: RecruitmentPipelineCardProps) {
  const canReadCandidates = usePermission(Permission.READ_RECRUITMENT_CANDIDATES);
  const canReadStages = usePermission(Permission.READ_RECRUITMENT_STAGES);
  const canReadVacancies = usePermission(Permission.READ_RECRUITMENT_VACANCIES);
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const router = useRouter();
  const [vacancyId, setVacancyId] = useState('');

  const { data: vacancies } = useJobOpenings({ limit: 100 });
  const vacancyOptions = useMemo(
    () => (vacancies?.items ?? []).map((v) => ({ value: v.id, label: v.title ?? 'Untitled' })),
    [vacancies],
  );

  const { data: stages = [], isLoading: stagesLoading } = useRecruitmentStages(
    canReadCandidates && canReadStages,
  );
  const screeningStageId = stageIdByName(stages, 'screening');
  const interviewStageId = stageIdByName(stages, 'interview');
  const hiredStageId = stageIdByName(stages, 'hired');

  // Only the totals are needed, so each query asks for a single row.
  const all = useCandidates({ vacancyId, limit: 1, enabled: canReadCandidates });
  const screening = useCandidates({
    vacancyId,
    stageId: screeningStageId,
    limit: 1,
    enabled: canReadCandidates && !!screeningStageId,
  });
  const interviewing = useCandidates({
    vacancyId,
    stageId: interviewStageId,
    limit: 1,
    enabled: canReadCandidates && !!interviewStageId,
  });
  const hired = useCandidates({
    vacancyId,
    stageId: hiredStageId,
    limit: 1,
    enabled: canReadCandidates && !!hiredStageId,
  });

  const isLoading = canReadCandidates && (all.isLoading || stagesLoading);
  const total = all.data?.meta.total ?? 0;
  // Vetting is the screening and interview stages together.
  const vettingCount =
    screeningStageId || interviewStageId
      ? (screeningStageId ? (screening.data?.meta.total ?? 0) : 0) +
        (interviewStageId ? (interviewing.data?.meta.total ?? 0) : 0)
      : null;
  const hiredCount = hiredStageId ? (hired.data?.meta.total ?? 0) : null;

  const show = (n: number | null) => (n === null ? '—' : String(n));

  return (
    <GaugeOverviewCard
      title="Recruitment Pipeline"
      subtitle="Candidates in the hiring pipeline"
      className={className}
      headerAction={
        <div className="flex items-center gap-2">
          {canReadVacancies && vacancyOptions.length > 0 && (
            <SearchSelect
              size="xs"
              placeholder="Job opening"
              allLabel="All job openings"
              options={vacancyOptions}
              value={vacancyId}
              showAllOption
              onChange={setVacancyId}
            />
          )}
          {(canReadVacancies || canReadCandidates) && (
            <Button
              variant="outline"
              size="sm"
              className="px-3 py-1 text-xs"
              onClick={() => router.push(`/${tenantSlug}/hr/recruitment`)}
            >
              Manage
            </Button>
          )}
        </div>
      }
      isLoading={isLoading}
      isEmpty={!canReadCandidates || total === 0}
      emptyMessage={vacancyId ? 'No candidates for this job opening.' : 'No candidates yet.'}
      total={total}
      metrics={[
        {
          key: 'candidates',
          label: 'Candidates',
          icon: Icons.Users,
          color: '#4c8dff',
          value: total,
          display: String(total),
        },
        {
          key: 'vetting',
          label: 'Vetting',
          icon: Icons.Timer,
          color: '#f5a623',
          value: vettingCount,
          display: show(vettingCount),
        },
        {
          key: 'hired',
          label: 'Hired',
          icon: Icons.CircleCheck,
          color: '#34d399',
          value: hiredCount,
          display: show(hiredCount),
        },
      ]}
      defaultCenter={{ value: show(hiredCount), label: 'Hired' }}
    />
  );
}
