const DAY_MS = 86_400_000;

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/** Whole calendar days from today to a date: positive ahead of it, 0 on the day, negative once past. */
export function daysFromToday(date: Date | string, now: Date = new Date()): number {
  return Math.round((startOfDay(new Date(date)).getTime() - startOfDay(now).getTime()) / DAY_MS);
}

export function describeDaysUntil(daysUntil: number): string {
  if (daysUntil === 0) return 'due today';
  if (daysUntil === 1) return 'due tomorrow';
  if (daysUntil > 1) return `due in ${daysUntil} days`;
  const late = -daysUntil;
  return `overdue by ${late} ${late === 1 ? 'day' : 'days'}`;
}
