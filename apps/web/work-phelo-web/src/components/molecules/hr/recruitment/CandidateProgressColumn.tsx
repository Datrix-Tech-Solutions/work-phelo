'use client';

import { Check } from 'lucide-react';
import { SectionCard } from '@/components/molecules/shared/sectionCard';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/formatters';
import { formatDateTime } from './candidateUtils';
import { SCREENING_SHARE, overallScore } from '@/lib/hr/candidateMatch';
import type { MatchCriterion, MatchResult } from '@/lib/hr/candidateMatch';
import type {
  RecruitmentCandidateDetail,
  RecruitmentStage,
  RecruitmentStageHistoryEntry,
} from '@/types/recruitment';

interface Props {
  candidate: RecruitmentCandidateDetail;
  stages: RecruitmentStage[];
  history: RecruitmentStageHistoryEntry[];
  match: MatchResult | null;
  /** Only passed while the candidate is in the Screening stage. */
  screening: MatchCriterion | null;
}

const EMPTY_CLASS = 'text-sm text-gray-400';

export function CandidateProgressColumn({ candidate, stages, history, match, screening }: Props) {
  return (
    <div className="flex flex-col gap-6 min-w-0">
      <SectionCard title="Match Score">
        <MatchScore match={match} screening={screening} />
      </SectionCard>
      <SectionCard title="Stage Progress">
        <StageProgress candidate={candidate} stages={stages} history={history} />
      </SectionCard>
      <SectionCard title="Notes">
        <Notes history={history} />
      </SectionCard>
    </div>
  );
}

