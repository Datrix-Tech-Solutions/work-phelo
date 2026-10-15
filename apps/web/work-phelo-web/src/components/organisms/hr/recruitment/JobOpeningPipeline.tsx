'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/atoms/Button';
import { Modal } from '@/components/organisms/shared/Modal';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';
import { useParams } from 'next/navigation';
import { useLoadingRouter as useRouter } from '@/hooks/useLoadingRouter';
import { Avatar } from '@/components/atoms/Avatar';
import { Badge, type BadgeProps } from '@/components/atoms/Badge';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { Skeleton } from '@/components/atoms/Skeleton';
import {
  candidateFullName,
  candidateLocation,
  experienceLabel,
  stageVariant,
} from '@/components/molecules/hr/recruitment/candidateUtils';
import { usePermission } from '@/hooks/hr/usePermission';
import { useCandidates, useRecruitmentStages, useSetCutoff } from '@/hooks/hr/useRecruitment';
import { computeMatchScore } from '@/lib/hr/candidateMatch';
import { formatDate } from '@/lib/formatters';
import { Permission } from '@/lib/permissionMap';
import { cardClass } from '@/lib/utils';
import type { RecruitmentCandidate, VacancyDetails } from '@/types/recruitment';

const LIMIT = 100;

const CUTOFF_VALUES = [40, 50, 60, 70, 80];

function matchVariant(score: number): BadgeProps['variant'] {
  if (score >= 70) return 'success';
  if (score >= 40) return 'warning';
  return 'danger';
}

function CandidateCard({
  candidate,
  requirements,
  onOpen,
}: {
  candidate: RecruitmentCandidate;
  requirements: VacancyDetails | null;
  onOpen: () => void;
}) {
  const name = candidateFullName(candidate);
  const match = computeMatchScore(candidate, requirements);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full flex-col gap-2 rounded-card border border-gray-200 bg-white p-3 text-left transition-colors hover:bg-gray-50"
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <Avatar name={name} size="sm" />
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-medium text-gray-900">{name}</span>
          <span className="truncate text-xs text-gray-500">{candidate.email ?? '—'}</span>
        </div>
      </div>
      <div className="flex flex-col gap-0.5 text-xs text-gray-500">
        <span className="truncate">{candidate.currentJobTitle ?? '—'}</span>
        <span className="truncate">
          {experienceLabel(candidate.yearsOfExperience)} · {candidateLocation(candidate)}
        </span>
        <span>Applied {formatDate(candidate.submittedAt ?? candidate.appliedAt)}</span>
      </div>
      {match && <Badge label={`${match.score}% match`} variant={matchVariant(match.score)} />}
    </button>
  );
}

function pendingMessage(
  pending: { value: number | null; rejected: number; restored: number } | null,
): string {
  if (!pending) return '';
  const parts: string[] = [];
  if (pending.rejected > 0) {
    parts.push(
      `${pending.rejected} ${pending.rejected === 1 ? 'applicant' : 'applicants'} will move to Rejected`,
    );
  }
  if (pending.restored > 0) {
    parts.push(
      `${pending.restored} auto-rejected ${pending.restored === 1 ? 'applicant' : 'applicants'} will return to the first stage`,
    );
  }
  return `${parts.join(' and ')}. You can still move any candidate afterwards.`;
}

