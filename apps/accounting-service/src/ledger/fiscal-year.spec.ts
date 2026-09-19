import { FiscalPeriodStatus as S } from '../../prisma/generated/client';
import {
  deriveFiscalYearStatus,
  fiscalYearName,
  summarizeFiscalYear,
} from './fiscal-year';

describe('fiscal year helpers', () => {
  describe('deriveFiscalYearStatus', () => {
    it.each([
      [[], S.OPEN],
      [[S.OPEN, S.OPEN], S.OPEN],
      // one open month keeps the whole year open, however many are closed
      [[S.CLOSED, S.CLOSED, S.OPEN], S.OPEN],
      [[S.SOFT_CLOSED, S.OPEN, S.LOCKED], S.OPEN],
      [[S.CLOSED, S.SOFT_CLOSED, S.LOCKED], S.SOFT_CLOSED],
      [[S.CLOSED, S.CLOSED], S.CLOSED],
      [[S.CLOSED, S.LOCKED], S.CLOSED],
      [[S.LOCKED, S.LOCKED], S.LOCKED],
    ])('%j → %s', (statuses, expected) => {
      expect(deriveFiscalYearStatus(statuses)).toBe(expected);
    });
  });

  describe('fiscalYearName', () => {
    it('uses the plain year for a January start', () => {
      expect(fiscalYearName(2026, 1)).toBe('FY2026');
    });

    it('spans two years for any other start month', () => {
      expect(fiscalYearName(2026, 7)).toBe('FY2026/27');
      expect(fiscalYearName(2099, 4)).toBe('FY2099/00');
    });
  });

  describe('summarizeFiscalYear', () => {
    it('reports derived status and how many periods are closed or locked', () => {
      const summary = summarizeFiscalYear(
        {
          id: 'y1',
          name: 'FY2026',
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-12-31'),
          createdAt: new Date('2025-12-01'),
        },
        [
          { status: S.LOCKED },
          { status: S.CLOSED },
          { status: S.SOFT_CLOSED },
          { status: S.OPEN },
        ],
      );

      expect(summary).toMatchObject({
        id: 'y1',
        name: 'FY2026',
        status: S.OPEN,
        periodCount: 4,
        closedPeriodCount: 2,
      });
    });
  });
});
