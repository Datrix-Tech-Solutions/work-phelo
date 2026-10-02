import { BudgetPeriod } from '../../prisma/generated/client';
import {
  budgetEndDate,
  dayAfter,
  parseBudgetDate,
  toDateOnly,
} from './budget-period';

const end = (period: BudgetPeriod, start: string) =>
  toDateOnly(budgetEndDate(period, new Date(`${start}T00:00:00.000Z`)));

describe('budget period', () => {
  it('ends a monthly budget on the last day of its month', () => {
    expect(end('MONTHLY', '2026-01-01')).toBe('2026-01-31');
    expect(end('MONTHLY', '2026-02-01')).toBe('2026-02-28');
    expect(end('MONTHLY', '2028-02-01')).toBe('2028-02-29');
  });

  it('ends quarterly and yearly budgets one period later, minus a day', () => {
    expect(end('QUARTERLY', '2026-01-01')).toBe('2026-03-31');
    expect(end('QUARTERLY', '2026-10-01')).toBe('2026-12-31');
    expect(end('YEARLY', '2026-01-01')).toBe('2026-12-31');
    expect(end('YEARLY', '2026-07-01')).toBe('2027-06-30');
  });

  it('clamps a start day the target month does not have', () => {
    expect(end('MONTHLY', '2026-01-31')).toBe('2026-02-27');
  });

  it('parses only real YYYY-MM-DD dates', () => {
    expect(toDateOnly(parseBudgetDate('2026-03-15')!)).toBe('2026-03-15');
    expect(parseBudgetDate('2026-02-31')).toBeNull();
    expect(parseBudgetDate('not-a-date')).toBeNull();
  });

  it('gives an exclusive upper bound one day after the end date', () => {
    expect(toDateOnly(dayAfter(new Date('2026-12-31T00:00:00.000Z')))).toBe(
      '2027-01-01',
    );
  });
});
