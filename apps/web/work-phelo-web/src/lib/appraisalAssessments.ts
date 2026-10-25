import type { Assessment, AssessmentStatus } from '@/store/appraisalAssessments.store';
import type { EmployeeObjective } from '@/store/employeeObjectives.store';
import type { Goal, LocalCycle } from '@/store/appraisalGoals.store';
import { DEFAULT_PERFORMANCE_BANDS, type FinalRating } from '@/types/hr';

export const RATING_MAX = 5;

export const STATUS_LABELS: Record<AssessmentStatus, string> = {
  NOT_STARTED: 'Not started',
  SELF_SUBMITTED: 'Awaiting manager',
  MANAGER_SUBMITTED: 'Awaiting HR',
  FINALIZED: 'Completed',
};

export const STATUS_STYLES: Record<AssessmentStatus, { dot: string; text: string }> = {
  NOT_STARTED: { dot: 'bg-blue-500', text: 'text-blue-600' },
  SELF_SUBMITTED: { dot: 'bg-amber-400', text: 'text-amber-500' },
  MANAGER_SUBMITTED: { dot: 'bg-purple-400', text: 'text-purple-600' },
  FINALIZED: { dot: 'bg-green-500', text: 'text-green-600' },
};

const dayOf = (iso: string) => iso.slice(0, 10);

/** The local calendar day of a timestamp, as YYYY-MM-DD. */
function localDay(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** When the cycle stopped counting new objectives: its end date, or the day it was closed or cancelled if sooner. */
function lastDay(cycle: LocalCycle) {
  const end = dayOf(cycle.endDate);
  const stopped = cycle.closedAt ?? cycle.cancelledAt;
  return stopped && stopped < end ? stopped : end;
}

/** Whether the objective was added while the cycle's dates were running. Older objectives with no date always count. */
export function objectiveInCycle(objective: EmployeeObjective, cycle: LocalCycle) {
  if (!objective.createdAt) return true;
  const day = localDay(objective.createdAt);
  return day >= dayOf(cycle.startDate) && day <= lastDay(cycle);
}

/** The cycles that count this objective: they run its goal and were still running when it was added. */
export function cyclesForObjective(objective: EmployeeObjective, cycles: LocalCycle[]) {
  return cycles.filter(
    (c) => c.goalIds.includes(objective.goalId) && objectiveInCycle(objective, c),
  );
}

/** Other live cycles that run one of these goals during any of the given dates. */
export function overlappingCycles(
  cycles: LocalCycle[],
  goalIds: string[],
  startDate: string,
  endDate: string,
  ignoreId?: string,
) {
  if (!startDate || !endDate) return [];
  return cycles.filter(
    (c) =>
      c.id !== ignoreId &&
      c.status !== 'CANCELLED' &&
      c.goalIds.some((id) => goalIds.includes(id)) &&
      dayOf(c.startDate) <= endDate &&
      dayOf(c.endDate) >= startDate,
  );
}

/**
 * The goals the cycle runs, each with the employee's objectives under it. Only objectives added
 * during the cycle's dates count, and goals with none are left out. Once the employee has
 * submitted, the objectives they rated are the ones that stay.
 */
export function goalsWithObjectives(
  cycle: LocalCycle,
  goals: Goal[],
  objectives: EmployeeObjective[],
  employeeId: string,
  assessment?: Assessment,
) {
  const locked = assessment && assessment.status !== 'NOT_STARTED';
  return cycle.goalIds
    .map((goalId) => goals.find((g) => g.id === goalId))
    .filter((g): g is Goal => !!g)
    .map((goal) => ({
      goal,
      objectives: objectives.filter(
        (o) =>
          o.employeeId === employeeId &&
          o.goalId === goal.id &&
          (locked ? o.id in assessment.selfRatings : objectiveInCycle(o, cycle)),
      ),
    }))
    .filter((entry) => entry.objectives.length > 0);
}

/**
 * The overall score as a percentage: each objective's self and manager ratings are blended by its
 * goal's weights, then averaged. Null until the manager has rated.
 */
export function overallScore(
  assessment: Assessment,
  entries: ReturnType<typeof goalsWithObjectives>,
): number | null {
  if (assessment.status !== 'MANAGER_SUBMITTED' && assessment.status !== 'FINALIZED') return null;
  const scores = entries.flatMap(({ goal, objectives }) =>
    objectives.map((o) => {
      const self = assessment.selfRatings[o.id]?.score ?? 0;
      const manager = assessment.managerRatings[o.id]?.score ?? 0;
      return (self * goal.selfAssessmentWeight + manager * goal.managerAssessmentWeight) / 100;
    }),
  );
  if (scores.length === 0) return null;
  const average = scores.reduce((sum, s) => sum + s, 0) / scores.length;
  return Math.round((average / RATING_MAX) * 100);
}

type Entries = ReturnType<typeof goalsWithObjectives>;

/** One side's average rating as a percentage of the top rating; null when nothing is rated. */
function sidePct(ratings: Assessment['selfRatings'], entries: Entries): number | null {
  const scores = entries.flatMap((e) => e.objectives.map((o) => ratings[o.id]?.score ?? 0));
  const rated = entries.flatMap((e) => e.objectives).filter((o) => ratings[o.id]?.score);
  if (scores.length === 0 || rated.length === 0) return null;
  return Math.round((scores.reduce((sum, s) => sum + s, 0) / scores.length / RATING_MAX) * 100);
}

export const selfScorePct = (a: Assessment, entries: Entries) => sidePct(a.selfRatings, entries);
export const managerScorePct = (a: Assessment, entries: Entries) =>
  sidePct(a.managerRatings, entries);

export const RATINGS: FinalRating[] = [
  'Outstanding',
  'Very Good',
  'Good',
  'Satisfactory',
  'Needs Improvement',
];

export function ratingForScore(score: number | null): FinalRating | undefined {
  if (score === null) return undefined;
  return (
    DEFAULT_PERFORMANCE_BANDS.find((b) => score >= b.minPercent && score <= b.maxPercent)?.rating ??
    'Needs Improvement'
  );
}

/** Each goal's score in the assessment: its objectives' blended ratings, averaged, as a percentage. */
export function goalScores(assessment: Assessment, entries: Entries) {
  return entries.map(({ goal, objectives }) => {
    const blended = objectives.map((o) => {
      const self = assessment.selfRatings[o.id]?.score ?? 0;
      const manager = assessment.managerRatings[o.id]?.score ?? 0;
      return (self * goal.selfAssessmentWeight + manager * goal.managerAssessmentWeight) / 100;
    });
    const average = blended.reduce((sum, s) => sum + s, 0) / blended.length;
    return { goal, score: Math.round((average / RATING_MAX) * 100) };
  });
}
