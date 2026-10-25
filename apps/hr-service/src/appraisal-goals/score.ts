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
