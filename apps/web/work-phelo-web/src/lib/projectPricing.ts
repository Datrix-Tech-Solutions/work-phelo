import type { ProjectBillingType, ProjectMilestone, ProjectPricing } from '@/types/hr';

/** Everything the pricing fields can hold while the form is open; only the ones for the chosen billing type are kept. */
export interface PricingDraft {
  price: number;
  hourlyRate: number;
  estimatedHours: number;
  monthlyAmount: number;
  milestones: ProjectMilestone[];
}

export const EMPTY_PRICING_DRAFT: PricingDraft = {
  price: 0,
  hourlyRate: 0,
  estimatedHours: 0,
  monthlyAmount: 0,
  milestones: [],
};

export const formatMoney = (n: number) =>
  `GHS ${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

/** Whole months from the start to the end date, at least one; null until both dates are set. */
export function retainerMonths(startDate?: string, endDate?: string): number | null {
  if (!startDate || !endDate) return null;
  const days = (new Date(endDate).getTime() - new Date(startDate).getTime()) / 86_400_000;
  if (Number.isNaN(days) || days < 0) return null;
  return Math.max(1, Math.round(days / 30.4375));
}

/** What the client is expected to pay, from the pricing fields; null when it can't be worked out yet. */
export function expectedValue(
  type: ProjectBillingType,
  draft: PricingDraft,
  startDate?: string,
  endDate?: string,
): number | null {
  switch (type) {
    case 'FLAT_RATE':
      return draft.price;
    case 'TIMED':
      return draft.hourlyRate * draft.estimatedHours;
    case 'MILESTONE':
      return draft.milestones.reduce((sum, m) => sum + m.amount, 0);
    case 'RETAINER': {
      const months = retainerMonths(startDate, endDate);
      return months === null ? null : months * draft.monthlyAmount;
    }
  }
}

/** The expected value of a saved pricing; null when it can't be worked out (a retainer with no end date). */
export function pricingExpectedValue(
  pricing: ProjectPricing,
  startDate?: string,
  endDate?: string,
): number | null {
  switch (pricing.type) {
    case 'FLAT_RATE':
      return pricing.price;
    case 'TIMED':
      return pricing.hourlyRate * pricing.estimatedHours;
    case 'MILESTONE':
      return pricing.milestones.reduce((sum, m) => sum + m.amount, 0);
    case 'RETAINER': {
      const months = retainerMonths(startDate, endDate);
      return months === null ? null : months * pricing.monthlyAmount;
    }
  }
}

/** The sum written out, e.g. "80 h × GHS 150". */
export function expectedValueNote(
  type: ProjectBillingType,
  draft: PricingDraft,
  startDate?: string,
  endDate?: string,
): string {
  switch (type) {
    case 'FLAT_RATE':
      return 'fixed price';
    case 'TIMED':
      return `${draft.estimatedHours} h × ${formatMoney(draft.hourlyRate)}`;
    case 'MILESTONE':
      return `sum of ${draft.milestones.length} ${draft.milestones.length === 1 ? 'milestone' : 'milestones'}`;
    case 'RETAINER': {
      const months = retainerMonths(startDate, endDate);
      return months === null
        ? 'set an end date to calculate'
        : `${months} ${months === 1 ? 'month' : 'months'} × ${formatMoney(draft.monthlyAmount)}`;
    }
  }
}

/** What's missing from the pricing for this billing type; undefined when it is complete. */
export function pricingError(
  type: ProjectBillingType,
  draft: PricingDraft,
  startDate?: string,
  endDate?: string,
): string | undefined {
  switch (type) {
    case 'FLAT_RATE':
      return draft.price > 0 ? undefined : 'Enter the price';
    case 'TIMED':
      return draft.hourlyRate > 0 && draft.estimatedHours > 0
        ? undefined
        : 'Enter the rate per hour and the estimated hours';
    case 'MILESTONE':
      return draft.milestones.length > 0 ? undefined : 'Add at least one milestone';
    case 'RETAINER':
      if (draft.monthlyAmount <= 0) return 'Enter the amount per month';
      return retainerMonths(startDate, endDate) === null
        ? 'Set a start and end date to work out the retainer'
        : undefined;
  }
}

/** The pricing to keep: only the fields that belong to the billing type. */
export function buildPricing(type: ProjectBillingType, draft: PricingDraft): ProjectPricing {
  switch (type) {
    case 'FLAT_RATE':
      return { type, price: draft.price };
    case 'TIMED':
      return { type, hourlyRate: draft.hourlyRate, estimatedHours: draft.estimatedHours };
    case 'MILESTONE':
      return { type, milestones: draft.milestones };
    case 'RETAINER':
      return { type, monthlyAmount: draft.monthlyAmount };
  }
}
