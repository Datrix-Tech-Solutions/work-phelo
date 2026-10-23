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

/** The goals the cycle runs, each with the employee's objectives under it. Goals with none are left out. */
export function goalsWithObjectives(
  cycle: LocalCycle,
  goals: Goal[],
  objectives: EmployeeObjective[],
  employeeId: string,
) {
  return cycle.goalIds
    .map((goalId) => goals.find((g) => g.id === goalId))
    .filter((g): g is Goal => !!g)
    .map((goal) => ({
      goal,
      objectives: objectives.filter((o) => o.employeeId === employeeId && o.goalId === goal.id),
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
