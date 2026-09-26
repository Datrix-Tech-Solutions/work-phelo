import { addDaysIso, sameDayLastYear } from '@/lib/accounting/profitAndLoss';

export type BalanceCompareMode =
  | 'none'
  | 'previous-month-end'
  | 'previous-year-end'
  | 'same-date-last-year';

export const BALANCE_COMPARE_LABELS: Record<BalanceCompareMode, string> = {
  none: 'No comparison',
  'previous-month-end': 'Previous month-end',
  'previous-year-end': 'Previous year-end',
  'same-date-last-year': 'Same date last year',
};

type FiscalYearSpan = { startDate: string; endDate: string };

const isoDate = (value: string) => value.slice(0, 10);

function containingYear(asOf: string, years: FiscalYearSpan[]) {
  return years.find((year) => isoDate(year.startDate) <= asOf && asOf <= isoDate(year.endDate));
}

/**
 * Start of the fiscal year the date falls in. Profit earned since then hasn't been closed into
 * retained earnings yet, so it is added to equity on the balance sheet. With no fiscal year
 * covering the date it falls back to 1 January.
 */
export function fiscalYearStart(asOf: string, years: FiscalYearSpan[]) {
  const year = containingYear(asOf, years);
  return year ? isoDate(year.startDate) : `${asOf.slice(0, 4)}-01-01`;
}

/** The as-at date the current one is compared against, or null when not comparing. */
export function comparativeAsOf(
  asOf: string,
  mode: BalanceCompareMode,
  hints: {
    years: FiscalYearSpan[];
    /** End of the fiscal month before the picked one, when a fiscal month was picked. */
    previousFiscalMonthEnd: string | null;
  },
) {
  switch (mode) {
    case 'none':
      return null;
    case 'same-date-last-year':
      return sameDayLastYear(asOf);
    case 'previous-month-end':
      // The day before the 1st of this month is the last day of the previous one.
      return hints.previousFiscalMonthEnd ?? addDaysIso(`${asOf.slice(0, 7)}-01`, -1);
    case 'previous-year-end': {
      const year = containingYear(asOf, hints.years);
      return year
        ? addDaysIso(isoDate(year.startDate), -1)
        : `${Number(asOf.slice(0, 4)) - 1}-12-31`;
    }
  }
}
