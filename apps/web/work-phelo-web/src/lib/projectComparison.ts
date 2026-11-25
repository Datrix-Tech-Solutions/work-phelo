import { retainerMonths } from '@/lib/projectPricing';
import type { ProjectPricing } from '@/types/hr';

/** What a project that isn't billed by time charges for, to set against the time spent on it. */
export interface PlannedWork {
  amount: number;
  /** The estimate, when the project has one. */
  hours?: number;
  /** What the amount is, e.g. "the price". */
  basis: string;
}

/** The retainer months begun by today, never more than the project runs for. */
export function retainerMonthsElapsed(startDate?: string, endDate?: string, today = new Date()) {
  if (!startDate) return 0;
  const days = (today.getTime() - new Date(startDate).getTime()) / 86_400_000;
  if (Number.isNaN(days) || days < 0) return 0;
  const begun = Math.floor(days / 30.4375) + 1;
  const total = retainerMonths(startDate, endDate);
  return total === null ? begun : Math.min(begun, total);
}

/** The planned side of the comparison; null for a project billed by time, whose invoices follow it. */
export function plannedWork(
  pricing: ProjectPricing,
  startDate?: string,
  endDate?: string,
  today = new Date(),
): PlannedWork | null {
  switch (pricing.type) {
    case 'TIMED':
      return null;
    case 'FLAT_RATE':
      return { amount: pricing.price, hours: pricing.estimatedHours, basis: 'the price' };
    case 'MILESTONE':
      return {
        amount: pricing.milestones.reduce((sum, m) => sum + m.amount, 0),
        hours: pricing.estimatedHours,
        basis: 'the milestone total',
      };
    case 'RETAINER': {
      const months = retainerMonthsElapsed(startDate, endDate, today);
      return {
        amount: months * pricing.monthlyAmount,
        hours: pricing.estimatedHours ? months * pricing.estimatedHours : undefined,
        basis: `the retainer for ${months} ${months === 1 ? 'month' : 'months'} so far`,
      };
    }
  }
}
