const DAY_MS = 86_400_000;

export const startOfUtcDay = (date: Date) =>
  Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());

export interface CycleWindow {
  startDate: Date;
  endDate: Date;
}

/** The moments (start inclusive, end exclusive) in which an objective's linkedAt counts for the cycle. The end date counts as a whole day. */
export function cycleWindowBounds(cycle: CycleWindow) {
  return {
    from: new Date(startOfUtcDay(cycle.startDate)),
    to: new Date(startOfUtcDay(cycle.endDate) + DAY_MS),
  };
}

/** Whether the objective was attached to its goal while the cycle's dates were running. Days are UTC until tenants carry a timezone. */
export function linkedInCycleWindow(
  linkedAt: Date | null,
  cycle: CycleWindow,
): boolean {
  if (!linkedAt) return false;
  const { from, to } = cycleWindowBounds(cycle);
  return linkedAt >= from && linkedAt < to;
}