function StageProgress({
  candidate,
  stages,
  history,
}: {
  candidate: RecruitmentCandidateDetail;
  stages: RecruitmentStage[];
  history: RecruitmentStageHistoryEntry[];
}) {
  const current = candidate.currentStage;
  if (!current) return <p className={EMPTY_CLASS}>This candidate has no stage yet.</p>;

  const isRejected = current.name.toLowerCase() === 'rejected';
  const reachedAt = new Map<string, string>();
  history.forEach((h) => reachedAt.set(h.newStage.id, h.changedAt));
  reachedAt.set(current.id, reachedAt.get(current.id) ?? candidate.appliedAt);

  // Rejected is a branch off the pipeline, so it only appears when it is where the candidate is.
  const sorted = [...stages].sort((a, b) => a.sortOrder - b.sortOrder);
  const steps = sorted.filter((s) => isRejected || s.name.toLowerCase() !== 'rejected');
  const visible = isRejected
    ? steps.filter((s) => s.id === current.id || reachedAt.has(s.id))
    : steps;
  const currentIndex = visible.findIndex((s) => s.id === current.id);

  if (visible.length === 0) return <p className={EMPTY_CLASS}>{current.name}</p>;

  return (
    <ol className="flex flex-col">
      {visible.map((stage, i) => {
        const isCurrent = i === currentIndex;
        const isDone = i < currentIndex;
        const at = reachedAt.get(stage.id);
        const isLast = i === visible.length - 1;
        const rejectedCurrent = isCurrent && isRejected;
        return (
          <li key={stage.id} className="relative flex gap-3 pb-5 last:pb-0">
            {!isLast && (
              <span
                className={cn(
                  'absolute left-3 top-6 -ml-px h-[calc(100%-1.5rem)] w-0.5',
                  isDone ? 'bg-emerald-400' : 'bg-gray-200',
                )}
              />
            )}
            <span
              className={cn(
                'relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-white',
                isDone && 'border-emerald-500 bg-emerald-500',
                isCurrent &&
                  !rejectedCurrent &&
                  'border-(--module-btn-bg,var(--color-brand)) bg-(--module-btn-bg,var(--color-brand))',
                rejectedCurrent && 'border-red-500 bg-red-500',
                !isDone && !isCurrent && 'border-gray-300 bg-white',
              )}
            >
              {isDone || isCurrent ? <Check className="h-3.5 w-3.5" /> : null}
            </span>
            <div className="min-w-0 pt-0.5">
              <p
                className={cn(
                  'text-sm',
                  isCurrent ? 'font-semibold text-gray-900' : 'font-medium text-gray-600',
                  !isDone && !isCurrent && 'text-gray-400',
                )}
              >
                {stage.name}
              </p>
              {at && (isDone || isCurrent) && (
                <p className="text-xs text-gray-400">{formatDate(at)}</p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function scoreTone(score: number) {
  if (score >= 75)
    return { label: 'Strong match', text: 'text-emerald-600', bar: 'bg-emerald-500' };
  if (score >= 50) return { label: 'Partial match', text: 'text-amber-600', bar: 'bg-amber-500' };
  return { label: 'Weak match', text: 'text-red-600', bar: 'bg-red-500' };
}

function MatchScore({
  match,
  screening,
}: {
  match: MatchResult | null;
  screening: MatchCriterion | null;
}) {
  const score = overallScore(match, screening);
  if (score === null) {
    return (
      <p className={EMPTY_CLASS}>
        Not available. The job opening has no skills, certificate, education, experience or language
        requirements to score against.
      </p>
    );
  }
  const tone = scoreTone(score);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-baseline gap-2">
        <span className={cn('text-3xl font-bold', tone.text)}>{score}%</span>
        <span className="text-sm font-medium text-gray-500">{tone.label}</span>
      </div>
      {match && (
        <div className="flex flex-col gap-3">
          {screening && (
            <ScoreGroupHeading
              title="Application"
              score={match.score}
              share={100 - SCREENING_SHARE}
            />
          )}
          <ul className="flex flex-col gap-3">
            {match.criteria.map((c) => (
              <CriterionBar key={c.key} criterion={c} />
            ))}
          </ul>
        </div>
      )}
      {screening && (
        <div className="flex flex-col gap-3 border-t border-gray-100 pt-3">
          {match && (
            <ScoreGroupHeading title="Screening" score={screening.score} share={SCREENING_SHARE} />
          )}
          <ul>
            <CriterionBar criterion={screening} />
          </ul>
        </div>
      )}
    </div>
  );
}

/** Shown in Screening, where the score is split between the application and the screening. */
function ScoreGroupHeading({
  title,
  score,
  share,
}: {
  title: string;
  score: number;
  share: number;
}) {
  return (
    <div className="flex items-baseline justify-between text-xs">
      <span className="font-semibold text-gray-900">
        {title} <span className="font-normal text-gray-400">· {share}% of score</span>
      </span>
      <span className={cn('font-semibold', scoreTone(score).text)}>{score}%</span>
    </div>
  );
}

function CriterionBar({ criterion: c }: { criterion: MatchCriterion }) {
  return (
    <li className="list-none">
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="font-medium text-gray-700">{c.label}</span>
        <span className="text-gray-400">{c.detail}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
        <div
          className={cn('h-full rounded-full', scoreTone(c.score).bar)}
          style={{ width: `${c.score}%` }}
        />
      </div>
    </li>
  );
}

function Notes({ history }: { history: RecruitmentStageHistoryEntry[] }) {
  const notes = history.filter((h) => h.note).reverse();
  if (notes.length === 0) {
    return (
      <p className={EMPTY_CLASS}>
        Notes added when moving the candidate between stages appear here.
      </p>
    );
  }
  return (
    <ul className="flex flex-col divide-y divide-gray-100">
      {notes.map((h) => (
        <li key={h.id} className="py-3 first:pt-0 last:pb-0">
          <p className="text-sm text-gray-800 whitespace-pre-line">{h.note}</p>
          <p className="mt-1 text-xs text-gray-400">
            {h.changedByEmployee
              ? `${h.changedByEmployee.firstName} ${h.changedByEmployee.lastName} · `
              : ''}
            {formatDateTime(h.changedAt)} · moved to {h.newStage.name}
          </p>
        </li>
      ))}
    </ul>
  );
}
