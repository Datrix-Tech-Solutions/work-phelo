import type {
  Assessment,
  AssessmentEntry,
  AssessmentStatus,
  EmployeeObjective,
  GoalCycle,
} from '@/types/appraisal';
import type { FinalRating } from '@/types/hr';

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

/** The calendar day of a timestamp, as YYYY-MM-DD. Days are UTC, as on the server. */
const utcDay = (iso: string) => new Date(iso).toISOString().slice(0, 10);

/** Whether the objective was linked to its goal while the cycle's dates were running. An objective with no goal never counts. */
export function objectiveInCycle(objective: EmployeeObjective, cycle: GoalCycle) {
  if (!objective.linkedAt) return false;
  const day = utcDay(objective.linkedAt);
  return day >= dayOf(cycle.startDate) && day <= dayOf(cycle.endDate);
}

/** The cycles that count this objective: they run its goal and were running when it was linked. Cancelled cycles are void. */
export function cyclesForObjective(objective: EmployeeObjective, cycles: GoalCycle[]) {
  return cycles.filter(
    (c) =>
      c.status !== 'CANCELLED' &&
      !!objective.goalId &&
      c.goalIds.includes(objective.goalId) &&
      objectiveInCycle(objective, c),
  );
}

/** Other live cycles that run one of these goals during any of the given dates. */
export function overlappingCycles(
  cycles: GoalCycle[],
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
 * The overall score as a percentage: each objective's self and manager ratings are blended by its
 * goal's weights, then averaged. Null until the manager has rated.
 */
export function overallScore(assessment: Assessment, entries: AssessmentEntry[]): number | null {
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

type Entries = AssessmentEntry[];

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

/** The lowest percentage for each rating above Needs Improvement; set under appraisal settings. */
export interface RatingThresholds {
  outstanding: number;
  veryGood: number;
  good: number;
  satisfactory: number;
}

export const DEFAULT_THRESHOLDS: RatingThresholds = {
  outstanding: 90,
  veryGood: 80,
  good: 70,
  satisfactory: 60,
};

export function ratingForScore(
  score: number | null,
  thresholds: RatingThresholds = DEFAULT_THRESHOLDS,
): FinalRating | undefined {
  if (score === null) return undefined;
  if (score >= thresholds.outstanding) return 'Outstanding';
  if (score >= thresholds.veryGood) return 'Very Good';
  if (score >= thresholds.good) return 'Good';
  if (score >= thresholds.satisfactory) return 'Satisfactory';
  return 'Needs Improvement';
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
