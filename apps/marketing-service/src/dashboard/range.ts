export const DAY_MS = 86_400_000;

/** Half-open [from, to): `to` is the day after the last day shown. */
export type Range = { from: Date; to: Date };

export const startOf = (value: string) => new Date(`${value}T00:00:00.000Z`);
export const toRange = (from: string, to: string): Range => ({
  from: startOf(from),
  to: new Date(startOf(to).getTime() + DAY_MS),
});
export const inRange = (at: Date, range: Range) =>
  at >= range.from && at < range.to;
