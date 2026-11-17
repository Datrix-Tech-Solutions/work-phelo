import type { Goal, PerformanceGroup } from '@/types/appraisal';

/** How many of the group's people a goal includes. */
export function goalCoverage(goal: Goal, memberIds: string[]) {
  return {
    covered: memberIds.filter((id) => goal.employeeIds.includes(id)).length,
    total: memberIds.length,
  };
}

/**
 * What one person's goals weigh, as goal id to percentage, totalling 100. A goal the person is not
 * on is left out and the group's weights for the goals they do have are rescaled to 100.
 * Empty when the person is on none of the group's goals.
 */
export function effectiveWeights(
  group: PerformanceGroup,
  goals: Goal[],
  employeeId: string,
): Record<string, number> {
  const own = group.goals.filter((g) =>
    goals.find((x) => x.id === g.goalId)?.employeeIds.includes(employeeId),
  );
  const total = weightTotal(own);
  if (total <= 0) return {};
  return Object.fromEntries(own.map((g) => [g.goalId, (g.weight / total) * 100]));
}

export const weightTotal = (goals: { weight: number }[]) =>
  goals.reduce((sum, g) => sum + (Number.isFinite(g.weight) ? g.weight : 0), 0);

/** Splits 100 across n goals, the remainder going to the first ones. */
export function evenWeights(n: number): number[] {
  if (n === 0) return [];
  const base = Math.floor(100 / n);
  const extra = 100 - base * n;
  return Array.from({ length: n }, (_, i) => base + (i < extra ? 1 : 0));
}

/** What is wrong with a saved group now. A goal only some members are on is not a problem; it is rescaled. */
export function groupProblems(group: PerformanceGroup, goals: Goal[]): string[] {
  const problems: string[] = [];
  for (const { goalId } of group.goals) {
    if (!goals.some((g) => g.id === goalId)) problems.push('A goal in this group no longer exists');
  }
  for (const id of group.employeeIds) {
    if (Object.keys(effectiveWeights(group, goals, id)).length === 0) {
      problems.push('Someone in this group is on none of its goals');
      break;
    }
  }
  if (weightTotal(group.goals) !== 100) problems.push('Weights do not total 100');
  return problems;
}

/** The other groups that already include any of these people. */
export function groupsSharingPeople(
  groups: PerformanceGroup[],
  employeeIds: string[],
  ignoreId?: string,
) {
  return groups
    .filter((g) => g.id !== ignoreId)
    .map((g) => ({ group: g, shared: g.employeeIds.filter((id) => employeeIds.includes(id)) }))
    .filter((x) => x.shared.length > 0);
}
