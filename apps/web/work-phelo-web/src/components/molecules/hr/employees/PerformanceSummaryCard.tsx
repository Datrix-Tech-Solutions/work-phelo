'use client';

import { useMemo, useState } from 'react';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { RatingBadge } from '@/components/molecules/hr/appraisal/RatingBadge';
import { SectionCard } from '@/components/molecules/shared/sectionCard';
import {
  goalScores,
  goalsWithObjectives,
  overallScore,
  ratingForScore,
} from '@/lib/appraisalAssessments';
import type { FinalRating } from '@/types/hr';
import { useAppraisalAssessmentsStore } from '@/store/appraisalAssessments.store';
import { useAppraisalGoalsStore } from '@/store/appraisalGoals.store';
import { useEmployeeObjectivesStore } from '@/store/employeeObjectives.store';

/**
 * Three scores from the employee's finalized appraisals: overall (across every cycle), the
 * chosen cycle's, and each goal's within that cycle, since several goals can run at once.
 */
export function PerformanceSummaryCard({ employeeId }: { employeeId?: string }) {
  const assessments = useAppraisalAssessmentsStore((s) => s.assessments);
  const cycles = useAppraisalGoalsStore((s) => s.cycles);
  const goals = useAppraisalGoalsStore((s) => s.goals);
  const objectives = useEmployeeObjectivesStore((s) => s.objectives);
  const [cycleId, setCycleId] = useState('');

  // Cycles are stored newest first, so the first one is the latest.
  const finalized = useMemo(
    () =>
      assessments
        .filter((a) => a.employeeId === employeeId && a.status === 'FINALIZED')
        .flatMap((a) => {
          const cycle = cycles.find((c) => c.id === a.cycleId);
          if (!cycle) return [];
          const entries = goalsWithObjectives(cycle, goals, objectives, a.employeeId);
          return [{ cycle, entries, assessment: a, score: overallScore(a, entries) }];
        })
        .sort((a, b) => cycles.indexOf(a.cycle) - cycles.indexOf(b.cycle)),
    [assessments, cycles, goals, objectives, employeeId],
  );

  const scored = finalized.filter((f) => f.score !== null);
  if (scored.length === 0) {
    return (
      <SectionCard title="Performance Summary">
        <p className="py-4 text-center text-sm text-gray-400">No finalized appraisals yet.</p>
      </SectionCard>
    );
  }

  const overall = Math.round(scored.reduce((sum, f) => sum + (f.score ?? 0), 0) / scored.length);
  const selected = scored.find((f) => f.cycle.id === cycleId) ?? scored[0];
  const byGoal = goalScores(selected.assessment, selected.entries);

  return (
    <SectionCard title="Performance Summary">
      <div className="flex flex-col gap-5">
        {/* Overall */}
        <div className="flex items-center gap-5">
          <ScoreRing score={overall} />
          <div className="flex min-w-0 flex-col items-start gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">
              Overall score
            </span>
            <RatingBadge rating={ratingForScore(overall)} />
            <span className="text-xs text-gray-500">
              Across {scored.length} finalized {scored.length === 1 ? 'appraisal' : 'appraisals'}
            </span>
          </div>
        </div>

        {/* Cycle */}
        <div className="flex flex-col gap-3 rounded-xl border border-gray-100 bg-gray-50/60 p-4">
          <SearchSelect
            label="Cycle"
            size="sm"
            clearable={false}
            options={scored.map((f) => ({ value: f.cycle.id, label: f.cycle.title }))}
            value={selected.cycle.id}
            onChange={setCycleId}
          />
          <div className="flex items-end justify-between gap-3">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                Cycle score
              </span>
              <RatingBadge rating={ratingForScore(selected.score)} />
            </div>
            <span className="text-3xl font-bold leading-none text-gray-900">{selected.score}%</span>
          </div>
        </div>

        {/* Goals */}
        <div className="flex flex-col gap-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">
            Goal scores
          </span>
          {byGoal.map(({ goal, score }) => (
            <div key={goal.id} className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: colorFor(score) }}
                  />
                  <span className="truncate text-sm text-gray-700">{goal.name}</span>
                </span>
                <span className="shrink-0 text-sm font-semibold text-gray-900">{score}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${score}%`, backgroundColor: colorFor(score) }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </SectionCard>
  );
}

const RATING_COLORS: Record<FinalRating, string> = {
  Outstanding: '#16a34a',
  'Very Good': '#2563eb',
  Good: '#0891b2',
  Satisfactory: '#f59e0b',
  'Needs Improvement': '#dc2626',
};

const colorFor = (score: number) => RATING_COLORS[ratingForScore(score) ?? 'Needs Improvement'];

/** A circular gauge of a percentage, in the colour of its rating. */
function ScoreRing({ score }: { score: number }) {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(100, Math.max(0, score));
  return (
    <div className="relative h-28 w-28 shrink-0">
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          strokeWidth="9"
          className="stroke-gray-100"
        />
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          strokeWidth="9"
          strokeLinecap="round"
          stroke={colorFor(score)}
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - clamped / 100)}
          className="transition-all duration-700"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-2xl font-bold text-gray-900">
        {score}%
      </span>
    </div>
  );
}