/** One fixed-width column per recruitment stage; the row scrolls sideways when stages overflow. */
export function JobOpeningPipeline({
  vacancyId,
  requirements,
  cutoffScore,
}: {
  vacancyId: string;
  requirements: VacancyDetails | null;
  cutoffScore: number | null;
}) {
  const params = useParams<{ tenantSlug: string }>();
  const router = useRouter();
  const canReadStages = usePermission(Permission.READ_RECRUITMENT_STAGES);
  const canReadCandidates = usePermission(Permission.READ_RECRUITMENT_CANDIDATES);

  const { data: stages = [], isLoading: stagesLoading } = useRecruitmentStages(
    canReadStages === true,
  );
  const { data, isLoading: candidatesLoading } = useCandidates({ vacancyId, limit: LIMIT });
  const canSetCutoff = usePermission(Permission.UPDATE_RECRUITMENT_VACANCY);
  const toast = useToast();
  const { mutate: setCutoffScore, isPending: isSettingCutoff } = useSetCutoff();
  // A change that would move applicants waits here for confirmation.
  const [pending, setPending] = useState<{
    value: number | null;
    rejected: number;
    restored: number;
  } | null>(null);

  const columns = useMemo(() => {
    const items = data?.items ?? [];
    const ordered = [...stages].sort((a, b) => a.sortOrder - b.sortOrder);
    const cols = ordered.map((stage) => ({
      id: stage.id,
      name: stage.name,
      isEntry: stage.isDefault,
      items: items.filter((c) => c.currentStageId === stage.id),
    }));
    const unassigned = items.filter(
      (c) => !c.currentStageId || !ordered.some((s) => s.id === c.currentStageId),
    );
    if (unassigned.length > 0) {
      cols.unshift({ id: 'unassigned', name: 'No stage', isEntry: false, items: unassigned });
    }
    return cols;
  }, [data, stages]);

  const hasCriteria =
    !!requirements &&
    ((requirements.skills?.items.length ?? 0) > 0 ||
      (requirements.languages?.items.length ?? 0) > 0 ||
      (requirements.experience?.minYears ?? 0) > 0);

  const cutoffOptions = useMemo(() => {
    const values = new Set(CUTOFF_VALUES);
    if (cutoffScore !== null) values.add(cutoffScore);
    return [...values]
      .sort((a, b) => a - b)
      .map((n) => ({ value: String(n), label: `${n}% and above` }));
  }, [cutoffScore]);

  const applyCutoff = (value: number | null) =>
    setCutoffScore(
      { id: vacancyId, cutoffScore: value },
      {
        onSuccess: (result) => {
          setPending(null);
          toast.success(
            value === null
              ? 'Cut-off cleared'
              : `Cut-off set to ${value}%${result.rejected > 0 ? `, ${result.rejected} moved to Rejected` : ''}`,
          );
        },
        onError: (err) => toast.error(extractError(err, 'Failed to set the cut-off')),
      },
    );

  const changeCutoff = (raw: string) => {
    const value = raw === '' ? null : Number(raw);
    // Ask the server who would move; only confirm when someone actually does.
    setCutoffScore(
      { id: vacancyId, cutoffScore: value, dryRun: true },
      {
        onSuccess: (preview) => {
          if (preview.rejected + preview.restored > 0) {
            setPending({ value, rejected: preview.rejected, restored: preview.restored });
          } else {
            applyCutoff(value);
          }
        },
        onError: (err) => toast.error(extractError(err, 'Failed to set the cut-off')),
      },
    );
  };

  if (canReadCandidates === false) return null;

  if (stagesLoading || candidatesLoading) {
    return (
      <div className="flex gap-4 overflow-hidden">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-72 w-72 shrink-0 rounded-card" />
        ))}
      </div>
    );
  }

  if (columns.length === 0) {
    return <p className="py-8 text-center text-sm text-gray-400">No stages set up yet.</p>;
  }

  const total = data?.meta.total ?? 0;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-start gap-4 overflow-x-auto pb-3">
        {columns.map((col) => {
          return (
            <section
              key={col.id}
              className={cardClass('flex max-h-[28rem] w-72 shrink-0 flex-col p-3')}
            >
              <header className="mb-3 flex items-center justify-between gap-2">
                <Badge label={col.name} variant={stageVariant(col.name)} />
                <span className="text-xs font-medium text-gray-500">{col.items.length}</span>
              </header>
              {col.isEntry && hasCriteria && canSetCutoff && (
                <div className="mb-3">
                  <SearchSelect
                    size="sm"
                    placeholder="Cut-off point"
                    allLabel="No cut-off"
                    options={cutoffOptions}
                    value={cutoffScore === null ? '' : String(cutoffScore)}
                    showAllOption
                    onChange={changeCutoff}
                  />
                </div>
              )}
              {col.isEntry && hasCriteria && !canSetCutoff && cutoffScore !== null && (
                <p className="mb-3 text-xs text-gray-500">Cut-off: {cutoffScore}% and above</p>
              )}
              <div className="flex flex-col gap-2 overflow-y-auto">
                {col.items.length === 0 ? (
                  <p className="py-6 text-center text-xs text-gray-400">No candidates</p>
                ) : (
                  col.items.map((c) => (
                    <CandidateCard
                      key={c.id}
                      candidate={c}
                      requirements={requirements}
                      onOpen={() =>
                        router.push(`/${params.tenantSlug}/hr/recruitment/candidates/${c.id}`)
                      }
                    />
                  ))
                )}
              </div>
            </section>
          );
        })}
      </div>
      <Modal
        isOpen={!!pending}
        onClose={() => setPending(null)}
        title="Apply Cut-off"
        description={pendingMessage(pending)}
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setPending(null)}>
              Cancel
            </Button>
            <Button
              isLoading={isSettingCutoff}
              loadingText="Applying…"
              onClick={() => pending && applyCutoff(pending.value)}
            >
              Apply
            </Button>
          </div>
        }
      />
      {total > LIMIT && (
        <p className="text-xs text-gray-400">
          Showing the {LIMIT} most recent of {total} applicants.
        </p>
      )}
    </div>
  );
}
