export const RATING_MAX = 5;

export type ObjectiveRatings = Record<string, { score: number }>;

export interface ScoreEntry {
  goal: { selfAssessmentWeight: number; managerAssessmentWeight: number };
  objectives: { id: string }[];
}

const pct = (average: number) => Math.round((average / RATING_MAX) * 100);

/** One side's average rating as a percentage of the top rating; null when nothing is rated. */
export function sideScore(
  entries: ScoreEntry[],
  ratings: ObjectiveRatings,
): number | null {
  const objectives = entries.flatMap((e) => e.objectives);
  const rated = objectives.filter((o) => ratings[o.id]?.score);
  if (objectives.length === 0 || rated.length === 0) return null;
  const total = objectives.reduce(
    (sum, o) => sum + (ratings[o.id]?.score ?? 0),
    0,
  );
  return pct(total / objectives.length);
}

/** Each objective's self and manager ratings blended by its goal's weights, averaged, as a percentage. */
export function overallScore(
  entries: ScoreEntry[],
  self: ObjectiveRatings,
  manager: ObjectiveRatings,
): number | null {
  const blended = entries.flatMap(({ goal, objectives }) =>
    objectives.map(
      (o) =>
        ((self[o.id]?.score ?? 0) * goal.selfAssessmentWeight +
          (manager[o.id]?.score ?? 0) * goal.managerAssessmentWeight) /
        100,
    ),
  );
  if (blended.length === 0) return null;
  return pct(blended.reduce((sum, s) => sum + s, 0) / blended.length);
}

export interface WeightedScoreEntry extends ScoreEntry {
  goal: ScoreEntry['goal'] & { id: string };
}

/**
 * The overall score when the person's group weights the goals: each goal's score (its objectives'
 * blended ratings, averaged) is weighted by `weights` (goal id to weight). A goal with no weight, or
 * no objectives, is left out and the rest are rescaled, so a person who lacks one of the group's
 * goals is still scored out of 100. Null when no goal has a weight.
 */
export function weightedOverallScore(
  entries: WeightedScoreEntry[],
  self: ObjectiveRatings,
  manager: ObjectiveRatings,
  weights: Record<string, number>,
): number | null {
  let total = 0;
  let sum = 0;
  for (const { goal, objectives } of entries) {
    const weight = weights[goal.id] ?? 0;
    if (weight <= 0 || objectives.length === 0) continue;
    const blended = objectives.map(
      (o) =>
        ((self[o.id]?.score ?? 0) * goal.selfAssessmentWeight +
          (manager[o.id]?.score ?? 0) * goal.managerAssessmentWeight) /
        100,
    );
    const average = blended.reduce((a, b) => a + b, 0) / blended.length;
    // Rounded per goal as the web does, so the server and the screen agree to the point.
    sum += pct(average) * weight;
    total += weight;
  }
  return total > 0 ? Math.round(sum / total) : null;
}
