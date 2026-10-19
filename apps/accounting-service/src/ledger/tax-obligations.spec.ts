import { TaxPayFrequency } from '../../prisma/generated/client';
import {
  dueDateFor,
  latestCompletedPeriod,
  remindFrom,
} from './tax-obligations';

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

describe('latestCompletedPeriod', () => {
  it('is the previous calendar month for a monthly tax', () => {
    const period = latestCompletedPeriod(
      TaxPayFrequency.MONTHLY,
      new Date(2026, 9, 5),
      1,
    );
    expect([ymd(period.start), ymd(period.end)]).toEqual([
      '2026-09-01',
      '2026-09-30',
    ]);
  });

  it('crosses the year end', () => {
    const period = latestCompletedPeriod(
      TaxPayFrequency.MONTHLY,
      new Date(2026, 0, 10),
      1,
    );
    expect([ymd(period.start), ymd(period.end)]).toEqual([
      '2025-12-01',
      '2025-12-31',
    ]);
  });

  it('follows calendar quarters when the fiscal year starts in January', () => {
    const period = latestCompletedPeriod(
      TaxPayFrequency.QUARTERLY,
      new Date(2026, 9, 5),
      1,
    );
    expect([ymd(period.start), ymd(period.end)]).toEqual([
      '2026-07-01',
      '2026-09-30',
    ]);
  });

  it('follows fiscal quarters when the fiscal year starts in April', () => {
    const period = latestCompletedPeriod(
      TaxPayFrequency.QUARTERLY,
      new Date(2026, 9, 5),
      4,
    );
    expect([ymd(period.start), ymd(period.end)]).toEqual([
      '2026-07-01',
      '2026-09-30',
    ]);
    const february = latestCompletedPeriod(
      TaxPayFrequency.QUARTERLY,
      new Date(2026, 1, 5),
      4,
    );
    expect([ymd(february.start), ymd(february.end)]).toEqual([
      '2025-10-01',
      '2025-12-31',
    ]);
  });

  it('is the previous fiscal year for a yearly tax', () => {
    const period = latestCompletedPeriod(
      TaxPayFrequency.YEARLY,
      new Date(2026, 9, 5),
      4,
    );
    expect([ymd(period.start), ymd(period.end)]).toEqual([
      '2025-04-01',
      '2026-03-31',
    ]);
  });
});

describe('dueDateFor', () => {
  const end = new Date(2026, 8, 30);

  it('uses the chosen day of the next month', () => {
    const due = dueDateFor(end, {
      dueDay: 15,
      dueOnLastDay: false,
      daysBefore: 3,
    });
    expect(ymd(due)).toBe('2026-10-15');
  });

  it('uses the last day of the next month', () => {
    const due = dueDateFor(end, {
      dueDay: null,
      dueOnLastDay: true,
      daysBefore: 3,
    });
    expect(ymd(due)).toBe('2026-10-31');
  });

  it('rolls into the next year', () => {
    const due = dueDateFor(new Date(2026, 11, 31), {
      dueDay: 15,
      dueOnLastDay: false,
      daysBefore: 3,
    });
    expect(ymd(due)).toBe('2027-01-15');
  });
});

describe('remindFrom', () => {
  it('counts back from the due date', () => {
    const from = remindFrom(new Date(2026, 9, 15), {
      dueDay: 15,
      dueOnLastDay: false,
      daysBefore: 3,
    });
    expect(ymd(from)).toBe('2026-10-12');
  });
});
